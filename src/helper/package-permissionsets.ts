import { PackageDirParsed, PackagePermissionset, SfdxPermissionSet } from './types';
import fs from 'fs';
import * as fspromise from 'fs/promises';
import path from 'path';
import { parseSourceComponent } from './xml';
/**
 * Returns all Permissionsets inside a SFDX package
 * @param pck Package name and path of the package to scan
 * @returns List of Permissionsets found inside the package directory
 */
export default async function getPermissionsets(pck: PackageDirParsed): Promise<PackagePermissionset[]> {
  const permissionSetPaths: string[] = getAllFiles(pck.path).filter((file) =>
    file.includes('permissionset-meta.xml')
  );
  let permissionSets = [];
  for (const psPath of permissionSetPaths) {
    const rawPs = await fspromise.readFile(psPath);
    permissionSets = [...permissionSets, parseSourceComponent(rawPs.toString()) as SfdxPermissionSet];
  }
  return permissionSets.map((ps) => {
    return { label: ps.PermissionSet.label, description: ps.PermissionSet.description } as PackagePermissionset;
  });
}

/**
 * Recursive function to return all files of a directory
 * @param dirPath directory path to scan
 * @param arrayOfFiles list of files to be added as existing files
 * @returns Array of Paths to all files in directory
 */
export const getAllFiles = function (dirPath: string, arrayOfFiles?: string[]) {
  let files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    if (fs.statSync(dirPath + '/' + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles);
    } else {
      if (arrayOfFiles) {
        arrayOfFiles.push(path.join(dirPath, '/', file));
      }
    }
  });

  return arrayOfFiles;
};
