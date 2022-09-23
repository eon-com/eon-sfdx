/* eslint-disable @typescript-eslint/quotes */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { readFile } from 'fs/promises';
import { Messages, SfdxError } from '@salesforce/core';
import EONLogger, {
  COLOR_HEADER,
  COLOR_TRACE,
  COLOR_KEY_MESSAGE,
  COLOR_SUCCESS,
  COLOR_INFO,
  COLOR_ERROR,
} from '../../../eon/EONLogger';
import { LOGOBANNER } from '../../../eon/logo';
import { UnassignPackage } from '../../../helper/types';
import puppeteer from 'puppeteer';
import YAML from 'yaml';
import path from 'path';
import Table from 'cli-table3';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'unassign');

export default class PackageMemberUnassign extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    //Label For Named Credential as Required
    packagename: flags.string({
      char: 'p',
      description: messages.getMessage('packageNameFlagDescription'),
      required: false,
      dependsOn: ['type', 'component'],
    }),
    type: flags.string({
      char: 't',
      description: messages.getMessage('typeFlagDescription'),
      required: false,
      dependsOn: ['packagename', 'component'],
    }),
    component: flags.string({
      char: 'c',
      description: messages.getMessage('componentFlagDescription'),
      required: false,
      dependsOn: ['packagename', 'type'],
    }),
    configfile: flags.string({
      char: 'f',
      description: messages.getMessage('configFlagDescription'),
      required: false,
    }),
    parentobject: flags.string({
      char: 'o',
      description: messages.getMessage('parentobjectFlagDescription'),
      required: false,
    }),
  };

  protected static requiresUsername = true;
  protected static requiresProject = true;

  private static infoTable = new Table({
    head: [
      COLOR_INFO('Package'),
      COLOR_INFO('Type'),
      COLOR_INFO('Component'),
      COLOR_INFO('Parent Object'),
      COLOR_INFO('CompRemoved'),
      COLOR_INFO('Message'),
    ],
    colWidths: [25, 20, 35, 25, 15, 30], // Requires fixed column widths
    wordWrap: true,
  });

  public async run(): Promise<void> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    EONLogger.log(COLOR_KEY_MESSAGE('Unassign package member...📦🚮'));

    const conn = this.org.getConnection();

    // The type we are querying for
    interface InstalledSubscriberPackage {
      Id?: string;
      SubscriberPackage: SubscriberPackage;
    }

    interface SubscriberPackage {
      Name: string;
    }

    let packageList: UnassignPackage[] = [];

    /**
     run this part only for the config flag
    */

    if (this.flags.configfile) {
      EONLogger.log(COLOR_TRACE(`Use config file ${this.flags.configfile} to remove components`));
      if (path.extname(this.flags.configfile) !== '.yml') {
        throw new SfdxError(`This config file has no yaml format. Please check your input`);
      }
      let ymlFile: string = '';
      try {
        ymlFile = await readFile(this.flags.configfile, 'utf8');
      } catch (e) {
        throw new SfdxError(
          `Find no config file in project for flag ${this.flags.configfile}. Please check your input`
        );
      }
      const parsedConfig = YAML.parse(ymlFile);
      if (typeof parsedConfig === 'object' && parsedConfig !== null) {
        for (const [pckKey, pckValue] of Object.entries(parsedConfig)) {
          let packageData: UnassignPackage = { Package: pckKey, UnassignKeys: [] };
          if (typeof pckValue === 'object' && pckValue !== null) {
            for (const [compKey, compValue] of Object.entries(pckValue)) {
              if (Array.isArray(compValue)) {
                compValue.forEach((elem) => {
                  if (typeof elem === 'object') {
                    packageData.UnassignKeys.push({
                      Type: compKey,
                      Component: elem?.ComponentName,
                      ParentObject: elem?.ParentObject,
                    });
                  } else if (typeof elem === 'string') {
                    packageData.UnassignKeys.push({ Type: compKey, Component: elem, ParentObject: '' });
                  } else {
                    throw new SfdxError(
                      `The config file for the part of package ${pckKey} has a wrong yaml format. Please check the file.`
                    );
                  }
                });
              } else {
                throw new SfdxError(
                  `The config file for the part of package ${pckKey} has a wrong yaml format (no Array). Please check the file.`
                );
              }
            }
            packageList.push(packageData);
          } else {
            throw new SfdxError(
              `The config file for the part of package ${pckKey} has a wrong yaml format (no Object). Please check the file.`
            );
          }
        }
      } else {
        throw new SfdxError(`The config file has a wrong yaml format or is empty. Please check the file.`);
      }
    } else {
      /**
     run this part only for single changes
    */
      EONLogger.log(COLOR_TRACE(`Start processing remove from a single component`));
      let packageData: UnassignPackage = {
        Package: this.flags.packagename,
        UnassignKeys: [
          { Type: this.flags.type, Component: this.flags.component, ParentObject: this.flags.parentobject ?? '' },
        ],
      };
      packageList.push(packageData);
    }
    EONLogger.log(COLOR_TRACE(`Fetch packages from Org`));
    const packageResult = await conn.tooling.query<InstalledSubscriberPackage>(
      `select Id,SubscriberPackage.Name from InstalledSubscriberPackage`
    );
    if (!packageResult.records || packageResult.records.length <= 0) {
      throw new SfdxError(
        `No Query results on Org for package name: ${this.flags.packagename} in Tooling Object InstalledSubscriberPackage. Please check the input.`
      );
    }
    for (const pck of packageList) {
      for (const id of packageResult.records) {
        if (pck.Package === id.SubscriberPackage.Name) {
          pck.Id = id.Id;
        }
      }

      if (!pck.Id) {
        throw new SfdxError(
          `Rollback because no query results on org for package name: ${pck.Package} in tooling object InstalledSubscriberPackage. Please check the input and fix the name.`
        );
      }
      //And now start loop to remove comps from Org
      await this.removeComp(pck);
    }
    console.log(PackageMemberUnassign.infoTable.toString());
    EONLogger.log(COLOR_KEY_MESSAGE('The process has ended. Please refer to the table for process information. 👆'));
  }

  async removeComp(pck: UnassignPackage) {
    const conn = this.org.getConnection();
    const browser = await puppeteer.launch({ headless: true, args: ['--start-maximized', '--disable-web-security'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    //const setupHome = `/lightning/setup/ImportedPackage/${pck.Id}/Components/view`
    const setupHome = `${pck.Id}?pkgComp=show`;
    let urlToGo = `${conn.instanceUrl}/secur/frontdoor.jsp?sid=${conn.accessToken}&retURL=${encodeURIComponent(
      setupHome
    )}`;
    EONLogger.log(
      COLOR_TRACE(`Go to url: ${conn.instanceUrl}/secur/frontdoor.jsp?retURL=${encodeURIComponent(setupHome)}`)
    );

    await page.goto(urlToGo, { waitUntil: 'networkidle2' });
    await page.waitForNavigation();
    await page.waitForSelector('h2.pageDescription');
    await new Promise((r) => setTimeout(r, 3000));
    for await (const keys of pck.UnassignKeys) {
      try {
        EONLogger.log(COLOR_TRACE(`Remove Comp for Package: ${pck.Package} and Component: ${keys.Component}`));
        //check to find the component and type in 1 row
        const compsBeforeChange = (await page.$$('tr')).length;
        let rowCounter = 0;
        const defaultHits = keys.ParentObject ? 4 : 3;
        const rows = await page.$$('tr');
        for (const row of rows) {
          if (rowCounter === defaultHits) {
            break;
          }
          rowCounter = 0;

          const tableHeader = await row.$eval('th', (th) => th?.textContent).catch((e) => '');
          if (tableHeader === keys.Component) {
            //found the component name
            rowCounter++;
          }

          const columns = await row.$$eval('td', (elements: HTMLTableCellElement[]) => {
            return elements.map((e) => e?.textContent);
          });
          for (const column of columns) {
            if (column === keys.Type) {
              //found the type
              rowCounter++;
            }
            if (keys.ParentObject) {
              if (column === keys.ParentObject) {
                //found the type
                rowCounter++;
              }
            }
          }

          const removeLink = await row.$eval('a', (a) => a?.title).catch((e) => '');
          if (removeLink.search(keys.Component) > -1) {
            //found the button to remove
            rowCounter++;
          }

          if (rowCounter === defaultHits) {
            //found all keys in 1 row, so we can remove the component
            //first deactivate the confirmation window
            await page.evaluate(`window.confirm = () => true`);
            //now click the remove button
            await (await row.$('a')).click();
            await page.waitForNavigation();
            await new Promise((r) => setTimeout(r, 1000));
          }
        }

        if (rowCounter === defaultHits) {
          // wait 1 second to check the results from window
          await new Promise((r) => setTimeout(r, 1000));
          //check if the comp is removed by counter
          const compsAfterChange = (await page.$$('tr')).length;
          if (compsAfterChange < compsBeforeChange) {
            EONLogger.log(COLOR_TRACE(`Removing was successfully`));
            keys.IsRemoved = true;
            keys.Message = COLOR_SUCCESS(`Removing was successfully`);
          } else {
            keys.IsRemoved = false;
            keys.Message = COLOR_ERROR(`Components before and after change are still the same number`);
          }
        } else {
          keys.IsRemoved = false;
          keys.Message = COLOR_ERROR(`The component does not exist for the package`);
        }
        PackageMemberUnassign.infoTable.push([
          pck.Package,
          keys.Type,
          keys.Component,
          keys.ParentObject,
          keys.IsRemoved ? '✔️' : '❌',
          keys.Message,
        ]);
      } catch (e) {
        console.log(e);
      }
    }
    await browser.close();
  }
}
