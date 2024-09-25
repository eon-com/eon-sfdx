import * as os from 'os';
import { Messages, SfError, SfProjectJson, Connection, ConfigAggregator, Org } from '@salesforce/core';
import { PackagePackageDir } from '@salesforce/schemas';
import { ComponentSet, MetadataApiDeploy, MetadataResolver, DeployDetails, ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { getDeployUrls } from '../../utils/get-packages';
import { DeployError, PackageTree } from '../../interfaces/package-interfaces';
import { AnyJson } from '@salesforce/ts-types';
import simplegit, { DiffResult, SimpleGit } from 'simple-git';
const util = require('util');
const exec = util.promisify(require('child_process').exec);
import {
  ApexCodeCoverageAggregate,
  ApexClass,
  NamedPackageDirLarge,
  ApexTestQueueItem,
  ApexTestQueueResult,
  ApexTestResult,
  PackageInfo,
  ApexTestclassCheck,
  CodeCoverageWarnings,
} from '../../helper/types';
import EONLogger, {
  COLOR_SUCCESS,
  COLOR_INFO,
  COLOR_KEY_MESSAGE,
  COLOR_HEADER,
  COLOR_NOTIFY,
  COLOR_WARNING,
  COLOR_ERROR,
  COLOR_TRACE,
} from '../../eon/EONLogger';
import path from 'path';
import Table from 'cli-table3';
import { UpsertResult, QueryResult } from 'jsforce';
import { LOGOBANNER } from '../../eon/logo';
import { Flags } from '@oclif/core';
import  EonCommand  from '../../EonCommand';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'validate');
const packageDeployMap = new Map<string, string>();

export default class Validate extends EonCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);


  static flags = {
    // Label For Named Credential as Required
    target: Flags.string({
      char: 't',
      description: messages.getMessage('targetFlag'),
      required: false,
    }),
    source: Flags.string({
      char: 's',
      description: messages.getMessage('sourceFlag'),
      required: false,
    }),
    deploymentscripts: Flags.boolean({
      char: 'd',
      description: messages.getMessage('scriptFlag'),
      default: false,
      required: false,
    }),
    package: Flags.string({
      char: 'p',
      description: messages.getMessage('packageFlag'),
      default: '',
      required: false,
    }),
    pooltag: Flags.string({
      char: 'g',
      description: messages.getMessage('poolFlag'),
      default: '',
      required: false,
    }),
    devhubalias: Flags.string({
      char: 'a',
      description: messages.getMessage('devAliasFlag'),
      default: '',
      required: false,
    }),
    onlytests: Flags.boolean({
      char: 'o',
      description: messages.getMessage('testclassFlag'),
      required: false,
    }),
    'target-org': Flags.string({
            char: 'u',
            aliases: ['targetusername', 'u'],
            description: 'Login username or alias for the target org.',
        }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  public async execute(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    EONLogger.log(COLOR_KEY_MESSAGE('Validating package(s)...'));
    EONLogger.log(COLOR_HEADER('Search for unlocked package changes'));
    // get sfdx project.json
    const projectJson: SfProjectJson = await this.project.retrieveSfProjectJson();
    const packageAliases = projectJson.getContents().packageAliases;
    let defaultUsername = '';

    if (!this.flags['target-org']) {
        defaultUsername = (await ConfigAggregator.create()).getPropertyValue('target-org');
        if (!defaultUsername) {
            throw new SfError(
                `Found no default target-org in your salesforce config file. Please provide a target-org with flag --target-org or set a default target-org on your local machine`
            );
        }
        EONLogger.log(COLOR_NOTIFY(`Using default target-org 👉 ${COLOR_INFO(defaultUsername)}`));
        this.org = await Org.create({ aliasOrUsername: defaultUsername });
    } else {
      EONLogger.log(COLOR_NOTIFY(`Using target-org 👉 ${COLOR_INFO(this.flags['target-org'])}`));
      this.org = await Org.create({ aliasOrUsername: this.flags['target-org'] });
    }

    if (this.flags.target && this.flags.package) {
      throw new SfError(`Either package or target flag can be used, not both`);
    }
    const json = projectJson.getContents();
    // get all packages
    let packageDirs: NamedPackageDirLarge[] = json.packageDirectories as NamedPackageDirLarge[];
    // get all diffs from current to target branch

    let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
    const sourcebranch = this.flags.source || 'HEAD';
    let includeForceApp = false;
    let changes: DiffResult;
    if (!this.flags.package) {
      changes = await git.diffSummary([`${this.flags.target}...${sourcebranch}`]);
      await git.fetch();
    }
    let table = new Table({
      head: [COLOR_NOTIFY('Package')],
    });
    const packageMap = new Map<string, NamedPackageDirLarge>();
    // check changed packages
    for (const pck of packageDirs) {
      let packageCheck = false;
      if (this.flags.package) {
        if (pck.package === this.flags.package) {
          if (!packageAliases[pck.package]) {
            EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${pck.package}`));
            continue;
          }
          packageMap.set(pck.package, pck);
          table.push([pck.package]);
          break;
        }
      }

      if (this.flags.target) {
        packageCheck = changes.files.some((change) => {
          if (
            path
              .join(path.dirname(projectJson.getPath()), path.normalize(change.file))
              .includes(path.normalize(pck.path))
          ) {
            return true;
          }
          //check for metadata move between packages
          if (change.file.search('=>') > -1) {
            if (change.file.search(`/${pck.package}/`) > -1) {
              return true;
            }
          }
        });
      }
      if (packageCheck) {
        //special checks for packages
        if (pck.ignoreOnStage?.includes('validate')) {
          //only packages without ignore flags
          EONLogger.log(
            COLOR_WARNING(
              `Found changes in package ${pck.package}. 👆 Skipping validation because ignoreOnStage flag in sfdx-project.json`
            )
          );
          continue;
        }

        if (pck.package === 'force-app') {
          EONLogger.log(COLOR_WARNING(`👆 No validation for this special source package: ${pck.package}`));
          includeForceApp = true;
          continue;
        }

        if (!packageAliases[pck.package]) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${pck.package}`));
          continue;
        }

        packageMap.set(pck.package, pck);
        table.push([pck.package]);
      }
    }

    if (packageMap.size === 0) {
      EONLogger.log(COLOR_NOTIFY(`✔ Found no unlocked packages with changes. Process finished without validation`));
      return {};
    }
    const packageMessage = this.flags.package ? `👉 Validate selected package:` : `👉 Following packages with changes:`;
    EONLogger.log(COLOR_NOTIFY(packageMessage));
    EONLogger.log(COLOR_INFO(table.toString()));

    if (packageMap.size === 0 && includeForceApp) {
      throw new SfError(
        `Validation failed. This merge request contains only data from the force-app folder. This folder is not part of the deployment.
Please put your changes in a (new) unlocked package or a (new) source package. THX`
      );
    }
    //fetch scratch org
    if (this.flags.pooltag) {
      if (!this.flags.devhubalias) {
        throw new SfError(`Please set a target devhub username flag when the pool tag is set. 👆`);
      }
      await this.fetchScratchOrg(this.flags.pooltag, this.flags.devhubalias);
    }
    //run validation tasks
    for (const [key, value] of packageMap) {
      //Start deploy process

      //Deploy Unlocked Package
      if (!this.flags.onlytests) {
        await this.deployPackageWithDependency(key, value.path);
      } else {
        EONLogger.log(COLOR_WARNING(`👆 No deployment, only testclass execution`));
      }

      //Run Tests
      await this.getApexClassesFromPaths(key, value.path);
    }
    EONLogger.log(COLOR_HEADER(`Yippiee. 🤙 Validation finsihed without errors. Great 🤜🤛`));
    return {};
  }

  private async deployPackageWithDependency(pck: string, path: string): Promise<void> {
    let pckList: string[] = [];
    let depList: string[] = [];
    EONLogger.log(COLOR_HEADER(`💪 Start deploy process`));

    const packageSingleMap = new Map<string, PackageInfo>();
    // get packages
    const projectJson: SfProjectJson = await this.project.retrieveSfProjectJson();

    const packageDependencyTree: PackageTree = getDeployUrls(projectJson, pck);
    packageDependencyTree.dependency.forEach((dep) => {
      if (dep.path && !packageDeployMap.get(dep.packagename)) {
        packageDeployMap.set(dep.packagename, `Dependency`);
        packageSingleMap.set(dep.packagename, {
          message: `Dependency`,
          path: dep.path,
          postDeploymentScript: dep.postDeploymentScript,
          preDeploymentScript: dep.preDeploymentScript,
        });
      }
    });
    if (!packageDeployMap.get(pck)) {
      packageDeployMap.set(pck, `Package`);
      packageSingleMap.set(pck, {
        message: `Package`,
        path: path,
        postDeploymentScript: packageDependencyTree.postDeploymentScript,
        preDeploymentScript: packageDependencyTree.preDeploymentScript,
      });
    }
    if (packageSingleMap.size > 0) {
      for (const [key, value] of packageSingleMap) {
        if (value.message === 'Package') {
          pckList.push(key);
        } else {
          depList.push(key);
        }
      }
      if (pckList.length > 0) {
        EONLogger.log(`${COLOR_NOTIFY('Package:')} ${COLOR_INFO(pckList.join())}`);
      }
      if (pckList.length > 0) {
        EONLogger.log(`${COLOR_NOTIFY('Dependencies:')} ${COLOR_INFO(depList.join())}`);
      }
      for (const [key, value] of packageSingleMap) {
        EONLogger.log(COLOR_INFO(`👉 Start deployment for package ${key}`));
        //execute pre deployment script for dependency
        if (value.preDeploymentScript && this.flags.deploymentscripts) {
          EONLogger.log(COLOR_INFO(`☝ Found pre deployment script for dependency package ${key}`));
          await this.runDeploymentSteps(value.preDeploymentScript, 'preDeployment', key);
        }
        await this.deployPackageTreeNode(key, value.path);
        //execute post deployment script for dependency
        if (value.postDeploymentScript && value.message === 'Package' && this.flags.deploymentscripts) {
          EONLogger.log(COLOR_INFO(`☝ Found post deployment script for dependency package ${key}`));
          await this.runDeploymentSteps(value.postDeploymentScript, 'postDeployment', key);
        }
      }

      //await tasks.run();
      // deploy dependencies
    } else {
      throw new SfError(
        `Found no package tree information for package: ${pck} and path ${path}. Please check the order for this package and his dependecies in the sfdx-project.json.
First the dependecies packages. And then this package.`
      );
    }
  }

  private async deployPackageTreeNode(pck: string, path: string): Promise<void> {
    ComponentSetBuilder.build({
      sourcepath: [path],
    });
    const deploy: MetadataApiDeploy = await ComponentSet.fromSource(path).deploy({
      usernameOrConnection: this.org.getConnection().getUsername(),
    });
    // Attach a listener to check the deploy status on each poll
    let counter = 0;
    deploy.onUpdate((response) => {
      if (counter === 5) {
        const { status, numberComponentsDeployed, numberComponentsTotal } = response;
        const progress = `${numberComponentsDeployed}/${numberComponentsTotal}`;
        const message = `⌛ Deploy Package: ${pck} Status: ${status} Progress: ${progress}`;
        EONLogger.log(COLOR_TRACE(message));
        counter = 0;
      } else {
        counter++;
      }
    });

    // Wait for polling to finish and get the DeployResult object
    const res = await deploy.pollStatus();
    if (!res.response.success) {
      await this.print(res.response.details);
    } else {
      EONLogger.log(COLOR_INFO(`✔ Deployment for Package ${pck} successfully 👌`));
    }
  }

  private async print(input: DeployDetails): Promise<void> {
    var table = new Table({
      head: ['Component Name', 'Error Message'],
      colWidths: [60, 60], // Requires fixed column widths
      wordWrap: true,
    });
    //print deployment errors
    if (
      (Array.isArray(input.componentFailures) && input.componentFailures.length > 0) ||
      (typeof input.componentFailures === 'object' && Object.keys(input.componentFailures).length > 0)
    ) {
      let result: DeployError[] = [];
      if (Array.isArray(input.componentFailures)) {
        result = input.componentFailures.map((a) => {
          const res: DeployError = {
            Name: a.fullName,
            Type: a.componentType,
            Status: a.problemType,
            Message: a.problem,
          };
          return res;
        });
      } else {
        const res: DeployError = {
          Name: input.componentFailures.fullName,
          Type: input.componentFailures.componentType,
          Status: input.componentFailures.problemType,
          Message: input.componentFailures.problem,
        };
        result = [...result, res];
      }
      result.forEach((r) => {
        let obj = {};
        obj[r.Name] = r.Message;
        table.push(obj);
      });
      console.log(table.toString());
      throw new SfError(
        `Deployment failed. Please check error messages from table and fix this issues from package.`
      );
      // print test run errors
    } else if (
      (input.runTestResult &&
        input.runTestResult.failures &&
        Array.isArray(input.runTestResult.failures) &&
        input.runTestResult.failures.length > 0) ||
      (input.runTestResult &&
        typeof input.runTestResult.failures === 'object' &&
        Object.keys(input.runTestResult.failures).length > 0)
    ) {
      let tableTest = new Table({
        head: ['Apex Class', 'Message', 'Stack Trace'],
        colWidths: [60, 60, 60], // Requires fixed column widths
        wordWrap: true,
      });
      if (Array.isArray(input.runTestResult.failures)) {
        input.runTestResult.failures.forEach((a) => {
          tableTest.push([a.name, a.message, a.stackTrace]);
        });
      } else {
        tableTest.push([
          input.runTestResult.failures.name,
          input.runTestResult.failures.message,
          input.runTestResult.failures.stackTrace,
        ]);
      }
      console.log(tableTest.toString());
      throw new SfError(
        `Testrun failed. Please check the testclass errors from table and fix this issues from package.`
      );
      // print code coverage errors
    } else if (
      (input.runTestResult &&
        input.runTestResult.codeCoverageWarnings &&
        Array.isArray(input.runTestResult.codeCoverageWarnings) &&
        input.runTestResult.codeCoverageWarnings.length > 0) ||
      (input.runTestResult &&
        typeof input.runTestResult.codeCoverageWarnings === 'object' &&
        Object.keys(input.runTestResult.codeCoverageWarnings).length > 0)
    ) {
      if (Array.isArray(input.runTestResult.codeCoverageWarnings)) {
        const coverageList: CodeCoverageWarnings[] = input.runTestResult.codeCoverageWarnings;
        coverageList.forEach((a) => {
          table.push([a.name, a.message]);
        });
      } else {
        const coverageList: CodeCoverageWarnings = input.runTestResult.codeCoverageWarnings;
        table.push([coverageList.name, coverageList.message]);
      }
      console.log(table.toString());
      throw new SfError(
        `Testcoverage failed. Please check the coverage from table and fix this issues from package.`
      );
    } else {
      throw new SfError(
        `Validation failed. No errors in the response. Please validate manual and check the errors on org (setup -> deployment status).`
      );
    }
  }

  private async getApexClassesFromPaths(pck: string, path: string): Promise<void> {
    EONLogger.log(COLOR_HEADER(`💪 Start Apex tests for package ${pck}.`));
    const apexTestClassIdList: string[] = [];
    const apexClassIdList: string[] = [];
    const apexTestClassNameList: string[] = [];
    const resolver: MetadataResolver = new MetadataResolver();
    let queueIdList: string[] = [];
    let testRunResult: ApexTestQueueResult;
    let apexCounter: number = 0;

    for (const component of resolver.getComponentsFromPath(path)) {
      if (component.type.id === 'apexclass') {
        apexCounter++;
        const apexCheckResult: ApexTestclassCheck = await this.checkIsTestClass(component.name);
        if (apexCheckResult.isTest) {
          apexTestClassIdList.push(apexCheckResult.Id);
          apexTestClassNameList.push(component.name);
        } else {
          apexClassIdList.push(apexCheckResult.Id);
        }
      }
    }

    if (apexCounter > 0 && apexTestClassNameList.length === 0) {
      throw new SfError(
        `Found apex class(es) for package ${pck} but no testclass(es). Please create a new testclass.`
      );
    }
    EONLogger.log(`${COLOR_NOTIFY('Package:')} ${COLOR_INFO(pck)}`);
    EONLogger.log(
      `${COLOR_NOTIFY('Testclasses:')} ${COLOR_INFO(
        `${apexTestClassNameList.length > 0 ? apexTestClassNameList.join() : 'No Testclasses found.'}`
      )}`
    );
    //insert Apex classes to test queue
    if (apexTestClassIdList.length > 0) {
      queueIdList = await this.addClassesToApexQueue(apexTestClassIdList);
    }

    //check test queue and wait for finish
    EONLogger.log(COLOR_INFO(`⌛ Waiting For test run results`));
    let _i: number = 2;

    do {
      testRunResult = await this.checkTestRunStatus(queueIdList);
      EONLogger.log(
        COLOR_TRACE(
          `Test Processing: ${testRunResult.ProcessingList.length}, Test Completed: ${testRunResult.CompletedList.length},Test Failed: ${testRunResult.FailedList.length} , Test Queued: ${testRunResult.QueuedList.length}`
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));
      _i++;
      if (_i > 360) {
        throw new Error('Apex test run timeout after 60 minutes');
      }
    } while (testRunResult.QueuedList.length > 0 || testRunResult.ProcessingList.length > 0);

    //check testrun result only for errors
    await this.checkTestResult(apexTestClassIdList, queueIdList);

    //check Code Coverage
    if (apexClassIdList.length > 0) {
      await this.checkCodeCoverage(apexClassIdList);
    }
  }
  //check if apex class is a testclass from code identifier @isTest
  private async checkIsTestClass(comp: string): Promise<ApexTestclassCheck> {
    let result: ApexTestclassCheck = { Id: '', isTest: false };
    const connection: Connection = this.org.getConnection();
    try {
      const apexObj: ApexClass = await connection.singleRecordQuery(
        "Select Id,Name,Body from ApexClass Where Name = '" + comp + "' And ManageableState = 'unmanaged' LIMIT 1",
        { tooling: true }
      );
      if (apexObj && (apexObj.Body.search('@isTest') > -1 || apexObj.Body.search('@IsTest') > -1)) {
        result.isTest = true;
      }
      result.Id = apexObj.Id;
    } catch (e) {
      throw new SfError(`Apex Query Error for Comp: ${comp} with detail error: ${e}`);
    }

    return result;
  }

  //Enable Synchronus Compile on Deploy
  private async addClassesToApexQueue(apexTestClassIdList: string[]): Promise<string[]> {
    let recordResult: string[] = [];
    const connection: Connection = this.org.getConnection();
    try {
      const queueResponse = await connection.requestPost(`${connection._baseUrl()}/tooling/runTestsAsynchronous/`, {
        classids: apexTestClassIdList.join(),
      });
      const jobId: string = queueResponse ? Object.values(queueResponse).join('') : '';
      if (jobId) {
        recordResult.push(jobId);
      } else {
        throw new SfError(`Post Request to Queue runs on error`);
      }
    } catch (e) {
      throw new SfError(`Insert to queue runs on error`);
    }
    return recordResult;
  }

  private async checkTestRunStatus(ids: string[]): Promise<ApexTestQueueResult> {
    const connection: Connection = this.org.getConnection();
    let queueResult: ApexTestQueueResult = {
      QueuedList: [],
      CompletedList: [],
      FailedList: [],
      ProcessingList: [],
      OtherList: [],
    };
    try {
      const responseFromOrg = await connection.tooling.query<ApexTestQueueItem>(
        `Select Id, ApexClassId,ApexClass.Name, Status, ExtendedStatus, ParentJobId, TestRunResultId from ApexTestQueueItem Where ParentJobId In ('${ids.join(
          "','"
        )}')`
      );
      if (responseFromOrg.records) {
        for (const result of responseFromOrg.records) {
          if (result.Status === 'Queued') {
            queueResult.QueuedList.push(result?.ApexClass?.Name);
          } else if (result.Status === 'Completed') {
            queueResult.CompletedList.push(result?.ApexClass?.Name);
          } else if (result.Status === 'Failed') {
            queueResult.FailedList.push(result?.ApexClass?.Name);
          } else if (result.Status === 'Processing') {
            queueResult.ProcessingList.push(result?.ApexClass?.Name);
          } else {
            queueResult.OtherList.push(result?.ApexClass?.Name);
          }
        }
      }
    } catch (e) {
      console.log(e);
      throw new SfError(messages.getMessage('errorApexQueueSelect'));
    }
    return queueResult;
  }

  private async checkCodeCoverage(ids: string[]): Promise<void> {
    const connection: Connection = this.org.getConnection();
    let table = new Table({
      head: [
        COLOR_INFO('Apex Test Modul'),
        COLOR_INFO('NumLinesCovered'),
        COLOR_INFO('NumLinesUncovered'),
        COLOR_INFO('Coverage in Percent'),
      ],
    });
    let coveredCounter: number = 0;
    let uncoveredCounter: number = 0;
    let packageCoverage: number = 0;
    try {
      const responseFromOrg = await connection.tooling.query<ApexCodeCoverageAggregate>(
        `Select ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered from ApexCodeCoverageAggregate Where ApexClassOrTriggerId In ('${ids.join(
          "','"
        )}')`
      );
      if (responseFromOrg.records) {
        for (const result of responseFromOrg.records) {
          table.push([
            result.ApexClassOrTrigger.Name,
            result.NumLinesCovered,
            result.NumLinesUncovered,
            result.NumLinesCovered > 0
              ? Math.floor((result.NumLinesCovered / (result.NumLinesCovered + result.NumLinesUncovered)) * 100)
              : 0,
          ]);
          coveredCounter += result.NumLinesCovered;
          uncoveredCounter += result.NumLinesUncovered;
        }
      }
    } catch (e) {
      throw new SfError(`System Exception: Problems to fetch results from ApexCodeCoverageAggregate`);
    }

    if (coveredCounter === 0 && uncoveredCounter === 0) {
      EONLogger.log(COLOR_WARNING(`This package has no covered and uncovered lines. Please check the result. 👆`));
    } else {
      packageCoverage = Math.floor((coveredCounter / (coveredCounter + uncoveredCounter)) * 100);

      EONLogger.log(COLOR_INFO('Check Code Coverage for Testclasses:'));
      EONLogger.log(COLOR_INFO(table.toString()));
      if (packageCoverage < 75) {
        throw new SfError(
          `The package has an overall coverage of ${packageCoverage}%, which does not meet the required overall coverage of 75%. Please check the testclass coverage table and fix the test classes.`
        );
      } else {
        EONLogger.log(COLOR_SUCCESS(`👏 Great. This package has a code coverage from ${packageCoverage}%. 😊`));
      }
    }
  }

  private async checkTestResult(apexClassList: string[], jobId: string[]): Promise<void> {
    const connection: Connection = this.org.getConnection();
    let responseFromOrg: QueryResult<ApexTestResult>;
    try {
      responseFromOrg = await connection.query<ApexTestResult>(
        `Select ApexClass.Name, Outcome, MethodName, Message from ApexTestResult Where Outcome = 'Fail' And ApexClassId In ('${apexClassList.join(
          "','"
        )}') And AsyncApexJobId In ('${jobId.join("','")}')`
      );
    } catch (e) {
      throw new SfError(`System Exception: Problems to found Results from ApexTestResult`);
    }
    let table = new Table({
      head: [COLOR_ERROR('ApexClass Name'), COLOR_ERROR('Methodname'), COLOR_ERROR('ErrorMessage')],
      colWidths: [60, 60, 60],
      wordWrap: true,
    });
    if (responseFromOrg.records.length > 0) {
      for (const result of responseFromOrg.records) {
        table.push([result.ApexClass.Name, result.MethodName, result.Message]);
      }
      console.log(table.toString());
      EONLogger.log(COLOR_ERROR(`This package contains testclass errors.`));
      throw new SfError(`Please fix this issues from the table and try again.`);
    }
  }

  private async runDeploymentSteps(scriptPath: string, scriptStep: string, scriptVariable1: string) {
    EONLogger.log(COLOR_HEADER(`Execute deployment script`));
    EONLogger.log(`${COLOR_NOTIFY('Path:')} ${COLOR_INFO(scriptPath)}`);
    try {
      const cmdPrefix = process.platform !== 'win32' ? 'sh -e' : 'cmd.exe /c';
      const { stdout, stderr } = await exec(
        `${cmdPrefix} ${path.normalize(path.join(process.cwd(), scriptPath))} ${scriptVariable1} ${this.org
          .getConnection()
          .getUsername()}`,
        { timeout: 0, encoding: 'utf-8', maxBuffer: 5242880 }
      );
      if (stderr) {
        EONLogger.log(COLOR_ERROR(`${scriptStep} Command Error: ${stderr}`));
      }
      if (stdout) {
        EONLogger.log(COLOR_INFO(`${scriptStep} Command Info: ${stdout}`));
      }
    } catch (e) {
      EONLogger.log(COLOR_ERROR(`${scriptStep} Command Error: ${e}`));
    }
  }

  private async fetchScratchOrg(poolTag: string, devHubUser: string) {
    EONLogger.log(COLOR_HEADER(`Fetch a scratch org from pool ⛏`));
    EONLogger.log(
      `${COLOR_NOTIFY('Run command:')} ${COLOR_INFO(
        `sfdx sfpowerscripts:pool:fetch -d --tag ${poolTag} --targetdevhubusername ${devHubUser}`
      )}`
    );
    try {
      const { stdout, stderr } = await exec(
        `sfdx sfpowerscripts:pool:fetch -d --tag ${poolTag} --targetdevhubusername ${devHubUser}`,
        { timeout: 0, encoding: 'utf-8', maxBuffer: 5242880 }
      );
      if (stderr) {
        throw new SfError(`Problems to fetch a scratch org from pool. Error: ${stderr}`);
      }
      if (stdout) {
        EONLogger.log(COLOR_INFO(`💪 Scratch org succesfully claimed`));
      }
    } catch (e) {
      throw new SfError(`Problems to fetch a scratch org from pool. Error: ${e}`);
    }
  }
}
