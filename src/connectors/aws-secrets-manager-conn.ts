// function to establish connection to aws vault and retrieve a credential by key + tag

import { SfProject, SfProjectJson } from '@salesforce/core';
import { PluginSettings, stringProperties } from '../helper/types';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandInput,
  GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';
import EONLogger, { COLOR_ERROR, COLOR_INFO, COLOR_KEY_MESSAGE } from '../eon/EONLogger';
export default async function getSecretAWS(secretname: string, tag: string, project: SfProject): Promise<string> {
  let settingKey: string = '';
  if (!secretname.includes('secret:')) {
    return secretname;
  } else {
    settingKey = secretname.replace('secret:', '');
  }

  // get sfdx project.json
  const projectJson: SfProjectJson = await project.retrieveSfProjectJson();
  const settings: PluginSettings = projectJson.getContents()?.plugins['eon-sfdx'] as PluginSettings;
  let secretNameAliasified = '';
  if (settings.awsSecretFormat) {
    secretNameAliasified = settings.awsSecretFormat.replace('{tag}', tag);
  }
  const client: SecretsManagerClient = new SecretsManagerClient({ region: settings.awsRegion });

  const param: GetSecretValueCommandInput = { SecretId: secretNameAliasified };
  const command = new GetSecretValueCommand(param);
  const response: GetSecretValueCommandOutput = await client.send(command);
  const parsedSecrets: stringProperties = JSON.parse(response.SecretString);

  if (parsedSecrets[settingKey]) {
    EONLogger.log(
      COLOR_KEY_MESSAGE('Secret found in property:') +
        COLOR_INFO(` Using key ${settingKey} from AWS using secret ${secretNameAliasified}...`)
    );
    return parsedSecrets[settingKey];
  } else {
    EONLogger.log(
      COLOR_ERROR(`Key with name "${settingKey}" does not exist in AWS secret with name ${secretNameAliasified}.`)
    );
    return null;
  }
}
