import * as os from 'os';
import { Connection, Messages, SfError, Org, ConfigAggregator } from '@salesforce/core';
import { ExternalDataSource } from '../../helper/types';
import EONLogger, { COLOR_ERROR, COLOR_SUCCESS, COLOR_HEADER, COLOR_NOTIFY, COLOR_INFO } from '../../eon/EONLogger';
import getSettingValue from '../../helper/aliasify-configuration';
import { LOGOBANNER } from '../../eon/logo';
import { Flags } from '@oclif/core';
import EonCommand from '../../EonCommand';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'update');

export default class Externaldatasource extends EonCommand {
    public static description = messages.getMessage('commandDescription_datasource');

    public static examples = messages.getMessage('examples_datasource').split(os.EOL);

    static flags = {
        // Label For Named Credential as Required
        name: Flags.string({
            char: 'n',
            description: messages.getMessage('nameFlagDescription_datasource'),
            required: true,
        }),
        endpoint: Flags.string({
            char: 'e',
            description: messages.getMessage('endpointFlagDescription_datasource'),
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
        const endpoint = this.flags.endpoint
            ? await getSettingValue(this.flags.endpoint, this.flags.alias, this.project)
            : undefined;

        const connection: Connection = this.org.getConnection();

        const responseFromOrg: ExternalDataSource[] = await connection.tooling
            .sobject('ExternalDataSource')
            .find({ DeveloperName: this.flags.name })
            .execute();
        if (responseFromOrg.length < 0) {
            throw new SfError(`No external data source with MasterLabel ${this.flags.name} found in org.`);
        }
        let externalDataSource: ExternalDataSource = responseFromOrg[0];
        await connection.tooling
            .sobject('ExternalDataSource')
            .update({
                Id: externalDataSource.Id,
                Metadata: {
                    endpoint: endpoint,
                    label: externalDataSource.Metadata.label,
                    principalType: externalDataSource.Metadata.principalType,
                    protocol: externalDataSource.Metadata.protocol,
                    type: externalDataSource.Metadata.type,
                    isWritable: externalDataSource.Metadata.isWritable,
                },
            })
            .catch((e) => {
                EONLogger.log(COLOR_ERROR(`could not update the external data source: ${e}`));
                this.exit(1);
            })
            .then((result) => EONLogger.log(COLOR_SUCCESS(`updated external data source successfully`)));
    }
}
