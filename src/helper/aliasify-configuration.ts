import { SfError, SfProject, SfProjectJson } from '@salesforce/core';
import { environmentConfigFile, PluginSettings, stringProperties } from './types';
import * as fspromise from 'fs/promises';
import path from 'path';
import * as YAML from 'yaml';
import EONLogger, { COLOR_ERROR, COLOR_INFO, COLOR_KEY_MESSAGE, COLOR_TRACE } from '../eon/EONLogger';
import getSecretAWS from '../connectors/aws-secrets-manager-conn';

/**
 * Retrieve configuration file and returns dynamic value if setting: or secret: is used as an indicator inside a command flag
 * @param settingname The raw value passed in e.g. as a flag to a command
 * @param alias The tag used to differentiate between versions of configuration
 * @param project the sfdxProject from salesforce/core
 * @returns Dynamic value from configuration file or secret manager
 */
export default async function getSettingValue(
  settingname: string,
  alias: string,
  project: SfProject
): Promise<string> {
  let settingKey: string = '';
  if (!settingname.includes('settings:')) {
    return settingname;
  } else {
    settingKey = settingname.replace('settings:', '');
  }

  // get sfdx project.json
  const projectJson: SfProjectJson = await project.retrieveSfProjectJson();
  const settings: PluginSettings = projectJson.getContents()?.plugins['eon-sfdx'] as PluginSettings;
  const configFilePath: string = path.join(
    path.dirname(projectJson.getPath()),
    settings.environmentConfigurationFilePath
  );
  let parsedFile: environmentConfigFile;
  if (settings?.environmentConfigurationFilePath) {
    await fspromise
      .stat(configFilePath)
      .catch((error) =>
        EONLogger.log(COLOR_ERROR('The configuration file defined in sfdx-project.json does not exist.'))
      );
    const raw = await fspromise.readFile(configFilePath, 'utf8');
    try {
      parsedFile = YAML.parse(raw) as environmentConfigFile;
    } catch (e) {
      EONLogger.log(COLOR_ERROR('The configuration file is not valid. Please check the syntax in the file.'));
    }
  } else {
    EONLogger.log(COLOR_ERROR('no configuration file was defined in sfdx-project.json.'));
  }
  let targetOrgSettings: stringProperties;

  let aliasChecked = 'default';
  if (alias in parsedFile.settings) {
    aliasChecked = alias;
  } else {
    EONLogger.log(COLOR_TRACE(`Alias ${alias} not found. Using default value instead.`));
  }
  targetOrgSettings = parsedFile.settings[aliasChecked];
  const targetOrgSettingsDefault = parsedFile.settings['default'];

  let result: string;
  if (settingKey in targetOrgSettings) {
    EONLogger.log(
      COLOR_KEY_MESSAGE('Property found:') +
        COLOR_INFO(
          ` Using property ${settingKey} for alias ${aliasChecked} from configuration file ${settings.environmentConfigurationFilePath} ...`
        )
    );
    result = targetOrgSettings[settingKey];
    if (targetOrgSettings[settingKey].includes('secret:')) {
      result = await getSecretAWS(targetOrgSettings[settingKey], aliasChecked, project);
    }
  } else if (settingKey in targetOrgSettingsDefault) {
    EONLogger.log(
      COLOR_KEY_MESSAGE('Default property found:') +
        COLOR_INFO(
          ` Using property ${settingKey} for alias default from configuration file ${settings.environmentConfigurationFilePath} ...`
        )
    );
    result = targetOrgSettingsDefault[settingKey];
    if (targetOrgSettingsDefault[settingKey].includes('secret:')) {
      result = await getSecretAWS(targetOrgSettings[settingKey], aliasChecked, project);
    }
  } else {
    EONLogger.log(
      COLOR_ERROR(
        `Property ${settingKey} does not exist neither for alias ${aliasChecked} nor in default in configuration file`
      )
    );
    result = null;
  }
  if (result === null) {
    throw new SfError(`${settingname} could not be resolved into a value.`);
  } else {
    return result;
  }
}
