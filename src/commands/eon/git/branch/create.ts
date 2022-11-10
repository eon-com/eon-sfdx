/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import {Messages, SfdxError, SfdxProjectJson} from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import simplegit, { SimpleGit } from 'simple-git';


import EONLogger, {
  COLOR_KEY_MESSAGE,
  COLOR_HEADER, COLOR_TRACE,COLOR_NOTIFY,COLOR_SUCCESS
} from '../../../../eon/EONLogger';
import path from 'path';
import {SfpowerscriptsArtifact2,PackageDirParsed} from '../../../../helper/types'
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
      required: true,
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
    // get sfdx project.json

    const packageDirs:PackageDirParsed[] = this.project.getSfdxProjectJson().getContents().packageDirectories;
    //get package
    const commitId = await this.getCommitFromOrg()
    if(!commitId){
      throw new SfdxError(`Found no Commit Id on Org! Please check the package name.`)
    }
    EONLogger.log(COLOR_TRACE(`Found commit id ${commitId} 👌`));
    //get branch
    await this.getBranch(commitId)
    this.updatePackageTree(packageDirs);
    await this.project.getSfdxProjectJson().write(this.project.getSfdxProjectJson().getContents())

    EONLogger.log(COLOR_SUCCESS(`Yippiee. 🤙 Branch created and project.json updated without errors. Great 🤜🤛`));
    return {};
  }
  private updatePackageTree(packageDirList: PackageDirParsed[]): void {
    EONLogger.log(COLOR_TRACE('Update package tree with ignoreOnStage build flag'));
    const packageTree = new Map<string, PackageDirParsed>();
    for (const packageDir of packageDirList) {
      if(this.flags.package === packageDir.package){
        packageTree.set(packageDir.package, packageDir);
        continue;
      }
      if(packageDir.ignoreOnStage && Array.isArray(packageDir.ignoreOnStage) && packageDir.ignoreOnStage.length > 0){
        if(!packageDir.ignoreOnStage.includes('build')){
          packageDir.ignoreOnStage.push('build')
        }
      } else {
        packageDir['ignoreOnStage'] = ['build'];
      }
    }
    if(packageTree.size === 0){ throw new SfdxError(`Package ${this.flags.package} not found in sfdx-project.json`)}

  }

  private async getBranch(commitId: string):Promise<void>{
    EONLogger.log(COLOR_TRACE('Start git tasks...'));
    const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();
    let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
       await git.fetch();
    EONLogger.log(COLOR_TRACE(`Check if the branch hotfix-${this.flags.ticket}-${this.flags.package} exist`));
       const branchSummary = await git.branch([`hotfix-${this.flags.ticket}-${this.flags.package}`,`-l`,`-r`])
       if(Object.keys(branchSummary.branches).length > 0){
         EONLogger.log(COLOR_NOTIFY(`Yes... Branch exist on remote. So force checkout on existing branch`));
         await git.checkout([`hotfix-${this.flags.ticket}-${this.flags.package}`,'-f'])
       } else {
         EONLogger.log(COLOR_TRACE(`No... Branch doesn't exist on remote`));
         EONLogger.log(COLOR_TRACE(`But exist the branch local? 🧐`));
         const branchSummary = await git.branch([`hotfix-${this.flags.ticket}-${this.flags.package}`,`-l`])
         if(Object.keys(branchSummary.branches).length > 0){
           EONLogger.log(COLOR_NOTIFY(`Yes... Branch exist local. So force checkout on existing branch`));
           await git.checkout([`hotfix-${this.flags.ticket}-${this.flags.package}`,'-f'])
         } else {
           EONLogger.log(COLOR_NOTIFY(`No... Branch doesn't exist also local. So create a new branch and force checkout`))
           EONLogger.log(COLOR_NOTIFY(`Wait 3 seconds...So that the IDE has time to switch the branch 😉`))
           await new Promise((resolve) => setTimeout(resolve, 3000));
         await git.checkout(['-b',`hotfix-${this.flags.ticket}-${this.flags.package}`,commitId,'-f'])
         EONLogger.log(COLOR_NOTIFY(`Branch created!`));
         }
       }
  }

  private async getCommitFromOrg(): Promise<string>{
    EONLogger.log(COLOR_TRACE(`Select custom object SfpowerscriptsArtifact2 ...`));
    EONLogger.log(COLOR_TRACE(`Username: ${this.org.getConnection().getUsername()}`));

    let responseFromOrg: SfpowerscriptsArtifact2;
    try {
      responseFromOrg = await this.org.getConnection().singleRecordQuery<SfpowerscriptsArtifact2>(
        `Select Id,CommitId__c from SfpowerscriptsArtifact2__c Where Name = '${this.flags.package}'`
      );
    } catch (e) {
      throw new SfdxError(`Its not possible to select Commit Id from SfpowerscriptsArtifact2. Pelase check the details: ${e.message}`);
    }
      return responseFromOrg.Id ? responseFromOrg.CommitId__c : '';
  }
}
