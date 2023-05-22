/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, NamedPackageDir, SfdxProjectJson } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import EONLogger, { COLOR_ERROR, COLOR_HEADER, COLOR_INFO, COLOR_NOTIFY, COLOR_TRACE } from '../../../../eon/EONLogger';
import { LOGOBANNER } from '../../../../eon/logo';
import { DevKitYaml, getDevKits } from '../../../../helper/devkit-constants';
import execa from 'execa';
import path from 'path';
import { Listr } from 'listr2';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'devkit');

export default class Apply extends SfdxCommand {
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

    const projectJson: SfdxProjectJson = await this.project.retrieveSfProjectJson();
    let packageDirs: NamedPackageDir[] = projectJson.getUniquePackageDirectories();
    const username: string = await this.org.getUsername();
    EONLogger.log(COLOR_HEADER('Applying DevKit ' + packagename + ' for ' + username));
    EONLogger.log('');
    // check if package exists
    if (!packageDirs.map((a) => a.package).includes(packagename)) {
      EONLogger.log(COLOR_ERROR('Package ' + packagename + ' does not exist in sfdx.project.json'));
      return;
    }
    const devkit: DevKitYaml = await getDevKits(packageDirs, packagename);

    const tasks = new Listr([]);

    if (devkit.permissionsets && devkit.permissionsets.length > 0) {
      tasks.add({
        title: `Assign Permissionsets`,
        task: async () => {
          const permissionsets: string = devkit.permissionsets.join(',');
          try {
            await execa('sfdx', ['force:user:permset:assign', '--permsetname',  permissionsets, '--json']);
          } catch (error) {
            EONLogger.log(COLOR_NOTIFY('Assigning Permissionset finished with following message(s):'));
            console.log(error?.stdout);
          }
        },
      });
    }
    if (devkit.anonymous_apex && devkit.anonymous_apex?.length > 0) {
      devkit.anonymous_apex.forEach((script) => {
        tasks.add({
          title: `Executing Apex: ${devkit.anonymous_apex}`,
          task: async () => {
            try {
              await execa('sfdx', ['force:apex:execute', '-f ', script]);
              EONLogger.log(COLOR_TRACE('Script executed'));
            } catch (error) {
              EONLogger.log(COLOR_NOTIFY('Executing Anonymous Apex finished with following message:'));
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
    if (devkit.test_data && devkit.test_data?.length > 0) {
      devkit.test_data.forEach((data) => {
        tasks.add({
          title: `Executing Data Import: ${data}`,
          task: async () => {
            try {
              await execa('sfdx', [
                'sfdmu:run',
                '--sourceusername',
                'csvfile',
                '--targetusername',
                username,
                '--path',
                path.dirname(data),
              ]);
              EONLogger.log(COLOR_TRACE('Data imported'));
            } catch (error) {
              EONLogger.log(COLOR_NOTIFY('Importing data finished with following message:'));
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
    EONLogger.log(COLOR_HEADER('DevKit applied.'));
    EONLogger.log('');
    const { Confirm } = require('enquirer');
    const resetSourceTracking = await new Confirm({
      name: 'resetSourceTracking',
      message: 'Do you want to reset source tracking for this scratch org before starting development?',
    })
      .run()
      .catch(console.error);

    if (!resetSourceTracking) {
      return {};
    }
    // optional reset of tracking
    EONLogger.log(COLOR_NOTIFY('Resetting source tracking...'));
    await execa('sfdx', ['force:source:tracking:reset', '--noprompt']);

    EONLogger.log(COLOR_INFO('Done.'));
    return {};
  }
}
