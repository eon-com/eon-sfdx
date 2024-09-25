import { SfProjectJson } from '@salesforce/core';
import { PackageTree, NamedPackageDirLarge } from '../helper/types';

export function getDeployUrls(projectJson: SfProjectJson, packagename: string): PackageTree {
  const json = projectJson.getContents();
    // get all packages

  const packageDirs: NamedPackageDirLarge[] = json.packageDirectories as NamedPackageDirLarge[];
  const packageAliases = projectJson.getContents().packageAliases;
  let packageTree: PackageTree;
  const currentPackage: NamedPackageDirLarge = packageDirs.find((pck) => pck.package === packagename);

  if (currentPackage) {
    packageTree = {
      packagename: currentPackage.package,
      path: currentPackage.path,
      managed: false,
      dependency: [],
    };

    if (currentPackage.dependencies) {
      currentPackage.dependencies.forEach((dep) => {
        // add only packages !== managed
        if (packageAliases[dep.package] && !packageAliases[dep.package].startsWith('04t')) {
        const treeDep: PackageTree = {
          packagename: dep.package,
          path: packageDirs.find((pck) => pck.package === dep.package)?.path,
        };
        packageTree.dependency = [...packageTree.dependency, treeDep];
      }
      });
    }
  }

  return packageTree;
}
