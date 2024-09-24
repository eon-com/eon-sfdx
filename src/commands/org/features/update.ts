/* eslint-disable @typescript-eslint/quotes */

import * as os from 'os';
import { Messages, SfProjectJson, Org, ConfigAggregator, SfError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import path from 'path';
import * as fspromise from 'fs/promises';
import * as YAML from 'yaml';
import EONLogger, { COLOR_HEADER, COLOR_ERROR, COLOR_TRACE, COLOR_NOTIFY, COLOR_INFO } from '../../../eon/EONLogger';
import { LOGOBANNER } from '../../../eon/logo';
import { featureSettingsConfigFile } from '../../../helper/types';
import Table from 'cli-table3';
import { Flags } from '@oclif/core';
import EonCommand from '../../../EonCommand';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'org');

export default class FeatureUpdate extends EonCommand {
    public static description = messages.getMessage('commandDescription_features_update');

    public static examples = messages.getMessage('examples_features_update').split(os.EOL);

    static flags = {
        alias: Flags.string({
            char: 'a',
            description: messages.getMessage('aliasDescription'),
        }),
        settingsfile: Flags.string({
            char: 'f',
            description: messages.getMessage('settingsDescription'),
            required: true,
        }),
        'target-org': Flags.string({
            char: 'o',
            aliases: ['targetusername', 'u'],
            description: 'Login username or alias for the target org.',
        }),
    };

    protected static requiresUsername = false;
    protected static requiresProject = true;

    public async execute(): Promise<AnyJson> {
        EONLogger.log(COLOR_HEADER(LOGOBANNER));

        let defaultUsername = '';

        if (!this.flags['target-org']) {
            defaultUsername = (await ConfigAggregator.create()).getPropertyValue('target-org');
            if (!defaultUsername) {
                throw new SfError(
                    `Found no default target-org in your salesforce config file. Please provide a target-org with flag --target-org or set a default target-org on your local machine`
                );
            }
            EONLogger.log(COLOR_NOTIFY(`Using default target-org 👉 ${COLOR_INFO(defaultUsername)}`));
            this.org = await Org.create({ aliasOrUsername: defaultUsername });
        } else {
          EONLogger.log(COLOR_NOTIFY(`Using target-org 👉 ${COLOR_INFO(this.flags['target-org'])}`));
          this.org = await Org.create({ aliasOrUsername: this.flags['target-org'] });
        }

        // parse settings file

        const projectJson: SfProjectJson = await this.project.retrieveSfProjectJson();
        const configFilePath: string = path.join(path.dirname(projectJson.getPath()), this.flags.settingsfile);
        let parsedFile: featureSettingsConfigFile;
        await fspromise
            .stat(configFilePath)
            .catch(() =>
                EONLogger.log(COLOR_ERROR('The feature settings file defined does not exist under the given path.'))
            );
        const raw = await fspromise.readFile(configFilePath, 'utf8');
        try {
            parsedFile = YAML.parse(raw) as featureSettingsConfigFile;
        } catch (e) {
            EONLogger.log(COLOR_ERROR('The feature settings file is not valid. Please check the syntax in the file.'));
        }

        // aliasify setting
        let tag = 'default';
        if (this.flags.alias && parsedFile.settings[this.flags.alias]) {
            tag = this.flags.alias;
        }
        const aliasSettings = parsedFile.settings[tag];
        const defaultSettings = parsedFile.settings['default'];
        let mergedSettings = { ...aliasSettings };

        // Settings updated with aliasified value:
        let settingsUpdatedAliasified: string[] = [];
        // Setting update with default value:
        let settingsUpdatedDefault: string[] = [];

        if (defaultSettings) {
            for (const featuresetting in defaultSettings) {
                if (!aliasSettings[featuresetting]) {
                    mergedSettings[featuresetting] = defaultSettings[featuresetting];
                    settingsUpdatedDefault = [...settingsUpdatedDefault, featuresetting];
                } else {
                    settingsUpdatedAliasified = [...settingsUpdatedAliasified, featuresetting];
                }
            }
        }
        let tableWithFoundSettings = new Table({
            head: [
                COLOR_NOTIFY('Feature Name'),
                COLOR_NOTIFY('Setting Name'),
                COLOR_NOTIFY('Alias'),
                COLOR_NOTIFY('Value'),
            ],
        });

        settingsUpdatedDefault.forEach((settingUpdated) => {
            Object.keys(mergedSettings[settingUpdated]).forEach((key) => {
                tableWithFoundSettings.push([settingUpdated, key, 'default', mergedSettings[settingUpdated][key]]);
            });
        });
        settingsUpdatedAliasified.forEach((settingUpdated) => {
            Object.keys(mergedSettings[settingUpdated]).forEach((key) => {
                tableWithFoundSettings.push([settingUpdated, key, tag, mergedSettings[settingUpdated][key]]);
            });
        });

        EONLogger.log(COLOR_NOTIFY('👉  Values used for given alias: ' + tag));
        EONLogger.log(tableWithFoundSettings.toString());
        // check org if settings exist
        let objects: string[] = [];
        for (let featureSetting in mergedSettings) {
            objects = [...objects, `'${featureSetting}'`];
        }
        if (objects.length === 0) {
            EONLogger.log(COLOR_INFO(`☝ No settings defined for the given tag or default`));
            return {};
        }
        const describeObjectQuery =
            'select id,DeveloperName from CustomObject where DeveloperName in (' + objects.join(',') + ')';

        const conn = this.org.getConnection();
        interface Settings {
            Id: string;
            [key: string]: any;
        }
        const describeObjects = await conn.tooling.query<Settings>(describeObjectQuery);

        /// TODO  IF OBJECTS FOUND, continue
        const availableObjects = describeObjects.records.map((object) => {
            return "'" + object.DeveloperName + "'";
        });
        if (availableObjects.length === 0) {
            EONLogger.log(
                COLOR_INFO(
                    `☝ None of the defined feature settings are available in the target org.
Deploy the custom settings to the org before running this command.`
                )
            );
            return {};
        }
        const describeFieldsQuery =
            'select id,DeveloperName, EntityDefinition.DeveloperName from CustomField  where EntityDefinition.DeveloperName  in (' +
            availableObjects.join(',') +
            ')';

        const describeFields = await conn.tooling.query<Settings>(describeFieldsQuery);

        interface AvailableSetting {
            settingName: string;
            fieldNames: string[];
        }
        let availableSettings: AvailableSetting[] = [];

        describeFields.records.forEach((record) => {
            if (
                availableSettings.filter((element) => element.settingName == record.EntityDefinition.DeveloperName)
                    .length > 0
            ) {
                availableSettings
                    .find((element) => element.settingName == record.EntityDefinition.DeveloperName)
                    .fieldNames.push(record.DeveloperName);
            } else {
                availableSettings = [
                    ...availableSettings,
                    {
                        settingName: record.EntityDefinition.DeveloperName,
                        fieldNames: [record.DeveloperName],
                    } as AvailableSetting,
                ];
            }
        });

        // make request to update existing settings

        // Settings not found in org:
        let featuresNotInOrg: string[] = [];
        let settingsNotInOrg: string[] = [];

        interface SettingForUpdate {
            developerName: string;
            requestbody: SettingForUpdateBody;
        }
        interface SettingForUpdateBody {
            [key: string]: any;
        }

        let settingForUpsertList: SettingForUpdate[] = [];

        for (const setting in mergedSettings) {
            if (availableSettings.find((avail) => avail.settingName === setting)) {
                let settingForUpsert: SettingForUpdate = { developerName: setting, requestbody: {} };
                // object is available
                for (const settingfield in mergedSettings[setting]) {
                    if (
                        availableSettings
                            .find((avail) => avail.settingName === setting)
                            .fieldNames.find((fieldname) => fieldname == settingfield)
                    ) {
                        settingForUpsert.requestbody[settingfield] = mergedSettings[setting][settingfield];
                    } else {
                        settingsNotInOrg = [...settingsNotInOrg, setting + '.' + settingfield];
                    }
                }
                settingForUpsertList = [...settingForUpsertList, settingForUpsert];
            } else {
                featuresNotInOrg = [...featuresNotInOrg, setting];
            }
        }

        if (featuresNotInOrg.length > 0 || settingsNotInOrg.length > 0) {
            EONLogger.log('☝' + COLOR_INFO(` Some Features or Settings are not available in the target org:`));
            let tableWithInvalidTargets = new Table({
                head: [COLOR_NOTIFY('Name'), COLOR_NOTIFY('Reason')],
            });

            featuresNotInOrg.forEach((item) => {
                tableWithInvalidTargets.push([item, 'Custom setting not in target org']);
            });
            settingsNotInOrg.forEach((item) => {
                tableWithInvalidTargets.push([item, 'Field in custom setting not in target org']);
            });
            console.log(tableWithInvalidTargets.toString());
        }

        for (const update of settingForUpsertList) {
            let fieldsToUpdate: String[] = Object.keys(update.requestbody).map((val) => {
                return val + '__c';
            });

            const query = `select id, ${fieldsToUpdate.join(',')}, SetupOwnerId from ${update.developerName + '__c'}`;

            // Query the org
            const result = await conn.query<Settings>(query);
            let res = result.records.find((record) => record.SetupOwnerId.substring(0, 3) == '00D');
            // Check Result From Query
            if (!res) {
                EONLogger.log(
                    COLOR_TRACE(
                        'Feature Setting does not exist yet in target org: ' +
                            update.developerName +
                            '. Initializing new...'
                    )
                );
                const newRecord = {};
                for (const prop in update.requestbody) {
                    newRecord[prop + '__c'] = update.requestbody[prop];
                }

                const newSetting = await conn.sobject(update.developerName + '__c').create(newRecord);

                if (!newSetting.success) {
                    EONLogger.log(COLOR_ERROR(`Update not successfully. Please try again`));
                }
            } else {
                for (const prop in update.requestbody) {
                    res[prop + '__c'] = update.requestbody[prop];
                }
                const opResult = await conn.sobject(update.developerName + '__c').update(res);
                if (!opResult.success) {
                    EONLogger.log(COLOR_ERROR(`Update not successfully. Please try again`));
                }
            }
        }

        EONLogger.log(COLOR_HEADER(`💪 All done. All available feauture settings were updated.`));
        return {};
    }
}
