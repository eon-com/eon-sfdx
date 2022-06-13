/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError, SfdxProjectJson, Connection } from '@salesforce/core';
import { ComponentSet, DeployMessage, MetadataApiDeploy, MetadataResolver } from '@salesforce/source-deploy-retrieve';
import { getDeployUrls } from '../../../utils/get-packages';
import { DeployError, PackageTree } from '../../../interfaces/package-interfaces';
import { AnyJson } from '@salesforce/ts-types';
import simplegit, { DiffResult, SimpleGit } from 'simple-git';
const util = require('util');
const exec = util.promisify(require('child_process').exec);
import {
  ApexCodeCoverageAggregate,
  RecordIds,
  ApexClass,
  NamedPackageDirLarge,
  CustomRecordResult,
  ApexTestQueueItem,
  ApexTestQueueResult,
  ApexTestResult,
  PackageInfo,
  ApexTestclassCheck,
} from '../../../helper/types';
import EONLogger, {
  COLOR_SUCCESS,
  COLOR_INFO,
  COLOR_KEY_MESSAGE,
  COLOR_HEADER,
  COLOR_NOTIFY,
  COLOR_WARNING,
  COLOR_ERROR,
  COLOR_TRACE
} from '../../../eon/EONLogger';
import path from 'path';
import Table from 'cli-table3';
import { UpsertResult, Record } from 'jsforce';
import { LOGOBANNER } from '../../../eon/logo';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'validate');
const packageDeployMap = new Map<string, string>();

export default class Validate extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    // Label For Named Credential as Required
    target: flags.string({
      char: 't',
      description: messages.getMessage('targetFlag'),
      required: false,
    }),
    source: flags.string({
      char: 's',
      description: messages.getMessage('sourceFlag'),
      required: false,
    }),
    deploymentscripts: flags.boolean({
      char: 'd',
      description: messages.getMessage('scriptFlag'),
      default: false,
      required: false,
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    EONLogger.log(COLOR_KEY_MESSAGE('Validating package(s)...'));
    await this.toggleParallelApexTesting();
    EONLogger.log(COLOR_HEADER('Search for unlocked package changes'));
    // get sfdx project.json
    const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();

    // get all packages
    let packageDirs: NamedPackageDirLarge[] = projectJson.getUniquePackageDirectories();
    // get all diffs from current to target branch
    let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
    const sourcebranch = this.flags.source || 'HEAD';
    await git.fetch();
    const changes: DiffResult = await git.diffSummary([`${this.flags.target}...${sourcebranch}`]);
    let table = new Table({
      head: [COLOR_NOTIFY('Package')],
    });
    const packageMap = new Map<string, NamedPackageDirLarge>();
    // check changed packages
    for (const pck of packageDirs) {
      if (
        changes.files.some((change) =>
          path
            .join(path.dirname(projectJson.getPath()), path.normalize(change.file))
            .includes(path.normalize(pck.fullPath))
        )
      ) {
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

        if (pck.package === 'force-app' || pck.package?.search('src') > -1) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for this special source package: ${pck.package}`));
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
    EONLogger.log(COLOR_NOTIFY(`👉 Following packages with changes:`));
    EONLogger.log(COLOR_INFO(table.toString()));

    //run validation tasks
    for (const [key, value] of packageMap) {
      //Start deploy process
      //execute preDeployment Scripts
      if (value.preDeploymentScript && this.flags.deploymentscripts) {
        EONLogger.log(COLOR_INFO(`☝ Found pre deployment script for package ${key}`));
        await this.runDeploymentSteps(value.preDeploymentScript, 'preDeployment', key);
      }
      //Deploy Package
      await this.deployPackageWithDependency(key, value.path);
      //execute postDeployment Scripts
      if (value.postDeploymentScript && this.flags.deploymentscripts) {
        EONLogger.log(COLOR_INFO(`☝ Found post deployment script for package ${key}`));
        await this.runDeploymentSteps(value.postDeploymentScript, 'postDeployment', key);
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
    const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();

    const packageDependencyTree: PackageTree = getDeployUrls(projectJson, pck);
    packageDependencyTree.dependency.forEach((dep) => {
      if (dep.path && !packageDeployMap.get(dep.packagename)) {
        packageDeployMap.set(dep.packagename, `Dependency`);
        packageSingleMap.set(dep.packagename, {
          message: `Dependency`,
          path: dep.path,
        });
      }
    });
    if (!packageDeployMap.get(pck)) {
      packageDeployMap.set(pck, `Package`);
      packageSingleMap.set(pck, { message: `Package`, path: path });
    }

    if (packageSingleMap.size > 0) {
      for (const [key, value] of packageSingleMap) {
          if(value.message === 'Package'){
            pckList.push(key)
          } else {
            depList.push(key)
          }
      }
      if(pckList.length > 0){
        EONLogger.log(`${COLOR_NOTIFY('Package:')} ${COLOR_INFO(pckList.join())}`);
      }
      if(pckList.length > 0){
        EONLogger.log(`${COLOR_NOTIFY('Dependencies:')} ${COLOR_INFO(depList.join())}`);
      }
      for (const [key, value] of packageSingleMap) {
        EONLogger.log(COLOR_INFO(`👉 Start deployment for package ${key}`));
        await this.deployPackageTreeNode(key,value.path);
      }

      //await tasks.run();
      // deploy dependencies
    } else {
      throw new SfdxError(
        `Found no package tree information for package: ${pck} and path ${path}. Please check sfdx-project.json and deploy manually.`
      );
    }
  }

  private async deployPackageTreeNode(pck: string,path: string): Promise<void> {
    const deploy: MetadataApiDeploy = await ComponentSet.fromSource(path).deploy({
      usernameOrConnection: this.org.getConnection().getUsername(),
    });
    // Attach a listener to check the deploy status on each poll

    deploy.onUpdate((response) => {
      const { status, numberComponentsDeployed, numberComponentsTotal } = response;
      const progress = `${numberComponentsDeployed}/${numberComponentsTotal}`;
      const message = `⌛ Deploy Package: ${pck} Status: ${status} Progress: ${progress}`;
      EONLogger.log(COLOR_TRACE(message));
    });

    // Wait for polling to finish and get the DeployResult object
    const res = await deploy.pollStatus();
    if (!res.response.success) {
      const errorTable: string = await this.print(res.response.details.componentFailures);
      console.log(errorTable);
      throw new SfdxError(
        `Deployment failed. Please check error messages from table and fix this issues from path ${path}.`
      );
    } else {
      EONLogger.log(COLOR_INFO(`✔ Deployment for Package ${pck} successfully 👌`));
    }
  }

  private async print(input: DeployMessage | DeployMessage[]): Promise<string> {
    var table = new Table({
      head: ['Component Name', 'Error Message'],
      colWidths: [60, 60], // Requires fixed column widths
      wordWrap: true,
    });
    let result: DeployError[] = [];
    if (Array.isArray(input)) {
      result = input.map((a) => {
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
        Name: input.fullName,
        Type: input.componentType,
        Status: input.problemType,
        Message: input.problem,
      };
      result = [...result, res];
    }
    result.forEach((r) => {
      let obj = {};
      obj[r.Name] = r.Message;
      table.push(obj);
    });

    return table.toString();
  }

  private async getApexClassesFromPaths(pck: string, path: string): Promise<void> {
    EONLogger.log(COLOR_HEADER(`💪 Start Apex tests for package ${pck}.`));
    const apexTestClassIdList: string[] = [];
    const apexClassIdList: string[] = [];
    const apexTestClassNameList: string[] = [];
    const resolver: MetadataResolver = new MetadataResolver();
    let queueInsertResult: CustomRecordResult | CustomRecordResult[];
    let queueIdList: string[] = [];
    let testRunResult: ApexTestQueueResult;
    let apexCounter: number = 0;
    
    EONLogger.log(COLOR_TRACE(`Fetch Apex Classes from path: ${path}`));
    for (const component of resolver.getComponentsFromPath(path)) {
      if (component.type.id === 'apexclass') {
        apexCounter++;
        EONLogger.log(COLOR_TRACE(`Found Apex Class: ${component.name}`));
        const apexCheckResult: ApexTestclassCheck = await this.checkIsTestClass(component.name);
        if (apexCheckResult.isTest) {
          apexTestClassIdList.push(apexCheckResult.Id);
          apexTestClassNameList.push(component.name);
          EONLogger.log(COLOR_TRACE(`Found Test Class: ${component.name}`));
        } else {
          apexClassIdList.push(apexCheckResult.Id);
        }
      }
    }

    if (apexCounter > 0 && apexTestClassNameList.length === 0) {
      throw new SfdxError(
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
      EONLogger.log(COLOR_TRACE(`Insert Apex Testclasses for package ${pck} to Queue`));
      queueInsertResult = await this.addClassesToApexQueue(apexTestClassIdList);
      EONLogger.log(COLOR_TRACE(`nsert Apex Testclasses succesfully`));
    }
   
    if (Array.isArray(queueInsertResult) && queueInsertResult.length > 0) {
      for (const record of queueInsertResult) {
        if (!record.success) {
          throw new SfdxError(messages.getMessage('errorApexQueueInsert', [record.errors.toString()]));
        }
        queueIdList.push(record.id);
      }
      //check test queue and wait for finish
      EONLogger.log(COLOR_INFO(`⌛ Waiting For test run results`));
      let _i: number = 2;
      do {
        testRunResult = await this.checkTestRunStatus(queueIdList);

        EONLogger.log(COLOR_TRACE(`All Tests: ${
          testRunResult.QueuedList.length +
          testRunResult.CompletedList.length +
          testRunResult.FailedList.length +
          testRunResult.ProcessingList.length +
          testRunResult.OtherList.length
        }. 
Queued(${testRunResult.QueuedList.length}): ${testRunResult.QueuedList.join()}
Completed(${testRunResult.CompletedList.length}): ${testRunResult.CompletedList.join()}
Processing(${testRunResult.ProcessingList.length}): ${testRunResult.ProcessingList.join()}
Failed(${testRunResult.FailedList.length}): ${testRunResult.FailedList.join()} 
Others(${testRunResult.OtherList.length}): ${testRunResult.OtherList.join()}`));

         await new Promise((resolve) => setTimeout(resolve, 10000));
         _i++
         if(_i > 50){
          throw new Error('Apex test run timeout after 5000 seconds');
         }
      } while (testRunResult.QueuedList.length > 0 || testRunResult.ProcessingList.length > 0)
     
      //check testrun result only for errors
      if (testRunResult.FailedList.length > 0) {
        EONLogger.log(COLOR_ERROR(`This package contains testclass errors.`));
        await this.checkTestResult();
        throw new SfdxError(`Please fix this issues and try again.`);
      }
      //check Code Coverage
      if (apexClassIdList.length > 0) {
        await this.checkCodeCoverage(apexClassIdList);
      }
    }
  }
  //check if apex class is a testclass from code identifier @isTest
  private async checkIsTestClass(comp: string): Promise<ApexTestclassCheck> {
    let result: ApexTestclassCheck = { Id: '', isTest: false };
    const connection: Connection = this.org.getConnection();
    try {
      const apexObj: ApexClass = await connection.singleRecordQuery(
        "Select Id,Name,Body from ApexClass Where Name = '" + comp + "' LIMIT 1",
        { tooling: true }
      );
      if (apexObj && (apexObj.Body.search('@isTest') > -1 || apexObj.Body.search('@IsTest') > -1)) {
        result.isTest = true;
      }
      result.Id = apexObj.Id;
    } catch (e) {
      throw new SfdxError(`Apex Query Error for Comp: ${comp} with detail error: ${e}`);
    }

    return result;
  }

  //Enable Synchronus Compile on Deploy
  private async toggleParallelApexTesting() {
    try {
      EONLogger.log(COLOR_NOTIFY('Update Apex Metadata Settings in Scratch'));
      const connection: Connection = this.org.getConnection();
      let apexSettingMetadata = { fullName: 'ApexSettings', enableDisableParallelApexTesting: false };
      let result: UpsertResult | UpsertResult[] = await connection.metadata.upsert('ApexSettings', apexSettingMetadata);
      if ((result as UpsertResult).success) {
        EONLogger.log(COLOR_INFO('Successfully updated apex testing setting'));
      }
    } catch (error) {
      EONLogger.log(COLOR_INFO(`Skipping toggling of enableDisableParallelApexTesting due to ${error}..`));
    }
  }

  //Enable Synchronus Compile on Deploy
  private async addClassesToApexQueue(
    apexTestClassIdList: string[]
  ): Promise<CustomRecordResult | CustomRecordResult[]> {
    const recordList: Record[] = [];
    let recordResult: CustomRecordResult[] | CustomRecordResult;
    const connection: Connection = this.org.getConnection();
    let deleteIds: string[] = [];
    for (const classId of apexTestClassIdList) {
      recordList.push({ ApexClassId: classId });
    }
    try {
      //delete all entries from code coverage
      const responseCodeCoverage = await connection.tooling.query<RecordIds>(`Select Id from ApexCodeCoverage`);
      if (responseCodeCoverage?.records) {
        for (const record of responseCodeCoverage?.records) {
          deleteIds.push(record.Id);
        }
        await connection.tooling.destroy('ApexCodeCoverage', deleteIds);
      }
      //delete all entries from code coverage aggregation
      deleteIds = [];
      const responseCodeAggregate = await connection.tooling.query<RecordIds>(
        `Select Id from ApexCodeCoverageAggregate`
      );
      if (responseCodeAggregate.records) {
        for (const record of responseCodeAggregate?.records) {
          deleteIds.push(record.Id);
        }
        await connection.tooling.destroy('ApexCodeCoverageAggregate', deleteIds);
      }
      //and now insert testclasses for new run
      recordResult = await connection.tooling.insert('ApexTestQueueItem', recordList);
    } catch (e) {
      console.log(e);
      throw new SfdxError(messages.getMessage('errorApexQueueInsert'));
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
        `Select Id, ApexClassId,ApexClass.Name, Status, ExtendedStatus, ParentJobId, TestRunResultId from ApexTestQueueItem Where Id In ('${ids.join(
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
      throw new SfdxError(messages.getMessage('errorApexQueueSelect'));
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
      console.log(e);
      throw new SfdxError(messages.getMessage('errorCodeCoverage'));
    }

    if (coveredCounter === 0) {
      throw new SfdxError(`This package has no covered lines. Please check the testclasses.`);
    }
    packageCoverage = Math.floor((coveredCounter / (coveredCounter + uncoveredCounter)) * 100);

    EONLogger.log(COLOR_INFO('Check Code Coverage for Testclasses:'));
    EONLogger.log(COLOR_INFO(table.toString()));
    if (packageCoverage < 75) {
      throw new SfdxError(
        `The package has an overall coverage of ${packageCoverage}%, which does not meet the required overall coverage of 75%. Please check the testclass coverage table and fix the test classes.`
      );
    } else {
      EONLogger.log(COLOR_SUCCESS(`👏 Great. This package has a code coverage from ${packageCoverage}%. 😊`));
    }
  }

  private async checkTestResult(): Promise<void> {
    const connection: Connection = this.org.getConnection();
    try {
      const responseFromOrg = await connection.tooling.query<ApexTestResult>(
        `Select ApexClass.Name, Outcome, MethodName, Message from ApexTestResult Where Outcome = 'Fail'`
      );
      if (responseFromOrg.records) {
        for (const result of responseFromOrg.records) {
          let table = new Table({
            head: [COLOR_ERROR('ApexClass Name'), COLOR_ERROR('Methodname')],
          });
          table.push([result.ApexClass.Name, result.MethodName]);
          console.log(table.toString());
          EONLogger.log(COLOR_ERROR(`ErrorMessage:`));
          EONLogger.log(COLOR_INFO(`${result.Message}`));
        }
      }
    } catch (e) {
      throw new SfdxError(messages.getMessage('errorCodeCoverage'));
    }
  }

  private async runDeploymentSteps(scriptPath: string, scriptStep: string, scriptVariable1: string) {
    EONLogger.log(COLOR_HEADER(`Execute deployment script`));
    EONLogger.log(`${COLOR_NOTIFY('Path:')} ${COLOR_INFO(scriptPath)}`);
    try {
      const scriptDir = scriptPath;
      const cmdPrefix = process.platform !== 'win32' ? 'sh ' : 'cmd.exe /c';
      const { stdout, stderr } = await exec(
        `${cmdPrefix} ${path.normalize(scriptDir)} ${scriptVariable1} ${this.org.getConnection().getUsername()}`,
        { timeout: 0, encoding: 'utf-8', maxBuffer: 5242880 }
      );
      if (stderr) {
        throw new SfdxError(COLOR_ERROR(`${scriptStep} Command Error: ${stderr}`));
      }
      if (stdout) {
        EONLogger.log(COLOR_INFO(`${scriptStep} Command Info: ${stdout}`));
      }
    } catch (e) {
      EONLogger.log(COLOR_ERROR(`${scriptStep} Command Error: ${e}`));
    }
  }
}
