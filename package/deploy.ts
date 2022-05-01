/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError, SfdxProjectJson } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { Listr } from 'listr2';
const Table = require('cli-table3');
import { ComponentSet, DeployMessage, MetadataApiDeploy } from '@salesforce/source-deploy-retrieve';
import { getDeployUrls } from '../../../helper/get-packages';
import { DeployError, PackageTree } from '../../../helper/types';
import EONLogger, { COLOR_HEADER } from '../../../eon/EONLogger';
import { LOGOBANNER } from '../../../eon/logo';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'deploy');

export default class Deploy extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    packagename: flags.string({
      char: 'p',
      description: messages.getMessage('packageFlagDescription'),
    }),
    includedependencies: flags.boolean({
      char: 'i',
      required: false,
      description: messages.getMessage('depFlagDescription'),
    }),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    this.ux.log('Note: Managed Packages are not considered when deploying the dependencies...');
    // map flags to variables
    const packagename = (this.flags.packagename || this.args.file) as string;

    const includedependencies = (this.flags.includedependencies || '') as boolean;
    // get packages
    const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();
    const packageDependencyTree: PackageTree = getDeployUrls(projectJson, packagename);

    if (packageDependencyTree) {
      const tasks = new Listr([]);

      if (includedependencies) {
        packageDependencyTree.dependency.forEach((dep) => {
          if (dep.path) {
            tasks.add({
              title: `Deploy Dependency: ${dep.packagename}`,
              task: async () => {
                await this.deployPackageTreeNode(dep);
              },
            });
          }
        });
      }
      tasks.add({
        title: `Deploy Package: ${packagename}`,
        task: async () => {
          await this.deployPackageTreeNode(packageDependencyTree);
        },
      });
      await tasks.run();
      // deploy dependencies
    } else {
      throw new SfdxError(messages.getMessage('errorNoPckResults', [packagename]));
    }

    const outputString = 'All done.';
    this.ux.log(outputString);

    // Return an object to be displayed with --json
    return { orgId: this.org.getOrgId(), outputString };
  }

  private async deployPackageTreeNode(treeNode: PackageTree): Promise<void> {
    const path: string = treeNode.path;

    const deploy: MetadataApiDeploy = await ComponentSet.fromSource(path).deploy({
      usernameOrConnection: this.org.getConnection().getUsername(),
    });
    this.ux.startSpinner(`deploying ${treeNode.packagename}`);
    // Attach a listener to check the deploy status on each poll
    deploy.onUpdate((response) => {
      const { status } = response;
      this.ux.setSpinnerStatus(status);
    });

    // Wait for polling to finish and get the DeployResult object
    const res = await deploy.pollStatus();
    if (!res.response.success) {
      console.log(this.print(res.response.details.componentFailures));
      this.ux.stopSpinner(`Deployment of ${treeNode.packagename} failed.`);

      throw new SfdxError(messages.getMessage('errorDeployFailed', ['Deployment failed. Check errors.']));
    } else {
      this.ux.stopSpinner(`Deployment of ${treeNode.packagename} done.`);
    }
  }

  private print(input: DeployMessage | DeployMessage[]): string {
    var table = new Table({
      head: ['Component Name', 'Error Message'],
    });
    let result: DeployError[] = [];
    if (Array.isArray(input)) {
      result = input.map((a) => {
        const res: DeployError = {
          Name: a.fullName + ': Line ' + a.lineNumber,
          Type: a.componentType,
          Status: a.problemType,
          Message: a.problem,
        };
        return res;
      });
    } else {
      const res: DeployError = {
        Name: input.fullName + ': ' + input.lineNumber,
        Type: input.componentType,
        Status: input.problemType,
        Message: input.problem,
      };
      result = [...result, res];
    }
    result.forEach((r) => {
      let obj = {};
      obj[r.Name] = r.Message;
      table.push(obj);
    });

    return table.toString();
  }
}
