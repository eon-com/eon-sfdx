import { SfProjectJson } from '@salesforce/core';
import { PackageTree } from './types';
import { NamedPackageDirLarge } from './types';

/**
 * This Class converts a sfdxProjectJson from core/Salesforce format to a package node tree across all levels
 * of implicit dependencies. Call `nodeTreeInit()` to initialize the nodeTree.
 * @param projectjson  the full projectJson from salesforce
 */
export default class PackageNodeTree {
  projectJson: SfProjectJson;
  nodeTree: PackageTree[] = [];
  public constructor(projectjson: SfProjectJson) {
    this.projectJson = projectjson;
  }
  /**
   * Converts the project Json PackageDirectories into a tree of packages
   */
  public async nodeTreeInit() {
    const json = this.projectJson.getContents();
    const packagedir: NamedPackageDirLarge[] = json.packageDirectories as NamedPackageDirLarge[];
    for (const pck of packagedir) {
      let newNode: PackageTree = {
        version: pck?.versionNumber,
        packagename: pck.package,
        path: pck.path,
        managed: false,
        dependency: [],
      };
      newNode.dependency = this.getDependencyNodes(pck.package, packagedir);
      this.nodeTree = [...this.nodeTree, newNode];
    }
  }
  /**
   * Crawl through the child nodes of a package and returns a single list of tree nodes containing
   * only unique package nodes. If dependencies are occuring as child of childs, the node with
   * the highest version number is return.
   * @param pckName Name of the package for which dependencies should be returned
   * @returns List of package tree nodes reflecting the explicit and implicit dependencies of a package
   *
   */
  public getImplicitDependencyNodesForPackageName(pckName: string): PackageTree[] {
    let implicitMinVersionNodes: PackageTree[] = [];
    const packageNode: PackageTree = this.nodeTree.find((node) => node.packagename === pckName);
    if (packageNode) {
      const dependencyTree = this.getAllImplicitDependencyNodes(packageNode);
      const distinctPackages: string[] = [...new Set(dependencyTree.map((x) => x.packagename))];
      distinctPackages.forEach((distinct) => {
        implicitMinVersionNodes = [
          ...implicitMinVersionNodes,
          this.getNodeWithHighestVersion(distinct, dependencyTree),
        ];
      });
    }
    return implicitMinVersionNodes;
  }

  /**
   * Recursive Function to generate all child tree nodes of a package
   * @param pckName Name of the package for which dependencies should be returned
   * @returns Dependency tree list
   *
   */
  private getDependencyNodes(pckName: string, dir: NamedPackageDirLarge[]): PackageTree[] {
    let dependencies: PackageTree[] = [];
    const pck: NamedPackageDirLarge = dir.find((p) => p.package === pckName);
    if (pck.dependencies) {
      pck.dependencies.forEach((dep) => {
        if (dep.versionNumber) {
          const depPck: NamedPackageDirLarge = dir.find((p) => p.package === dep.package);
          const packageNode: PackageTree = {
            version: dep.versionNumber,
            packagename: depPck?.package,
            managed: false,
            path: depPck?.path,
            dependency: this.getDependencyNodes(depPck.package, dir),
          };
          dependencies = [...dependencies, packageNode];
        } else {
          const managedNode: PackageTree = {
            packagename: dep.package,
            managed: true,
          };
          dependencies = [...dependencies, managedNode];
        }
      });
    }

    return dependencies;
  }
  /**
   * Recursive Function to concatenate all child tree nodes as one list. The list might contain
   * multiple versions of the same tree node as dependency versions might differ
   * @param pckName Name of the package for which dependencies should be returned
   * @returns List of package tree nodes reflecting all explicit and implicit child dependencies of a package
   */
  private getAllImplicitDependencyNodes(pckNode: PackageTree): PackageTree[] {
    let implicitDependencies: PackageTree[] = [];

    for (const depNode of pckNode.dependency) {
      if (depNode.dependency && depNode.dependency.length > 0) {
        const childImplicitDependencies: PackageTree[] = this.getAllImplicitDependencyNodes(depNode);
        implicitDependencies = [...implicitDependencies, ...childImplicitDependencies, depNode];
      } else {
        implicitDependencies = [...implicitDependencies, depNode];
      }
    }
    return implicitDependencies;
  }

  /**
   * Find the tree node in a list of tree nodes that has the highest semver version.
   * In case of managed package, the first value is returned
   * @param pckName Name of the package for which dependencies should be returned
   * @param nodeList list of nodes to be searched for highest version
   * @returns single tree node representing the highest required version inherited from dependency tree
   */
  public getNodeWithHighestVersion(pckName: string, nodeList: PackageTree[]): PackageTree {
    let samePackageNodes: PackageTree[] = [];
    samePackageNodes = nodeList.filter((node) => node.packagename === pckName);
    if (samePackageNodes.some((samePackageNode) => samePackageNode.managed)) {
      return nodeList.find((node) => node.packagename === pckName);
    }
    const semver = require('semver');
    let versions: string[] = [];
    samePackageNodes.forEach((samePackageNode) => {
      const pckSemver = samePackageNode.version
        ? samePackageNode.version.replace('.NEXT', '').replace('.LATEST', '')
        : undefined;
      versions = [...versions, pckSemver];
    });
    const max = versions.sort(semver.rcompare)[0];
    return nodeList.find((node) => {
      return node.version && node.version.includes(max) && node.packagename === pckName;
    });
  }
}
