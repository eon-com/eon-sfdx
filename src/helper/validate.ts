/* eslint-disable import/namespace */
import {SfError, SfProjectJson} from '@salesforce/core'
import {NamedPackageDirLarge} from '../helper/types'
import * as lodash from 'lodash'
import * as path from 'node:path'
import {simpleGit} from 'simple-git'

export default class ValidateDiff {
  private static instance: ValidateDiff

  public static getInstance(): ValidateDiff {
    if (!this.instance) {
      this.instance = new ValidateDiff()
    }

    return this.instance
  }

  public async getGitDiff(packageTree: NamedPackageDirLarge, project: SfProjectJson): Promise<boolean> {
    const git = simpleGit(path.dirname(project.getPath()))
    const diffString = await git.diff([`origin/main...HEAD`, `--no-renames`, `--name-only`])
    const modifiedFiles: string[] = diffString.split('\n')

    modifiedFiles.pop()

    // no static checks when package is ignored

    for (const filename of modifiedFiles) {
      if (path.normalize(filename).includes(path.normalize(packageTree.path))) {
        return true
      }
    }

    return false
  }

  public async getPackageTreeChanges(
    sourceTree: NamedPackageDirLarge,
    project: SfProjectJson,
  ): Promise<NamedPackageDirLarge | null> {
    const git = simpleGit(path.dirname(project.getPath()))
    const projectJsonString: string = await git.show([`origin/main:sfdx-project.json`])
    if (!projectJsonString) {
      throw new SfError(`Found no sfdx-project.json file for branch origin/main`)
    }

    const projectJsonTarget = JSON.parse(projectJsonString)
    const packageDirsTarget = projectJsonTarget.packageDirectories

    if (!packageDirsTarget && !Array.isArray(packageDirsTarget)) {
      throw new SfError(`Could not parse sfdx-project.json from target branch. Please check your target branch.`)
    }

    for (const targetTree of packageDirsTarget) {
      if (targetTree.package === sourceTree.package && !lodash.isEqual(targetTree, sourceTree)) {
        return targetTree
      }
    }

    return null
  }
}
