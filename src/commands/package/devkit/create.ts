import * as os from 'os';
import fs from 'fs';
import path from 'path';
import { Messages, SfProjectJson, SfError, ConfigAggregator, Org } from '@salesforce/core';
import { NamedPackageDirLarge } from '../../../helper/types';

import { AnyJson } from '@salesforce/ts-types';
import EONLogger, { COLOR_ERROR, COLOR_HEADER, COLOR_INFO, COLOR_NOTIFY } from '../../../eon/EONLogger';
import { LOGOBANNER } from '../../../eon/logo';
import {
    DEVKITFOLDER,
    EONDEVKITYML,
    EXAMPLEAPEX,
    EXPORTJSON,
    SCRIPTSFOLDER,
    SETUPFILE,
    TESTDATAFOLDER,
} from '../../../helper/devkit-constants';
import { Flags } from '@oclif/core';
import EonCommand from '../../../EonCommand';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'devkit');

export default class Create extends EonCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = messages.getMessage('examples').split(os.EOL);

    static flags = {
        package: Flags.string({
            char: 'p',
            description: messages.getMessage('packageFlag'),
            required: true,
        }),
        'target-org': Flags.string({
            char: 'o',
            aliases: ['targetusername', 'u'],
            description: 'Login username or alias for the target org.',
        }),
    };

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;
    public async execute(): Promise<AnyJson> {
        EONLogger.log(COLOR_HEADER(LOGOBANNER));
        const packagename = this.flags.package;

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

        const projectJson: SfProjectJson = await this.project.retrieveSfProjectJson();
        const json = projectJson.getContents();

        let packageDirs: NamedPackageDirLarge[] = json.packageDirectories as NamedPackageDirLarge[];

        // check if package exists
        if (!packageDirs.map((a) => a.package).includes(packagename)) {
            EONLogger.log(COLOR_ERROR('Package ' + packagename + ' does not exist in sfdx.project.json'));
            return;
        }
        const packagePath: string = packageDirs.find((a) => a.package === packagename).path;
        const filePaths: String[] = this.findFileInDir(packagePath, SETUPFILE);

        if (filePaths.length > 1) {
            EONLogger.log(COLOR_ERROR('Multiple ' + SETUPFILE + ' files found in package ' + packagename));
            EONLogger.log(COLOR_ERROR('Only one ' + SETUPFILE + ' file is allowed per package'));
            return;
        } else if (filePaths.length === 1) {
            EONLogger.log(COLOR_INFO(SETUPFILE + ' file in package ' + packagename + ' already exists.'));
            return;
        }

        // create new subfolders of devkit
        if (!fs.existsSync(path.join(packagePath, DEVKITFOLDER))) {
            fs.mkdirSync(path.join(packagePath, DEVKITFOLDER));
        }
        if (!fs.existsSync(path.join(packagePath, DEVKITFOLDER, SCRIPTSFOLDER))) {
            fs.mkdirSync(path.join(packagePath, DEVKITFOLDER, SCRIPTSFOLDER));
        }
        if (!fs.existsSync(path.join(packagePath, DEVKITFOLDER, TESTDATAFOLDER))) {
            fs.mkdirSync(path.join(packagePath, DEVKITFOLDER, TESTDATAFOLDER));
        }
        // create new yml file
        const baseStructureYaml = EONDEVKITYML;
        if (!fs.existsSync(path.join(packagePath, DEVKITFOLDER, SETUPFILE))) {
            fs.writeFileSync(path.join(packagePath, DEVKITFOLDER, SETUPFILE), baseStructureYaml);
            EONLogger.log(COLOR_INFO('Created ' + SETUPFILE + ' file in package ' + packagename));
        }
        // create new export.json file
        const baseExportJson = EXPORTJSON;

        if (!fs.existsSync(path.join(packagePath, DEVKITFOLDER, TESTDATAFOLDER, 'export.json'))) {
            fs.writeFileSync(path.join(packagePath, DEVKITFOLDER, TESTDATAFOLDER, 'export.json'), baseExportJson);
            EONLogger.log(COLOR_INFO('Created export.json file in package ' + packagename));
        }
        // create example apex script
        const exampleApexBody = EXAMPLEAPEX;
        if (!fs.existsSync(path.join(packagePath, DEVKITFOLDER, SCRIPTSFOLDER, 'setup-script.apex'))) {
            fs.writeFileSync(path.join(packagePath, DEVKITFOLDER, SCRIPTSFOLDER, 'setup-script.apex'), exampleApexBody);
            EONLogger.log(COLOR_INFO('Created setup-script.apex file in package ' + packagename));
        }

        EONLogger.log(COLOR_HEADER('Devkit creation completed for package ' + packagename));
        return {};
    }

    // find all files in directory
    findFileInDir(dir, filename) {
        let results = [];
        fs.readdirSync(dir).forEach((file) => {
            let fullPath = path.join(dir, file);
            if (fs.lstatSync(fullPath).isDirectory()) {
                results = [...results, ...this.findFileInDir(fullPath, filename)];
            } else {
                if (fullPath.includes(filename)) {
                    results.push(fullPath);
                }
            }
        });
        return results;
    }
}
