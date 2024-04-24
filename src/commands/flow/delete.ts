import { Command, Flags } from '@oclif/core';
import { StateAggregator, Connection, AuthInfo } from '@salesforce/core';
import { Flow, AggregateResult } from '../../helper/types';

import EONLogger, {
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_KEY_MESSAGE,
    COLOR_NOTIFY,
    COLOR_SUCCESS,
    COLOR_WARNING,
    COLOR_TRACE,
} from '../../eon/EONLogger';
import { LOGOBANNER } from '../../eon/logo';
import Bottleneck from 'bottleneck';
import EonCommand from '../../EonCommand';

export default class FlowDelete extends EonCommand {
    static description = 'Delete flow versions from org';

    static examples = ['eon flow delete --label csc_cockpit --behind 2 --alias <org>'];

    static flags = {
        label: Flags.string({ char: 'l', description: 'MasterLabel', exclusive: ['extra-flag'] }),
        orgAlias: Flags.string({ char: 'o', description: 'OrgAlias', required: true }),
        rest: Flags.integer({ char: 'r', description: 'Startpoint to delete versions', required: true }),
        all: Flags.boolean({ char: 'a', description: 'Delete all versions', exclusive: ['label'] }),
    };

    // eslint-disable-next-line complexity
    async execute(): Promise<void> {
        EONLogger.log(COLOR_HEADER(LOGOBANNER));
        EONLogger.log(COLOR_KEY_MESSAGE('Delete flow version(s)...'));

        const { flags } = await this.parse(FlowDelete);
        const flowCountSet = new Set<string>();
        const flowDeleteSet = new Set<string>();
        const flowMap = new Map<string, Flow[]>();
        const stateAggregator = await StateAggregator.getInstance();
        const userName = stateAggregator.aliases.resolveUsername(flags.orgAlias);
        const connection = await Connection.create({
            authInfo: await AuthInfo.create({ username: userName }),
        });

        const limiter = new Bottleneck({ maxConcurrent: 1 });

        limiter.on('failed', async (error, jobInfo) => {
            if (jobInfo.retryCount < 5) {
                return 1000 + jobInfo.retryCount * 1000;
            } else {
                throw new Error(`Retry limit exceeded, Unable to get sandbox auth infos due to ${error.message}`);
            }
        });

        limiter.on('retry', (error, jobInfo) =>
            EONLogger.log(
                `Sandbox auth request runs on error. Retrying (${jobInfo.retryCount + 1}/5) after 1 seconds...`
            )
        );

        EONLogger.log(COLOR_NOTIFY(`🧐 Fetch package versions for username ${userName}`));
        EONLogger.log(COLOR_TRACE(`First check how many flows have more than ${flags.rest} versions.`));

        const queryFlowCount = `SELECT COUNT(Id),MasterLabel FROM Flow WHERE ManageableState = 'unmanaged' GROUP BY MasterLabel HAVING COUNT(Id) > ${flags.rest} ORDER BY MasterLabel DESC`;

        const responseFlowCount = await connection.tooling.query<AggregateResult>(queryFlowCount);
        const flowCount =
            responseFlowCount.records && responseFlowCount.records.length > 0 ? responseFlowCount.records : [];

        if (flowCount.length === 0) {
            EONLogger.log(
                COLOR_WARNING(`👆 No flow versions found on org with more than ${flags.rest} versions. Skip command!`)
            );
            return;
        }

        for (const flow of flowCount) {
            flowCountSet.add(flow.MasterLabel);
        }

        const query = flags.all
            ? `Select Id,MasterLabel, VersionNumber, Status from Flow where MasterLabel In ('${[
                  ...flowCountSet.values(),
              ].join(`','`)}') And ManageableState = 'unmanaged' Order by VersionNumber desc`
            : `Select Id,MasterLabel, VersionNumber, Status from Flow where MasterLabel = '${flags.label}' And ManageableState = 'unmanaged' Order by VersionNumber desc`;


        const response = await connection.tooling.query<Flow>(query);

        const flowVersions = response.records && response.records.length > 0 ? response.records : [];

        // Loop trough flow and create a map with the MasterLabel as key and the flow as value
        for (const flow of flowVersions) {
            if (flowMap.has(flow.MasterLabel)) {
                flowMap.get(flow.MasterLabel)?.push(flow);
            } else {
                flowMap.set(flow.MasterLabel, [flow]);
            }
        }

        // extra function to add a timeout to avoid too many requests this resoves salesforce lock errors
        async function deleteFlowVersion(id: string) {
            // await a new promise with timeout to avoid too many requests
            // eslint-disable-next-line no-promise-executor-return
            await connection.tooling.delete('Flow', id);
        }

        if (flowVersions.length === 0) {
            EONLogger.log(COLOR_WARNING(`No flow versions found for this settings. Skip command!`));
            return;
        }

        for (const [label, flows] of flowMap) {
            EONLogger.log(COLOR_TRACE(`👍 Found ${flows.length} flow versions for label ${label}`));
            // First check if a version is active
            const activeFlow = flows.some((flow) => flow.Status === 'Active');
            if (activeFlow)
                EONLogger.log(COLOR_TRACE(`🤘 Found active version. So counter starts behind the active version!`));
            else EONLogger.log(COLOR_TRACE(`👆 No active version found. So counter starts from the beginning!`));

            let isActive = false;
            let versionCounter = 0;

            for (const flow of flows) {
                // iterate over all flow versions with index and delete them

                if ((activeFlow && flow.Status === 'Active') || !activeFlow) {
                    isActive = true;
                    continue;
                }

                if (isActive) {
                    versionCounter++;
                }

                if (versionCounter > flags.rest) {
                    flowDeleteSet.add(flow.MasterLabel);
                    await limiter.schedule(async () => {

                      EONLogger.log(COLOR_TRACE(`Start deleting flow  ${flow.MasterLabel} with version number ${flow.VersionNumber}`));
                      try{
                      await deleteFlowVersion(flow.Id)
                      } catch (error) {
                        if(error.errorCode === 'DEPENDENCY_EXISTS'){
                          EONLogger.log(COLOR_ERROR(`Dependency exists for flow. Continue with the next flow version.`));
                        } else {
                          throw new Error(error.message);
                        }
                      }

                    });
                }
            }
        }

        if (flowDeleteSet.size === 0) {
            EONLogger.log(COLOR_WARNING(`👆 No flow versions to delete found for this settings. Skip command!`));
            return;
        }

        EONLogger.log(COLOR_KEY_MESSAGE('Ready to delete the flow version(s): ⌛️'));
        EONLogger.log(`Flow(s) to delete: ${[...flowDeleteSet.values()].join(', ')}`);

    }
}
