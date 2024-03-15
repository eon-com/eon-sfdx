/* eslint-disable @typescript-eslint/quotes */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { Connection, Messages, SfError } from '@salesforce/core';
import { NamedCredential } from '../../helper/types';
import EONLogger, { COLOR_ERROR, COLOR_SUCCESS, COLOR_HEADER } from '../../eon/EONLogger';
import getSettingValue from '../../helper/aliasify-configuration';
import { LOGOBANNER } from '../../eon/logo';
import { Flags } from '@oclif/core';
import  EonCommand  from '../../EonCommand';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'update');

export default class Namedcredential extends EonCommand {
  public static description = messages.getMessage('commandDescription_namedCredential');

  public static examples = messages.getMessage('examples_namedCredential').split(os.EOL);

  static flags = {
    // Label For Named Credential as Required
    name: Flags.string({
      char: 'n',
      description: messages.getMessage('nameFlagDescription_namedCredential'),
      required: true,
    }),
    endpoint: Flags.string({
      char: 'e',
      description: messages.getMessage('endpointFlagDescription_namedCredential'),
    }),
    password: Flags.string({
      char: 'p',
      description: messages.getMessage('passwordFlagDescription_namedCredential'),
    }),
    username: Flags.string({
      char: 's',
      description: messages.getMessage('usernameFlagDescription_namedCredential'),
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
    const endpoint = this.flags.endpoint
      ? await getSettingValue(this.flags.endpoint, this.flags.alias, this.project)
      : undefined;
    const password = this.flags.password
      ? await getSettingValue(this.flags.password, this.flags.alias, this.project)
      : undefined;
    const username = this.flags.username
      ? await getSettingValue(this.flags.username, this.flags.alias, this.project)
      : undefined;

    const connection: Connection = this.org.getConnection();

    const responseFromOrg: NamedCredential[] = await connection.tooling
      .sobject('NamedCredential')
      .find({ MasterLabel: this.flags.name })
      .execute();
    if (responseFromOrg.length < 0) {
      throw new SfError(`No Namedcredential with MasterLabel ${this.flags.name} found in org.`);
    }
    let namedCredential: NamedCredential = responseFromOrg[0];

    await connection.tooling
      .sobject('NamedCredential')
      .update({
        Id: namedCredential.Id,
        Metadata: { endpoint: endpoint, username: username, password: password, label: namedCredential.MasterLabel },
      })
      .catch((e) => {
        EONLogger.log(COLOR_ERROR(`could not update the namedCredential: ${e}`));
        this.exit(1);
      })
      .then((result) => EONLogger.log(COLOR_SUCCESS(`updated named credential successfully`)));
  }
}
