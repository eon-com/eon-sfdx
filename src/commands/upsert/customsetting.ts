/* eslint-disable @typescript-eslint/quotes */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { Flags } from '@oclif/core';
import EonCommand from '../../EonCommand';
import { Messages, SfError, Org, ConfigAggregator } from '@salesforce/core';
import EONLogger, {
    COLOR_HEADER,
    COLOR_TRACE,
    COLOR_ERROR,
    COLOR_SUCCESS,
    COLOR_NOTIFY,
    COLOR_INFO,
} from '../../eon/EONLogger';
import { LOGOBANNER } from '../../eon/logo';
import getSettingValue from '../../helper/aliasify-configuration';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'upsert');

export default class CustomSetting extends EonCommand {
    public static description = messages.getMessage('commandDescription_customsetting');

    public static examples = messages.getMessage('examples_customsetting').split(os.EOL);

    public static readonly flags = {
        //Label For Named Credential as Required
        name: Flags.string({
            char: 'n',
            description: messages.getMessage('nameFlagDescription'),
            required: true,
        }),
        key: Flags.string({
            char: 'k',
            description: messages.getMessage('keyFlagDescription_customsetting'),
            required: true,
        }),
        value: Flags.string({
            char: 'v',
            description: messages.getMessage('valueFlagDescription_customsetting'),
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
        const value = this.flags.value
            ? await getSettingValue(this.flags.value, this.flags.alias, this.project)
            : undefined;
        const conn = this.org.getConnection();
        const query = `select id, ${this.flags.key}, SetupOwnerId from ${this.flags.name}`;

        // The type we are querying for
        interface Settings {
            Id: string;
            [key: string]: any;
        }

        // Query the org
        const result = await conn.query<Settings>(query);
        let res = result.records.find((record) => record.SetupOwnerId.substring(0, 3) == '00D');
        // Check Result From Query
        if (!res) {
            EONLogger.log(COLOR_TRACE('Setting does not exist yet. Initializing new...'));
            const newRecord = {};
            newRecord[this.flags.key] = value;
            const newSetting = await conn.sobject(this.flags.name).create(newRecord);
            if (!newSetting.success) {
                EONLogger.log(COLOR_ERROR(`Update not successfully. Please try again`));
            } else {
                EONLogger.log(COLOR_SUCCESS(`update custom settings successfully`));
            }
        } else {
            res[this.flags.key] = value;
            const opResult = await conn.sobject(this.flags.name).update(res);
            if (!opResult.success) {
                EONLogger.log(COLOR_ERROR(`Update not successfully. Please try again`));
            } else {
                EONLogger.log(COLOR_SUCCESS(`update custom settings successfully`));
            }
        }
    }
}
