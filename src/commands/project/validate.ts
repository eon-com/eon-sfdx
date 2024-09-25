import * as os from 'os';
import { Messages, SfError, SfProjectJson } from '@salesforce/core';
import { PackageDir, PackageDirDependency } from '@salesforce/schemas';
import { AnyJson, ensureArray } from '@salesforce/ts-types';
import simplegit, { DiffResult, SimpleGit } from 'simple-git';
import {
  ProjectValidationOutput,
  NamedPackageDirLarge,
  MetadataPackage,
  MetadataPackageVersion,
  SubscriberPackageVersion,
} from '../../helper/types';
import EONLogger, {
  COLOR_INFO,
  COLOR_KEY_MESSAGE,
  COLOR_HEADER,
  COLOR_NOTIFY,
  COLOR_WARNING,
  COLOR_TRACE,
  COLOR_EON_YELLOW,
  COLOR_ERROR,
  COLOR_INFO_BOLD,
  COLOR_SUCCESS,
} from '../../eon/EONLogger';
import path from 'path';
import Table from 'cli-table3';
import { LOGOBANNER } from '../../eon/logo';
import stripAnsi from 'strip-ansi';
import { Flags } from '@oclif/core';
import  EonCommand  from '../../EonCommand';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'project_validate');

export default class ProjectValidate extends EonCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  static flags = {
    // Label For Named Credential as Required
    target: Flags.string({
      char: 't',
      description: messages.getMessage('target'),
      required: false,
      default: 'origin/main',
    }),
    source: Flags.string({
      char: 's',
      description: messages.getMessage('source'),
      required: false,
    }),
    versionupdate: Flags.boolean({
      char: 'v',
      description: messages.getMessage('versionupdate'),
      required: false,
    }),
    missingdeps: Flags.boolean({
      char: 'm',
      description: messages.getMessage('missingdeps'),
      required: false,
    }),
    order: Flags.boolean({
      char: 'o',
      description: messages.getMessage('order'),
      required: false,
    }),
    depsversion: Flags.boolean({
      char: 'd',
      description: messages.getMessage('depsversion'),
      required: false,
    }),
    package: Flags.string({
      char: 'p',
      description: messages.getMessage('package'),
      default: '',
      required: false,
    }),
    all: Flags.boolean({
      char: 'a',
      description: messages.getMessage('all'),
      required: false,
    }),
    change: Flags.boolean({
      char: 'c',
      description: messages.getMessage('change'),
      required: false,
    }),
    targetdevhubusername: Flags.string({
      char: 'u',
      description: 'Login username or alias for the devhub org.',
      required: true,
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  // Comment this out if your command does not require an org username
  protected static requiresDevhubUsername = true;

  protected static publicPackageMap = new Map<string, NamedPackageDirLarge>();
  private static readonly TREE_VERSION_UPDATE = 'Package tree version';
  private static readonly MISSING_DEPS = 'Package tree missing dependencies';
  private static readonly TREE_ORDER = 'Package tree order';
  private static readonly TREE_DEPS_ORDER = 'Package tree dependencies order';
  private static readonly TREE_DEPS_VERSION = 'Package tree dependencies version';

  public async execute(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    EONLogger.log(COLOR_KEY_MESSAGE('Static checks on sfdx-project.json file...'));
    let hasError = false;
    // get sfdx project.json
    const projectJson: SfProjectJson = await this.project.retrieveSfProjectJson();
    const packageAliases = projectJson.getContents().packageAliases;
    // get all packages
    const contents = projectJson.getContents();
    let packageDirs: NamedPackageDirLarge[] = ensureArray(contents.packageDirectories);
    // get all diffs from current to target branch

    let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
    let packageDirsTarget: NamedPackageDirLarge[] = [];
    let packageCheckList: ProjectValidationOutput[] = [];
    EONLogger.log(COLOR_HEADER('Search for package changes'));
    const projectJsonString: string = await git.show([`${this.flags.target}:sfdx-project.json`]);
    if (!projectJsonString) {
      throw new SfError(`Found no sfdx-project.json file on branch ${this.flags.target}`);
    }
    const projectJsonTarget: SfProjectJson = JSON.parse(projectJsonString);
    packageDirsTarget = projectJsonTarget['packageDirectories'];
    if (!packageDirsTarget && !Array.isArray(packageDirsTarget)) {
      throw new SfError(`Could not parse sfdx-project.json from target branch. Please check your target branch.`);
    }

    const sourcebranch = this.flags.source || 'HEAD';
    let includeForceApp = false;
    let changes: DiffResult;
    changes = await git.diffSummary([`${this.flags.target}...${sourcebranch}`]);
    await git.fetch();
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

      if (this.flags.target && changes.files && Array.isArray(changes.files)) {
        packageCheck = changes.files.some((change) => {
          if (
            path
              .join(path.dirname(projectJson.getPath()), path.normalize(change.file))
              .includes(path.normalize(pck.path))
          ) {
            return true;
          }
          //check for metadata move between packages
          if (change.file.search('=>') > -1) {
            if (change.file.search(`/${pck.package}/`) > -1) {
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
      throw new SfError(
        `Validation failed. This merge request contains only data from the force-app folder. This folder is not part of the deployment.
Please put your changes in a (new) unlocked package or a (new) source package. THX`
      );
    }

    //run validation tasks
    if (this.flags.versionupdate || this.flags.all) {
      EONLogger.log(COLOR_HEADER('🔎 Start static check for 👉 Package changes with version update'));
      for (const value of packageMap.values()) {
        //check update version number
        const singlePackageCheckList = this.checkSingleVersionUpdate(value, packageDirsTarget);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList, ...singlePackageCheckList];
          ProjectValidate.publicPackageMap.set(value.package, value);
          hasError = true;
        }
      }
    }
    if (this.flags.depsversion || this.flags.all) {
      EONLogger.log(COLOR_HEADER('🔎 Start static checks for 👉 Correct dependencies version'));

      let metaPackageList = await this.hubOrg
        .getConnection()
        .autoFetchQuery<MetadataPackage>(
          `Select Name,(select Id,  MajorVersion, MinorVersion, PatchVersion, BuildNumber, SystemModstamp  from MetadataPackageVersions ) from MetadataPackage`
        );
      let packageList = metaPackageList.records ? metaPackageList.records : [];
      if (packageList.length === 0) {
        EONLogger.log(COLOR_WARNING(`👆 No metadata packages found in this org`));
        return {};
      }
      let packageVersionList: MetadataPackageVersion[] = [];

      for (const meta of packageList) {
        let packageVersion = meta.MetadataPackageVersions ? meta.MetadataPackageVersions.records : [];
        for (const version of packageVersion) {
          packageVersionList.push({
            id: version.Id,
            name: meta.Name,
            version: `${version.MajorVersion}.${version.MinorVersion}.${version.PatchVersion}`,
            modifiedDate: version.SystemModstamp,
          });
        }
      }
      for (const value of packageMap.values()) {
        if (!packageAliases[value.package]) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${value.package}`));
          continue;
        }
        const singlePackageCheckList = await this.checkDepVersion(value, packageVersionList);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList, ...singlePackageCheckList];
          ProjectValidate.publicPackageMap.set(value.package, value);
          hasError = true;
        }
      }
    }
    if (this.flags.missingdeps || this.flags.all) {
      EONLogger.log(COLOR_HEADER('🔎 Start static checks for 👉 Missing dependencies'));
      for (const value of packageMap.values()) {
        if (!packageAliases[value.package]) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${value.package}`));
          continue;
        }
        const singlePackageCheckList = this.checkMissingDeps(packageDirs, value);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList, ...singlePackageCheckList];
          ProjectValidate.publicPackageMap.set(value.package, value);
          hasError = true;
        }
      }
    }
    if (this.flags.order || this.flags.all) {
      EONLogger.log(COLOR_HEADER('🔎 Start static checks for 👉 Correct package order'));
      for (const value of packageMap.values()) {
        if (!packageAliases[value.package]) {
          EONLogger.log(COLOR_WARNING(`👆 No validation for source packages: ${value.package}`));
          continue;
        }
        const singlePackageCheckList = this.checkPackageOrder(packageDirs, value, packageAliases);
        if (singlePackageCheckList.length > 0) {
          packageCheckList = [...packageCheckList, ...singlePackageCheckList];
          ProjectValidate.publicPackageMap.set(value.package, value);
          hasError = true;
        }
      }
    }

    if (hasError) {
      //console.log(tableOutput.toString());
      EONLogger.log(
        COLOR_ERROR(`🔥 Static check found errors. Please check the package snippets with the correct data 🧐`)
      );
      for (const publicPck of ProjectValidate.publicPackageMap.values()) {
        const pckOrderMainList = packageCheckList.filter(
          (pck) => pck.Package === publicPck.package && pck.Process === ProjectValidate.TREE_ORDER
        );
        const hasTreeVersionUpdate = packageCheckList.some(
          (pck) => pck.Package === publicPck.package && pck.Process === ProjectValidate.TREE_VERSION_UPDATE
        );
        const hasMissingDeps = packageCheckList.some(
          (pck) => pck.Package === publicPck.package && pck.Process === ProjectValidate.MISSING_DEPS
        );
        const hasTreeOrder = packageCheckList.some(
          (pck) => pck.Package === publicPck.package && pck.Process === ProjectValidate.TREE_ORDER
        );
        const hasTreeDepsOrder = packageCheckList.some(
          (pck) => pck.Package === publicPck.package && pck.Process === ProjectValidate.TREE_DEPS_ORDER
        );
        const hasDepsVersion = packageCheckList.some(
          (pck) => pck.Package === publicPck.package && pck.Process === ProjectValidate.TREE_DEPS_VERSION
        );
        let table = new Table({
          head: ['Check', 'Result'],
          colWidths: [60, 100], // Requires fixed column widths
          wordWrap: true,
        });
        table.push([
          COLOR_INFO(ProjectValidate.TREE_VERSION_UPDATE),
          `${
            hasTreeVersionUpdate
              ? COLOR_INFO(
                  `👎 Update package version. Please look into the ${COLOR_EON_YELLOW(
                    `changes`
                  )} from the package snippets!`
                )
              : '👍'
          }`,
        ]);
        table.push([
          COLOR_INFO(ProjectValidate.MISSING_DEPS),
          `${
            hasMissingDeps
              ? COLOR_INFO(
                  `👎 Add dependencies.Please look into the ${COLOR_EON_YELLOW(`changes`)} from the package snippets!`
                )
              : '👍'
          }`,
        ]);
        table.push([
          COLOR_INFO(ProjectValidate.TREE_ORDER),
          `${
            hasTreeOrder
              ? COLOR_INFO(
                  `👎 Change package order.Please put package ${publicPck.package} behind ⤵ the depend package ${
                    pckOrderMainList[pckOrderMainList.length - 1]?.Message
                  } ❗️`
                )
              : '👍'
          }`,
        ]);
        table.push([
          COLOR_INFO(ProjectValidate.TREE_DEPS_ORDER),
          `${
            hasTreeDepsOrder
              ? COLOR_INFO(
                  `👎 Change dependencies order.Please look into the ${COLOR_EON_YELLOW(
                    `changes`
                  )} from the package snippets!`
                )
              : '👍'
          }`,
        ]);
        table.push([
          COLOR_INFO(ProjectValidate.TREE_DEPS_VERSION),
          `${
            hasDepsVersion
              ? COLOR_INFO(
                  `👎 Update dependency version.Please look into the ${COLOR_EON_YELLOW(
                    `changes`
                  )} from the package snippets!`
                )
              : '👍'
          }`,
        ]);
        EONLogger.log(`${COLOR_INFO_BOLD('Package')}: ${COLOR_INFO(publicPck.package)}\n`);
        console.log(table.toString());
        EONLogger.log(`${COLOR_INFO_BOLD('Start of package code snippets')}: ${COLOR_INFO(publicPck.package)}\n`);
        console.log(this.createTableString(publicPck), '\n');
        EONLogger.log(`${COLOR_INFO_BOLD('End of package code snippets')}: ${COLOR_INFO(publicPck.package)}\n`);
      }
      if (this.flags.change) {
        EONLogger.log(COLOR_HEADER(`👆 Update sfdx-project.json file with the new data 👆`));
        projectJson.setContentsFromObject(contents);
        await projectJson.write();
      } else {
        throw new SfError(
          `🔥 Static checks failed. Please fetch the new data from snippet and fix this issues from sfdx-project.json file`
        );
      }
    }

    EONLogger.log(COLOR_SUCCESS(`Yippiee. 🤙 Static checks finsihed without errors. Great 🤜🤛`));

    return {};
  }

  private checkSingleVersionUpdate(
    sourcePackageDir: NamedPackageDirLarge,
    targetPackageDirs: NamedPackageDirLarge[]
  ): ProjectValidationOutput[] {
    EONLogger.log(COLOR_TRACE(`Check version update for package ${sourcePackageDir.package}`));
    const validationResponse: ProjectValidationOutput[] = [];
    for (const targetPackage of targetPackageDirs) {
      if (sourcePackageDir.package === targetPackage.package) {
        if (
          sourcePackageDir.versionNumber
            .replace('.NEXT', '')
            .localeCompare(targetPackage.versionNumber.replace('.NEXT', ''), undefined, {
              numeric: true,
              sensitivity: 'base',
            }) < 1
        ) {
          validationResponse.push({
            Process: ProjectValidate.TREE_VERSION_UPDATE,
            Package: sourcePackageDir.package,
            Message: `Package Version without change. Please update version ${sourcePackageDir.versionNumber}`,
          });
          //create the new version number from target branch , update minor version
          let newMinorVersion: string = '';
          try {
            if (targetPackage.versionNumber) {
              const startVersion = targetPackage.versionNumber
                .replace('.NEXT', '')
                .slice(0, targetPackage.versionNumber.indexOf('.'));
              const endVersion = targetPackage.versionNumber
                .replace('.NEXT', '')
                .slice(targetPackage.versionNumber.replace('.NEXT', '').lastIndexOf('.') + 1);
              const firstPoint = targetPackage.versionNumber.replace('.NEXT', '').indexOf('.') + 1;
              const lastPoint = targetPackage.versionNumber.replace('.NEXT', '').lastIndexOf('.');
              const oldMinor = targetPackage.versionNumber.replace('.NEXT', '').slice(firstPoint, lastPoint);
              const newMinor = ~~oldMinor + 1;
              newMinorVersion = `${startVersion}.${newMinor}.${endVersion}.NEXT`;
            }
          } catch (e) {
            throw new SfError(
              `Static checks failed. Cannot create a new minor version from target branch. Please check the project json from main.`
            );
          }
          sourcePackageDir.versionNumber = `${COLOR_EON_YELLOW(newMinorVersion)}`;
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
    if (!(packageTree.dependencies && Array.isArray(packageTree.dependencies) && packageTree.dependencies.length > 0)) {
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
              const mainPckTree = sourcePackageDirs.filter((pck) => pck.package === sourcePckDep.package);
              depPackageSet.set(
                sourcePckDep.package,
                mainPckTree.length > 0 && mainPckTree[0].versionNumber
                  ? mainPckTree[0].versionNumber.replace('.NEXT', '.LATEST')
                  : sourcePckDep.versionNumber
              );
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
          Process: ProjectValidate.MISSING_DEPS,
          Package: packageTree.package,
          Message: `Please add package ${key} to the dependencies`,
        });
        if (value && value !== undefined) {
          packageTree.dependencies.splice(depPackageCounter, -1, {
            package: COLOR_EON_YELLOW(key),
            versionNumber: COLOR_EON_YELLOW(value),
          });
        } else {
          packageTree.dependencies.splice(depPackageCounter, -1, {
            package: COLOR_EON_YELLOW(key),
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
      if (
        !(
          packageTree.dependencies &&
          Array.isArray(packageTree.dependencies) &&
          typeof packageAliases === 'object' &&
          packageTree.dependencies.length > 0
        )
      ) {
        EONLogger.log(COLOR_INFO(`✔️ Package has no dependencies. Finished without check.`));
        return validationResponse;
      }
      // create a map for the perfect managed package order , this order comes from the alias section in sfdx-project.json
      let managedAliasMap = new Map<string, number>();
      let managedAliasCounter = -15;
      Object.entries(packageAliases).forEach(([key, value]) => {
        if (value.startsWith('04')) {
          managedAliasMap.set(key, managedAliasCounter);
          managedAliasCounter++;
        }
      });
      // create perfect order from sfdx-project json top to down
      let packageDirCounter = 0;
      for (const sourcePackageTree of sourcePackageDirs) {
        packageDirCounter++;
        for (const sourcePckDep of packageTree.dependencies) {
          //managed package??
          if (packageAliases[sourcePckDep.package] && packageAliases[sourcePckDep.package].startsWith('04')) {
            if (!newPckIndexMap.get(sourcePckDep.package)) {
              newPckIndexMap.set(sourcePckDep.package, managedAliasMap.get(sourcePckDep.package));
            }
          }
          if (sourcePckDep.package === sourcePackageTree.package) {
            newPckIndexMap.set(sourcePckDep.package, packageDirCounter);
          }
        }
      }
      //create current order
      newPackageIndex = 1;
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
      let newPackageTreeDepsList: PackageDirDependency[] = [];
      const newIndexPckMap = new Map<number, string>();
      for (const [key, value] of newPckIndexMap) {
        newIndexPckMap.set(value, key);
      }
      const newIndexPckSortMap = new Map([...newIndexPckMap].sort((a, b) => a[0] - b[0]));
      const newPckIndexSortMap = new Map<string, number>();
      newPackageIndex = 1;
      for (const value of newIndexPckSortMap.values()) {
        newPckIndexSortMap.set(value, newPackageIndex);
        newPackageIndex++;
      }
      for (const [key, value] of newPckIndexSortMap) {
        outputList.push(key);
        if (currentPckIndexMap.get(key)) {
          if (currentPckIndexMap.get(key) > value) {
            let splicePck: string = stripAnsi(packageTree.dependencies[currentPckIndexMap.get(key) - 1].package);
            let spliceVersion: string = stripAnsi(
              packageTree.dependencies[currentPckIndexMap.get(key) - 1].versionNumber
            );
            if (spliceVersion && spliceVersion !== undefined) {
              newPackageTreeDepsList.push({
                package: COLOR_EON_YELLOW(splicePck),
                versionNumber: COLOR_EON_YELLOW(spliceVersion),
              });
            } else {
              newPackageTreeDepsList.push({ package: COLOR_EON_YELLOW(splicePck) });
            }
            validationResponse.push({
              Process: ProjectValidate.TREE_DEPS_ORDER,
              Package: packageTree.package,
              Message: `Package ${key} has the wrong order position. Current postion is ${currentPckIndexMap.get(
                key
              )}. New position is ${value}.
  Please check the New Order Details on top of the table ☝️.`,
            });
          } else {
            let splicePck: string = stripAnsi(packageTree.dependencies[currentPckIndexMap.get(key) - 1].package);
            let spliceVersion: string = stripAnsi(
              packageTree.dependencies[currentPckIndexMap.get(key) - 1].versionNumber
            );
            if (spliceVersion && spliceVersion !== undefined) {
              newPackageTreeDepsList.push({
                package: splicePck,
                versionNumber: spliceVersion,
              });
            } else {
              newPackageTreeDepsList.push({ package: splicePck });
            }
          }
        }
      }
      packageTree.dependencies = newPackageTreeDepsList;
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
            Process: ProjectValidate.TREE_ORDER,
            Package: packageTree.package,
            Message: key,
          });
        }
      }

      return validationResponse;
    } catch (e) {
      throw new SfError(e);
    }
  }

  private async checkDepVersion(
    packageTree: NamedPackageDirLarge,
    packageVersionList: MetadataPackageVersion[]
  ): Promise<ProjectValidationOutput[]> {
    const validationResponse: ProjectValidationOutput[] = [];
    const currentPackageVersionMap = new Map<string, string>();
    const subscriberPackageVersionMap = new Map<string, string>();
    if (!(packageTree.dependencies && Array.isArray(packageTree.dependencies) && packageTree.dependencies.length > 0)) {
      EONLogger.log(COLOR_INFO(`✔️ Package has no dependencies. Finished without check.`));
      return validationResponse;
    }

    EONLogger.log(COLOR_TRACE(`Start checking dependency versions for package ${packageTree.package}`));
    EONLogger.log(COLOR_TRACE(`Search latest version on dev hub for package ${packageTree.package}`));
    // now fetch deps from dependend packages
    for (const sourcePckDep of packageTree.dependencies) {
      if (sourcePckDep?.versionNumber) {
        const checkResult = await this.createSubsriberPackageVersionMap(
          sourcePckDep.package,
          subscriberPackageVersionMap,
          packageVersionList
        );
        if (checkResult) {
          return validationResponse;
        }
      }
    }
    // first fetch package deps for unlocked package
    const checkResult = await this.createSubsriberPackageVersionMap(
      packageTree.package,
      subscriberPackageVersionMap,
      packageVersionList
    );
    if (checkResult) {
      return validationResponse;
    }

    for (const sourcePckDep of packageTree.dependencies) {
      if (sourcePckDep?.versionNumber) {
        if (sourcePckDep.versionNumber.search('LATEST') === -1) {
          throw new SfError(
            `Validation for dependencies version failed. A dependend package for ${packageTree.package} has a wrong version format.
The job cannot find the 'LATEST' prefix. Please check the version number ${sourcePckDep.versionNumber} for package ${sourcePckDep.package}.`
          );
        }
        currentPackageVersionMap.set(sourcePckDep.package, sourcePckDep.versionNumber.replace('.LATEST', ''));
      }
    }
    for (const [key, value] of currentPackageVersionMap) {
      if (!subscriberPackageVersionMap.has(key)) {
        EONLogger.log(
          COLOR_WARNING(
            `👆 Found no SubscriberPackageVersion dependency id for package ${key} on the dev hub. Please check the SubscriberPackageVersion for version ${value}.`
          )
        );
        continue;
      }
      if (
        subscriberPackageVersionMap.get(key).localeCompare(value, undefined, {
          numeric: true,
          sensitivity: 'base',
        }) > 0
      ) {
        validationResponse.push({
          Process: ProjectValidate.TREE_DEPS_VERSION,
          Package: packageTree.package,
          Message: `Dependend package ${key} needs a higher version. Please update version to ${subscriberPackageVersionMap.get(
            key
          )}!`,
        });
        for (const sourcePckDep of packageTree.dependencies) {
          if (sourcePckDep.package === key) {
            let colorVersion: string = stripAnsi(sourcePckDep.versionNumber);
            colorVersion = COLOR_EON_YELLOW(`${subscriberPackageVersionMap.get(key)}.LATEST`);
            sourcePckDep.versionNumber = colorVersion;
          }
        }
      }
    }
    return validationResponse;
  }

  private createTableString(packageTree: NamedPackageDirLarge): string {
    let outputString: string = '';
    outputString = `        {\n`;
    outputString = outputString + `             "path": "${packageTree.path}",\n`;
    outputString = outputString + `             "package": "${packageTree.package}",\n`;
    if (packageTree.versionName) {
      outputString = outputString + `             "versionName": "${packageTree.versionName}",\n`;
      packageTree.versionName = stripAnsi(packageTree.versionName);
    }
    outputString = outputString + `             "versionNumber": "${packageTree.versionNumber}",\n`;
    packageTree.versionNumber = stripAnsi(packageTree.versionNumber);
    outputString =
      outputString +
      `${
        packageTree.dependencies && Array.isArray(packageTree.dependencies) && packageTree.dependencies.length > 0
          ? `             "default": ${packageTree.default},\n`
          : `             "default": ${packageTree.default}\n`
      }`;
    if (packageTree.dependencies && Array.isArray(packageTree.dependencies) && packageTree.dependencies.length > 0) {
      outputString = outputString + `             "dependencies": [\n`;
      packageTree.dependencies.forEach((value, index) => {
        outputString = outputString + `                 {\n`;
        outputString = value.versionNumber
          ? outputString + `                     "package": "${value.package}",\n`
          : outputString + `                     "package": "${value.package}"\n`;
        if (value.versionNumber) {
          outputString = outputString + `                     "versionNumber": "${value.versionNumber}"\n`;
          value.versionNumber = stripAnsi(value.versionNumber);
          value.package = stripAnsi(value.package);
        }
        outputString =
          index === packageTree.dependencies.length - 1
            ? outputString + `                 }\n`
            : outputString + `                 },\n`;
      });
      outputString = outputString + `             ]\n`;
    }
    outputString = outputString + `        }\n`;
    return outputString;
  }

  private async createSubsriberPackageVersionMap(
    pck: string,
    subscriberPackageVersionMap: Map<string, string>,
    packageVersionList: MetadataPackageVersion[]
  ): Promise<Boolean> {
    const latestPackageVersionList = packageVersionList
      .filter((pckVersion) => pckVersion.name === pck)
      .sort((a, b) =>
        a.version.localeCompare(b.version, undefined, {
          numeric: true,
          sensitivity: 'base',
        }) > 0
          ? -1
          : 1
      );
    if (latestPackageVersionList.length === 0) {
      EONLogger.log(
        COLOR_WARNING(`👆 Found no package version for package ${pck} on the dev hub. Please check the package name.`)
      );
      return true;
    }

    let subscriberPackageResponse = await this.hubOrg
      .getConnection()
      .tooling.query<SubscriberPackageVersion>(
        `Select Dependencies from SubscriberPackageVersion where id = '${latestPackageVersionList[0].id}'`
      );

    let subscriberPackageList = subscriberPackageResponse.records ? subscriberPackageResponse.records : [];
    if (subscriberPackageList.length === 0) {
      EONLogger.log(
        COLOR_WARNING(
          `👆 Found no SubscriberPackageVersion for package ${pck} and Id ${latestPackageVersionList[0].id} on the dev hub. Please check the package name.`
        )
      );
      return true;
    } else {
      if (subscriberPackageList[0].Dependencies?.ids && Array.isArray(subscriberPackageList[0].Dependencies?.ids)) {
        subscriberPackageList[0].Dependencies.ids.forEach((id) => {
          for (const version of packageVersionList) {
            if (version.id === id.subscriberPackageVersionId) {
              if (subscriberPackageVersionMap.has(version.name)) {
                if (
                  version.version.localeCompare(subscriberPackageVersionMap.get(version.name), undefined, {
                    numeric: true,
                    sensitivity: 'base',
                  }) > 0
                ) {
                  subscriberPackageVersionMap.set(version.name, version.version);
                }
              } else {
                subscriberPackageVersionMap.set(version.name, version.version);
              }
            }
          }
        });
      }
    }
    return false;
  }
}
