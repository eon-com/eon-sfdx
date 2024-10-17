import { Org, SfError } from '@salesforce/core';
import EONLogger, { COLOR_KEY_MESSAGE, COLOR_NOTIFY, COLOR_TRACE } from '../../eon/EONLogger';
import PackageInstall from './../../helper/package-install';
import ValidateDiff from './../../helper/validate';
import { SfProject, SfProjectJson } from '@salesforce/core';
import { NamedPackageDirLarge, PackageCharacter } from '../../helper/types';
import { Dictionary, Nullable } from '@salesforce/ts-types';
import Table from 'cli-table3';
import ScratchOrg from '@flxbl-io/sfp/lib/core/scratchorg/ScratchOrg';

export interface UnlockedPackageImplProps {
    devHubAlias: string;
    scratchOrgAlias: string;
    runScripts: boolean;
    poolTag: string;
}

export default class UnlockedPackageImpl {
    constructor(private props: UnlockedPackageImplProps) {}
    public async exec(): Promise<any> {
        EONLogger.log(COLOR_KEY_MESSAGE('Validating unlocked package(s)...'));

        const project = await SfProject.resolve();
        const projectJson: SfProjectJson = await project.retrieveSfProjectJson();
        const json = projectJson.getContents();
        const packageTrees: NamedPackageDirLarge[] = json.packageDirectories as NamedPackageDirLarge[];
        const packageAliases: Nullable<Dictionary<string>> = project.getPackageAliases();
        const packageMap = new Map<string, PackageCharacter>();
        const packageMapSort = new Map<string, PackageCharacter>();

        const packageInfoTable = new Table({
            head: [
                COLOR_NOTIFY('Package Name'),
                COLOR_NOTIFY('Reason'),
                COLOR_NOTIFY('Has Bit2Win Deps'),
                COLOR_NOTIFY('Type'),
            ],
            colWidths: [30, 30, 15, 15],
            wordWrap: true,
        });

        // first loop for changes detection
        const promises: Promise<void>[] = [];
        for (const pck of packageTrees) {
            if (pck.ignoreOnStage && Array.isArray(pck.ignoreOnStage) && pck.ignoreOnStage.includes('build')) {
                EONLogger.log(COLOR_TRACE(`👆 Package ${pck.package} is ignored on validate stage. Skipping...`));
                continue;
            }

            if (!packageAliases[pck.package]) {
                continue;
            }

            if (pck.type) {
                continue;
            }

            const promise = this.checkPackageChanges(pck, packageAliases, packageMap, projectJson);

            promises.push(promise);
        }

        EONLogger.log(COLOR_NOTIFY(`🧐 Checking for changes in ${packageTrees.length} packages...`));

        await Promise.allSettled(promises);
        if (packageMap.size === 0) {
            EONLogger.log(COLOR_NOTIFY(`✔ Found no packages with changes. Process finished without validation`));
            return;
        }

        // second loop for sorting
        for (const pck of packageTrees) {
            if (packageMap.has(pck.package)) {
                packageMapSort.set(pck.package, packageMap.get(pck.package));
            }
        }

        for (const [key, value] of packageMapSort) {
            packageInfoTable.push([key, value.reason, value.hasManagedPckDeps ? '✅' : '❌', value.type]);
        }

        const devHubOrg = await Org.create({ aliasOrUsername: this.props.devHubAlias });

        let fetchResult: ScratchOrg;
        if (!this.props.scratchOrgAlias) {
            const PoolFetchImpl = require('@flxbl-io/sfp/lib/core/scratchorg/pool/PoolFetchImpl').default;

            const poolFetchImpl = new PoolFetchImpl(devHubOrg as Org, this.props.poolTag, false, false, '', '', false);

            fetchResult = (await poolFetchImpl.execute()) as ScratchOrg;
            if (fetchResult.failureMessage) {
                throw new SfError(fetchResult.failureMessage);
            }

            EONLogger.log(COLOR_NOTIFY(`======== Scratch org details ======== 👇`));

            const scratchInfoTable = new Table({
                head: [COLOR_NOTIFY('Key'), COLOR_NOTIFY('Value')],
                colWidths: [20, 70],
                wordWrap: true,
            });

            for (let [key, value] of Object.entries(fetchResult)) {
                if (value) {
                    scratchInfoTable.push([key, value]);
                }
            }

            EONLogger.log(scratchInfoTable.toString());
        }

        EONLogger.log(COLOR_NOTIFY(`👉 Following unlocked packages with changes:`));
        EONLogger.log(packageInfoTable.toString());

        // now install all packages
        await PackageInstall.getInstance().run(
            packageMapSort,
            this.props.devHubAlias,
            this.props.scratchOrgAlias || fetchResult.username,
            this.props.runScripts
        );
    }

    async checkPackageChanges(
        pck: NamedPackageDirLarge,
        packageAliases: Nullable<Dictionary<string>>,
        packageMap: Map<string, PackageCharacter>,
        projectJson: SfProjectJson
    ): Promise<void> {
        const packageCharacter: PackageCharacter = {
            hasManagedPckDeps: false,
            reason: '',
            type: '',
            versionNumber: '',
            packageDeps: [],
            path: pck.path,
            hasError: false,
            errorMessage: '',
            targetTree: {} as NamedPackageDirLarge,
        };
        if (pck.ignoreOnStage && Array.isArray(pck.ignoreOnStage) && pck.ignoreOnStage.includes('validate')) {
            return;
        }

        // check bit2win dependencies
        if (pck.dependencies && Array.isArray(pck.dependencies)) {
            for (const packageTreeDeps of pck.dependencies!) {
                if (
                    packageAliases![packageTreeDeps.package] &&
                    packageAliases![packageTreeDeps.package]?.startsWith('04')
                ) {
                    packageCharacter.hasManagedPckDeps = true;
                } else {
                    packageCharacter.packageDeps.push(packageTreeDeps);
                }
            }
        }

        // check pck type
        if (pck.type ?? pck.type === 'data') {
            packageCharacter.type = 'data';
        } else if (packageAliases![pck.package!]) {
            packageCharacter.type = 'unlocked';
        } else {
            packageCharacter.type = 'source';
        }

        // set version number
        packageCharacter.versionNumber = pck?.versionNumber ?? '';

        const hasGitDiff = await ValidateDiff.getInstance().getGitDiff(pck, projectJson);
        if (hasGitDiff) {
            packageCharacter.reason = 'Found change(s) in package';
            packageMap.set(pck.package!, packageCharacter);
        }

        const targetTree = await ValidateDiff.getInstance().getPackageTreeChanges(pck, projectJson);
        if (targetTree && hasGitDiff) {
            packageCharacter.targetTree = targetTree;
            packageMap.set(pck.package!, packageCharacter);
        }
    }
}
