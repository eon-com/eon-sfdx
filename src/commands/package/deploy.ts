import * as os from 'os';
import { Messages, SfError, SfProjectJson, ConfigAggregator, Org } from '@salesforce/core';
const Table = require('cli-table3');
import { ComponentSet, DeployDetails, MetadataApiDeploy } from '@salesforce/source-deploy-retrieve';
import { getDeployUrls } from '../../helper/get-packages';
import { DeployError, PackageTree } from '../../helper/types';
import EONLogger, {
    COLOR_HEADER,
    COLOR_INFO,
    COLOR_NOTIFY,
    COLOR_SUCCESS,
    COLOR_TRACE,
    COLOR_WARNING,
} from '../../eon/EONLogger';
import { LOGOBANNER } from '../../eon/logo';
import { Flags, Args } from '@oclif/core';
import EonCommand from '../../EonCommand';
import Bottleneck from 'bottleneck';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'deploy');

export default class Deploy extends EonCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = messages.getMessage('examples').split(os.EOL);

    static flags = {
        // flag with a value (-n, --name=VALUE)
        packagename: Flags.string({
            char: 'p',
            description: messages.getMessage('packageFlagDescription'),
        }),
        includedependencies: Flags.boolean({
            char: 'i',
            required: false,
            description: messages.getMessage('depFlagDescription'),
        }),
        start: Flags.string({
            char: 's',
            description: 'Start deployment at the point of this package name',
        }),
        'target-org': Flags.string({
            char: 'o',
            aliases: ['targetusername', 'u'],
            description: 'Login username or alias for the target org.',
        }),
    };

    // Comment this out if your command does not require an org username
    protected static requiresUsername = false;

    // Comment this out if your command does not support a hub org username
    // protected static supportsDevhubUsername = true;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    static args = {
        file: Args.string(),
    };

    public async execute(): Promise<void> {
        EONLogger.log(COLOR_HEADER(LOGOBANNER));
        EONLogger.log(COLOR_HEADER('👆 Note: Managed Packages are not considered when deploying the dependencies...'));
        EONLogger.log(COLOR_HEADER(`💪 Put packages in queue and start deployment/installation process`));
        const { args } = await this.parse(Deploy);
        // map flags to variables
        const packagename = (this.flags.packagename || args.file) as string;
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

        const includedependencies = (this.flags.includedependencies || '') as boolean;
        // get packages
        const projectJson: SfProjectJson = await this.project.retrieveSfProjectJson();
        const packageDependencyTree: PackageTree = getDeployUrls(projectJson, packagename);

        const limiter = new Bottleneck({
            maxConcurrent: 1,
        });

        if (packageDependencyTree) {
            if (includedependencies && packageDependencyTree.dependency) {
                const depsList: string[] = [];
                for (const packageDep of packageDependencyTree.dependency) {
                    depsList.push(packageDep.packagename);
                }
                EONLogger.log(COLOR_NOTIFY(`First deploy the dependencies...👇`));
                EONLogger.log(`${COLOR_NOTIFY('Dependencies:')} ${COLOR_INFO(depsList.join(','))}`);
                let isStarted = false;
                for (const dep of packageDependencyTree.dependency) {
                    // If the start flag is active and we haven't reached the specified package yet, skip until we do
                    if (this.flags.start && !isStarted) {
                        if (this.flags.start !== dep.packagename) {
                            continue;
                        } else {
                            // We've reached the specified package, so mark it as started
                            EONLogger.log(
                                COLOR_WARNING(
                                    `Restarting the deployment at the point of package ${this.flags.start}...👆`
                                )
                            );
                            isStarted = true;
                        }
                    }

                    await limiter.schedule(async () => await this.deployPackageTreeNode(dep.packagename, dep.path));
                }
            }

            EONLogger.log(COLOR_NOTIFY(`Deploy package ${packageDependencyTree.packagename}...👇`));
            await this.deployPackageTreeNode(packageDependencyTree.packagename, packageDependencyTree.path);

            // deploy dependencies
        } else {
            throw new SfError(messages.getMessage('errorNoPckResults', [packagename]));
        }

        EONLogger.log(COLOR_SUCCESS(`👏 Congratulations Deployment finished! 🥳`));
        // Return an object to be displayed with --json
    }

    private async deployPackageTreeNode(pck: string, path: string): Promise<void> {
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
            // print code coverage error
        } else {
            throw new SfError(
                `Validation failed. No errors in the response. Please validate manual and check the errors on org (setup -> deployment status).`
            );
        }
    }
}
