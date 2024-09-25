import { SfProjectJson } from '@salesforce/core';
import { PackageTree } from '../interfaces/package-interfaces';
import { NamedPackageDirLarge } from '../helper/types';

export function getDeployUrls(projectJson: SfProjectJson, packagename: string): PackageTree {
  const json = projectJson.getContents();
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
      postDeploymentScript: currentPackage?.postDeploymentScript ?? '',
      preDeploymentScript: currentPackage?.preDeploymentScript ?? ''
    };

    if (currentPackage.dependencies) {
      currentPackage.dependencies.forEach((dep) => {
        // add only packages !== managed
        if (packageAliases[dep.package] && !packageAliases[dep.package].startsWith('04t')) {
        const depPackage: NamedPackageDirLarge = packageDirs.find((pck) => pck.package === dep.package);
        const treeDep: PackageTree = {
          packagename: dep.package,
          path: packageDirs.find((pck) => pck.package === dep.package)?.path,
          postDeploymentScript: depPackage?.postDeploymentScript ?? '',
          preDeploymentScript: depPackage?.preDeploymentScript ?? ''
        };
        packageTree.dependency = [...packageTree.dependency, treeDep];
      }
      });
    }
  }

  return packageTree;
}
