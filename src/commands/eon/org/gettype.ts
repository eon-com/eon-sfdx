/* eslint-disable @typescript-eslint/quotes */

import * as os from 'os';
import { SfdxCommand } from '@salesforce/command';
import { Connection, Messages } from '@salesforce/core';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'org');

export default class Gettype extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');
  public static examples = messages.getMessage('examples').split(os.EOL);
  public static args = [{ name: 'file' }];

  protected static requiresUsername = true;

  public async run(): Promise<void> {
    const connection: Connection = this.org.getConnection();
    const query = `SELECT IsSandbox, TrialExpirationDate FROM Organization`;
    let orgType: string;
    // The type we are querying for
    interface Settings {
      Id?: string;
      [key: string]: any;
    }

    // Query the org
    const result = await connection.query<Settings>(query);

    if (result.records) {
      if (result.records[0].IsSandbox) {
        orgType = result.records[0].TrialExpirationDate ? 'scratchorg' : 'sandbox';
      } else {
        orgType = 'production';
      }
      console.log(orgType);
    }
  }
}
