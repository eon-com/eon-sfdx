import { SfError } from '@salesforce/core';
import fs from 'fs';
import fspromise from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import EONLogger, { COLOR_ERROR } from '../eon/EONLogger';
import { NamedPackageDirLarge } from './types';

export const SETUPFILE = 'eon-devkit.yml';
export const DEVKITFOLDER = 'devkit';
export const SCRIPTSFOLDER = 'scripts';
export const TESTDATAFOLDER = 'testdata';

export const EXPORTJSON: string = `{
    "allOrNone": false,
    "promptOnMissingParentObjects": true,
    "concurrencyMode": "Serial",
    "importCSVFilesAsIs": false,
    "objects": [
        {
            "query": "SELECT id, Name from Account",
            "operation": "Upsert",
            "externalId": "Name"
        },
        {
            "query": "SELECT id, Name from Contact",
            "operation": "Upsert",
            "externalId": "Name"
        }
    ]
}`;

export const EONDEVKITYML: string = `
# Include other devkits from other packages by adding the name of the package (e.g. core):
include:
    -
# List the permissionsets that should be assigned to current user (e.g. Service Agent):
permissionsets:
    -
# add location(s) of anonymous apex scripts relative to this file (e.g. scripts/script.apex):
anonymous_apex:
    - scripts/setup-script.apex
# add location(s) of export.json files if testdata should be imported (e.g. testdata/export.json):
test_data:
    - testdata/export.json
`;

export const EXAMPLEAPEX: string = `
System.debug('Add your scripts here');
`;

export interface DevKitYaml {
  include?: string[];
  permissionsets?: string[];
  anonymous_apex?: string[];
  test_data?: string[];
}

export const getDevKits = async (packageDirs: NamedPackageDirLarge[], packagename: string) => {
  const packagePath: string = packageDirs.find((a) => a.package === packagename).path;

  const filePaths: string[] = findFileInDir(packagePath, SETUPFILE);
  // error handling
  if (filePaths.length > 1) {
    EONLogger.log(COLOR_ERROR('Multiple ' + SETUPFILE + ' files found in package ' + packagename));
    EONLogger.log(COLOR_ERROR('Only one ' + SETUPFILE + ' file is allowed per package'));
    return;
  } else if (filePaths.length === 0) {
    throw new SfError(SETUPFILE + ' file not found in package ' + packagename);
  }
  const devKitFilePath = filePaths[0];

  const raw = await fspromise.readFile(devKitFilePath, 'utf8');
  let devkitRootFile: DevKitYaml;
  try {
    devkitRootFile = YAML.parse(raw) as DevKitYaml;
  } catch (e) {
    EONLogger.log(COLOR_ERROR('Error parsing ' + SETUPFILE + ' file in package ' + packagename));
    return;
  }
  const devKitDir = path.dirname(devKitFilePath);
  devkitRootFile.anonymous_apex = devkitRootFile.anonymous_apex
    ?.filter((a) => a != null)
    .map((a) => path.join(devKitDir, a));
  devkitRootFile.test_data = devkitRootFile.test_data?.filter((a) => a != null).map((a) => path.join(devKitDir, a));
  devkitRootFile.permissionsets = devkitRootFile.permissionsets?.filter((a) => a != null);
  devkitRootFile.include = devkitRootFile.include?.filter((a) => a != null) ?? [];

  if (devkitRootFile?.include && devkitRootFile.include.length > 0) {
    for (const includedPackage of devkitRootFile.include.filter((a) => a != null)) {
      let childDevkit: DevKitYaml = await getDevKits(packageDirs, includedPackage);
      devkitRootFile.anonymous_apex = [
        ...devkitRootFile.anonymous_apex,
        ...(childDevkit.anonymous_apex.filter((a) => a != null) || []),
      ];
      devkitRootFile.permissionsets = [
        ...(devkitRootFile.permissionsets.filter((a) => a != null) || []),
        ...(childDevkit.permissionsets.filter((a) => a != null) || []),
      ];
      devkitRootFile.test_data = [
        ...(devkitRootFile.test_data.filter((a) => a != null) || []),
        ...(childDevkit.test_data.filter((a) => a != null) || []),
      ];
      devkitRootFile.include = [
        ...(devkitRootFile.include.filter((a) => a != null) || []),
        ...(childDevkit.include.filter((a) => a != null) || []),
      ];
    }
  }
  return devkitRootFile;
};

export function findFileInDir(dir, filename) {
  let results = [];
  fs.readdirSync(dir).forEach((file) => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      results = [...results, ...findFileInDir(fullPath, filename)];
    } else {
      if (fullPath.includes(filename)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}
