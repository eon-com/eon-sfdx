import { SfdxProjectJson } from '@salesforce/core';
import { PackageTree } from '../interfaces/package-interfaces';
import { NamedPackageDirLarge } from '../helper/types';

export function getDeployUrls(projectJson: SfdxProjectJson, packagename: string): PackageTree {
  const packageDirs: NamedPackageDirLarge[] = projectJson.getUniquePackageDirectories();
  let packageTree: PackageTree;
  const currentPackage: NamedPackageDirLarge = packageDirs.find((pck) => pck.package === packagename);

  if (currentPackage) {
    packageTree = {
      packagename: currentPackage.package,
      path: currentPackage.fullPath,
      managed: false,
      dependency: [],
      postDeploymentScript: currentPackage?.postDeploymentScript ?? '',
      preDeploymentScript: currentPackage?.preDeploymentScript ?? ''
    };

    if (currentPackage.dependencies) {
      currentPackage.dependencies.forEach((dep) => {
        const depPackage: NamedPackageDirLarge = packageDirs.find((pck) => pck.package === dep.package);
        const treeDep: PackageTree = {
          packagename: dep.package,
          path: packageDirs.find((pck) => pck.package === dep.package)?.fullPath,
          postDeploymentScript: depPackage?.postDeploymentScript ?? '',
          preDeploymentScript: depPackage?.preDeploymentScript ?? ''
        };
        packageTree.dependency = [...packageTree.dependency, treeDep];
      });
    }
  }

  return packageTree;
}