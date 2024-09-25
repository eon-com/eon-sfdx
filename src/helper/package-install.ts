/* eslint-disable complexity */
import PQueue from 'p-queue'
import {
  PackageCharacter,
  Package2Version,
  NamedPackageDirLarge,
  DeployError,
  ApexTestclassCheck,
  ApexClass,
  ApexTestQueueResult,
  ApexTestQueueItem,
  ApexTestResult,
  ApexCodeCoverageAggregate,
} from '../helper/types'
import {Duration} from '@salesforce/kit'
import EONLogger, {
  COLOR_SUCCESS,
  COLOR_INFO,
  COLOR_HEADER,
  COLOR_NOTIFY,
  COLOR_WARNING,
  COLOR_ERROR,
  COLOR_TRACE,
} from '../eon/EONLogger';
import {SfError, SfProject, Connection, StateAggregator, AuthInfo, Lifecycle} from '@salesforce/core'
import {Dictionary, Nullable} from '@salesforce/ts-types'
import {exit} from 'node:process'
import {ComponentSet, MetadataApiDeploy, MetadataResolver, DeployDetails} from '@salesforce/source-deploy-retrieve'
import {
  PackageInstallOptions,
  PackageInstallCreateRequest,
  SubscriberPackageVersion,
  PackageEvents,
  PackagingSObjects,
} from '@salesforce/packaging'
import PackageInstallRequest = PackagingSObjects.PackageInstallRequest
import Table from 'cli-table3'
import {promisify} from 'node:util'
import {exec as execCallback} from 'node:child_process'
import * as path from 'node:path'

export default class PackageInstall {
  private static instance: PackageInstall
  private runScripts: boolean = false
  private hasDepsChanges: boolean = false

  public static getInstance(): PackageInstall {
    if (!this.instance) {
      this.instance = new PackageInstall()
    }

    return this.instance
  }

  async run(
    packageMap: Map<string, PackageCharacter>,
    devHubAlias: string,
    orgAlias: string,
    runScripts: boolean,
  ): Promise<void> {
    this.runScripts = runScripts
    const project = await SfProject.resolve()
    const projectJson = project.getSfProjectJson()
    const json = projectJson.getContents()
    const packageAliases = project.getPackageAliases()
    const packageTrees = json.packageDirectories as NamedPackageDirLarge[]
    const packageVersionMap = new Map<string, string>()
    EONLogger.log(COLOR_HEADER(`💪 Put packages in queue and start deployment/installation process`))
    const q = new PQueue({concurrency: 1})
    for (const [packageName, packageCharacter] of packageMap) {
      if (packageCharacter.type !== 'unlocked') {
        EONLogger.log(
          COLOR_WARNING(
            `Found changes in package ${packageName}. 👆 Skipping validation because no unlocked package ( Found no package id )!`,
          ),
        )
        continue
      }

      q.add(() => this.printInstallationHeader(packageName, packageCharacter))
      // first try to install all deps
      for (const packageDep of packageCharacter.packageDeps) {
        if (
          packageVersionMap.has(packageDep.package) &&
          packageVersionMap.get(packageDep.package) === packageDep.versionNumber
        ) {
          continue
        } else {
          packageVersionMap.set(packageDep.package, packageDep.versionNumber!)
        }

        q.add(() =>
          this.installPackage(
            packageDep.package,
            packageDep.versionNumber!,
            packageAliases,
            devHubAlias,
            orgAlias,
            packageTrees,
            packageCharacter,
          )
            .then(async () => {
              // no output needed
            })
            .catch(async (error: SfError) => {
              await this.handlePackageError(packageDep.package, error.message)
            }),
        )
      }
      // always deploy the key package and run testclasses

      q.add(() =>
        this.installPackage(
          packageName,
          packageCharacter.versionNumber,
          packageAliases,
          devHubAlias,
          orgAlias,
          packageTrees,
          packageCharacter,
          true,
        )
          .then(async () => {
            // no output needed
          })
          .catch(async (error: SfError) => {
            await this.handlePackageError(packageName, error.message)
          }),
      )
    }

    Lifecycle.getInstance().on(PackageEvents.install.status, async (results: PackageInstallRequest) => {
      EONLogger.log(
        COLOR_TRACE(
          `⌛ Install package status: ${results.Status} SubscriberId: ${results.SubscriberPackageVersionKey}`,
        ),
      )
    })

    await q.onIdle()
    EONLogger.log(COLOR_HEADER(`Yippiee. 🤙 Validation finsihed without errors. Great 🤜🤛`))
  }

  private async installPackage(
    packageName: string,
    versionNumber: string,
    packageAliases: Nullable<Dictionary<string>>,
    devHubAlias: string,
    orgAlias: string,
    packageTrees: NamedPackageDirLarge[],
    packageCharacter: PackageCharacter,
    isKey = false,
  ): Promise<void> {
    const packageId = packageAliases?.[packageName]
    let packagePath = ''
    let preDeploymentScriptPath = ''
    let postDeploymentScriptPath = ''
    // unlocked packages needs a package id
    if (!packageId) {
      throw new SfError(
        `Found no package id for package ${packageName}. Contact support team to generate a package id for this package.`,
      )
    }

    for (const packageTree of packageTrees) {
      if (packageTree.package === packageName) {
        packagePath = packageTree.path
        preDeploymentScriptPath = packageTree.preDeploymentScript ?? ''
        postDeploymentScriptPath = packageTree.postDeploymentScript ?? ''
      }
    }

    if (!packagePath) {
      throw new SfError(
        `Found no package path for package ${packageName}. Please check your sfdx-project.json for ${packageName}`,
      )
    }

    if (versionNumber) {
      // check if version is valid
      const versions = versionNumber.split('.')
      if (versions.length !== 4) {
        throw new SfError(
          `Version number ${versionNumber} is not valid. Please check your sfdx-project.json for ${packageName}`,
        )
      }

      // need to run pre scripts
      if (this.runScripts && preDeploymentScriptPath && isKey) {
        EONLogger.log(COLOR_INFO(`☝ Found pre deployment script for dependency package ${packageName}`))
        await this.runDeploymentSteps(preDeploymentScriptPath, 'Pre Deployment', packageName, orgAlias)
      }
      // use package install job

      let isFoundOldVersion = false

      let package2Version = await this.getSubscriberPackageId(packageId, versionNumber, devHubAlias)

      if (
        !package2Version &&
        packageCharacter.targetTree?.dependencies &&
        Array.isArray(packageCharacter.targetTree?.dependencies) &&
        packageCharacter.targetTree?.dependencies.length > 0
      ) {
        const targetTreePck = packageCharacter.targetTree?.dependencies.find((a) => a.package === packageName)
        if (targetTreePck?.versionNumber) {
          package2Version = await this.getSubscriberPackageId(packageId, targetTreePck.versionNumber, devHubAlias)
          if (package2Version) {
            isFoundOldVersion = true
            EONLogger.log(COLOR_TRACE(`☝ Found update for child package ${packageName}`))
            EONLogger.log(
              COLOR_TRACE(
                `So first install the old version ${targetTreePck.versionNumber} from main branch and then deploy the package`,
              ),
            )
          }
        }
      }

      // when we found a deps change then we need to deploy the rest

      if (!this.hasDepsChanges) this.hasDepsChanges = !package2Version

      if (isKey) this.hasDepsChanges = !isKey

      await (package2Version && !isKey && !this.hasDepsChanges
        ? this.installPackageWithId(package2Version, orgAlias, packageName)
        : this.deployPackageFromPath(packageName, packagePath, orgAlias))

      if (isFoundOldVersion) await this.deployPackageFromPath(packageName, packagePath, orgAlias)

      // need to run post scripts
      if (this.runScripts && postDeploymentScriptPath && isKey) {
        EONLogger.log(COLOR_INFO(`☝ Found post deployment script for dependency package ${packageName}`))
        await this.runDeploymentSteps(postDeploymentScriptPath, 'Post Deployment', packageName, orgAlias)
      }

      if (isKey) {
        // run testclasses
        await this.getApexClassesFromPaths(packageName, packagePath, orgAlias)
      }
    }
  }

  private printInstallationHeader(packageName: string, packageCharacter: PackageCharacter): void {
    EONLogger.log(COLOR_INFO(`${COLOR_NOTIFY('Package:')} ${packageName}`))
    if (packageCharacter.packageDeps.length > 0) {
      const depsList: string[] = []
      for (const packageDep of packageCharacter.packageDeps) {
        depsList.push(packageDep.package)
      }

      EONLogger.log(`${COLOR_NOTIFY('Dependencies:')} ${COLOR_INFO(depsList.join(','))}`)
    }
  }

  private async handlePackageError(packageName: string, errorMessage: string): Promise<void> {
    EONLogger.log(COLOR_ERROR(`💥 Package ${packageName} runs on error!`))
    EONLogger.log(COLOR_ERROR(errorMessage))
    exit(1)
  }

  private async getSubscriberPackageId(
    packageVersionId: string,
    versionNumber: string,
    devHubAlias: string,
  ): Promise<Package2Version | null> {
    const stateAggregator = await StateAggregator.getInstance()
    const userName = stateAggregator.aliases.resolveUsername(devHubAlias)
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({username: userName}),
    })
    const versions = versionNumber.split('.')

    const query = `SELECT Id, SubscriberPackageVersionId FROM Package2Version WHERE Package2Id = '${packageVersionId}' AND MajorVersion = ${versions[0]} AND MinorVersion = ${versions[1]} AND PatchVersion = ${versions[2]} ORDER BY CreatedDate desc LIMIT 1`

    const response = await connection.tooling.query<Package2Version>(query)
    if (!response.records || response.records.length === 0) {
      return null
    }

    return response.records[0]
  }

  private async deployPackageFromPath(pck: string, path: string, orgAlias: string): Promise<void> {
    const stateAggregator = await StateAggregator.getInstance()
    const userName = stateAggregator.aliases.resolveUsername(orgAlias)
    const deploy: MetadataApiDeploy = await ComponentSet.fromSource(path).deploy({
      usernameOrConnection: userName,
    })
    // Attach a listener to check the deploy status on each poll
    let counter = 0
    deploy.onUpdate((response) => {
      if (counter === 5) {
        const {status, numberComponentsDeployed, numberComponentsTotal} = response
        const progress = `${numberComponentsDeployed}/${numberComponentsTotal}`
        const message = `⌛ Deploy Package: ${pck} Status: ${status} Progress: ${progress}`
        EONLogger.log(COLOR_TRACE(message))
        counter = 0
      } else {
        counter++
      }
    })

    // Wait for polling to finish and get the DeployResult object
    const res = await deploy.pollStatus()
    if (res?.response?.success) {
      EONLogger.log(COLOR_INFO(`✔ Deployment for Package ${pck} successfully 👌`))
    } else {
      await this.printDeployError(res.response.details)
    }
  }

  private async installPackageWithId(
    package2Version: Package2Version,
    orgAlias: string,
    packageName: string,
  ): Promise<void> {
    const stateAggregator = await StateAggregator.getInstance()
    const userName = stateAggregator.aliases.resolveUsername(orgAlias)
    const conn = await Connection.create({
      authInfo: await AuthInfo.create({username: userName}),
    })

    const options: PackageInstallOptions = {
      publishFrequency: Duration.milliseconds(20_000),
      publishTimeout: Duration.minutes(60),
      pollingFrequency: Duration.milliseconds(20_000),
      pollingTimeout: Duration.minutes(60),
    }
    const packageInstallRequest: PackageInstallCreateRequest = {
      ApexCompileType: 'package',
      SubscriberPackageVersionKey: package2Version.SubscriberPackageVersionId,
      UpgradeType: 'mixed-mode',
      SecurityType: 'None',
    }

    const subscriberPackageVersion = new SubscriberPackageVersion({
      connection: conn,
      aliasOrId: package2Version.SubscriberPackageVersionId,
      password: '',
    })

    EONLogger.log(
      COLOR_TRACE(`⌛ Install Package: ${packageName} SubscriberId: ${package2Version.SubscriberPackageVersionId}`),
    )

    const installResult = await subscriberPackageVersion.install(packageInstallRequest, options)
    if (installResult.Status === 'SUCCESS') {
      EONLogger.log(COLOR_INFO(`✔ Installation for Package ${packageName} successfully 👌`))
      return
    }

    if (
      installResult.Status === 'ERROR' &&
      installResult.Errors?.errors &&
      Array.isArray(installResult.Errors?.errors)
    ) {
      EONLogger.log(COLOR_ERROR(`Installation errors:`))
      let errorCounter = 1
      // eslint-disable-next-line no-unsafe-optional-chaining
      for (const error of installResult.Errors?.errors) {
        EONLogger.log(COLOR_ERROR(`${errorCounter}) ${error.message}`))
        errorCounter++
      }

      throw new SfError(
        `Error: Unable to install ${packageName}. Check errors above 👆. Tip! Wrong dependency version for example 🤔`,
      )
    }
  }

  private async printDeployError(input: DeployDetails): Promise<void> {
    const table = new Table({
      head: ['Component Name', 'Error Message'],
      colWidths: [60, 60], // Requires fixed column widths
      wordWrap: true,
    })
    // print deployment errors
    if (
      (Array.isArray(input.componentFailures) && input.componentFailures.length > 0) ||
      (typeof input.componentFailures === 'object' && Object.keys(input.componentFailures).length > 0)
    ) {
      let result: DeployError[] = []
      if (Array.isArray(input.componentFailures)) {
        result = input.componentFailures.map((a) => {
          const res: DeployError = {
            Name: a.fullName,
            Type: a.componentType ?? '',
            Status: a.problemType ?? '',
            Message: a.problem ?? '',
          }
          return res
        })
      } else {
        const res: DeployError = {
          Name: input.componentFailures.fullName,
          Type: input.componentFailures.componentType ?? '',
          Status: input.componentFailures.problemType ?? '',
          Message: input.componentFailures.problem ?? '',
        }
        result = [...result, res]
      }

      for (const r of result) {
        const obj: {[key: string]: string} = {}
        obj[r.Name] = r.Message
        table.push(obj)
      }

      console.log(table.toString())
      throw new SfError(`Deployment failed. Please check error messages from table and fix this issues from package.`)
      // print test run error
    } else {
      throw new SfError(
        `Validation failed. No errors in the response. Please validate manual and check the errors on org (setup -> deployment status).`,
      )
    }
  }

  private async runDeploymentSteps(scriptPath: string, scriptStep: string, packageName: string, alias: string) {
    EONLogger.log(COLOR_TRACE(`Execute deployment script`))
    EONLogger.log(`${COLOR_TRACE('Path:')} ${COLOR_TRACE(scriptPath)}`)
    const stateAggregator = await StateAggregator.getInstance()
    const userName = stateAggregator.aliases.resolveUsername(alias)
    const exec = promisify(execCallback)
    try {
      const cmdPrefix = process.platform === 'win32' ? 'cmd.exe /c' : 'sh -e'
      EONLogger.log(
        `${COLOR_TRACE(
          `Command: ${cmdPrefix} ${path.normalize(
            path.join(process.cwd(), scriptPath),
          )} ${packageName} ${userName} ${alias}`,
        )}`,
      )
      const {stdout, stderr} = await exec(
        `${cmdPrefix} ${path.normalize(path.join(process.cwd(), scriptPath))} ${packageName} ${userName} ${alias}`,
        {timeout: 0, encoding: 'utf8', maxBuffer: 5_242_880},
      )
      if (stderr) {
        EONLogger.log(COLOR_ERROR(`${scriptStep} Command Error: ${stderr}`))
      }

      if (stdout) {
        EONLogger.log(COLOR_INFO(`${scriptStep} Command Info: ${stdout}`))
      }
    } catch (error) {
      EONLogger.log(COLOR_ERROR(`${scriptStep} Command Error: ${error}`))
    }
  }

  private async getApexClassesFromPaths(pck: string, path: string, orgAlias: string): Promise<void> {
    EONLogger.log(COLOR_HEADER(`💪 Start Apex tests for package ${pck}.`))
    const apexTestClassIdList: string[] = []
    const apexClassIdList: string[] = []
    const apexTestClassNameList: string[] = []
    const resolver: MetadataResolver = new MetadataResolver()
    let queueIdList: string[] = []
    let testRunResult: ApexTestQueueResult
    let apexCounter: number = 0

    for (const component of resolver.getComponentsFromPath(path)) {
      if (component.type.id === 'apexclass') {
        apexCounter++
        // eslint-disable-next-line no-await-in-loop
        const apexCheckResult: ApexTestclassCheck = await this.checkIsTestClass(component.name, orgAlias)
        if (apexCheckResult.isTest) {
          apexTestClassIdList.push(apexCheckResult.Id)
          apexTestClassNameList.push(component.name)
        } else {
          apexClassIdList.push(apexCheckResult.Id)
        }
      }
    }

    if (apexCounter > 0 && apexTestClassNameList.length === 0) {
      throw new SfError(`Found apex class(es) for package ${pck} but no testclass(es). Please create a new testclass.`)
    }

    EONLogger.log(`${COLOR_NOTIFY('Package:')} ${COLOR_INFO(pck)}`)
    EONLogger.log(
      `${COLOR_NOTIFY('Testclasses:')} ${COLOR_INFO(
        `${apexTestClassNameList.length > 0 ? apexTestClassNameList.join(',') : 'No Testclasses found.'}`,
      )}`,
    )
    // insert Apex classes to test queue
    if (apexTestClassIdList.length > 0) {
      queueIdList = await this.addClassesToApexQueue(apexTestClassIdList, orgAlias)
    } else {
      return
    }

    // check test queue and wait for finish
    EONLogger.log(COLOR_INFO(`⌛ Waiting For test run results`))
    let _i: number = 2

    do {
      // eslint-disable-next-line no-await-in-loop
      testRunResult = await this.checkTestRunStatus(queueIdList, orgAlias)
      EONLogger.log(
        COLOR_TRACE(
          `Test Processing: ${testRunResult.ProcessingList.length}, Test Completed: ${testRunResult.CompletedList.length},Test Failed: ${testRunResult.FailedList.length} , Test Queued: ${testRunResult.QueuedList.length}`,
        ),
      )
      // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, 10_000))
      _i++
      if (_i > 360) {
        throw new Error('Apex test run timeout after 60 minutes')
      }
    } while (testRunResult.QueuedList.length > 0 || testRunResult.ProcessingList.length > 0)

    // check testrun result only for errors

    await this.checkTestResult(apexTestClassIdList, queueIdList, orgAlias)

    // check Code Coverage
    if (apexClassIdList.length > 0) {
      await this.checkCodeCoverage(apexClassIdList, orgAlias)
    }
  }

  // check if apex class is a testclass from code identifier @isTest

  private async checkIsTestClass(comp: string, orgAlias: string): Promise<ApexTestclassCheck> {
    const result: ApexTestclassCheck = {Id: '', isTest: false}
    const stateAggregator = await StateAggregator.getInstance()
    const userName = stateAggregator.aliases.resolveUsername(orgAlias)
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({username: userName}),
    })
    try {
      const apexObj: ApexClass = await connection.singleRecordQuery(
        "Select Id,Name,Body from ApexClass Where Name = '" + comp + "' And NamespacePrefix = null LIMIT 1",
        {tooling: true},
      )
      if (apexObj && (apexObj.Body.search('@isTest') > -1 || apexObj.Body.search('@IsTest') > -1)) {
        result.isTest = true
      }

      result.Id = apexObj.Id
    } catch (error) {
      throw new SfError(`Apex Query Error for Comp: ${comp} with detail error: ${error}`)
    }

    return result
  }

  private async addClassesToApexQueue(apexTestClassIdList: string[], orgAlias: string): Promise<string[]> {
    const recordResult: string[] = []
    const stateAggregator = await StateAggregator.getInstance()
    const userName = stateAggregator.aliases.resolveUsername(orgAlias)
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({username: userName}),
    })
    try {
      const queueResponse = await connection.requestPost(`${connection._baseUrl()}/tooling/runTestsAsynchronous/`, {
        classids: apexTestClassIdList.join(','),
      })
      const jobId: string = queueResponse ? Object.values(queueResponse).join('') : ''
      if (jobId) {
        recordResult.push(jobId)
      } else {
        throw new SfError(`Post Request to Queue runs on error`)
      }
    } catch (error) {
      throw new SfError(`Insert to queue runs on error: ${error}`)
    }

    return recordResult
  }

  private async checkTestRunStatus(ids: string[], orgAlias: string): Promise<ApexTestQueueResult> {
    const stateAggregator = await StateAggregator.getInstance()
    const userName = stateAggregator.aliases.resolveUsername(orgAlias)
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({username: userName}),
    })
    const queueResult: ApexTestQueueResult = {
      QueuedList: [],
      CompletedList: [],
      FailedList: [],
      ProcessingList: [],
      OtherList: [],
    }
    try {
      const responseFromOrg = await connection.tooling.query<ApexTestQueueItem>(
        `Select Id, ApexClassId,ApexClass.Name, Status, ExtendedStatus, ParentJobId, TestRunResultId from ApexTestQueueItem Where ParentJobId In ('${ids.join(
          "','",
        )}')`,
      )
      if (responseFromOrg.records) {
        for (const result of responseFromOrg.records) {
          switch (result.Status) {
            case 'Queued': {
              queueResult.QueuedList.push(result?.ApexClass?.Name)

              break
            }

            case 'Completed': {
              queueResult.CompletedList.push(result?.ApexClass?.Name)

              break
            }

            case 'Failed': {
              queueResult.FailedList.push(result?.ApexClass?.Name)

              break
            }

            case 'Processing': {
              queueResult.ProcessingList.push(result?.ApexClass?.Name)

              break
            }

            default: {
              queueResult.OtherList.push(result?.ApexClass?.Name)
            }
          }
        }
      }
    } catch (error) {
      console.log(error)
      throw new SfError('Found no testrun result on org')
    }

    return queueResult
  }

  private async checkTestResult(apexClassList: string[], jobId: string[], orgAlias: string): Promise<void> {
    const stateAggregator = await StateAggregator.getInstance()
    const userName = stateAggregator.aliases.resolveUsername(orgAlias)
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({username: userName}),
    })

    try {
      const responseFromOrg = await connection.query<ApexTestResult>(
        `Select ApexClass.Name, Outcome, MethodName, Message from ApexTestResult Where Outcome = 'Fail' And ApexClassId In ('${apexClassList.join(
          "','",
        )}') And AsyncApexJobId In ('${jobId.join("','")}')`,
      )

      const table = new Table({
        head: [COLOR_ERROR('ApexClass Name'), COLOR_ERROR('Methodname'), COLOR_ERROR('ErrorMessage')],
        colWidths: [60, 60, 60],
        wordWrap: true,
      })
      if (responseFromOrg.records.length > 0) {
        for (const result of responseFromOrg.records) {
          table.push([result.ApexClass.Name, result.MethodName, result.Message])
        }

        console.log(table.toString())
        EONLogger.log(COLOR_ERROR(`This package contains testclass errors.`))
        throw new SfError(`Please fix this issues from the table and try again.`)
      }
    } catch (error) {
      throw new SfError(`System Exception: Problems to found Results from ApexTestResult: ${error}`)
    }
  }

  private async checkCodeCoverage(ids: string[], orgAlias: string): Promise<void> {
    const stateAggregator = await StateAggregator.getInstance()
    const userName = stateAggregator.aliases.resolveUsername(orgAlias)
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({username: userName}),
    })
    const table = new Table({
      head: [
        COLOR_INFO('Apex Test Modul'),
        COLOR_INFO('NumLinesCovered'),
        COLOR_INFO('NumLinesUncovered'),
        COLOR_INFO('Coverage in Percent'),
      ],
    })
    let coveredCounter: number = 0
    let uncoveredCounter: number = 0
    let packageCoverage: number = 0
    try {
      const responseFromOrg = await connection.tooling.query<ApexCodeCoverageAggregate>(
        `Select ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered from ApexCodeCoverageAggregate Where ApexClassOrTriggerId In ('${ids.join(
          "','",
        )}')`,
      )
      if (responseFromOrg.records) {
        for (const result of responseFromOrg.records) {
          table.push([
            result.ApexClassOrTrigger.Name,
            result.NumLinesCovered,
            result.NumLinesUncovered,
            result.NumLinesCovered > 0
              ? Math.floor((result.NumLinesCovered / (result.NumLinesCovered + result.NumLinesUncovered)) * 100)
              : 0,
          ])
          coveredCounter += result.NumLinesCovered
          uncoveredCounter += result.NumLinesUncovered
        }
      }
    } catch (error) {
      throw new SfError(`System Exception: Problems to fetch results from ApexCodeCoverageAggregate: ${error}`)
    }

    if (coveredCounter === 0 && uncoveredCounter === 0) {
      EONLogger.log(COLOR_WARNING(`This package has no covered and uncovered lines. Please check the result. 👆`))
    } else {
      packageCoverage = Math.floor((coveredCounter / (coveredCounter + uncoveredCounter)) * 100)

      EONLogger.log(COLOR_INFO('Check Code Coverage for Testclasses:'))
      EONLogger.log(COLOR_INFO(table.toString()))
      if (packageCoverage < 75) {
        throw new SfError(
          `The package has an overall coverage of ${packageCoverage}%, which does not meet the required overall coverage of 75%. Please check the testclass coverage table and fix the test classes.`,
        )
      } else {
        EONLogger.log(COLOR_SUCCESS(`👏 Great. This package has a code coverage from ${packageCoverage}%. 😊`))
      }
    }
  }
}
