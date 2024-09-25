import * as os from 'os';
import { Messages, SfProjectJson, SfError, Org, ConfigAggregator } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import EONLogger, { COLOR_ERROR, COLOR_HEADER, COLOR_NOTIFY, COLOR_TRACE, COLOR_INFO } from '../../../../eon/EONLogger';
import { LOGOBANNER } from '../../../../eon/logo';
import { DevKitYaml, getDevKits } from '../../../../helper/devkit-constants';
import execa from 'execa';
import path from 'path';
import { Listr } from 'listr2';
import { Flags } from '@oclif/core';
import EonCommand from '../../../../EonCommand';
import { NamedPackageDirLarge } from '../../../../helper/types';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'devkit');

export default class RetrieveDevkit extends EonCommand {
    public static description = messages.getMessage('commandDescription_apply');

    public static examples = messages.getMessage('examples').split(os.EOL);

    static flags = {
        package: Flags.string({
            char: 'p',
            description: messages.getMessage('packageFlag'),
            required: true,
        }),
        'target-org': Flags.string({
            char: 'o',
            aliases: ['targetusername', 'u'],
            description: 'Login username or alias for the target org.',
        }),
    };

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    protected static requiresUsername = false;
    public async execute(): Promise<AnyJson> {
        EONLogger.log(COLOR_HEADER(LOGOBANNER));
        const packagename = this.flags.package;

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

        const projectJson: SfProjectJson = await this.project.retrieveSfProjectJson();
        const json = projectJson.getContents();
        let packageDirs: NamedPackageDirLarge[] = json.packageDirectories as NamedPackageDirLarge[];
        const username: string = await this.org.getUsername();
        EONLogger.log(COLOR_HEADER('Retrieve Testdata of DevKit ' + packagename + ' for ' + username));
        EONLogger.log('');
        // check if package exists
        if (!packageDirs.map((a) => a.package).includes(packagename)) {
            EONLogger.log(COLOR_ERROR('Package ' + packagename + ' does not exist in sfdx.project.json'));
            return;
        }
        const devkit: DevKitYaml = await getDevKits(packageDirs, packagename);

        const tasks = new Listr([]);

        if (devkit.test_data && devkit.test_data?.length > 0) {
            devkit.test_data.forEach((data) => {
                tasks.add({
                    title: `Retrieving data for: ${data}`,
                    task: async () => {
                        try {
                            await execa('sfdx', [
                                'sfdmu:run',
                                '--targetusername',
                                'csvfile',
                                '--sourceusername',
                                username,
                                '--path',
                                path.dirname(data),
                            ]);
                            EONLogger.log(COLOR_TRACE('Data retrieved for ' + data));
                        } catch (error) {
                            EONLogger.log(COLOR_NOTIFY('retrieving data finished with following message:'));
                            EONLogger.log(
                                COLOR_TRACE(`
${error}
            `)
                            );
                        }
                    },
                });
            });
        }
        await tasks.run();

        EONLogger.log('');
        EONLogger.log(COLOR_HEADER('Testdata in DevKit refreshed.'));
        return {};
    }
}
