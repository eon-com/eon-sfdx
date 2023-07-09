import { NamedPackageDir, PackageDir, SfdxProjectJson } from '@salesforce/core';
import { PackageTree } from '../helper/types';

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

export async function getParentPackages(projectJson: SfdxProjectJson, packagename: string, includeself?: boolean): Promise<PackageDir[]> {
  const packageDirectories = await projectJson.getPackageDirectories();
  const parents = packageDirectories.reduce((parents, pkg) => {
    if (includeself) {
      if (pkg.package === packagename) {
        return [...parents, {
          path: pkg.path,
          packagename: pkg.package
        }]
      }
    }
    const isDependency = pkg.dependencies?.find(dep => dep.package === packagename);
    if (isDependency) {
      return [...parents, {
        path: pkg.path,
        packagename: pkg.package
      }]
    }
    return parents;
  }, []);
  return parents;
}
