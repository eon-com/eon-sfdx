/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import fs from 'fs';
import path from 'path';
import { Messages, NamedPackageDir, SfdxProjectJson } from '@salesforce/core';

import { AnyJson } from '@salesforce/ts-types';
import EONLogger, { COLOR_ERROR, COLOR_HEADER, COLOR_INFO } from '../../../../eon/EONLogger';
import { LOGOBANNER } from '../../../../eon/logo';
import { eonDevKitYml, exampleApex, exportJson } from '../../../../helper/filecontents';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'devkit');

export default class Validate extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

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
  public async run(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    const packagename = this.flags.package;
    const setupFileName = 'eon-devkit.yml';
    const devkitFolderName = 'devkit';
    const scriptsFolderName = 'scripts';
    const testdataFolderName = 'testdata';

    const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();

    let packageDirs: NamedPackageDir[] = projectJson.getUniquePackageDirectories();

    // check if package exists
    if (!packageDirs.map((a) => a.package).includes(packagename)) {
      EONLogger.log(COLOR_ERROR('Package ' + packagename + ' does not exist in sfdx.project.json'));
      return;
    }
    const packagePath: string = packageDirs.find((a) => a.package === packagename).path;
    const filePaths: String[] = this.findFileInDir(packagePath, setupFileName);

    if (filePaths.length > 2) {
      EONLogger.log(COLOR_ERROR('Multiple ' + setupFileName + ' files found in package ' + packagename));
      EONLogger.log(COLOR_ERROR('Only one ' + setupFileName + ' file is allowed per package'));
      return;
    } else if (filePaths.length === 1) {
      EONLogger.log(COLOR_INFO(setupFileName + ' file in package ' + packagename + ' already exists.'));
      //todo: check if basic structure is given
      return;
    }

    // create new subfolders of devkit
    if (!fs.existsSync(path.join(packagePath, devkitFolderName))) {
      fs.mkdirSync(path.join(packagePath, devkitFolderName));
    }
    if (!fs.existsSync(path.join(packagePath, devkitFolderName, scriptsFolderName))) {
      fs.mkdirSync(path.join(packagePath, devkitFolderName, scriptsFolderName));
    }
    if (!fs.existsSync(path.join(packagePath, devkitFolderName, testdataFolderName))) {
      fs.mkdirSync(path.join(packagePath, devkitFolderName, testdataFolderName));
    }
    // create new yml file
    const baseStructureYaml = eonDevKitYml;
    if (!fs.existsSync(path.join(packagePath, devkitFolderName, setupFileName))) {
      fs.writeFileSync(path.join(packagePath, devkitFolderName, setupFileName), baseStructureYaml);
      EONLogger.log(COLOR_INFO('Created ' + setupFileName + ' file in package ' + packagename));
    }
    // create new export.json file
    const baseExportJson = exportJson;

    if (!fs.existsSync(path.join(packagePath, devkitFolderName, testdataFolderName, 'export.json'))) {
      fs.writeFileSync(path.join(packagePath, devkitFolderName, testdataFolderName, 'export.json'), baseExportJson);
      EONLogger.log(COLOR_INFO('Created export.json file in package ' + packagename));
    }
    // create example apex script
    const exampleApexBody = exampleApex;
    if (!fs.existsSync(path.join(packagePath, devkitFolderName, scriptsFolderName, 'setup-script.apex'))) {
      fs.writeFileSync(
        path.join(packagePath, devkitFolderName, scriptsFolderName, 'setup-script.apex'),
        exampleApexBody
      );
      EONLogger.log(COLOR_INFO('Created setup-script.apex file in package ' + packagename));
    }

    EONLogger.log(COLOR_HEADER('Devkit setup completed.'));
    return {};
  }

  // find all files in directory
  findFileInDir(dir, filename) {
    let results = [];
    fs.readdirSync(dir).forEach((file) => {
      let fullPath = path.join(dir, file);
      if (fs.lstatSync(fullPath).isDirectory()) {
        results = [...results, ...this.findFileInDir(fullPath, filename)];
      } else {
        if (fullPath.includes(filename)) {
          results.push(fullPath);
        }
      }
    });
    return results;
  }
}
