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
import * as os from 'os';
import fs from 'fs/promises';
import { DeployError, PluginSettings } from '../../../helper/types';
// @ts-ignore
import { prompt, AutoComplete, Input, Select, Toggle } from 'enquirer';
import { FLOW_END } from 'yaml/dist/parse/cst';
import {
  ComponentSet,
  MetadataResolver,
  MetadataApiDeploy,
  DeployMessage
} from '@salesforce/source-deploy-retrieve'
import Table from 'cli-table3';
import EONLogger, { COLOR_HEADER } from '../../../eon/EONLogger';
import { LOGOBANNER } from '../../../eon/logo';
import chalk from 'chalk';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'commit');

export default class Create extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{ name: 'file' }];

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  protected static requiresUsername = true;
  private print(input: DeployMessage | DeployMessage[]): string {
    var table = new Table({
      head: ['Component Name', 'Error Message'],
    });
    let result: DeployError[] = [];
    if (Array.isArray(input)) {
      result = input.map((a) => {
        const res: DeployError = {
          Name: a.fullName + ': Line ' + a.lineNumber,
          Type: a.componentType,
          Status: a.problemType,
          Message: a.problem,
        };
        return res;
      });
    } else {
      const res: DeployError = {
        Name: input.fullName + ': ' + input.lineNumber,
        Type: input.componentType,
        Status: input.problemType,
        Message: input.problem,
      };
      result = [...result, res];
    }
    result.forEach((r) => {
      let obj = {};
      obj[r.Name] = r.Message;
      table.push(obj);
    });
    return table.toString();
  }

  getInfoFromUser = async (packageNames) => {
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
      validate(value) {
        if (/(^[^a-z].*$|^.*_$|^.*__.*$|[^a-z0-9_])/i.test(value)) {
          return chalk.red(`The custom field name you provided ${value} on object Feature1 can only contain alphanumeric characters, must begin with a letter, cannot end with an underscore or contain two consecutive underscore characters, and must be unique across all Feature1 fields.`)
        }
        return true;
      }
    }).run();

    const category = await new Input({
      name: 'Category',
      message: 'Enter Feature Flag Category'
    }).run();

    const packageName = 'deprecated-components'  // hardcoded for dev purposes

    // const packageName = await new AutoComplete({
    //   name: 'package',
    //   message: 'Select your package',
    //   limit: 15,
    //   initial: 2,
    //   choices: packageNames,
    //   footer() {
    //     return chalk.dim('(Scroll up and down to reveal more choices)');
    //   }
    // }).run()

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

  generateCustomSettingField = ({ object, name, label, packageDir }) => {
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

  generateCustomMetadataRecord = ({ label, object, category, type, name, packageDir }) => {
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

  generateCustomSettingsObject = ({ object, packageDir }) => {
    let content = '<?xml version="1.0" encoding="UTF-8"?>';
    content += '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">';
    content += '    <customSettingsType>Hierarchy</customSettingsType>';
    content += '    <enableFeeds>false</enableFeeds>';
    content += `    <label>${object}</label>`;
    content += '    <visibility>Public</visibility>';
    content += '</CustomObject>';
    const dirPath = `${packageDir}objects\\${object}__c\\`;
    const filePath = `${dirPath}${object}__c.object-meta.xml`;
    return { content, filePath };
  }

  deployFeatureFlag = async ({ object, name, sourcesToDeploy }) => {
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

  public async run(): Promise<AnyJson> {
    console.clear();
    EONLogger.log(COLOR_HEADER(LOGOBANNER));



    const projectJson: SfdxProjectJson = await this.project.retrieveSfdxProjectJson();
    const packageDirs: NamedPackageDir[] = projectJson.getUniquePackageDirectories();
    const packageNames = packageDirs.map(dir => dir.package).sort();

    const { name, label, packageName, category, type, shouldDeploy } = await this.getInfoFromUser(packageNames);

    const packageDir = packageDirs.find(dir => dir.package === packageName).fullPath;
    const object = 'Feature1';

    const {
      content: csContent,
      filePath: csFilePath,
      dirPath: csDirPath
    } = this.generateCustomSettingField({ object, name, label, packageDir })
    await fs.mkdir(csDirPath, { recursive: true })
    await fs.writeFile(csFilePath, csContent);

    const {
      content: mdContent,
      filePath: mdFilePath,
      dirPath: mdDirPath
    } = this.generateCustomMetadataRecord({ label, object, category, type, name, packageDir });
    await fs.mkdir(mdDirPath, { recursive: true })
    await fs.writeFile(mdFilePath, mdContent);

    const sourcesToDeploy = [mdFilePath, csFilePath];

    const {
      content: objContent,
      filePath: objFilePath
    } = this.generateCustomSettingsObject({ object, packageDir });
    try {
      await fs.access(objFilePath);
    } catch (_) {
      await fs.writeFile(objFilePath, objContent);
      sourcesToDeploy.push(objFilePath);
    };

    if (shouldDeploy) {
      this.deployFeatureFlag({name, object, sourcesToDeploy});
    } else {
      EONLogger.log('To deploy freshly created Feature Flag use following command:');
      EONLogger.log(chalk.inverse(`sfdx force:source:deploy -p "${sourcesToDeploy.join(',')}"`))
    }




      return toAnyJson({});
    }
  }
