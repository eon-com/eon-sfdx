/* eslint-disable @typescript-eslint/quotes */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import EONLogger, { COLOR_HEADER, COLOR_TRACE, COLOR_KEY_MESSAGE, COLOR_SUCCESS } from '../../../eon/EONLogger';
import { LOGOBANNER } from '../../../eon/logo';
import puppeteer from 'puppeteer';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'deactivate_bot');

export default class DeactivateBot extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    //Label For Named Credential as Required
    developername: flags.string({
      char: 'd',
      description: messages.getMessage('developerNameFlagDescription'),
      required: true,
    }),
  };

  protected static requiresUsername = true;
  protected static requiresProject = true;

  public async run(): Promise<void> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    EONLogger.log(COLOR_KEY_MESSAGE('Deactivate bot...'));
    
    const conn = this.org.getConnection();

    // The type we are querying for
    interface VersionSettings {
      Id?: string;
      DeveloperName: string;
      VersionNumber: number;
    }

    interface DefinitionSettings {
        Id?: string;
    }
    const definitionResult = await conn.query<DefinitionSettings>(`select Id from BotDefinition where DeveloperName='${this.flags.developername}'`); 
    if (!definitionResult.records || definitionResult.records.length <= 0) {
        throw new SfdxError(`No Query results for DeveloperName: ${this.flags.developername} on Org for BotDefinition. Please check the command flags.`);
    }
    // Query the org
    let versionResult = await conn.query<VersionSettings>(`select Id,DeveloperName,VersionNumber from BotVersion where BotDefinition.DeveloperName = '${this.flags.developername}' and Status = 'Active'`);
    if (!versionResult.records || versionResult.records.length <= 0) {
        versionResult = await conn.query<VersionSettings>(`select Id,DeveloperName,VersionNumber from BotVersion where BotDefinition.DeveloperName = '${this.flags.developername}'`);
        if (!versionResult.records || versionResult.records.length <= 0) {
            throw new SfdxError(`No Query results for DeveloperName: ${this.flags.developername} on Org for Object BotVersion. Please check the developer name.`);
        } else {
            EONLogger.log(COLOR_SUCCESS(`No activation necessary. All Versions inactive.`))  
            return;
        }
    }
    // Check Result From Query
    await this.activateBot(definitionResult.records[0].Id, versionResult.records[0].Id);
  }

  async activateBot(botId: string, versionId: string){
    EONLogger.log(COLOR_TRACE(`Deactivate Bot for BotId: ${botId} and Version: ${versionId}`))
    const conn = this.org.getConnection();
    const browser = await puppeteer.launch({ args: ['–no-sandbox', '–disable-setuid-sandbox'] });
    const page = await browser.newPage();
    //define einstein bot url
    const setupHome = `/chatbots/botBuilder.app#/bot/dialogs/detail?botId=${botId}&versionId=${versionId}`
    let urlToGo = `${conn.instanceUrl}/secur/frontdoor.jsp?sid=${conn.accessToken}&retURL=${encodeURIComponent(setupHome)}`;
    EONLogger.log(COLOR_TRACE(`Go to url: ${conn.instanceUrl}/secur/frontdoor.jsp?retURL=${encodeURIComponent(setupHome)}`))
    await page.goto(urlToGo,{ waitUntil: 'networkidle0' });
    try{
    //find deactivate button and Click    
    await page.waitForSelector('.btnBotDeactivate');
    await page.evaluate(() => {
        if(document.querySelector('.btnBotDeactivate').getElementsByTagName('button')[0] && document.querySelector('.btnBotDeactivate').getElementsByTagName('button')[0].textContent === 'Deactivate'){
            document.querySelector('.btnBotDeactivate').getElementsByTagName('button')[0].click();
        } else {
            throw new SfdxError(`Found no deactivate button`); 
        }
    });
    EONLogger.log(COLOR_TRACE('Found Deactivate Button. Click...'))
    //find modal and confirm
    await page.waitForSelector('builder_service_chatbots-modal-confirm');
    await page.evaluate(() => {
        if(document.querySelector('builder_service_chatbots-modal-confirm').getElementsByTagName('button')[2] && document.querySelector('builder_service_chatbots-modal-confirm').getElementsByTagName('button')[2].textContent === 'Yes'){
            document.querySelector('builder_service_chatbots-modal-confirm').getElementsByTagName('button')[2].click();
        } else {
            throw new SfdxError(`Found no modal confirm button`);
        }
    });
    EONLogger.log(COLOR_TRACE('Found Confirm Button. Click...'))
    //check for activate button
    await page.waitForSelector('.btnBotActivate',{timeout: 1000});
    } catch (e){
        await browser.close();
        throw new SfdxError(`Cannot deactivate bot.See details: ${e}`);
    }
    await browser.close();
    EONLogger.log(COLOR_SUCCESS(`Dectivation was successfully`))
  }
}
