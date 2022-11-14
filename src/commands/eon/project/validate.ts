/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import {flags, SfdxCommand} from '@salesforce/command';
import {Messages, SfdxError, SfdxProjectJson,} from '@salesforce/core';
import {AnyJson} from '@salesforce/ts-types';
import simplegit, {DiffResult, SimpleGit} from 'simple-git';
import Table from 'cli-table3';
import * as path from 'path';
import {LOGOBANNER} from '../../../eon/logo';
import EONLogger, {
  COLOR_KEY_MESSAGE,
  COLOR_HEADER,
  COLOR_TRACE,
  COLOR_WARNING,
  COLOR_NOTIFY,
  COLOR_INFO,
  COLOR_INFO_BOLD, COLOR_ERROR_DIM,
  COLOR_INFO_BOLD_DIM,
  COLOR_SUCCESS
} from '../../../eon/EONLogger';
import {PackageDirLarge} from "../../../helper/types";
import {ProjectCheckOutput, ProjectCheckProcess} from "../../../helper/types";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'project_validate');

export default class ProjectValidate extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{name: 'file'}];

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
    include: flags.string({
      char: 'i',
      description: messages.getMessage('include'),
      default: '',
      required: false,
    }),
    exclude: flags.string({
      char: 'e',
      description: messages.getMessage('exclude'),
      default: '',
      required: false,
    }),
    fix: flags.boolean({
      char: 'f',
      description: messages.getMessage('fix'),
      required: false,
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  /**
   * @description - This method is used to run the sfdx command
   *
   */
  public async run(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    EONLogger.log(COLOR_KEY_MESSAGE(`Start sfdx-project.json package validation...`));

    const packageDirs: PackageDirLarge[] = this.project.getSfdxProjectJson().getContents().packageDirectories;
    let packageCheckList: ProjectCheckOutput[] = []
    let hasSubProcessError = false;
    const packageAliases = this.project.getSfdxProjectJson().getContents().packageAliases;
    const packageTreeMap = await this.getPackagesForCheck(packageDirs);
    if (packageTreeMap.size === 0) {
      EONLogger.log(COLOR_NOTIFY(`✔ Found no packages with changes. Process finished without validation`));
      return {};
    }

    if (this.flags.versionupdate) {
      EONLogger.log(COLOR_INFO('🔎 Start static check for 👉 Package changes with version update'));
      const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();
      let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
      try {
        const projectJsonString: string = await git.show([`${this.flags.target}:sfdx-project.json`]);

        if (!projectJsonString) {
          EONLogger.log(COLOR_WARNING(`👆 Skip this validation. Found no sfdx-project.json file on branch ${this.flags.target}`));
        } else {

          for (const pckTree of packageTreeMap.values()) {
            //check update version number
            const singlePackageCheckList = this.checkSingleVersionUpdate(pckTree, projectJsonString);
            if (singlePackageCheckList.length > 0) {
              packageCheckList = [...packageCheckList, ...singlePackageCheckList];
              hasSubProcessError = true;
            }
          }
        }
      } catch (e) {
        throw new SfdxError(`👆 Skip this validation. Found no sfdx-project.json file on branch ${this.flags.target} and ${e.message}`);
      }
    }

    if (this.flags.missingdeps) {
      EONLogger.log(COLOR_INFO(`🔎 Start static checks for 👉 Missing dependencies`));
      for (const value of packageTreeMap.values()) {
        if (!packageAliases[value.package]) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${value.package}`));
          continue;
        }
        const singlePackageCheckList = this.checkMissingDeps(packageDirs, value);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList, ...singlePackageCheckList];
          hasSubProcessError = true;
        }
      }
    }

    if (this.flags.order) {
      EONLogger.log(COLOR_INFO(`🔎 Start static checks for 👉 Correct package order`));
      for (const value of packageTreeMap.values()) {
        if (!packageAliases[value.package]) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${value.package}`));
          continue;
        }
        const singlePackageCheckList = this.checkPackageOrder(packageDirs, value, packageAliases);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList, ...singlePackageCheckList];
          hasSubProcessError = true;
        }
      }
    }
    if (this.flags.depsversion) {
      EONLogger.log(COLOR_INFO(`🔎 Start static checks for 👉 Correct dependencies version`));
      for (const value of packageTreeMap.values()) {
        if (!packageAliases[value.package]) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${value.package}`));
          continue;
        }
        const singlePackageCheckList = this.checkDepVersion(packageDirs, value);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList, ...singlePackageCheckList];
          hasSubProcessError = true;
        }
      }
    }

    if (hasSubProcessError) {
      this.printOutput(packageCheckList,packageTreeMap);
    }

    if (this.flags.fix && hasSubProcessError) {
      await this.project.getSfdxProjectJson().write();
      EONLogger.log(COLOR_SUCCESS(`✔ sfdx-project.json file updated`));
      EONLogger.log(COLOR_SUCCESS(`Yippiee. 🤙 Static checks finsihed with update. Great 🤜🤛`));
    } else {
      EONLogger.log(COLOR_HEADER(`Yippiee. 🤙 Static checks finsihed without errors. Great 🤜🤛`));
    }
    return {};
  }

  /**
   * @description Create a map for all packages in the project the has been changed. Optionally include/exclude packages.
   * @param  packageDirList
   * @return {Map<string, PackageDirLarge>}
   */
  private async getPackagesForCheck(packageDirList: PackageDirLarge[]): Promise<Map<string, PackageDirLarge>> {
    EONLogger.log(COLOR_HEADER(`Get packages for validation check...`));
    const packageMap = new Map<string, PackageDirLarge>();
    let includeForceApp = false;
    let table = new Table({
      head: [COLOR_NOTIFY('Package')],
    });
    // use value from package include flag
    if (this.flags.include) {
      EONLogger.log(COLOR_TRACE(`Include package flag active. Fetch packages only from command line input`));
      const packageList = this.flags.include.split(',');
      for (const inputPackage of packageList) {
        const packageDir = packageDirList.find(
          (packageDir) => packageDir.package === inputPackage
        );
        if (packageDir) {
          packageMap.set(packageDir.package, packageDir);
        } else {
          throw new SfdxError(`Package ${inputPackage} not found in sfdx-project.json`);
        }
      }
    }
    // use value from package exclude flag
    if (this.flags.exclude) {
      EONLogger.log(COLOR_TRACE(`Ignore packages from command exclude flag`));
      const packageList = this.flags.exclude.split(',');
      for (const inputPackage of packageList) {
        const packageDir = packageDirList.find(
          (packageDir) => packageDir.package === inputPackage
        );
        if (packageDir) {
          packageMap.delete(packageDir.package);
        } else {
          throw new SfdxError(`Package ${inputPackage} not found in sfdx-project.json`);
        }
      }
    }
    if (packageMap.size !== 0 || this.flags.include) {
      return packageMap;
    }
    // check git only with no include/exclude flag
    const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();
    let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
    const sourcebranch = this.flags.source || 'HEAD';
    const targetbranch = this.flags.target || 'origin/main';
    EONLogger.log(COLOR_TRACE(`Check git diff between ${sourcebranch} and ${targetbranch}`));
    await git.fetch();
    let changes: DiffResult = await git.diffSummary([`${targetbranch}...${sourcebranch}`]);
    for (const pck of packageDirList) {
      let packageCheck = false;
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
    if (packageMap.size === 0 && includeForceApp) {
      throw new SfdxError(
        `Validation failed. This merge request contains only data from the force-app folder. This folder is not part of the deployment.
Please put your changes in a (new) unlocked package or a (new) source package. THX`
      );
    }
    if (packageMap.size !== 0) {
      const packageMessage = this.flags.package ? `👉 Validate selected package:` : `👉 Following packages with changes:`;
      EONLogger.log(COLOR_NOTIFY(packageMessage));
      EONLogger.log(COLOR_INFO(table.toString()));
    }
    return packageMap;
  }

  /**
   * @description - This method is used to check if a package has a version update
   * @param sourcePackageDir
   * @param gitProjectString
   * @private
   */
  private checkSingleVersionUpdate(
    sourcePackageDir: PackageDirLarge,
    gitProjectString: string = ''
  ): ProjectCheckOutput[] {
    EONLogger.log(COLOR_TRACE(`Check version update for package ${sourcePackageDir.package}`));

    let targetProjectJson: SfdxProjectJson = JSON.parse(gitProjectString);
    let targetPackageDirs = targetProjectJson['packageDirectories'];
    if(!targetPackageDirs && !Array.isArray(targetPackageDirs)){
      throw new SfdxError(
        `Could not parse sfdx-project.json from target branch. Please check your target branch.`
      );
    }

    const validationResponse: ProjectCheckOutput[] = [];
    for (const targetPackage of targetPackageDirs) {
      if (sourcePackageDir.package === targetPackage.package) {
        if (
          sourcePackageDir.versionNumber.replace('.NEXT','').localeCompare(targetPackage.versionNumber.replace('.NEXT',''), undefined, {
            numeric: true,
            sensitivity: 'base',
          }) < 0
        ) {
          validationResponse.push({
            Process: ProjectCheckProcess.TREE_VERSION_UPDATE,
            Package: sourcePackageDir.package,
            Message: `Package Version without change. Please update version ${sourcePackageDir.versionNumber} higher then the target branch version ${targetPackage.versionNumber.replace('.NEXT','')}`,
          });
          //create the new version number from target branch , update minor version
          let newMinorVersion: string = '';
          try {
            if (targetPackage.versionNumber) {
              const startVersion = targetPackage.versionNumber.replace('.NEXT','').slice(0, targetPackage.versionNumber.indexOf('.'))
              const endVersion = targetPackage.versionNumber.replace('.NEXT','').slice(targetPackage.versionNumber.replace('.NEXT','').lastIndexOf('.') + 1)
              const firstPoint = targetPackage.versionNumber.replace('.NEXT','').indexOf('.') + 1;
              const lastPoint = targetPackage.versionNumber.replace('.NEXT','').lastIndexOf('.');
              const oldMinor = targetPackage.versionNumber.replace('.NEXT','').slice(firstPoint, lastPoint);
              const newMinor = ~~oldMinor + 1;
              newMinorVersion = `${startVersion}.${newMinor}.${endVersion}.NEXT`
            }
          } catch (e) {
            throw new SfdxError(
              `Static checks failed. Cannot create a new minor version from target branch. Please check the project json from branch ${this.flags.target}`
            );
          }
          sourcePackageDir.versionNumber = newMinorVersion;
        }
      }
    }
    return validationResponse;
  }

  private checkMissingDeps(
    sourcePackageDirs: PackageDirLarge[],
    packageTree: PackageDirLarge
  ): ProjectCheckOutput[] {
    EONLogger.log(COLOR_TRACE(`Start check missing dependencies for package ${packageTree.package}`));
    const validationResponse: ProjectCheckOutput[] = [];
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
              depPackageSet.set(sourcePckDep.package, mainPckTree.length > 0 && mainPckTree[0].versionNumber ? mainPckTree[0].versionNumber.replace('.NEXT', '.LATEST') : sourcePckDep.versionNumber)
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
          Process: ProjectCheckProcess.MISSING_DEPS,
          Package: packageTree.package,
          Message: `Please add package ${key} to the dependencies`,
        });
        if (value) {
          packageTree.dependencies.splice(depPackageCounter - 1, 0, {
            package: key,
            versionNumber: value,
          });
        } else {
          packageTree.dependencies.splice(depPackageCounter - 1, 0, {
            package: key,
          });
        }
      }
    }
    // iterate again to
    return validationResponse;
  }

  /**
   * @description - This method is used to check the depenenecies order of a package
   * @param sourcePackageDirs
   * @param packageTree
   * @param packageAliases
   * @private
   */
  private checkPackageOrder(
    sourcePackageDirs: PackageDirLarge[],
    packageTree: PackageDirLarge,
    packageAliases: {
      [k: string]: string;
    }
  ): ProjectCheckOutput[] {
    try {
      EONLogger.log(COLOR_TRACE(`Start checking order for package ${packageTree.package}`));
      const currentPckIndexMap = new Map<string, number>();
      const newPckIndexMap = new Map<string, number>();
      const validationResponse: ProjectCheckOutput[] = [];
      let newPackageIndex = 0;
      if (!packageTree?.dependencies) {
        EONLogger.log(COLOR_WARNING(`Validation for missing dependencies failed. unlocked package ${packageTree.package} has no dependencies array.
  Please add an empty array for the dependencies.`))
        return validationResponse;
      }
      if (
        !(packageTree?.dependencies && Array.isArray(packageTree.dependencies) && packageTree.dependencies.length > 0)
      ) {
        EONLogger.log(COLOR_INFO(`✔️ Package has no dependencies. Finished without check.`, COLOR_INFO));
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
      outputList = [];
      for (const [key, value] of newPckIndexMap) {
        outputList.push(key);
        if (currentPckIndexMap.get(key)) {
          if (currentPckIndexMap.get(key) > value) {
            if (packageTree.dependencies[currentPckIndexMap.get(key)].versionNumber && packageTree.dependencies[currentPckIndexMap.get(key)].versionNumber !== undefined) {
              packageTree.dependencies.splice(value, 0, {
                package: packageTree.dependencies[currentPckIndexMap.get(key)].package,
                versionNumber: packageTree.dependencies[currentPckIndexMap.get(key)].versionNumber,
              });
            } else {
              packageTree.dependencies.splice(value, 0, {
                package: packageTree.dependencies[currentPckIndexMap.get(key)].package,
              });
            }
            packageTree.dependencies.splice(currentPckIndexMap.get(key) + 1, 1);
            validationResponse.push({
              Process: ProjectCheckProcess.TREE_DEPS_ORDER,
              Package: packageTree.package,
              Message: `Package ${key} has the wrong order position. Current position is ${currentPckIndexMap.get(
                key
              )}. New position is ${value}. Please put the package ${key} on top to package ${packageTree.dependencies[value + 1].package}.
You find the new order details in the snippet to see the correct position 👇️.`,
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
            Process: ProjectCheckProcess.TREE_ORDER,
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

  /**
   * @description - This method is used to check the coorect versions from the dependend packages
   * @param sourcePackageDirs
   * @param packageTree
   * @private
   */
  private checkDepVersion(
    sourcePackageDirs: PackageDirLarge[],
    packageTree: PackageDirLarge
  ): ProjectCheckOutput[] {
    EONLogger.log(COLOR_TRACE(`Start checking dependency versions for package ${packageTree.package}`));
    const validationResponse: ProjectCheckOutput[] = [];
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
      EONLogger.log(COLOR_INFO(`✔️ Package has no dependencies. Finished without check.`, COLOR_INFO));
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
            Process: ProjectCheckProcess.TREE_DEPS_VERSION,
            Package: packageTree.package,
            Message: `Dependend package ${key} needs a higher version. Please update version to ${newPackageVersionMap.get(
              key
            )}!`,
          });
          for (const sourcePckDep of packageTree.dependencies) {
            if (sourcePckDep.package === key) {
              sourcePckDep.versionNumber = `${newPackageVersionMap.get(key)}.LATEST`;
            }
          }
        }
      }
    }
    return validationResponse;
  }

  /**
   * @description - This method prints the error messages to the console
   * @param packageCheckList
   * @param packageMap
   * @private
   */
  private printOutput(packageCheckList: ProjectCheckOutput[], packageMap: Map<string, PackageDirLarge>): void {
    EONLogger.log(
      COLOR_ERROR_DIM(`Static check found errors. Please check the package snippets with the correct data 🧐👇`)
    );
    for (const pck of packageMap.values()) {
      if (packageCheckList.filter(pckCheck => pckCheck.Package === pck.package)) {
        EONLogger.log(`${COLOR_INFO_BOLD('Package')}: ${COLOR_INFO(pck.package)}`)
      }
      //special output for wrong package tree order
      if (packageCheckList.some(pckCheck => pckCheck.Package === pck.package && pckCheck.Process === ProjectCheckProcess.TREE_ORDER)) {
        const pckOrderMainList = packageCheckList.filter(pckCheck => pckCheck.Package === pck.package && pckCheck.Process === ProjectCheckProcess.TREE_ORDER)
        EONLogger.log(COLOR_ERROR_DIM(`Please put package ${pck.package} behind ⤵ the depend package ${pckOrderMainList[pckOrderMainList.length - 1].Message} ❗️`))
      }
      //standard output for errors without wrong package tree order
      packageCheckList.forEach((pckCheck) => {
        if (pckCheck.Package === pck.package && pckCheck.Process !== ProjectCheckProcess.TREE_ORDER) {
          EONLogger.log(COLOR_ERROR_DIM(`${pckCheck.Process}: ${pckCheck.Message}`));
        }
      })
      if (packageCheckList.filter(pckCheck => pckCheck.Package === pck.package)) {
        EONLogger.log(COLOR_INFO_BOLD_DIM(`Start of package code snippets with fixed data`));
        console.log(pck)
        EONLogger.log(COLOR_INFO_BOLD_DIM(`End of package code snippets with fixed data`));
      }
    }
    if(!this.flags.fix){
      throw new SfdxError(
        `Static checks failed. Please fetch the new data from snippet and fix this issues from sfdx-project.json file
If you want to fix this issues automatically, please use the --fix flag.`
      );
    }
  }
}
