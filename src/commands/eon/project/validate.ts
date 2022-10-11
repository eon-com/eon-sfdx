/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError, SfdxProjectJson, PackageDir } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import simplegit, { DiffResult, SimpleGit } from 'simple-git';
import { ProjectValidationOutput, NamedPackageDirLarge } from '../../../helper/types';
import EONLogger, {
  COLOR_INFO,
  COLOR_KEY_MESSAGE,
  COLOR_HEADER,
  COLOR_NOTIFY,
  COLOR_WARNING,
  COLOR_TRACE,
  COLOR_EON_YELLOW,
  COLOR_EON_BLUE,
  COLOR_ERROR,
} from '../../../eon/EONLogger';
import path from 'path';
import Table from 'cli-table3';
import { LOGOBANNER } from '../../../eon/logo';
import { ProjectJson } from '@salesforce/core/lib/sfdxProject';
import stripAnsi from 'strip-ansi';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'project_validate');

export default class ProjectValidate extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    // Label For Named Credential as Required
    target: flags.string({
      char: 't',
      description: messages.getMessage('target'),
      required: false,
    }),
    source: flags.string({
      char: 's',
      description: messages.getMessage('source'),
      required: false,
    }),
    versionupdate: flags.boolean({
      char: 'v',
      description: messages.getMessage('versionupdate'),
      required: false,
      dependsOn: ['target'],
    }),
    missingdeps: flags.boolean({
      char: 'm',
      description: messages.getMessage('missingdeps'),
      required: false,
    }),
    order: flags.boolean({
      char: 'o',
      description: messages.getMessage('order'),
      required: false,
    }),
    depsversion: flags.boolean({
      char: 'd',
      description: messages.getMessage('depsversion'),
      required: false,
    }),
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package'),
      default: '',
      required: false,
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  protected static publicPackageMap = new Map<string, NamedPackageDirLarge>();

  public async run(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    EONLogger.log(COLOR_KEY_MESSAGE('Static checks on sfdx-project.json file...'));
    let hasError = false;
    // get sfdx project.json
    const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();
    const packageAliases = projectJson.getContents().packageAliases;
    if (this.flags.target && this.flags.package) {
      throw new SfdxError(`Either package or target flag can be used, not both`);
    }
    // get all packages
    let packageDirs: NamedPackageDirLarge[] = projectJson.getUniquePackageDirectories();
    // get all diffs from current to target branch

    let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
    let projectJsonString: string;
    let projectJsonTarget: ProjectJson;
    let packageDirsTarget: PackageDir[] = [];
    let packageCheckList: ProjectValidationOutput[] = []
    if (!this.flags.package) {
      EONLogger.log(COLOR_HEADER('Search for package changes'));
      projectJsonString = await git.show([`${this.flags.target}:sfdx-project.json`]);

      if (!projectJsonString) {
        throw new SfdxError(`Found no sfdx-project.json file on branch ${this.flags.target}`);
      }
      projectJsonTarget = JSON.parse(projectJsonString);
      projectJsonTarget.packageDirectories;
    }

    const sourcebranch = this.flags.source || 'HEAD';
    let includeForceApp = false;
    let changes: DiffResult;
    if (!this.flags.package) {
      changes = await git.diffSummary([`${this.flags.target}...${sourcebranch}`]);
      await git.fetch();
    }
    let table = new Table({
      head: [COLOR_NOTIFY('Package')],
    });
    const packageMap = new Map<string, NamedPackageDirLarge>();
    // check changed packages
    for (const pck of packageDirs) {
      let packageCheck = false;
      if (this.flags.package) {
        if (pck.package === this.flags.package) {
          packageMap.set(pck.package, pck);
          table.push([pck.package]);
          break;
        }
      }

      if (this.flags.target) {
        packageCheck = changes.files.some((change) => {
          if (
            path
              .join(path.dirname(projectJson.getPath()), path.normalize(change.file))
              .includes(path.normalize(pck.fullPath))
          ) {
            return true;
          }
          //check for metadata move between packages
          if (change.file.search('=>') > -1) {
            if (change.file.search(pck.package) > -1) {
              return true;
            }
          }
        });
      }
      if (packageCheck) {
        //special checks for packages

        if (pck.package === 'force-app') {
          EONLogger.log(COLOR_WARNING(`👆 No validation for this special source package: ${pck.package}`));
          includeForceApp = true;
          continue;
        }

        packageMap.set(pck.package, pck);
        table.push([pck.package]);
      }
    }

    if (packageMap.size === 0) {
      EONLogger.log(COLOR_NOTIFY(`✔ Found no unlocked packages with changes. Process finished without validation`));
      return {};
    }

    const packageMessage = this.flags.package ? `👉 Validate selected package:` : `👉 Following packages with changes:`;
    EONLogger.log(COLOR_NOTIFY(packageMessage));
    EONLogger.log(COLOR_INFO(table.toString()));

    if (packageMap.size === 0 && includeForceApp) {
      throw new SfdxError(
        `Validation failed. This merge request contains only data from the force-app folder. This folder is not part of the deployment. 
Please put your changes in a (new) unlocked package or a (new) source package. THX`
      );
    }

    //run validation tasks
    if (this.flags.versionupdate) {
      EONLogger.log(COLOR_HEADER('🔎 Start static check for 👉 Package changes with version update'));
      for (const value of packageMap.values()) {
        //check update version number
        const singlePackageCheckList = this.checkSingleVersionUpdate(value, packageDirsTarget);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList,...singlePackageCheckList];
          ProjectValidate.publicPackageMap.set(value.package, value);
          hasError = true;
        }
      }
    }
    if (this.flags.missingdeps) {
      EONLogger.log(COLOR_HEADER('🔎 Start static checks for 👉 Missing dependencies'));
      for (const value of packageMap.values()) {
        if (!packageAliases[value.package]) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${value.package}`));
          continue;
        }
        const singlePackageCheckList = this.checkMissingDeps(packageDirs, value);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList,...singlePackageCheckList];
          ProjectValidate.publicPackageMap.set(value.package, value);
          hasError = true;
        }
      }
    }
    if (this.flags.order) {
      EONLogger.log(COLOR_HEADER('🔎 Start static checks for 👉 Correct package order'));
      for (const value of packageMap.values()) {
        if (!packageAliases[value.package]) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${value.package}`));
          continue;
        }
        const singlePackageCheckList = this.checkPackageOrder(packageDirs, value, packageAliases);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList,...singlePackageCheckList];
          ProjectValidate.publicPackageMap.set(value.package, value);
          hasError = true;
        }
      }
    }
    if (this.flags.depsversion) {
      EONLogger.log(COLOR_HEADER('🔎 Start static checks for 👉 Correct dependencies version'));
      for (const value of packageMap.values()) {
        if (!packageAliases[value.package]) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${value.package}`));
          continue;
        }
        const singlePackageCheckList = this.checkDepVersion(packageDirs, value);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList,...singlePackageCheckList];
          ProjectValidate.publicPackageMap.set(value.package, value);
          hasError = true;
        }
      }
    }
    if (hasError) {
      //console.log(tableOutput.toString());
      EONLogger.log(
        COLOR_ERROR(`Static check found errors. Please check the package templates with the correct data 🧐`)
      );
      for (const publicPck of ProjectValidate.publicPackageMap.values()) {
        const pckOrderMainList = packageCheckList.filter(pck => pck.Package === publicPck.package && pck.Process === 'Main Package Order');
        console.log(COLOR_INFO(`>>>>>>>>>>>> sfdx-project.json snippet >>>> 📦 ${publicPck.package}>>>>>>>>`), '\n');
        console.log(this.createTableString(publicPck),'\n');
        if(pckOrderMainList.length > 0){
          EONLogger.log(COLOR_WARNING(`👆 This package has a wrong position in the project json. Please put this package behind ⤵ the depend package ${pckOrderMainList[pckOrderMainList.length - 1].Message} ❗️`));
        }
        console.log(
          COLOR_INFO(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<`, '\n')
        );
      }
      throw new SfdxError(
        `Static checks failed. Please fetch the new data from table and fix this issues from sfdx-project.json file`
      );
    }

    EONLogger.log(COLOR_HEADER(`Yippiee. 🤙 Static checks finsihed without errors. Great 🤜🤛`));

    return {};
  }

  private checkSingleVersionUpdate(
    sourcePackageDir: NamedPackageDirLarge,
    targetPackageDirs: PackageDir[]
  ): ProjectValidationOutput[] {
    EONLogger.log(COLOR_TRACE(`Check version update for package ${sourcePackageDir.package}`));
    const validationResponse: ProjectValidationOutput[] = [];
    for (const targetPackage of targetPackageDirs) {
      if (sourcePackageDir.package === targetPackage.package) {
        if (
          sourcePackageDir.versionNumber.localeCompare(targetPackage.versionNumber, undefined, {
            numeric: true,
            sensitivity: 'base',
          }) > 0
        ) {
          validationResponse.push({
            Process: `Package version update`,
            Package: sourcePackageDir.package,
            Message: `Package Version without change. Please update version ${sourcePackageDir.versionNumber}`,
          });
          //create the new version number from target branch , update minor version
          let newMinorVersion: string = '';
          try {
          if(targetPackage.versionNumber){
            const startVersion = targetPackage.versionNumber.slice(0,targetPackage.versionNumber.indexOf('.'))
            const endVersion = targetPackage.versionNumber.slice(targetPackage.versionNumber.lastIndexOf('.') + 1)
            const firstPoint = targetPackage.versionNumber.indexOf('.') + 1;
            const lastPoint = targetPackage.versionNumber.lastIndexOf('.');
            const oldMinor = targetPackage.versionNumber.slice(firstPoint,lastPoint);
            const newMinor = ~~oldMinor + 1;
            newMinorVersion = `${startVersion}.${newMinor}.${endVersion}.NEXT`
          }
          } catch (e){
            throw new SfdxError(
              `Static checks failed. Cannot create a new minor version from target branch. Please check the project json from main.`
            );
          }
          sourcePackageDir.versionNumber = `"${COLOR_EON_BLUE(newMinorVersion)}"`;
        }
      }
    }
    return validationResponse;
  }

  private checkMissingDeps(
    sourcePackageDirs: NamedPackageDirLarge[],
    packageTree: NamedPackageDirLarge
  ): ProjectValidationOutput[] {
    EONLogger.log(COLOR_TRACE(`Start check missing dependencies for package ${packageTree.package}`));
    const validationResponse: ProjectValidationOutput[] = [];
    const depPackageSet = new Map<string, string>();
    if (!packageTree?.dependencies) {
      throw new SfdxError(
        `Validation for missing dependencies failed. unlocked package ${packageTree.package} has no dependencies array.
Please add an empty array for the dependencies.`
      );
    }
    if (
      !(packageTree?.dependencies && Array.isArray(packageTree.dependencies) && packageTree.dependencies.length > 0)
    ) {
      EONLogger.log(COLOR_INFO(`✔️ Package has no dependencies. Finished without check.`));
      return validationResponse;
    }
    //first iterate over all deps packages to create a set
    for (const pckDepsTree of packageTree.dependencies) {
      for (const sourcePackageTree of sourcePackageDirs) {
        if (pckDepsTree.package === sourcePackageTree.package) {
          if (sourcePackageTree.dependencies && Array.isArray(sourcePackageTree.dependencies)) {
            for (const sourcePckDep of sourcePackageTree.dependencies) {
              //get the latest version from main for new package dependency
              const mainPckTree = sourcePackageDirs.filter(pck => pck.package === sourcePckDep.package); 
              depPackageSet.set(sourcePckDep.package, mainPckTree.length > 0 && mainPckTree[0].versionNumber ? mainPckTree[0].versionNumber.replace('.NEXT','.LATEST') : sourcePckDep.versionNumber)
            }
          }
        }
      }
    }
    let depPackageCounter = 0;
    // now iterate over the required packages set
    for (const [key, value] of depPackageSet) {
      depPackageCounter++;
      let isInPackageTree = false;
      for (const pckDepsTree of packageTree.dependencies) {
        if (pckDepsTree.package === key) {
          isInPackageTree = true;
        }
      }
      if (!isInPackageTree) {
        validationResponse.push({
          Process: `Missing dependencies`,
          Package: packageTree.package,
          Message: `Please add package ${key} to the dependencies`,
        });
        if (value && value !== undefined) {
          packageTree.dependencies.splice(depPackageCounter, 0, {
            package: COLOR_EON_BLUE(key),
            versionNumber: COLOR_EON_BLUE(value),
          });
        } else {
          packageTree.dependencies.splice(depPackageCounter, 0, {
            package: COLOR_EON_BLUE(key),
          });
        }
      }
    }
    // iterate again to
    return validationResponse;
  }

  private checkPackageOrder(
    sourcePackageDirs: NamedPackageDirLarge[],
    packageTree: NamedPackageDirLarge,
    packageAliases: {
      [k: string]: string;
    }
  ): ProjectValidationOutput[] {
    try {
      EONLogger.log(COLOR_TRACE(`Start checking order for package ${packageTree.package}`));
      const currentPckIndexMap = new Map<string, number>();
      const newPckIndexMap = new Map<string, number>();
      const validationResponse: ProjectValidationOutput[] = [];
      let newPackageIndex = 0;
      if (!packageTree?.dependencies) {
        throw new SfdxError(
          `Validation for missing dependencies failed. unlocked package ${packageTree.package} has no dependencies array.
  Please add an empty array for the dependencies.`
        );
      }
      if (
        !(packageTree?.dependencies && Array.isArray(packageTree.dependencies) && packageTree.dependencies.length > 0)
      ) {
        EONLogger.log(COLOR_INFO(`✔️ Package has no dependencies. Finished without check.`));
        return validationResponse;
      }
      // create perfect order from sfdx-project json top to down
      for (const sourcePackageTree of sourcePackageDirs) {
        for (const sourcePckDep of packageTree.dependencies) {
          //managed package??
          if (packageAliases[sourcePckDep.package] && packageAliases[sourcePckDep.package].startsWith('04')) {
            if (!newPckIndexMap.get(sourcePckDep.package)) {
              newPckIndexMap.set(sourcePckDep.package, newPackageIndex);
              newPackageIndex++;
            }
          }
          if (sourcePckDep.package === sourcePackageTree.package) {
            newPckIndexMap.set(sourcePckDep.package, newPackageIndex);
            newPackageIndex++;
          }
        }
      }
      //create current order
      newPackageIndex = 0;
      for (const sourcePckDep of packageTree.dependencies) {
        currentPckIndexMap.set(sourcePckDep.package, newPackageIndex);
        newPackageIndex++;
      }
      // create output
      let outputList: string[] = [];
      for (const newOrder of currentPckIndexMap.keys()) {
        outputList.push(newOrder);
      }
      if (outputList.length > 0) {
        //EONLogger.log(COLOR_INFO(`Current Order: ${outputList.join()}`));
      }
      outputList = [];
      for (const [key, value] of newPckIndexMap) {
        outputList.push(key);
        if (currentPckIndexMap.get(key)) {
          if (currentPckIndexMap.get(key) > value) {
            let splicePck: string = stripAnsi(packageTree.dependencies[currentPckIndexMap.get(key)].package);
            let spliceVersion: string = stripAnsi(packageTree.dependencies[currentPckIndexMap.get(key)].versionNumber);
            if (spliceVersion && spliceVersion !== undefined) {
              packageTree.dependencies.splice(value, 0, {
                package: COLOR_EON_YELLOW(splicePck),
                versionNumber: COLOR_EON_YELLOW(spliceVersion),
              });
            } else {
              packageTree.dependencies.splice(value, 0, {
                package: COLOR_EON_YELLOW(splicePck),
              });
            }
            packageTree.dependencies.splice(currentPckIndexMap.get(key) + 1, 1);
            validationResponse.push({
              Process: `Dependency Order`,
              Package: packageTree.package,
              Message: `Package ${key} has the wrong order position. Current postion is ${currentPckIndexMap.get(
                key
              )}. New position is ${value}. Please check the New Order Details on top of the table ☝️.`,
            });
            //create current order after splice process
            newPackageIndex = 0;
            currentPckIndexMap.clear();
            for (const sourcePckDep of packageTree.dependencies) {
              currentPckIndexMap.set(sourcePckDep.package, newPackageIndex);
              newPackageIndex++;
            }
          }
        }
      }
      if (outputList.length > 0) {
        //EONLogger.log(COLOR_INFO(`New Order: ${outputList.join()}`));
      }
      // now check also the correct package position. the package itself must come after the dependencies
      currentPckIndexMap.clear();
      newPackageIndex = 0;
      let currentPackageIndex = 0;
      for (const sourcePackageTree of sourcePackageDirs) {
        for (const sourcePckDep of packageTree.dependencies) {
          if (sourcePckDep.package === sourcePackageTree.package) {
            newPckIndexMap.set(sourcePckDep.package, newPackageIndex);
          }
        }
        if (sourcePackageTree.package === packageTree.package) {
          currentPackageIndex = newPackageIndex;
        }
        newPackageIndex++;
      }
      for (const [key, value] of newPckIndexMap) {
        if (value > currentPackageIndex) {
          validationResponse.push({
            Process: `Main Package Order`,
            Package: packageTree.package,
            Message: key,
          });
        }
      }

      return validationResponse;
    } catch (e) {
      throw new SfdxError(e);
    }
  }

  private checkDepVersion(
    sourcePackageDirs: NamedPackageDirLarge[],
    packageTree: NamedPackageDirLarge
  ): ProjectValidationOutput[] {
    EONLogger.log(COLOR_TRACE(`Start checking dependency versions for package ${packageTree.package}`));
    const validationResponse: ProjectValidationOutput[] = [];
    const currentPackageVersionMap = new Map<string, string>();
    const newPackageVersionMap = new Map<string, string>();
    if (!packageTree?.dependencies) {
      throw new SfdxError(
        `Validation for missing dependencies failed. unlocked package ${packageTree.package} has no dependencies array.
  Please add an empty array for the dependencies.`
      );
    }
    if (
      !(packageTree?.dependencies && Array.isArray(packageTree.dependencies) && packageTree.dependencies.length > 0)
    ) {
      EONLogger.log(COLOR_INFO(`✔️ Package has no dependencies. Finished without check.`));
      return validationResponse;
    }

    for (const sourcePackageTree of sourcePackageDirs) {
      for (const sourcePckDep of packageTree.dependencies) {
        if (sourcePckDep.package === sourcePackageTree.package) {
          if (sourcePackageTree?.versionNumber) {
            if (sourcePackageTree.versionNumber.search('NEXT') === -1) {
              throw new SfdxError(
                `Validation for dependencies version failed. Unlocked package ${packageTree.package} has wrong version format.
The job cannot find the 'NEXT' prefix. Please check the version number ${sourcePckDep.versionNumber} for package ${sourcePckDep.package}.`
              );
            }
            newPackageVersionMap.set(sourcePckDep.package, sourcePackageTree.versionNumber.replace('.NEXT', ''));
          }
        }
      }
    }
    for (const sourcePckDep of packageTree.dependencies) {
      if (sourcePckDep?.versionNumber) {
        if (sourcePckDep.versionNumber.search('LATEST') === -1) {
          throw new SfdxError(
            `Validation for dependencies version failed. A dependend package for ${packageTree.package} has a wrong version format.
The job cannot find the 'LATEST' prefix. Please check the version number ${sourcePckDep.versionNumber} for package ${sourcePckDep.package}.`
          );
        }
        currentPackageVersionMap.set(sourcePckDep.package, sourcePckDep.versionNumber.replace('.LATEST', ''));
      }
    }
    for (const [key, value] of currentPackageVersionMap) {
      if (newPackageVersionMap.get(key)) {
        if (
          newPackageVersionMap.get(key).localeCompare(value, undefined, {
            numeric: true,
            sensitivity: 'base',
          }) > 0
        ) {
          validationResponse.push({
            Process: `Package dependency version`,
            Package: packageTree.package,
            Message: `Dependend package ${key} needs a higher version. Please update version to ${newPackageVersionMap.get(
              key
            )}!`,
          });
          for (const sourcePckDep of packageTree.dependencies) {
            if (sourcePckDep.package === key) {
              let colorVersion: string = stripAnsi(sourcePckDep.versionNumber);
              colorVersion = COLOR_EON_BLUE(`${newPackageVersionMap.get(key)}.LATEST`);
              sourcePckDep.versionNumber = colorVersion;
            }
          }
        }
      }
    }
    return validationResponse;
  }

  private createTableString(packageTree: NamedPackageDirLarge): string {
    let outputString: string = '';
    outputString = `        {\n`;
    outputString = outputString + `             "path": "${packageTree.path}"\n`;
    outputString = outputString + `             "package": "${packageTree.package}"\n`;
    outputString = outputString + `             "versionName": "${packageTree.versionName}"\n`;
    outputString = outputString + `             "versionNumber": "${packageTree.versionNumber}"\n`;
    outputString = outputString + `             "default": "${packageTree.default}"\n`;
    outputString = outputString + `             "dependencies": [\n`;
    for (const packageDep of packageTree.dependencies) {
      outputString = outputString + `                 {\n`;
      outputString = outputString + `                     "package": "${packageDep.package}"\n`;
      if (packageDep.versionNumber) {
        outputString = outputString + `                     "versionNumber": "${packageDep.versionNumber}"\n`;
      }
      outputString = outputString + `                 }\n`;
    }
    outputString = outputString + `             ]\n`;
    return outputString;
  }
}
