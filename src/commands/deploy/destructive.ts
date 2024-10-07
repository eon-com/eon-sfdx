import { Flags } from '@oclif/core';
import { Messages, SfProject, ConfigAggregator, SfError, Org } from '@salesforce/core';
import * as os from 'os';

import EONLogger, {
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_KEY_MESSAGE,
    COLOR_NOTIFY,
    COLOR_SUCCESS,
    COLOR_WARNING,
    COLOR_TRACE,
    COLOR_INFO,
    COLOR_INFO_BOLD,
} from '../../eon/EONLogger';
import { LOGOBANNER } from '../../eon/logo';
import EonCommand from '../../EonCommand';
import { AnyJson } from '@salesforce/ts-types';
import path from 'path';
import fs from 'fs'
import fsPromise from 'fs/promises'
import { ComponentSetBuilder, DeployMessage } from '@salesforce/source-deploy-retrieve';
import Table from 'cli-table3';

Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'deploy_destructive');

export default class DeployDestructive extends EonCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = messages.getMessage('examples').split(os.EOL);

    static flags = {
        // Label For Named Credential as Required
        'manifest-path': Flags.string({
            char: 'm',
            description: messages.getMessage('manifestPath'),
            required: true,
        }),
        'destructive-path': Flags.string({
            char: 'd',
            description: messages.getMessage('destructivePath'),
            required: true,
        }),
        checkonly: Flags.boolean({
            char: 'c',
            description: messages.getMessage('checkonly'),
            default: false,
            required: false,
        }),
        rollback: Flags.boolean({
            char: 'r',
            description: messages.getMessage('rollback'),
            default: true,
            required: false,
        }),
        'write-output': Flags.boolean({
          char: 'w',
          description: messages.getMessage('output'),
          default: false,
          required: false,
         }),
        'ignore-warnings': Flags.boolean({
            char: 'i',
            description: messages.getMessage('ignoreWarnings'),
            default: true,
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
        EONLogger.log(COLOR_KEY_MESSAGE('Deploy destructive change(s)...'));
        EONLogger.log(COLOR_HEADER('Search for xml files...'));
        const project = await SfProject.resolve();
        const packageDirs = project.getUniquePackageDirectories().map((pDir) => pDir.path);
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

        const manifestPath = path.join(process.cwd(), this.flags['manifest-path']);
        const destructivePath = path.join(process.cwd(), this.flags['destructive-path']);

        // Check if the file exists
        try {
            await fsPromise.access(manifestPath, fsPromise.constants.F_OK);
        } catch (err) {
            throw new SfError(`File does not exist: ${manifestPath}`);
        }

        EONLogger.log(COLOR_TRACE(`File exists: ${manifestPath}`));

        try {
          await fsPromise.access(destructivePath, fsPromise.constants.F_OK);
        } catch (err) {
            throw new SfError(`File does not exist: ${destructivePath}`);
        }

        EONLogger.log(COLOR_TRACE(`File exists: ${destructivePath}`));

        const componetSet = await ComponentSetBuilder.build({
            apiversion: '50.0',
            manifest: {
                manifestPath: this.flags['manifest-path'],
                directoryPaths: packageDirs,
                destructiveChangesPost: this.flags['destructive-path'],
            },
        });

        if (componetSet?.destructiveChangesPost.size === 0) {
            EONLogger.log(COLOR_WARNING(`No destructive changes found in file ${destructivePath}`));
            return {};
        }

        EONLogger.log(COLOR_INFO_BOLD(`Found destructive changes for this files 👇`));

        let inputTable = new Table({
            head: ['Type', 'Name'],
            colWidths: [60, 60], // Requires fixed column widths
            wordWrap: true,
        });

        for (const [key] of componetSet.destructiveChangesPost) {
            const compInfo = key.split('#');
            inputTable.push([compInfo[0], compInfo[1]]);
        }

        EONLogger.log(inputTable.toString());
        EONLogger.log(COLOR_NOTIFY(`Deploying destructive changes...`));

        const deploy = await componetSet.deploy({
            usernameOrConnection: this.org.getConnection() as any,
            apiOptions: { checkOnly: this.flags.checkonly, rollbackOnError: this.flags.rollback, ignoreWarnings: this.flags['ignore-warnings'] },
        });

        let counter = 0;

        deploy.onUpdate((response) => {
            if (counter === 5) {
                const message = `⌛ Destructive deployment is in progress`;
                counter = 0;
            } else {
                counter++;
            }
        });

        deploy.onCancel(() => {
            throw new SfError('Deployment canceled by user or from org side');
        });

        let outputTable = new Table({
            head: ['Type', 'Name', 'Status', 'Error'],
            colWidths: [20, 30, 10, 60], // Requires fixed column widths
            wordWrap: true,
        });

        const res = await deploy.pollStatus();
        //success comps
        if (
            Array.isArray(res.response.details.componentSuccesses) &&
            res.response.details.componentSuccesses.length > 0
        ) {
            for (const successer of res.response.details.componentSuccesses) {
                if (successer.deleted) {
                    outputTable.push([
                        COLOR_SUCCESS(successer.componentType),
                        COLOR_SUCCESS(successer.fullName),
                        '✅',
                        '',
                    ]);
                } else if(successer.problemType === 'Warning') {
                    outputTable.push([
                        COLOR_WARNING(successer.componentType),
                        COLOR_WARNING(successer.fullName),
                        'ℹ️',
                        COLOR_WARNING(successer.problem),
                    ]);
                }
            }
        } else if (
            typeof res.response.details.componentSuccesses === 'object' &&
            Object.keys(res.response.details.componentSuccesses).length > 0
        ) {
            const successer = res.response.details.componentSuccesses as DeployMessage;
            if (successer.deleted) {
                outputTable.push([COLOR_SUCCESS(successer.componentType), COLOR_SUCCESS(successer.fullName), '✅', '']);
            }
        }
        //warning comps
        if (
            Array.isArray(res.response.details.componentFailures) &&
            res.response.details.componentFailures.length > 0
        ) {
            for (const failure of res.response.details.componentFailures) {
                if (failure.problemType === 'Warning') {
                    outputTable.push([
                        COLOR_WARNING(failure.componentType),
                        COLOR_WARNING(failure.fullName),
                        'ℹ️',
                        failure.problem,
                    ]);
                }
            }
        } else if (
            typeof res.response.details.componentFailures === 'object' &&
            Object.keys(res.response.details.componentFailures).length > 0
        ) {
            const failure = res.response.details.componentFailures as DeployMessage;
            if (failure.problemType === 'Warning') {
                outputTable.push([
                    COLOR_WARNING(failure.componentType),
                    COLOR_WARNING(failure.fullName),
                    'ℹ️',
                    failure.problem,
                ]);
            }
        }
        let hasCompErrors = false;
        //error comps
        if (
            Array.isArray(res.response.details.componentFailures) &&
            res.response.details.componentFailures.length > 0
        ) {
            for (const failure of res.response.details.componentFailures) {
                if (failure.problemType === 'Error') {
                    hasCompErrors = true;
                    outputTable.push([
                        COLOR_ERROR(failure.componentType),
                        COLOR_ERROR(failure.fullName),
                        '❌',
                        failure.problem,
                    ]);
                }
            }
        } else if (
            typeof res.response.details.componentFailures === 'object' &&
            Object.keys(res.response.details.componentFailures).length > 0
        ) {
            const failure = res.response.details.componentFailures as DeployMessage;
            if (failure.problemType === 'Error') {
                hasCompErrors = true;
                outputTable.push([
                    COLOR_ERROR(failure.componentType),
                    COLOR_ERROR(failure.fullName),
                    '❌',
                    failure.problem,
                ]);
            }
        }

        EONLogger.log(COLOR_INFO_BOLD(`Deployment result 👇`));
        EONLogger.log(outputTable.toString());

        if(this.flags['write-output'] && res.response?.details){
          try {
          const outputDir = path.join(process.cwd(), '.eon/command');
          this.createProjectPackagePath('.eon/command');
          const outputFilePath = path.join(outputDir, 'destructive_deploy_output.json');
          EONLogger.log(COLOR_INFO(`Writing output to file ${outputFilePath}`));
          await fsPromise.writeFile(outputFilePath, JSON.stringify(res.response.details, null, 2));
          } catch (err) {
            throw new SfError(`Error writing output file: ${err}`);
          }
        }

        if (hasCompErrors) {
            throw new SfError(
                `Deployment failed. Please check error messages from table and fix this issues from package.`
            );
        }

        EONLogger.log(COLOR_SUCCESS(`Destructive deployment successfully 🎉`));

        return {};
    }

    createProjectPackagePath = (directoryPath: string): void => {
      const normalizedPath = path.join(process.cwd(), directoryPath)
      const segments = normalizedPath.split(path.sep)

      // Erstelle den Pfad rekursiv
      segments.reduce((currentPath, folder) => {
        currentPath += folder + path.sep
        if (!fs.existsSync(currentPath)) {
          fs.mkdirSync(currentPath)
        }
        return currentPath
      }, '')
    }
}
