import { PackageDirParsed, PackagePermissionset, PluginSettings } from './types';
const markdownTable = require('markdown-table');
import {
  COLOR_ERROR,
  COLOR_HEADER,
} from '../eon/EONLogger';
import dedent from 'dedent-js';

import fs from 'fs/promises';
import getPermissionsets from './package-permissionsets';
import path from 'path';
import { SfError } from '@salesforce/core';
import ora from 'ora';

/**
 * Represents the readme of a package inside the package root folder
 */
export default class PackageReadme {
  /**
   * Crawl through the child nodes of a package and returns a single list of tree nodes containing
   * only unique package nodes. If dependencies are occuring as child of childs, the node with
   * the highest version number is return.
   * @param pckName Name of the package for which dependencies should be returned
   * @returns List of package tree nodes reflecting the explicit and implicit dependencies of a package
   *
   */
  static async update(
    pck: PackageDirParsed,
    message: string,
    reference: string,
    user: string,
    settings: PluginSettings
  ): Promise<string> {
    const posixString = pck.path
      .split(path.sep)
      .join(path.posix.sep)
      .replace(settings.sfdxContentSubPath, '');
    const readmePath = path.join(posixString, 'readme.md');
    let readmeExists = true;
    await fs.stat(readmePath).catch((error) => (readmeExists = false));

    let readmeBody = '';

    if (readmeExists) {
      const readme = await fs.readFile(readmePath);
      readmeBody = readme.toString();
    } else {
      readmeBody = `# ${pck.package}

<!-- Add your package description here -->
      `;
    }

    const existingChangelogBody: string = this.getSection(readmeBody, '## Changelog');
    const newChangelogBody: string = this.createNewChangelog(
      existingChangelogBody,
      pck,
      message,
      reference,
      user,
      settings
    );
    const existingPermissionBody: string = this.getSection(readmeBody, '## Permission Sets');
    const newPermissionBody: string = await this.createPermissionsetOverview(pck);
    let newReadmeBody = '';

    if (!readmeBody.includes('## ')) {
      newReadmeBody =
        readmeBody +
        `
` +
        newPermissionBody +
        `
` +
        newChangelogBody;
    } else {
      newReadmeBody = readmeBody
        .replace(existingChangelogBody, newChangelogBody)
        .replace(existingPermissionBody, newPermissionBody);
    }
    const spinner = ora(COLOR_HEADER(`Start updating readme.md file for package ${pck.package}`)).start();
    await fs.writeFile(readmePath, newReadmeBody);
    spinner.succeed(COLOR_HEADER(`Readme.md file for package ${pck.package} updated`));
    return readmePath;
  }
  /**
   * Creates a markdown section with table containing details of all permission set in a package
   * @param body string body of markdown file
   * @param sectionname name of the ## section to be parsed
   * @returns Markdown containing the section of the defined section name
   */
  static getSection(body: string, sectionname: string): string {
    const readmeBody = body;
    let changelogIndex = readmeBody.indexOf(sectionname);

    let existingChangelogBody: string = '';
    // if changelog found, parse the existing changelog
    if (~changelogIndex) {
      const changelogEndIndex = body.substring(changelogIndex).indexOf('## ', 10);
      if (~changelogEndIndex) {
        existingChangelogBody = body.substring(changelogIndex).substring(0, changelogEndIndex);
      } else {
        existingChangelogBody = body.substring(changelogIndex).substring(0, body.length);
      }
    }
    return existingChangelogBody;
  }
  /**
   * Creates a markdown section with a table containing changlog information
   * @param priorBody Body of existing readme
   * @param pck Package related to the readme
   * @param message Information about what change was done
   * @param reference e.g. Jira Reference related to the change
   * @param user Name or identifier of the user adding a change
   * @param settings PluginSettings from sfdx-project.json
   * @returns Markdown section with updated or new changelog table
   */
  static createNewChangelog(
    priorBody: string,
    pck: PackageDirParsed,
    message: string,
    reference: string,
    user: string,
    settings: PluginSettings
  ): string {
    let tableItems = priorBody
      .replace('## Changelog', '')
      .split('|')
      .map((item) => item.trim());

    tableItems.splice(0, tableItems.indexOf('Version') + 10);
    tableItems = tableItems.filter((item) => item != '');

    const priorEntries = tableItems.reduce((resultArray, item, index) => {
      const chunkIndex = Math.floor(index / 4);
      if (!resultArray[chunkIndex]) {
        resultArray[chunkIndex] = []; // start a new chunk
      }
      resultArray[chunkIndex].push(item);
      return resultArray;
    }, []);

    let lineCounter = 0;
    const spinner = ora(COLOR_HEADER(`Start validate readme.md changelog section for package ${pck.package}`)).start();
    for (const entry of priorEntries) {
      lineCounter++;
      if(Array.isArray(entry) && entry.length !== 4){
        spinner.fail(COLOR_ERROR(`Readme validation failed`));
        throw new SfError(dedent(COLOR_ERROR(`The changelog section in the readme.md has not the expected 4 columns.
        Please fix it manually.`)),COLOR_ERROR('PACKAGE_README_ERROR'));
      }
      if (Array.isArray(entry) && !entry[0].includes('NEXT')){
        spinner.fail(COLOR_ERROR(`Readme validation failed`));
        throw new SfError(dedent(COLOR_ERROR(`Readme validation for package version "NEXT".
        The package version ${entry[0]} in line ${lineCounter} has a wrong format`)),COLOR_ERROR('PACKAGE_README_ERROR'));
      }
      if (Array.isArray(entry) && entry[0] === pck.versionNumber){
        spinner.fail(COLOR_ERROR(`Readme validation failed`));
        throw new SfError(dedent(COLOR_ERROR(`Readme check for identical pck versions.
        Package version ${pck.versionNumber} from project-json is identical with readme!`)),COLOR_ERROR('PACKAGE_README_ERROR'));
      }
    }

    spinner.succeed(COLOR_HEADER(`Readme.md changelog validation for package ${pck.package} is successful`));

    const workItem = settings.workItemUrl ? `[${reference}](${settings.workItemUrl}${reference})` : reference;

    const newTableItems = [
      ['Version', 'Jira Reference', 'Author', 'Description'],
      ...priorEntries,
      [pck.versionNumber, workItem, user, message],
    ];
    const table = markdownTable(newTableItems);

    return `## Changelog

${table}

`;
  }
  /**
   * Creates a markdown section with table containing details of all permission set in a package
   * @param pck Package containing the permission sets
   * @returns Markdown documentation of permission sets
   */
  static async createPermissionsetOverview(pck: PackageDirParsed): Promise<string> {
    const permissionSets: PackagePermissionset[] = await getPermissionsets(pck);

    const permissionSetTableLines: String[][] = permissionSets.map((ps) => {
      return [ps.label, ps.description];
    });
    const newTableItems = [['Label', 'Description'], ...permissionSetTableLines];
    const table = markdownTable(newTableItems);

    return `## Permission Sets

${table}

`;
  }
}
