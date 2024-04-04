import { NamedPackageDir, SfProjectJson } from '@salesforce/core';
import { PackageTree } from '../helper/types';

export function getDeployUrls(projectJson: SfProjectJson, packagename: string): PackageTree {
  const packageDirs: NamedPackageDir[] = projectJson.getUniquePackageDirectories();
  const packageAliases = projectJson.getContents().packageAliases;
  let packageTree: PackageTree;
  const currentPackage: NamedPackageDir = packageDirs.find((pck) => pck.package === packagename);

  if (currentPackage) {
    packageTree = {
      packagename: currentPackage.package,
      path: currentPackage.fullPath,
      managed: false,
      dependency: [],
    };

    if (currentPackage.dependencies) {
      currentPackage.dependencies.forEach((dep) => {
        // add only packages !== managed
        if (packageAliases[dep.package] && !packageAliases[dep.package].startsWith('04t')) {
        const treeDep: PackageTree = {
          packagename: dep.package,
          path: packageDirs.find((pck) => pck.package === dep.package)?.fullPath,
        };
        packageTree.dependency = [...packageTree.dependency, treeDep];
      }
      });
    }
  }

  return packageTree;
}
