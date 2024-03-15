/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import {
  Messages,
  NamedPackageDir,
  PackageDir,
  PackageDirDependency,
  SfProject,
  SfError,
  SfProjectJson,
} from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import simplegit, { DiffResult, SimpleGit } from 'simple-git';
import { PackageTree, PluginSettings, ProjectJsonParsed } from '../helper/types';
import EONLogger, {
  COLOR_SUCCESS,
  COLOR_WARNING,
  COLOR_INFO,
  COLOR_KEY_MESSAGE,
  COLOR_NOTIFY,
  COLOR_HEADER,
  COLOR_TRACE
} from '../eon/EONLogger';
import PackageReadme from '../helper/package-readme';
import fs from 'fs/promises';
import path from 'path';
import slash from 'slash';
import PackageNodeTree from '../helper/package-tree';
import  EonCommand  from '../EonCommand';
import dedent from 'dedent-js';
import { Flags } from '@oclif/core';
import { LOGOBANNER } from '../eon/logo';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'commit');

export default class Commit extends EonCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static readonly flags = {
    //Label For Named Credential as Require
    'target-org': Flags.string({
      char: 'o',
      aliases: ['targetusername', 'u'],
      description: 'Login username or alias for the target org.',
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  public async execute(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    // get sfdx project.json
    const project: SfProject = await SfProject.resolve();
    const projectJson: SfProjectJson = await project.retrieveSfProjectJson();
    const settings: PluginSettings = projectJson.getContents()?.plugins['eon-sfdx'] as PluginSettings;

    // get all packages
    let packageDirs: NamedPackageDir[] = projectJson.getUniquePackageDirectories();
    // get all staged changes
    let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
    const diffString = await git.diff([`origin/main...HEAD`, `--no-renames`, `--name-only`])
    const modifiedFiles: string[] = diffString.split('\n')

    modifiedFiles.pop()

    // ask for jira reference
    let changedPackages: string[] = [];
    let changedSet = new Set<string>();
    // check changed packages
    for (const pck of packageDirs) {
      for (const filename of modifiedFiles) {
        if (path.normalize(filename).includes(path.normalize(pck.path))) {
          changedSet.add(pck.package);
        }
      }
    }

    if(changedSet.size > 0){
      changedPackages = [...changedSet];
    }

    // multiple packages
    if (changedPackages.length == 0) {
      throw new SfError('No staged changes to any package found!');
    } else if (changedPackages.length > 1) {
      const { Confirm } = require('enquirer');
      EONLogger.log(COLOR_KEY_MESSAGE('Found changes in multiple packages 👇'));

      const Table = require('cli-table3');
      let table = new Table({
        head: [COLOR_NOTIFY('Package Name')],
      });
      for (let pck of changedPackages) {
        table.push([pck]);
      }

      EONLogger.log(table.toString());

      const multipleChangesConfirm = await new Confirm({
        name: 'multipleChangesConfirm',
        message: COLOR_HEADER('Are you sure to commit changes to different packages within the same commit?'),
      })
        .run()
        .catch(console.error);

      if (!multipleChangesConfirm) {
        return {};
      }
    } else {
      EONLogger.log(COLOR_KEY_MESSAGE('Found changes in this package 👇'));

      const Table = require('cli-table3');
      let table = new Table({
        head: [COLOR_NOTIFY('Package Name')],
      });
      for (let pck of changedPackages) {
        table.push([pck]);
      }

      EONLogger.log(table.toString());
    }

    // ask for type
    const { Select } = require('enquirer');
    const promptType = await new Select({
      name: 'changetype',
      message: dedent(`${COLOR_HEADER("Please select the nature of the changes you'd like to commit 👆")}
                       ${COLOR_TRACE('Fix updates the patch version. For example 1.0.0 => 1.0.1')}
                       ${COLOR_TRACE('Feature updates the minor version. For example 1.0.0 => 1.1.0')}`),
      choices: ['Fix', 'Feature'],
    })
      .run()
      .catch(console.error);
    // get jira ref from branch as default
    const branchname = await git.revparse(['--abbrev-ref', 'HEAD']);
    let defaultJiraId = 'XXXXX-12345';

    if (settings && settings.workItemFilter) {
      defaultJiraId = branchname.match(settings.workItemFilter)
        ? branchname.match(settings.workItemFilter)[0]
        : defaultJiraId;
    }

    const { Input } = require('enquirer');
    const promptJira = await new Input({
      message: COLOR_HEADER('What is the Jira Reference?'),
      initial: defaultJiraId,
    })
      .run()
      .catch(console.log);
    // ask for commit message

    const { prompt } = require('enquirer');
    const message = await prompt({
      required: true,
      type: 'input',
      name: 'message',
      message: COLOR_HEADER('Describe your changes briefly:'),
    });

    const { Confirm } = require('enquirer');
    const hasBreakingPrompt = await new Confirm({
      name: 'hasBreakingConfirm',
      message: dedent(`Do your changes include breaking changes to existing features?
      ${COLOR_TRACE('Yes updates the major version. For example 1.0.0 => 2.0.0')}`),
    })
      .run()
      .catch(console.error);

    // update versions
    const Table = require('cli-table3');
    let table = new Table({
      head: [COLOR_NOTIFY('Package Name'), COLOR_NOTIFY('Version')],
    });
    let updatedPackages: PackageDir[] = [];
    for (let packageName of changedPackages) {
      const nodetree: PackageNodeTree = new PackageNodeTree(projectJson);
      await nodetree.nodeTreeInit();
      let pck = packageDirs.find((pckdir) => packageName === pckdir.package);


      let oldVer = pck.versionNumber;
      let version: number[] = pck.versionNumber
        .replace('.NEXT', '')
        .split('.')
        .map((v) => Number.parseInt(v));

      // update versions based on change type
      if (hasBreakingPrompt) {
        version[0] = version[0] + 1;
        version[1] = 0;
        version[2] = 0;
      } else if (promptType == 'Feature') {
        version[1] = version[1] + 1;
        version[2] = 0;
      } else {
        version[2] = version[2] + 1;
      }
      // differentiate between unlocked and source packages
      pck.versionNumber = `${version[0]}.${version[1]}.${version[2]}${oldVer.includes('.NEXT') ? '.NEXT' : ''}`;
      let newVer = pck.versionNumber;
      table.push([packageName, `${oldVer} ==> ${newVer}`]);

      // update dependencies
      /*if (dependencyPrompt && pck.dependencies) {
        for (let dep of pck.dependencies) {
          if (dep.versionNumber) {
            dep.versionNumber = packageDirs
              .find((dir) => dir.package === dep.package)
              .versionNumber.replace('.NEXT', '.LATEST');
          }
        }
      }*/

      updatedPackages = [...updatedPackages, pck];
    }

    // print summary
    const commitMsg = `${promptType == 'Feature' ? 'feat:' : 'fix:'} ${promptJira} ${message.message}`;

    EONLogger.log(
      COLOR_HEADER(`
Following Details will be committed:
    `)
    );
    EONLogger.log(`${COLOR_INFO('Commit Message: ')} ${COLOR_SUCCESS(commitMsg)}`);
    console.log(table.toString());
    EONLogger.log(COLOR_WARNING(`🚸 Please update **only** the desired dependencies manually before carrying out the next step 👆`));
    EONLogger.log(COLOR_WARNING(`🚸 Only those dependencies that contain the necessary changes should be updated. ❗️`));
    // handle version updates

    // ask, if dependencies should be updated
    const confirmPrompt = await new Confirm({
      name: 'confirmCommit',
      message: COLOR_HEADER('Are you happy with your changes? Select Y to commit your staged changes now.'),
    })
      .run()
      .catch(console.error);

    // exit if no was selected
    if (!confirmPrompt) {
      return {};
    }

    // update sfdx project json
    let raw = await fs.readFile(projectJson.getPath());
    let json: ProjectJsonParsed = JSON.parse(raw.toString());
    let readmes: string[] = [];

    for (let update of updatedPackages) {
      const index = json.packageDirectories.indexOf(
        json.packageDirectories.find((pck) => pck.package === update.package)
      );
      if (~index) {
        json.packageDirectories[index] = update;
        // update readme if set in settings
        if (settings && settings.enableReadmeGeneration) {
          const gitUser = await git.getConfig('user.name');
          const readme = await PackageReadme.update(
            json.packageDirectories[index],
            message.message,
            promptJira,
            gitUser.value,
            settings
          );
          readmes.push(path.normalize(readme));
        }
        json.packageDirectories[index].fullPath = undefined;
        json.packageDirectories[index].name = undefined;
        json.packageDirectories[index].path = slash(json.packageDirectories[index].path);
      }
    }
    await fs.writeFile(projectJson.getPath(), JSON.stringify(json, null, 2));

    // commit changes
    //await git.add([...readmes, projectJson.getPath()]);
    //await git.commit(commitMsg);
    EONLogger.log(COLOR_SUCCESS('🎉 Your changes have been committed successfully!'));
    return {};
  }
}
