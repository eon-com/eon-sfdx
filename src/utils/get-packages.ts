import { NamedPackageDir, SfdxProjectJson } from '@salesforce/core';
import { PackageTree } from '../interfaces/package-interfaces';

export function getDeployUrls(projectJson: SfdxProjectJson, packagename: string): PackageTree {
  const packageDirs: NamedPackageDir[] = projectJson.getUniquePackageDirectories();
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
        const treeDep: PackageTree = {
          packagename: dep.package,
          path: packageDirs.find((pck) => pck.package === dep.package)?.fullPath,
        };
        packageTree.dependency = [...packageTree.dependency, treeDep];
      });
    }
  }

  return packageTree;
}