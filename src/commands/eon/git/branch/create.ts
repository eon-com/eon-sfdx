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
import simplegit, { SimpleGit } from 'simple-git';
const { Input } = require('enquirer');
const { Select } = require('enquirer');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

import EONLogger, {
  COLOR_KEY_MESSAGE,
  COLOR_HEADER,
  COLOR_TRACE,
  COLOR_NOTIFY,
  COLOR_SUCCESS,
  COLOR_WARNING,
  COLOR_ERROR
} from '../../../../eon/EONLogger';
import path from 'path';
import { SfpowerscriptsArtifact2, PackageDirParsed, BranchCreateResponse } from '../../../../helper/types';
//import Table from 'cli-table3';
import { LOGOBANNER } from '../../../../eon/logo';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'branch_create');

export default class GitHotfixCreate extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    // Label For Named Credential as Required
    package: flags.string({
      char: 'p',
      description: messages.getMessage('packageFlag'),
      required: true,
    }),
    ticket: flags.string({
      char: 't',
      description: messages.getMessage('ticketFlag'),
      required: false,
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    EONLogger.log(COLOR_KEY_MESSAGE('Start creating branch from gitlab...'));
    EONLogger.log(COLOR_HEADER(`👉 Hotfix-Branch: hotfix-${this.flags.ticket}-${this.flags.package} 👈`));

    //prompt for org
    this.org.getConnection().getAuthInfoFields().instanceUrl;
    const orgSelection = await new Select({
      message: `Confirm org 👉 ${this.org.getConnection().getAuthInfoFields().instanceUrl}:`,
      initial: 0,
      choices: [
        { name: 'Yes', message: `Yes that's right 👍`, value: 'Yes' },
        { name: 'No', message: `Ohh its the wrong org. Please let me start again`, value: 'No' },
      ],
    })
      .run()
      .catch(console.error);
    // exit if no was selected
    if (orgSelection === 'No') {
      EONLogger.log(COLOR_WARNING('Skip next steps and finish command. Bye 👋'));
      return {};
    }
    const orgResponse = await this.getCommitFromOrg();
    if (!orgResponse.commit) {
      throw new SfdxError(`Found no Commit Id on Org! Please check the package name.`);
    }
    EONLogger.log(COLOR_TRACE(`Found commit id ${orgResponse.commit} and new version: ${orgResponse.version} 👌`));
    //get branch
    if (this.flags.ticket) {
      const branchSelection = await new Select({
        message: `Do you like to create the branch hotfix-${this.flags.ticket}-${this.flags.package}? 🤔`,
        initial: 0,
        choices: [
          { name: 'Yes', message: `Yes`, value: 'Yes' },
          { name: 'No', message: 'No ,go to next step', value: 'No' },
        ],
      })
        .run()
        .catch(console.error);
      // exit if no was selected
      if (branchSelection === 'Yes') {
        await this.getBranch(orgResponse);
      }
    }
    //update package tree
    const treeSelection = await new Select({
      message: `Do you like to update the package tree with ignoreOnStage build flag? 🧐`,
      initial: 0,
      choices: [
        { name: 'Yes', message: `Yes`, value: 'Yes' },
        { name: 'No', message: 'No ,go to next step', value: 'No' },
      ],
    })
      .run()
      .catch(console.error);
    // exit if no was selected
    if (treeSelection === 'Yes') {
      await this.updatePackageTree(orgResponse);
    }

    let taskCounter = true;
    while (taskCounter) {
      taskCounter = await this.generateGitTasks();
    }

    EONLogger.log(COLOR_SUCCESS(`Yippiee. 🤙 Branch created and project.json updated without errors. Great 🤜🤛`));
    return {};
  }
  private async updatePackageTree(orgResponse: BranchCreateResponse): Promise<void> {
    let git: SimpleGit = simplegit();
    const responseJson = await git.show([`${orgResponse.commit}:sfdx-project.json`]);

    const parsedResponseJson = JSON.parse(responseJson);
    const projectJson: PackageDirParsed[] = parsedResponseJson?.packageDirectories;

    EONLogger.log(COLOR_TRACE('Update package tree with ignoreOnStage build flag'));
    const packageTree = new Map<string, PackageDirParsed>();
    for (const packageDir of projectJson) {
      if (this.flags.package === packageDir.package) {
        const versionSelection = await new Select({
          message: 'Choise next steps for the package version:',
          initial: 0,
          choices: [
            {
              name: 'Yes',
              message: `Update to new patch version ${orgResponse.version} from org x.x.+1`,
              value: 'Yes',
            },
            { name: 'No', message: 'No thx. Go to next steps', value: 'No' },
          ],
        })
          .run()
          .catch(console.error);

        if (versionSelection === 'Yes') {
          packageDir.versionNumber = orgResponse.version;
        }
        packageTree.set(packageDir.package, packageDir);
        continue;
      }
      if (packageDir.ignoreOnStage && Array.isArray(packageDir.ignoreOnStage) && packageDir.ignoreOnStage.length > 0) {
        if (!packageDir.ignoreOnStage.includes('build')) {
          packageDir.ignoreOnStage.push('build');
        }
      } else {
        packageDir['ignoreOnStage'] = ['build'];
      }
    }
    if (packageTree.size === 0) {
      throw new SfdxError(`Package ${this.flags.package} not found in sfdx-project.json`);
    }
    await this.project.getSfdxProjectJson().write(parsedResponseJson);
  }

  private async getBranch(orgResponse: BranchCreateResponse): Promise<void> {
    EONLogger.log(COLOR_TRACE('Start git tasks...'));
    const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();
    let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
    await git.fetch();
    EONLogger.log(COLOR_TRACE(`Check if the branch hotfix-${this.flags.ticket}-${this.flags.package} exist`));
    const branchSummary = await git.branch([`hotfix-${this.flags.ticket}-${this.flags.package}`, `-l`, `-r`]);
    if (Object.keys(branchSummary.branches).length > 0) {
      EONLogger.log(COLOR_NOTIFY(`Yes... Branch exist on remote. So force checkout on existing branch`));
      await git.checkout([`hotfix-${this.flags.ticket}-${this.flags.package}`, '-f']);
    } else {
      EONLogger.log(COLOR_TRACE(`No... Branch doesn't exist on remote`));
      EONLogger.log(COLOR_TRACE(`But exist the branch local? 🧐`));
      const branchSummary = await git.branch([`hotfix-${this.flags.ticket}-${this.flags.package}`, `-l`]);
      if (Object.keys(branchSummary.branches).length > 0) {
        EONLogger.log(COLOR_NOTIFY(`Yes... Branch exist local. So force checkout on existing branch`));
        await git.checkout([`hotfix-${this.flags.ticket}-${this.flags.package}`, '-f']);
      } else {
        EONLogger.log(COLOR_NOTIFY(`No... Branch doesn't exist also local. So create a new branch and force checkout`));
        EONLogger.log(COLOR_NOTIFY(`Wait 3 seconds...So that the IDE has time to switch the branch 😉`));
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await git.checkout(['-b', `hotfix-${this.flags.ticket}-${this.flags.package}`, orgResponse.commit]);
        EONLogger.log(COLOR_NOTIFY(`Branch created!`));
      }
    }
  }

  private async getCommitFromOrg(): Promise<BranchCreateResponse> {
    EONLogger.log(COLOR_TRACE(`Select custom object SfpowerscriptsArtifact2 ...`));
    EONLogger.log(COLOR_TRACE(`Username: ${this.org.getConnection().getUsername()}`));

    let responseFromOrg: SfpowerscriptsArtifact2;
    try {
      responseFromOrg = await this.org
        .getConnection()
        .singleRecordQuery<SfpowerscriptsArtifact2>(
          `Select Id,CommitId__c, Version__c from SfpowerscriptsArtifact2__c Where Name = '${this.flags.package}'`
        );
    } catch (e) {
      throw new SfdxError(
        `Its not possible to select Commit Id from SfpowerscriptsArtifact2. Pelase check the details: ${e.message}`
      );
    }
    if (!responseFromOrg.Id) {
      throw new SfdxError(
        `Its not possible to select Commit Id from SfpowerscriptsArtifact2. Pelase check the details: ${responseFromOrg}`
      );
    }

    const parsedVersionOld = responseFromOrg.Version__c.slice(0, responseFromOrg.Version__c.lastIndexOf('.'));
    const newPackageVersion = `${parsedVersionOld.slice(0, parsedVersionOld.lastIndexOf('.'))}.${
      parseInt(parsedVersionOld.slice(parsedVersionOld.lastIndexOf('.') + 1)) + 1
    }.NEXT`;

    return { commit: responseFromOrg.CommitId__c, version: newPackageVersion };
  }

  private async generateGitTasks(): Promise<boolean> {
    let git: SimpleGit = simplegit();
    // ask, if dependencies should be updated
    const taskSelection = await new Select({
      message: 'Choise next steps:',
      initial: 0,
      choices: [
        { name: 'pretty', message: 'Run prettier on your staged changes', value: 'pretty' }, //<= choice object
        { name: 'cherry-pick', message: 'Cherry-pick a merge commit', value: 'cherry-pick' }, //<= choice object
        { name: 'push', message: 'Push your changes to the remote branch', value: 'push' }, //<= choice object
        { name: 'return', message: 'Exit from this command. Bye 👋', value: 'cherry-pick' }, //<= choice object
      ],
    })
      .run()
      .catch(console.error);

    // exit if no was selected
    if (taskSelection === 'return') {
      return false;
    }

    if (taskSelection === 'pretty') {
      try {
        const { stdout, stderr } = await exec(`npx pretty-quick --staged`, {
          timeout: 0,
          encoding: 'utf-8',
          maxBuffer: 5242880,
        });
        if (stderr) {
          EONLogger.log(COLOR_TRACE(`Pretty Quick Command Error: ${stderr}`));
        }
        if (stdout) {
          EONLogger.log(stdout);
        }
      } catch (e) {
        EONLogger.log(COLOR_TRACE(`Pretty Quick Command Error: ${e}`));
      }
      return true;
    }

    if (taskSelection === 'cherry-pick') {
      const inputMerge = await new Input({
        name: 'mergeId',
        message: 'Please enter commit id:',
      })
        .run()
        .catch(console.error);

      EONLogger.log(COLOR_TRACE(`Run command 👉 git cherry-pick -m1 ${this.flags.merge}`));

      try {
        await git.raw(['cherry-pick', inputMerge, '-m1']);
      } catch (e) {
        EONLogger.log(
          COLOR_WARNING(`Cherry pick failed. Please check the details: ${e.message} \n\n ${e.stderr} \n\n ${e.stdout}`)
        );
        EONLogger.log(
          COLOR_WARNING(`👆 Please check merge for merge conflicts and resolve them before the next steps`)
        );
      }
      return true;
    }

    if (taskSelection === 'push') {
      const localBranchName = await git.raw(['rev-parse', '--abbrev-ref', 'HEAD']);
      EONLogger.log(COLOR_TRACE(`Run command 👉 git push -u origin ${localBranchName}`));
      try{
      await git.raw(['push','-u','origin',`${localBranchName.trim()}`]);
      }catch(e){
        EONLogger.log(COLOR_ERROR(`💥 ${e.message}`))
      }
      return true;
    }
  }
}
