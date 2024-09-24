import * as os from 'os';
import { Messages, SfError, SfProjectJson, Org, ConfigAggregator } from '@salesforce/core';
import EONLogger, { COLOR_HEADER, COLOR_NOTIFY, COLOR_SUCCESS, COLOR_WARNING, COLOR_INFO } from '../../eon/EONLogger';
import { LOGOBANNER } from '../../eon/logo';
import getSettingValue from '../../helper/aliasify-configuration';
import { getAllFiles } from '../../helper/package-permissionsets';
import fspromise from 'fs/promises';
import { PluginSettings } from '../../helper/types';
import path from 'path';
import { Flags } from '@oclif/core';
import EonCommand from '../../EonCommand';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'update');

export default class Metadata extends EonCommand {
    public static description = messages.getMessage('commandDescription_metadata');

    public static examples = messages.getMessage('examples_metadata').split(os.EOL);

    static flags = {
        // Label For Named Credential as Required
        directory: Flags.string({
            char: 'd',
            description: messages.getMessage('directoryMetadataFlagDescription'),
            required: true,
        }),
        artifactdirectory: Flags.string({
            char: 'k',
            description: messages.getMessage('artifactDirectoryMetadataFlagDescription'),
        }),
        placeholder: Flags.string({
            char: 'p',
            description: messages.getMessage('placeholderMetadataFlagDescription'),
            required: true,
        }),
        value: Flags.string({
            char: 'v',
            description: messages.getMessage('valueMetadataFlagDescription'),
            required: true,
        }),
        alias: Flags.string({
            char: 'a',
            description: messages.getMessage('aliasDescription'),
        }),
        'target-org': Flags.string({
            char: 'o',
            aliases: ['targetusername', 'u'],
            description: 'Login username or alias for the target org.',
        }),
    };

    protected static requiresUsername = false;
    protected static requiresProject = true;

    public async execute(): Promise<void> {
        EONLogger.log(COLOR_HEADER(LOGOBANNER));

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

        // get sfdx project.json
        const projectJson: SfProjectJson = await this.project.retrieveSfProjectJson();
        const settings: PluginSettings = projectJson.getContents()?.plugins['eon-sfdx'] as PluginSettings;

        // prepare values and settings
        const value = await getSettingValue(this.flags.value, this.flags.alias, this.project);
        const placeholder = settings.metadataPlaceholderFormat
            ? settings.metadataPlaceholderFormat.replace('placeholder', this.flags.placeholder)
            : `{[${this.flags.placeholder}]}`;

        const targetdir = this.flags.artifactdirectory
            ? path.join(this.flags.artifactdirectory, this.flags.directory)
            : this.flags.directory;

        try {
            const dirStat = await fspromise.stat(targetdir);
            let updatedFiles: string[] = [];
            if (dirStat.isDirectory()) {
                const filePaths = getAllFiles(targetdir);
                for await (const p of filePaths) {
                    const raw = await fspromise.readFile(p);
                    let content = raw.toString();
                    if (content.includes(placeholder)) {
                        content = content.replace(placeholder, value);
                        await fspromise.writeFile(p, content);
                        updatedFiles = [...updatedFiles, path.basename(p)];
                    }
                }
            } else {
                const raw = await fspromise.readFile(targetdir);
                let content = raw.toString();
                if (content.includes(placeholder)) {
                    content = content.replace(placeholder, value);
                    await fspromise.writeFile(targetdir, content);
                    updatedFiles = [...updatedFiles, path.basename(targetdir)];
                }
            }

            if (updatedFiles.length > 0) {
                EONLogger.log(
                    COLOR_SUCCESS(
                        `
The placeholder ` +
                            COLOR_NOTIFY(placeholder) +
                            ` was updated for following files:`
                    )
                );
                const Table = require('cli-table3');
                let print = new Table({
                    head: [COLOR_NOTIFY('Updated files')],
                });
                updatedFiles.forEach((f) => print.push([f]));
                console.log(print.toString());
            } else {
                EONLogger.log(
                    COLOR_WARNING(`
The placeholder was not found in specified file(s): No changes done.`)
                );
            }
        } catch (e) {
            throw new SfError(
                'No files found for this path or directory. Please ensure that --directory points to a valid folder or file.'
            );
        }
    }
}
