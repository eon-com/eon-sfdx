/* eslint-disable @typescript-eslint/quotes */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfError, SfProject } from '@salesforce/core';
import { ExternalDataSource } from '../../../helper/types';
import EONLogger, { COLOR_ERROR, COLOR_SUCCESS, COLOR_HEADER } from '../../../eon/EONLogger';
import getSettingValue from '../../../helper/aliasify-configuration';
import { LOGOBANNER } from '../../../eon/logo';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'update');

export default class Externaldatasource extends SfdxCommand {
  public static description = messages.getMessage('commandDescription_datasource');

  public static examples = messages.getMessage('examples_datasource').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    // Label For Named Credential as Required
    name: flags.string({
      char: 'n',
      description: messages.getMessage('nameFlagDescription_datasource'),
      required: true,
    }),
    endpoint: flags.string({
      char: 'e',
      description: messages.getMessage('endpointFlagDescription_datasource'),
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
    const endpoint = this.flags.endpoint
      ? await getSettingValue(this.flags.endpoint, this.flags.alias, await SfProject.resolve())
      : undefined;

    const connection = this.org.getConnection();

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
