/* eslint-disable @typescript-eslint/quotes */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import EONLogger, { COLOR_HEADER, COLOR_TRACE, COLOR_ERROR, COLOR_SUCCESS } from '../../../eon/EONLogger';
import { LOGOBANNER } from '../../../eon/logo';
import getSettingValue from '../../../helper/aliasify-configuration';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'upsert');

export default class CustomSetting extends SfdxCommand {
  public static description = messages.getMessage('commandDescription_customsetting');

  public static examples = messages.getMessage('examples_customsetting').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    //Label For Named Credential as Required
    name: flags.string({
      char: 'n',
      description: messages.getMessage('nameFlagDescription'),
      required: true,
    }),
    key: flags.string({
      char: 'k',
      description: messages.getMessage('keyFlagDescription_customsetting'),
      required: true,
    }),
    value: flags.string({
      char: 'v',
      description: messages.getMessage('valueFlagDescription_customsetting'),
      required: true,
    }),
    alias: flags.string({
      char: 'a',
      description: messages.getMessage('aliasDescription'),
    }),
  };

  protected static requiresUsername = true;
  protected static requiresProject = true;

  public async run(): Promise<void> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    const value = this.flags.value
      ? await getSettingValue(this.flags.value, this.flags.alias, this.project)
      : undefined;
    const conn = this.org.getConnection();
    const query = `select id, ${this.flags.key}, SetupOwnerId from ${this.flags.name}`;

    // The type we are querying for
    interface Settings {
      Id?: string;
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
