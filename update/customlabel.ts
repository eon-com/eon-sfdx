/* eslint-disable @typescript-eslint/quotes */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { Connection, Messages, SfdxError } from '@salesforce/core';
import { CustomLabel } from '../../../helper/types';
import getSettingValue from '../../../helper/aliasify-configuration';
import EONLogger, { COLOR_ERROR, COLOR_SUCCESS, COLOR_HEADER } from '../../../eon/EONLogger';
import { LOGOBANNER } from '../../../eon/logo';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'update');

export default class Customlabel extends SfdxCommand {
  public static description = messages.getMessage('commandDescription_customlabel');

  public static examples = messages.getMessage('examples_customlabel').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    // Label For Named Credential as Required
    name: flags.string({
      char: 'n',
      description: messages.getMessage('nameFlagDescription'),
      required: true,
    }),
    value: flags.string({
      char: 'c',
      description: messages.getMessage('valueFlagDescription_customlabel'),
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
    // prepare values and settings
    const value = await getSettingValue(this.flags.value, this.flags.alias, this.project);
    const connection: Connection = this.org.getConnection();

    const responseFromOrg: CustomLabel[] = await connection.tooling
      .sobject('ExternalString')
      .find({ MasterLabel: this.flags.name })
      .execute();
    if (responseFromOrg.length < 0) {
      throw new SfdxError(`No Label with MasterLabel ${this.flags.name} found in org.`);
    }
    const label: CustomLabel = responseFromOrg[0];
    label.Value = value;
    await connection.tooling
      .sobject('ExternalString')
      .update({ Id: label.Id, Value: value })
      .catch((e) => {
        EONLogger.log(COLOR_ERROR(`could not update the label: ${e}`));
        this.exit(1);
      })
      .then((result) => EONLogger.log(COLOR_SUCCESS(`updated label successfully`)));
  }
}
