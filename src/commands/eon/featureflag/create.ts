/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxCommand } from '@salesforce/command';
import {
  Messages,
  NamedPackageDir,
  SfdxError,
  SfdxProjectJson
} from '@salesforce/core';
import { AnyJson, toAnyJson } from '@salesforce/ts-types';
import fs from 'fs/promises';
import * as os from 'os';
import { PluginSettings } from '../../../helper/types';
// @ts-ignore
import {
  ComponentSet,
  MetadataApiDeploy
} from '@salesforce/source-deploy-retrieve';
// @ts-ignore
import { AutoComplete, Input, Select, Toggle } from 'enquirer';
import path from 'path';

import chalk from 'chalk';
import EONLogger, { COLOR_HEADER } from '../../../eon/EONLogger';
import { LOGOBANNER } from '../../../eon/logo';
import {
  MetadataFile,
  PathItem,
  fetchCategories,
  getCategoriesItemsSet
} from '../../../helper/featureflag-categories';
import { COLOR_WARNING } from '../../../eon/EONLogger';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'commit');



export default class Create extends SfdxCommand {

  private ANSWER = {
    GO_BACK: chalk.dim(' - (go one level back)'),
    ADD_NEW: chalk.dim(' + (add new entry)'),
    SAVE_NOW: chalk.dim(' * (finish entering category)')
  };

  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{ name: 'file' }];

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  private categoriesItemsSet: string[];
  private categoriesTree: object;

  private getEntries(categoriesTree: object, path: Array<PathItem>) {
    let tempObj = categoriesTree;
    if (path.length) {
      for (const entry of path) {
        if (entry.isCustom === false && tempObj[entry.name]) {
          tempObj = tempObj[entry.name]
        } else {
          return [];
        }
      }
    }
    return Object.keys(tempObj)
  }

  private getDisplayChoices(choices: Array<string>, level: number): string[] {
    return [
      ...(choices.length > 0 ? [...choices] : [this.ANSWER.SAVE_NOW]),
      ...(level > 1 ? [this.ANSWER.GO_BACK] : []),
      ...[this.ANSWER.ADD_NEW]
    ];
  }

  private async getCategoryFromUser(): Promise<string> {
    let isChoiceMade = false;
    let choicePath: Array<PathItem> = [];
    let choices = this.getEntries(this.categoriesTree, choicePath);

    while (!isChoiceMade) {
      const level = choicePath.length + 1;
      const displayChoices = this.getDisplayChoices(choices, level);
      console.clear();

      let message: string;
      if (level === 0) {
        message = 'Add new entry or finish entering category';
      } else if (level === 1) {
        message = 'Select top-level category'
      } else {
        message = `Select subcategory\nYour choices: ${choicePath.map(item => item.name).join(' => ')} => `;
      }

      const prompt = new AutoComplete({
        name: `level${level}`,
        message,
        limit: 15,
        choices: displayChoices
      })

      let answer: string;
      try {
        answer = await prompt.run();
      } catch (error) {
        console.error('🚀', error);
      }

      if (answer === this.ANSWER.GO_BACK) {
        const lastItem = choicePath.pop();
        if (lastItem.isCustom) {
          this.categoriesItemsSet = this.categoriesItemsSet.filter(setItem => setItem !== lastItem.name)
        }
      } else if (answer === this.ANSWER.ADD_NEW) {
        let newItem: string;
        let isItemUnique: boolean;
        do {
          const newItemPrompt = new Input({
            message: 'Enter new category item'
          });

          newItem = await newItemPrompt.run();
          isItemUnique = !(this.categoriesItemsSet.includes(newItem));
          if (!isItemUnique) {
            EONLogger.log(COLOR_WARNING('Category item must be unique!'));
          }
        } while (!isItemUnique)
        choicePath.push({ name: newItem, isCustom: true });
        this.categoriesItemsSet.push(newItem)

      } else if (answer === this.ANSWER.SAVE_NOW) {
        isChoiceMade = true;
      }
      else {
        choicePath.push({ name: answer, isCustom: false });
      }
      choices = this.getEntries(this.categoriesTree, choicePath);
    }

    return choicePath.map(c => c.name).join('.');

  }

  private async getInfoFromUser(packageNames: string[]) {
    const label = await new Input({
      name: 'Label',
      message: 'Enter Feature Flag Label'
    }).run();

    const defaultName = label.replaceAll(/[^a-zA-Z0-9_]/gi, '_')
      .replaceAll(/_{2,}/g, '_')
      .replace(/^(_)(.*)$/, '$2')
      .replace(/(^[^a-z].*$)/i, 'X$1')
      .replace(/^(.*)(_)$/, '$1');

    const name = await new Input({
      name: 'Name',
      message: 'Enter Feature Flag Name (enter to confirm default)',
      initial: defaultName,
      validate(value: string) {
        if (/(^[^a-z].*$|^.*_$|^.*__.*$|[^a-z0-9_])/i.test(value)) {
          return chalk.red(`The custom field name you provided ${value} on object Feature1 can only contain alphanumeric characters, must begin with a letter, cannot end with an underscore or contain two consecutive underscore characters, and must be unique across all Feature1 fields.`)
        }
        return true;
      }
    }).run();

    const category = await this.getCategoryFromUser();

    const packageName = await new AutoComplete({
      name: 'package',
      message: 'Select your package',
      limit: 15,
      initial: 2,
      choices: packageNames,
      footer() {
        return chalk.dim('(Scroll up and down to reveal more choices)');
      }
    }).run()

    const type = await new Select({
      name: 'type',
      message: 'Select Feature Flag type',
      choices: ['Custom Setting', 'Custom Permission']
    }).run();

    const shouldDeploy = await new Toggle({
      name: 'shouldDeploy',
      message: 'Deploy Metadata after creating?',
      enabled: 'Yes',
      disabled: 'No',
      initial: 'Yes'
    }).run()

    return { name, label, packageName, category, type, shouldDeploy }
  }

  private generateCustomSettingField({ object, name, label, packageDir }): MetadataFile {
    let content = '<?xml version="1.0" encoding="UTF-8"?>\n';
    content += '<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    content += `<fullName>${name}__c</fullName>\n`;
    content += '<defaultValue>false</defaultValue>\n';
    content += '<externalId>false</externalId>\n';
    content += `<label>${label}</label>\n`;
    content += '<trackTrending>false</trackTrending>\n';
    content += '<type>Checkbox</type>\n';
    content += '</CustomField>';
    const dirPath = `${packageDir}objects\\${object}__c\\fields\\`
    const filePath = `${dirPath}${name}__c.field-meta.xml`;
    return { content, dirPath, filePath };
  }

  private generateCustomMetadataRecord({ label, object, category, type, name, packageDir }): MetadataFile {
    let content = '<?xml version="1.0" encoding="UTF-8"?>\n';
    content += '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n';
    content += `<label>${label}</label>\n`;
    content += '<protected>false</protected>\n';
    content += '<values>\n';
    content += '<field>Category__c</field>\n';
    content += `<value xsi:type="xsd:string">${category}</value>\n`;
    content += '</values>\n';
    content += '<values>\n';
    content += '<field>Setting__c</field>\n';
    content += `<value xsi:type="xsd:string">${object}__c.${name}__c</value>\n`;
    content += '</values>\n';
    content += '<values>\n';
    content += '<field>Type__c</field>\n';
    content += `<value xsi:type="xsd:string">${type}</value>\n`;
    content += '</values>\n';
    content += '</CustomMetadata>';
    const dirPath = `${packageDir}customMetadata\\`;
    const filePath = `${dirPath}Feature_Flag.${name}.md-meta.xml`;
    return { content, filePath, dirPath };
  }

  private generateCustomSettingsObject({ object, defaultDir }): MetadataFile {
    let content = '<?xml version="1.0" encoding="UTF-8"?>';
    content += '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">';
    content += '    <customSettingsType>Hierarchy</customSettingsType>';
    content += '    <enableFeeds>false</enableFeeds>';
    content += `    <label>${object}</label>`;
    content += '    <visibility>Public</visibility>';
    content += '</CustomObject>';
    const dirPath = `${defaultDir}objects\\${object}__c\\`;
    const filePath = `${dirPath}${object}__c.object-meta.xml`;
    return { content, filePath, dirPath };
  }

  private async deployFeatureFlag({ object, name, sourcesToDeploy }) {
    interface Settings {
      Id?: string;
      [key: string]: any;
    }
    const deploy: MetadataApiDeploy = await ComponentSet.fromSource(sourcesToDeploy).deploy({
      usernameOrConnection: this.org.getConnection().getUsername(),
    });
    this.ux.startSpinner('Deploying...');
    deploy.onUpdate((response) => {
      const { status } = response;
      this.ux.setSpinnerStatus(status);
    });

    const deployRes = await deploy.pollStatus();
    if (!deployRes.response.success) {
      this.ux.stopSpinner('Deployment failed.');

      throw new SfdxError(messages.getMessage('errorDeployFailed', ['Deployment failed. Check errors.']));
    } else {
      this.ux.stopSpinner('Deployment done.');
    }

    const conn = this.org.getConnection();
    const query = `select id, ${name}__c, SetupOwnerId from ${object}__c`;
    const result = await conn.query<Settings>(query);
    const queryRes = result.records.find((record) => record.SetupOwnerId.substring(0, 3) == '00D');

    if (!queryRes) {
      this.ux.startSpinner('Setting does not exist yet. Initializing new...');
      const newRecord = { [`${name}__c`]: false };
      const newSetting = await conn.sobject(`${object}__c`).create(newRecord);
      if (!newSetting.success) {
        this.ux.stopSpinner(`Update not successfully. Please try again`);
      } else {
        this.ux.stopSpinner(`update custom settings successfully`);
      }
    }
  }

  private async saveFile({directory, fileName, fileContent}): Promise<void> {
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(fileName, fileContent);
  }
  public async run(): Promise<AnyJson> {
    console.clear();
    EONLogger.log(COLOR_HEADER(LOGOBANNER));

    const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();
    const packageDirs: NamedPackageDir[] = projectJson.getUniquePackageDirectories();
    const packageNames = packageDirs.map(dir => dir.package).sort();
    const settings: PluginSettings = projectJson.getContents()?.plugins['eon-sfdx'] as PluginSettings;
    const defaultPackage = settings.featureFlagDefaultPackage;
    const sourceSubdir = settings.sourceSubdir;
    const rootDir: string = `${path.dirname(projectJson.getPath())}`;

    this.ux.startSpinner('Fetching Feature Flag Categories');
    this.categoriesTree = await fetchCategories(rootDir);
    this.ux.stopSpinner('Success!');
    this.categoriesItemsSet = getCategoriesItemsSet(this.categoriesTree);

    const { name, label, packageName, category, type, shouldDeploy } = await this.getInfoFromUser(packageNames);

    const packageDir = `${packageDirs.find(dir => dir.package === packageName).fullPath}${sourceSubdir}\\`;
    const defaultDir = `${packageDirs.find(dir => dir.package === defaultPackage).fullPath}${sourceSubdir}\\`;
    const object = 'Feature1';

    const {
      content: csContent,
      filePath: csFilePath,
      dirPath: csDirPath
    } = this.generateCustomSettingField({ object, name, label, packageDir })
    await this.saveFile({directory: csDirPath, fileName: csFilePath, fileContent: csContent})

    const {
      content: mdContent,
      filePath: mdFilePath,
      dirPath: mdDirPath
    } = this.generateCustomMetadataRecord({ label, object, category, type, name, packageDir });
    await this.saveFile({directory: mdDirPath, fileName: mdFilePath, fileContent: mdContent})

    const sourcesToDeploy = [mdFilePath, csFilePath];

    const {
      content: objContent,
      filePath: objFilePath,
      dirPath: objDirPath
    } = this.generateCustomSettingsObject({ object, defaultDir });
    try {
      await fs.access(objFilePath);
    } catch (_) {
      await this.saveFile({directory: objDirPath, fileName: objFilePath, fileContent: objContent})
      sourcesToDeploy.push(objFilePath);
    };

    if (shouldDeploy) {
      this.deployFeatureFlag({ name, object, sourcesToDeploy });
    } else {
      EONLogger.log('To deploy freshly created Feature Flag use following command:');
      EONLogger.log(chalk.inverse(`sfdx force:source:deploy -p "${sourcesToDeploy.join(',')}"`))
    }

    return toAnyJson({});
  }
}
