/* eslint-disable @typescript-eslint/quotes */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { Connection, Messages, SfError } from '@salesforce/core';
import { CustomLabel } from '../../helper/types';
import getSettingValue from '../../helper/aliasify-configuration';
import EONLogger, { COLOR_ERROR, COLOR_SUCCESS, COLOR_HEADER } from '../../eon/EONLogger';
import { LOGOBANNER } from '../../eon/logo';
import { Flags } from '@oclif/core';
import  EonCommand  from '../../EonCommand';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'update');

export default class Customlabel extends EonCommand {
  public static description = messages.getMessage('commandDescription_customlabel');

  public static examples = messages.getMessage('examples_customlabel').split(os.EOL);


  static flags = {
    // Label For Named Credential as Required
    name: Flags.string({
      char: 'n',
      description: messages.getMessage('nameFlagDescription'),
      required: true,
    }),
    value: Flags.string({
      char: 'c',
      description: messages.getMessage('valueFlagDescription_customlabel'),
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
      required: true,
    }),
  };

  protected static requiresUsername = true;
  protected static requiresProject = true;

  public async execute(): Promise<void> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    // prepare values and settings
    const value = await getSettingValue(this.flags.value, this.flags.alias, this.project);
    const connection: Connection = this.org.getConnection();

    const responseFromOrg: CustomLabel[] = await connection.tooling
      .sobject('ExternalString')
      .find({ MasterLabel: this.flags.name })
      .execute();
    if (responseFromOrg.length < 0) {
      throw new SfError(`No Label with MasterLabel ${this.flags.name} found in org.`);
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
