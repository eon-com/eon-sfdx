import * as os from 'os';
import { Messages, SfProject, SfError, SfProjectJson } from '@salesforce/core';
import { NamedPackageDirLarge } from '../helper/types';
import { AnyJson } from '@salesforce/ts-types';
import simplegit, { SimpleGit } from 'simple-git';
import { PluginSettings } from '../helper/types';
import EONLogger, {
    COLOR_SUCCESS,
    COLOR_INFO,
    COLOR_KEY_MESSAGE,
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_TRACE_ITALIC,
    COLOR_EON_YELLOW,
} from '../eon/EONLogger';
import PackageReadme from '../helper/package-readme';
import path from 'path';
import PackageNodeTree from '../helper/package-tree';
import EonCommand from '../EonCommand';
import dedent from 'dedent-js';
import { Flags } from '@oclif/core';
import { LOGOBANNER } from '../eon/logo';
import { exec } from 'child_process';
import { promisify } from 'util';
import ora from 'ora';
import slash from 'slash';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'changelog');

export default class Changelog extends EonCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = messages.getMessage('examples').split(os.EOL);

    public static readonly flags = {
        //Label For Named Credential as Require
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
        // get sfdx project.json
        const project: SfProject = await SfProject.resolve();
        const projectJson: SfProjectJson = await project.retrieveSfProjectJson();
        const jsons = projectJson.getContents();
        const settings: PluginSettings = projectJson.getContents()?.plugins['eon-sfdx'] as PluginSettings;

        EONLogger.log(
            COLOR_EON_YELLOW(`ℹ️ Note: Package dependency version updates are not included in this command 👆.`)
        );

        EONLogger.log(
            COLOR_EON_YELLOW(
                `You have to update them manually if necessary.So look if you have dependencies to other packages`
            )
        );

        EONLogger.log(COLOR_EON_YELLOW(`and update them before you make the next steps ❗️`));

        // get all packages
        let packageDirs: NamedPackageDirLarge[] = jsons.packageDirectories as NamedPackageDirLarge[];
        const { Select } = require('enquirer');
        let diffFlags: string[] = [];

        const gitDiffStrategy = await new Select({
            name: 'gitDiffStrategy',
            message: dedent(`${COLOR_HEADER('Please choose a changelog strategy')}
                       ${COLOR_TRACE_ITALIC('"Staged" creates a changelog from your staged changes.')}
                       ${COLOR_TRACE_ITALIC(
                           'This is useful when you like to update the readme with your staged changes.'
                       )}
                       ${COLOR_TRACE_ITALIC('"Head" fetches the changes from your branch against origin/main.')}
                       ${COLOR_TRACE_ITALIC(
                           'This is useful if you want to update (only) the readme and create a new commit for this change.'
                       )}`),
            choices: [COLOR_HEADER('Staged'), COLOR_HEADER('Head')],
        })
            .run()
            .catch(console.error);

        if (gitDiffStrategy.includes('Staged')) {
            diffFlags = ['--staged'];
        } else {
            diffFlags = [`origin/main...HEAD`, `--no-renames`, `--name-only`];
        }
        // get all staged changes
        let git: SimpleGit = simplegit(path.dirname(projectJson.getPath()));
        const diffString = await git.diff(diffFlags);
        const modifiedFiles: string[] = diffString.split('\n');

        modifiedFiles.pop();

        // ask for jira reference
        let changedPackages: string[] = [];
        let changedSet = new Set<string>();
        // check changed packages
        for (const pck of packageDirs) {
            for (const filename of modifiedFiles) {
                if (path.normalize(filename).includes(path.normalize(pck.path))) {
                    changedSet.add(pck.package);
                }
            }
        }

        if (changedSet.size > 0) {
            changedPackages = [...changedSet];
        }

        // multiple packages
        if (changedPackages.length == 0) {
            if (gitDiffStrategy.includes('Staged')) {
                throw new SfError(
                    COLOR_ERROR('No staged changes to any package found!'),
                    COLOR_ERROR('GIT_DIFF_ERROR')
                );
            } else {
                throw new SfError(
                    COLOR_ERROR(
                        'No changes to any package found!. Looks that your branch is up to date with origin/main.'
                    ),
                    COLOR_ERROR('GIT_DIFF_ERROR')
                );
            }
        } else if (changedPackages.length > 1) {
            EONLogger.log(COLOR_KEY_MESSAGE('Found changes in multiple packages 👇'));

            const Table = require('cli-table3');
            let table = new Table({
                head: [COLOR_KEY_MESSAGE('Package Name')],
            });
            for (let pck of changedPackages) {
                table.push([pck]);
            }

            EONLogger.log(table.toString());

            const multipleChangesConfirm = await new Select({
                name: 'multipleChangesConfirm',
                message: COLOR_HEADER('Are you sure to commit changes to different packages within the same commit?'),
                choices: [COLOR_HEADER('Yes'), COLOR_HEADER('No')],
            })
                .run()
                .catch(console.error);

            if (multipleChangesConfirm.includes('No')) {
                return {};
            }
        } else {
            EONLogger.log(COLOR_KEY_MESSAGE('Found changes in this package 👇'));

            const Table = require('cli-table3');
            let table = new Table({
                head: [COLOR_KEY_MESSAGE('Package Name')],
            });
            for (let pck of changedPackages) {
                table.push([pck]);
            }

            EONLogger.log(table.toString());
        }

        // ask for type
        const promptType = await new Select({
            name: 'changetype',
            message: dedent(`${COLOR_HEADER("Please select the nature of the changes you'd like to commit 👆")}
                       ${COLOR_TRACE_ITALIC('"Fix" updates the patch version. For example 1.0.0 => 1.0.1')}
                       ${COLOR_TRACE_ITALIC('"Feature" updates the minor version. For example 1.0.0 => 1.1.0')}`),
            choices: [COLOR_HEADER('Feature'), COLOR_HEADER('Fix')],
        })
            .run()
            .catch(console.error);
        // get jira ref from branch as default
        const branchname = await git.revparse(['--abbrev-ref', 'HEAD']);
        let defaultJiraId = 'XXXXX-12345';

        if (settings && settings.workItemFilter) {
            defaultJiraId = branchname.match(settings.workItemFilter)
                ? branchname.match(settings.workItemFilter)[0]
                : defaultJiraId;
        }

        const { Input } = require('enquirer');
        const promptJira = await new Input({
            message: COLOR_HEADER('What is the Jira Reference?'),
            initial: defaultJiraId,
        })
            .run()
            .catch(console.log);
        // ask for commit message

        const { prompt } = require('enquirer');
        const message = await prompt({
            required: true,
            type: 'input',
            name: 'message',
            message: COLOR_HEADER('Describe your changes briefly:'),
        });

        const hasBreakingPrompt = await new Select({
            name: 'hasBreakingConfirm',
            message: dedent(`${COLOR_HEADER('Do your changes include breaking changes to existing features?')}
      ${COLOR_TRACE_ITALIC('"Yes" updates the major version. For example 1.0.0 => 2.0.0')}
      `),
            choices: [COLOR_HEADER('No'), COLOR_HEADER('Yes')],
        })
            .run()
            .catch(console.error);

        // update versions
        const Table = require('cli-table3');
        let table = new Table({
            head: [COLOR_KEY_MESSAGE('Package Name'), COLOR_KEY_MESSAGE('Version')],
        });
        let updatedPackages: NamedPackageDirLarge[] = [];
        for (let packageName of changedPackages) {
            const nodetree: PackageNodeTree = new PackageNodeTree(projectJson);
            await nodetree.nodeTreeInit();
            let pck = packageDirs.find((pckdir) => packageName === pckdir.package);
            let oldVer = pck.versionNumber;
            let version: number[] = pck.versionNumber
                .replace('.NEXT', '')
                .split('.')
                .map((v) => Number.parseInt(v));

            // update versions based on change type
            if (hasBreakingPrompt.includes('Yes')) {
                version[0] = version[0] + 1;
                version[1] = 0;
                version[2] = 0;
            } else if (promptType.includes('Feature')) {
                version[1] = version[1] + 1;
                version[2] = 0;
            } else {
                version[2] = version[2] + 1;
            }
            // differentiate between unlocked and source packages
            pck.versionNumber = `${version[0]}.${version[1]}.${version[2]}${oldVer.includes('.NEXT') ? '.NEXT' : ''}`;
            let newVer = pck.versionNumber;
            table.push([packageName, `${oldVer} ==> ${newVer}`]);

            // update dependencies
            /*if (dependencyPrompt && pck.dependencies) {
        for (let dep of pck.dependencies) {
          if (dep.versionNumber) {
            dep.versionNumber = packageDirs
              .find((dir) => dir.package === dep.package)
              .versionNumber.replace('.NEXT', '.LATEST');
          }
        }
      }*/

            updatedPackages = [...updatedPackages, pck];
        }

        // print summary
        const commitMsg = `${promptType.includes('Feature') ? 'feat:' : 'fix:'} ${promptJira} ${message.message}`;

        EONLogger.log(
            COLOR_HEADER(`
Following Details will be updated:
    `)
        );
        EONLogger.log(`${COLOR_KEY_MESSAGE('Please check the new changelog message 👉')} ${COLOR_INFO(commitMsg)}\n`);
        EONLogger.log(`${COLOR_KEY_MESSAGE('Please check the sfdx-project.json pck update(s) 👇')}`);
        console.log(table.toString());

        // handle version updates

        // ask, if dependencies should be updated
        const confirmPrompt = await new Select({
            name: 'confirmCommit',
            message: dedent(`${COLOR_HEADER('Are you happy with your changes?')}
      ${COLOR_TRACE_ITALIC('Select "Yes" to update the files.')}
      `),
            choices: [COLOR_HEADER('Yes'), COLOR_HEADER('No, i go out without any changes!')],
        })
            .run()
            .catch(console.error);

        // exit if no was selected
        if (confirmPrompt.includes('No')) {
            return {};
        }

        // update sfdx project json
        let json = projectJson.getContents();
        let readmes: string[] = [];
        const jsonPd = json.packageDirectories as NamedPackageDirLarge[];

        for (let update of updatedPackages) {
            const index = jsonPd.indexOf(
              jsonPd.find((pck) => pck.package === update.package)
            );
            if (~index) {
                // we need this step for windows users to normalize the path
                update.path = path.normalize(update.path);
                jsonPd[index] = update;
                // update readme if set in settings
                if (settings && settings.enableReadmeGeneration) {
                    const gitUser = await git.getConfig('user.name');
                    const readme = await PackageReadme.update(
                        jsonPd[index],
                        message.message,
                        promptJira,
                        gitUser.value,
                        settings
                    );
                    readmes.push(path.normalize(readme));
                    readmes.push(path.normalize(readme.replace('readme','README')));
                    readmes.push(path.normalize(readme.replace('readme','Readme')))
                }
                delete jsonPd[index]['name'];
                json.packageDirectories[index].path = slash(json.packageDirectories[index].path);
            }
        }
        projectJson.setContentsFromObject(json);
        const spinner = ora(COLOR_HEADER('Start updating sfdx-project.json file')).start();
        await projectJson.write();
        spinner.succeed(COLOR_HEADER('sfdx-project.json file update succesfully'));

        // commit changes
        spinner.start(COLOR_HEADER('start staging your new changes'));
        await git.add([projectJson.getPath(),...readmes]);
        spinner.succeed(COLOR_HEADER('Staging your new changes succesfully'));

        const execAsync = promisify(exec);
        spinner.start(COLOR_HEADER('Start format your stages changes by prettier'));
        try {
            const { stdout, stderr } = await execAsync('npm run pretty-quick:staged');
            if (stdout) {
                spinner.succeed(COLOR_HEADER('Formatting your stages changes by prettier succesfully. Here the output 👇'));
                EONLogger.log(stdout);
            }
            if (stderr) {
                spinner.fail('Formatting your stages changes by prettier failed. Here the output 👇');
                EONLogger.log(stderr);
            }
        } catch (error) {
            throw new SfError(COLOR_ERROR(error.message), 'PRETTIER_ERROR');
        }

        //await git.commit(commitMsg);
        EONLogger.log(COLOR_SUCCESS('🎉 Congratulations!👏 Your changes have been staged successfully! 🥳'));
        return {};
    }
}
