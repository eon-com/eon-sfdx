import * as os from 'os';
import { Messages, SfError, SfProjectJson, StateAggregator, ConfigAggregator, Org } from '@salesforce/core';
import { ComponentSet, MetadataApiDeploy, MetadataResolver, DeployDetails } from '@salesforce/source-deploy-retrieve';
import { DeployError } from '../../../interfaces/package-interfaces';
import { AnyJson } from '@salesforce/ts-types';
import simplegit, { DiffResult, SimpleGit } from 'simple-git';
import fs from 'fs';
const util = require('util');
const exec = util.promisify(require('child_process').exec);
import {
  NamedPackageDirLarge,
  ApexTestclassCheck,
  SourcePackageComps,
  CodeCoverageWarnings,
} from '../../../helper/types';
import EONLogger, {
  COLOR_INFO,
  COLOR_KEY_MESSAGE,
  COLOR_HEADER,
  COLOR_NOTIFY,
  COLOR_WARNING,
  COLOR_ERROR,
  COLOR_TRACE,
} from '../../../eon/EONLogger';
import path from 'path';
import Table from 'cli-table3';
import { LOGOBANNER } from '../../../eon/logo';
import { Flags } from '@oclif/core';
import  EonCommand  from '../../../EonCommand';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'validate_source');

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
    'target-org': Flags.string({
            char: 'o',
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

    EONLogger.log(COLOR_KEY_MESSAGE('Validating source package(s)...'));
    EONLogger.log(COLOR_HEADER('Search for source package changes'));
    // get sfdx project.json
    const projectJson: SfProjectJson = await this.project.retrieveSfProjectJson();
    const json = projectJson.getContents();
    const packageAliases = projectJson.getContents().packageAliases;

    // get all packages
    let packageDirs: NamedPackageDirLarge[] = json.packageDirectories as NamedPackageDirLarge[];

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

    // get all diffs from current to target branch
    let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
    const sourcebranch = this.flags.source || 'HEAD';
    let includeForceApp = false;
    await git.fetch();
    const changes: DiffResult = await git.diffSummary([`${this.flags.target}...${sourcebranch}`]);
    let table = new Table({
      head: [COLOR_NOTIFY('Package')],
    });
    const packageMap = new Map<string, NamedPackageDirLarge>();
    // check changed packages
    for (const pck of packageDirs) {
      let packageCheck = false;
      if (this.flags.package) {
        if (pck.package === this.flags.package) {
          if (packageAliases[pck.package]) {
            EONLogger.log(COLOR_WARNING(`👆 No validation for unlocked packages: ${pck.package}`));
            continue;
          }
          packageMap.set(pck.package, pck);
          table.push([pck.package]);
          break;
        }
      }
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
          packageMap.set(pck.package, pck);
          table.push([pck.package]);
        } else {
          EONLogger.log(COLOR_WARNING(`👆 No validation for unlocked packages: ${pck.package}`));
        }
      }
    }

    if (packageMap.size === 0) {
      EONLogger.log(COLOR_NOTIFY(`✔ Found no source packages with changes. Process finished without validation`));
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

    //run validation tasks
    for (const [key, value] of packageMap) {
      //Start deploy process
      //execute preDeployment Scripts
      if (value.preDeploymentScript && this.flags.deploymentscripts) {
        EONLogger.log(COLOR_INFO(`☝ Found pre deployment script for package ${key}`));
        await this.runDeploymentSteps(value.preDeploymentScript, 'preDeployment', key);
      }
      //Deploy Source Package
      if (key.search('src') > -1) {
        await this.validateSourcePackage(path.normalize(value.path), key);
        continue;
      }

      //execute postDeployment Scripts
      if (value.postDeploymentScript && this.flags.deploymentscripts) {
        EONLogger.log(COLOR_INFO(`☝ Found post deployment script for package ${key}`));
        EONLogger.log(COLOR_INFO(`☝ No post deployment execution in source validation job`));
        //await this.runDeploymentSteps(value.postDeploymentScript, 'postDeployment', key);
      }
    }
    EONLogger.log(COLOR_HEADER(`Yippiee. 🤙 Validation finsihed without errors. Great 🤜🤛`));
    return {};
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

  private async validateSourcePackage(path: string, pck: string) {
    EONLogger.log(COLOR_HEADER(`💪 Start Deployment and Tests for source package.`));
    let username = this.org.getConnection().getUsername();
    if (this.flags.alias) {
      const stateAggregator = await StateAggregator.getInstance();
      username = stateAggregator.aliases.resolveUsername(this.flags.alias);
    }
    const sourceComps = await this.getApexClassesForSource(path);
    const testLevel = sourceComps.apexTestclassNames.length > 0 ? 'RunSpecifiedTests' : 'NoTestRun';
    EONLogger.log(COLOR_HEADER(`Validate source package: ${pck}`));
    EONLogger.log(`${COLOR_NOTIFY('Path:')} ${COLOR_INFO(path)}`);
    EONLogger.log(`${COLOR_NOTIFY('Metadata Size:')} ${COLOR_INFO(sourceComps.comps.length)}`);
    EONLogger.log(`${COLOR_NOTIFY('TestLevel:')} ${COLOR_INFO(testLevel)}`);
    EONLogger.log(`${COLOR_NOTIFY('Username:')} ${COLOR_INFO(username)}`);
    EONLogger.log(
      `${COLOR_NOTIFY('ApexClasses:')} ${
        sourceComps.apexClassNames.length > 0
          ? COLOR_INFO(sourceComps.apexClassNames.join())
          : COLOR_INFO('no Apex Classes in source package')
      }`
    );
    EONLogger.log(
      `${COLOR_NOTIFY('ApexTestClasses:')} ${
        sourceComps.apexTestclassNames.length > 0
          ? COLOR_INFO(sourceComps.apexTestclassNames.join())
          : COLOR_INFO('no Apex Test Classes in source package')
      }`
    );

    if (sourceComps.apexClassNames.length > 0 && sourceComps.apexTestclassNames.length === 0) {
      throw new SfError(
        `Found apex class(es) for package ${pck} but no testclass(es). Please create a new testclass.`
      );
    }

    const deploy: MetadataApiDeploy = await ComponentSet.fromSource(path).deploy({
      usernameOrConnection: username,
      apiOptions: { checkOnly: true, testLevel: testLevel, runTests: sourceComps.apexTestclassNames },
    });
    // Attach a listener to check the deploy status on each poll
    let counter = 0;
    deploy.onUpdate((response) => {
      if (counter === 5) {
        const {
          status,
          numberComponentsDeployed,
          numberComponentsTotal,
          numberTestsTotal,
          numberTestsCompleted,
          stateDetail,
        } = response;
        const progress = `${numberComponentsDeployed}/${numberComponentsTotal}`;
        const testProgress = `${numberTestsCompleted}/${numberTestsTotal}`;
        let message = '';
        if (numberComponentsDeployed < sourceComps.comps.length) {
          message = `⌛ Deploy Package: ${pck} Status: ${status} Progress: ${progress}`;
        } else if (numberComponentsDeployed === numberComponentsTotal && numberTestsTotal > 0) {
          message = `⌛ Test Package: ${pck} Status: ${status} Progress: ${testProgress} ${stateDetail ?? ''}`;
        } else if (numberTestsTotal === 0 && sourceComps.apexTestclassNames.length > 0) {
          message = `⌛ Waiting for testclass execution`;
        }
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
      EONLogger.log(COLOR_INFO(`✔ Deployment and tests for source package ${pck} successfully 👌`));
    }
  }

  private async getApexClassesForSource(path: string): Promise<SourcePackageComps> {
    const sourcePckComps: SourcePackageComps = { comps: [], apexClassNames: [], apexTestclassNames: [] };
    const resolver: MetadataResolver = new MetadataResolver();

    for (const component of resolver.getComponentsFromPath(path)) {
      sourcePckComps.comps.push(component.name);
      if (component.type.id === 'apexclass') {
        const apexCheckResult: ApexTestclassCheck = await this.checkIsSourceTestClass(component.content);
        if (apexCheckResult.isTest) {
          sourcePckComps.apexTestclassNames.push(component.name);
        } else {
          sourcePckComps.apexClassNames.push(component.name);
        }
      }
    }

    return sourcePckComps;
  }

  //check if apex class is a testclass from code identifier @isTest
  private async checkIsSourceTestClass(comp: string): Promise<ApexTestclassCheck> {
    let checkResult: ApexTestclassCheck = { isTest: false };
    try {
      const data = await fs.promises.readFile(comp, 'utf8');
      if (data.search('@isTest') > -1 || data.search('@IsTest') > -1) {
        checkResult.isTest = true;
      }
    } catch (err) {
      EONLogger.log(COLOR_TRACE(err));
      return checkResult;
    }
    return checkResult;
  }
}
