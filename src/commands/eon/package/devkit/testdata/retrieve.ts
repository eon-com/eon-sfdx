/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, NamedPackageDir } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import EONLogger, { COLOR_ERROR, COLOR_HEADER, COLOR_NOTIFY, COLOR_TRACE } from '../../../../../eon/EONLogger';
import { LOGOBANNER } from '../../../../../eon/logo';
import { DevKitYaml, getDevKits } from '../../../../../helper/devkit-constants';
import execa from 'execa';
import path from 'path';
import { Listr } from 'listr2';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'devkit');

export default class RetrieveDevkit extends SfdxCommand {
  public static description = messages.getMessage('commandDescription_apply');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    package: flags.string({
      char: 'p',
      description: messages.getMessage('packageFlag'),
      required: true,
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  protected static requiresUsername = true;
  public async run(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    const packagename = this.flags.package;

    const projectJson = await this.project.retrieveSfdxProjectJson();
    let packageDirs: NamedPackageDir[] = projectJson.getUniquePackageDirectories();
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
