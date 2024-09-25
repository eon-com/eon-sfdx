const axios = require('axios');
import { AnyJson } from '@salesforce/ts-types';
import { Messages, SfError, Connection, AuthInfo, StateAggregator } from '@salesforce/core';
import { Listr } from 'listr2';
import {
  SingleMergeRequest,
  GitPackageInfos,
  PackageChange,
  SfpowerscriptsArtifact2,
  JobDetails,
  NamedPackageDirLarge,
} from '../../../../helper/types';
import EONLogger, {
  COLOR_INFO,
  COLOR_KEY_MESSAGE,
  COLOR_HEADER,
  COLOR_NOTIFY,
  COLOR_WARNING,
  COLOR_TRACE,
} from '../../../../eon/EONLogger';
import Table from 'cli-table3';
import { LOGOBANNER } from '../../../../eon/logo';
import { Flags } from '@oclif/core';
import  EonCommand  from '../../../../EonCommand';
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.

export default class GitLabStatus extends EonCommand {
  public static description = `This command fetch the current deployment status for a merge request`;

  public static examples = [
    `sfdx eon:gitlab:merge:status --token gitlabxxxxx --url gitlab.com --aliases dev,ft,sit --mergeid 1523`,
    `sfdx eon:gitlab:merge:status -t gitlabxxxxx -u gitlab.com -a dev,ft,sit -m 1523`,
  ];


  public static deploymentCounter = {
    isOnFT: 0,
    isOnSIT: 0,
    isOnPreProd: 0,
    isOnProd: 0,
    isOnEWISIT: 0,
  };

  public static packageTagCounter = 0;

  static flags = {
    // Label For Named Credential as Required
    token: Flags.string({
      char: 't',
      description: `User Token from GitLab Repository`,
      required: true,
    }),
    mergeid: Flags.integer({
      char: 'm',
      description: 'Merge Request Id',
      required: true,
    }),
    aliases: Flags.string({
      char: 'a',
      description: 'Orgs Alias for deplyoment status',
      default: '',
      required: true,
    }),
    url: Flags.string({
      char: 'u',
      description: 'GitLab API Url',
      default: '',
      required: true,
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async execute(): Promise<AnyJson> {
    EONLogger.log(COLOR_HEADER(LOGOBANNER));
    EONLogger.log(COLOR_KEY_MESSAGE('Gitlab merge status...'));
    EONLogger.log(COLOR_HEADER('Get from merge the package versions and deployment statis'));
    //set global gitlab variables
    axios.defaults.baseURL = this.flags.url;
    axios.defaults.headers.common['Authorization'] = `Bearer ${this.flags.token}`;
    //generate output table
    let table = new Table({
      head: [
        COLOR_INFO('Package/ Merge Request'),
        COLOR_INFO('Build Status'),
        COLOR_INFO('isOnFT'),
        COLOR_INFO('isOnEDGSIT'),
        COLOR_INFO('isOnPreProd'),
        COLOR_INFO('isOnProd'),
        COLOR_INFO('isOnEWISIT'),
      ],
      colWidths: [40, 20, 13, 13, 13, 13, 13], // Requires fixed column widths
      wordWrap: true,
    });
    //create org alias array
    const orgAliases = this.flags.aliases.split(' ');
    //fetch single merge request from gitlab
    const merge = await this.getSingleMergeRequest();
    EONLogger.log(`${COLOR_NOTIFY('Author:')} ${COLOR_INFO(merge.author)}`);
    EONLogger.log(`${COLOR_NOTIFY('Title:')} ${COLOR_INFO(merge.title)}`);
    EONLogger.log(`${COLOR_NOTIFY('Description:')} ${COLOR_INFO(merge.description)}`);
    EONLogger.log(`${COLOR_NOTIFY('Milestone:')} ${COLOR_INFO(merge.milestone)}`);
    EONLogger.log(`${COLOR_NOTIFY('Status:')} ${COLOR_INFO(merge.mergeStatus)}`);
    EONLogger.log(`${COLOR_NOTIFY('WebLink:')} ${COLOR_INFO(merge.web_url)}`);

    const mergeWithPck = await this.getSingleMergeChanges(merge);
    if (mergeWithPck.packages.size > 0) {
      EONLogger.log(COLOR_INFO('👏 Found changes for package(s):'));
      EONLogger.log(COLOR_INFO(`👉 ${[...mergeWithPck.packages.keys()].join()} 👈`));
      //Get Package Tags from Gitlab Registry
      let mergeWithTags = await this.getPackageTags(merge, merge.commitSHA);
      //Get Package infos from Org
      for (const a of orgAliases) {
        mergeWithTags = await this.getPackageInfosFromOrg(mergeWithTags, a);
      }
      for (const [key, value] of mergeWithTags.packages) {
        table.push([
          { hAlign: 'center', content: key },
          { hAlign: 'center', content: value.releaseTag },
          { hAlign: 'center', content: value.isOnFT ? '✔️' : '❌' },
          { hAlign: 'center', content: value.isOnSIT ? '✔️' : '❌' },
          { hAlign: 'center', content: value.isOnPreProd ? '✔️' : '❌' },
          { hAlign: 'center', content: value.isOnProd ? '✔️' : '❌' },
          { hAlign: 'center', content: value.isOnEWISIT ? '✔️' : '❌' },
        ]);
      }
      table.push([
        { hAlign: 'center', content: mergeWithTags.id },
        { hAlign: 'center', content: mergeWithTags.packages.size === GitLabStatus.packageTagCounter ? '✔️' : '❌' },
        {
          hAlign: 'center',
          content: mergeWithTags.packages.size === GitLabStatus.deploymentCounter.isOnFT ? '✔️' : '❌',
        },
        {
          hAlign: 'center',
          content: mergeWithTags.packages.size === GitLabStatus.deploymentCounter.isOnSIT ? '✔️' : '❌',
        },
        {
          hAlign: 'center',
          content: mergeWithTags.packages.size === GitLabStatus.deploymentCounter.isOnPreProd ? '✔️' : '❌',
        },
        {
          hAlign: 'center',
          content: mergeWithTags.packages.size === GitLabStatus.deploymentCounter.isOnProd ? '✔️' : '❌',
        },
        {
          hAlign: 'center',
          content: mergeWithTags.packages.size === GitLabStatus.deploymentCounter.isOnEWISIT ? '✔️' : '❌',
        },
      ]);
      EONLogger.log(table.toString());
      //and now get all current errors from the pipeline

      let jobMap = new Map<string, JobDetails>();
      await new Listr([
        {
          title: 'Check the repository for the latest job errors',
          task: async (): Promise<void> => {
            jobMap = await this.getLastJobIds();
          },
        },
      ]).run();

      for (const value of jobMap.values()) {
        let pckHasError = false;
        if (value.status === 'failed') {
          value.packages = await this.getJobMetrics(value.jobId);
          for (const pck of value.packages) {
            if (mergeWithTags.packages.get(pck)) {
              pckHasError = true;
            }
          }
          if (value.packages.length > 0) {
            if (pckHasError) {
              EONLogger.log(
                COLOR_WARNING(
                  `❗️This merge request contains ${value.alias} errors. Pick your Package and check the job details:`
                )
              );
              EONLogger.log(COLOR_INFO(`📦 ${value.packages.join(',')}`));
              EONLogger.log(COLOR_TRACE(`Job Link: ${COLOR_INFO(value.webUrl)}`));
            } else {
              EONLogger.log(
                COLOR_INFO(`✅ This merge request contains no ${value.alias} errors.Current packages with errors:`)
              );
              EONLogger.log(COLOR_INFO(`📦 ${value.packages.join(',')}`));
              EONLogger.log(COLOR_TRACE(`Job Link: ${COLOR_INFO(value.webUrl)}`));
            }
          }
        }
      }
      EONLogger.log(COLOR_KEY_MESSAGE(`Merge status check completed.🤟`));
    } else {
      EONLogger.log(COLOR_KEY_MESSAGE(`🤟 Merge status check completed.Found no changes.`));
    }

    return {};
  }

  private async getSingleMergeRequest(): Promise<SingleMergeRequest> {
    EONLogger.log(COLOR_TRACE(`Get single merge request data from gitlab for merge id: ${this.flags.mergeid}`));
    try {
      const merge = await axios({
        method: 'get',
        url: `/api/v4/projects/10309/merge_requests/${this.flags.mergeid}`,
      });
      if (merge.status === 200 && merge.data) {
        return {
          packages: new Map<string, GitPackageInfos>(),
          id: merge.data.iid,
          labels: merge.data.labels,
          commitSHA: merge.data.merge_commit_sha ?? 'not-defined',
          author: merge.data.author ? merge.data.author.name : '',
          username: merge.data.author ? merge.data.author.username : '',
          title: merge.data.title,
          web_url: merge.data.web_url,
          createdat: merge.data.created_at,
          description: merge.data.description,
          merged_by: merge.data.merged_by ? merge.data.merged_by.name : '',
          reviewer: '',
          isBuild: false,
          isOnFT: false,
          isOnSIT: false,
          isOnPreProd: false,
          isOnProd: false,
          isOnEWISIT: false,
          mergeStatus: merge.data.state,
          milestone: merge.data.milestone ? merge.data.milestone.title : '',
        };
      } else {
        throw new SfError(`Check Response Status: ${merge.status} or no data from single merge request`);
      }
    } catch (e) {
      throw new SfError(`No result from Gitlab for single merge request data.`);
    }
  }

  private async getRepoFiles(commit: string): Promise<string> {
    let blobId: string = '';
    try {
      const repoFileResponse = await axios({
        method: 'get',
        url: `/api/v4/projects/10309/repository/files/sfdx-project.json?ref=${commit}`,
      });
      if (repoFileResponse?.status === 200) {
        blobId = repoFileResponse.data.blob_id ? repoFileResponse.data.blob_id : '';
      }
    } catch (e) {
      //console.log()
    }
    return blobId;
  }

  private async getCommitProjectJson(blobId: string): Promise<NamedPackageDirLarge[]> {
    let projectJsonPackages: NamedPackageDirLarge[] = [];
    if (blobId) {
      try {
        const mergeCommitResponse = await axios({
          method: 'get',
          url: `/api/v4/projects/10309/repository/blobs/${blobId}/raw`,
        });
        if (mergeCommitResponse?.status === 200) {
          projectJsonPackages = mergeCommitResponse.data.packageDirectories;
        }
      } catch (e) {
        //console.log(logError('Get Single Commit Project JSON Error'))
        //console.log(logInfo(e))
      }
    }
    return projectJsonPackages;
  }

  private async getSingleMergeChanges(merge: SingleMergeRequest): Promise<SingleMergeRequest> {
    let packageMap = new Map();
    let projectJson: NamedPackageDirLarge[];
    let mergeChangesResponse;
    try {
      mergeChangesResponse = await axios({
        method: 'get',
        url: `/api/v4/projects/10309/merge_requests/${merge.id}/changes`,
      });
    } catch (e) {
      throw new SfError(`Error. Cannot get changes from Gitlab for single merge request`);
    }
    try {
      if (mergeChangesResponse?.status === 200) {
        //Check only Merges > 445
        if (mergeChangesResponse.data.sha && mergeChangesResponse.data.changes.length > 0) {
          //get Project Json
          let blobId = await this.getRepoFiles(mergeChangesResponse.data.sha);
          if (blobId) {
            projectJson = await this.getCommitProjectJson(blobId);
          }
          if (projectJson?.length > 0 && Array.isArray(mergeChangesResponse.data.changes)) {
            //Loop Changes
            for (const change of mergeChangesResponse.data.changes as PackageChange[]) {
              //Loop Package List
              for (const pck of projectJson) {
                let isInOldPath = false;
                let isInNewPath = false;

                if (change.old_path && pck.path && pck.versionNumber) {
                  if (change.old_path.search(pck.path.replace(/\\/g, '/')) > -1) {
                    merge.packages.set(pck.package, {
                      package: pck.package,
                      version: pck.versionNumber.replace('NEXT', '').replace('LAST', '').trim(),
                      srcChange: false,
                      releaseTag: 'package-not-created',
                      commitId: '',
                      isOnFT: false,
                      isOnSIT: false,
                      isOnPreProd: false,
                      isOnProd: false,
                      isOnEWISIT: false,
                    });
                    isInOldPath = true;
                  }
                  if (!change.old_path.startsWith('src/')) {
                    isInOldPath = true;
                  }
                }
                if (change.new_path && pck.path && pck.versionNumber) {
                  if (change.new_path.search(pck.path.replace(/\\/g, '/')) > -1) {
                    merge.packages.set(pck.package, {
                      package: pck.package,
                      version: pck.versionNumber.replace('NEXT', '').replace('LAST', '').trim(),
                      srcChange: false,
                      releaseTag: 'package-not-created',
                      commitId: '',
                      isOnFT: false,
                      isOnSIT: false,
                      isOnPreProd: false,
                      isOnProd: false,
                      isOnEWISIT: false,
                    });
                    if (change.new_path.startsWith('src/')) {
                      isInNewPath = true;
                    }
                  }
                }
                if (!isInOldPath && isInNewPath) {
                  packageMap.get(pck.package).srcChange = true;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      //currently no exception handling
    }
    return merge;
  }

  private async getPackageTags(merge: SingleMergeRequest, tagSHA: string): Promise<SingleMergeRequest> {
    for (const [key, value] of merge.packages) {
      try {
        const mergeCommitResponse = await axios({
          method: 'get',
          url: `/api/v4/projects/10309/repository/tags?search=^${key}_v`, //sorted by last commit
        });
        if (mergeCommitResponse?.status === 200 && mergeCommitResponse.data) {
          for (const tag of mergeCommitResponse.data) {
            if (tag.commit?.id === tagSHA || tag.commit?.parent_ids.includes(tagSHA)) {
              value.releaseTag = tag.name.slice(tag.name.search('_v') + 2);
              value.commitId = tag?.commit?.short_id;
              ++GitLabStatus.packageTagCounter;
            }
          }
          //second try with version number from project json
          if (value.releaseTag === 'package-not-created') {
            for (const tag of mergeCommitResponse.data) {
              if (tag.name.startsWith(`${key}_v${value.version}`)) {
                value.releaseTag = tag.name.slice(tag.name.search('_v') + 2);
                value.commitId = tag?.commit?.short_id;
                ++GitLabStatus.packageTagCounter;
                break;
              }
            }
          }

          //second try with version number =< project json version
          if (value.releaseTag === 'package-not-created') {
            for (const tag of mergeCommitResponse.data) {
              let packageIndex = tag.name.search('_v');
              let packageTag = tag.name.slice(packageIndex + 2, tag.name.lastIndexOf('.') + 1);
              if (packageTag.localeCompare(value.version, undefined, { numeric: true, sensitivity: 'base' }) > -1) {
                value.releaseTag = tag.name.slice(tag.name.search('_v') + 2);
                value.commitId = tag?.commit?.short_id;
                ++GitLabStatus.packageTagCounter;
                break;
              }
            }
          }
        }
      } catch (e) {}
    }

    return merge;
  }

  private async getPackageInfosFromOrg(merge: SingleMergeRequest, alias: string): Promise<SingleMergeRequest> {
    EONLogger.log(COLOR_TRACE(`Get package infos from org ${alias}`));
    let orgKey: string = '';
    try {
      const stateAggregator = await StateAggregator.getInstance();
      const username = stateAggregator.aliases.resolveUsername(alias); // r
      const connection = await Connection.create({
        authInfo: await AuthInfo.create({ username: username }),
      });
      const orgUrl = connection.getAuthInfoFields().instanceUrl;
      if (orgUrl.includes('eon--ft')) {
        orgKey = 'isOnFT';
      } else if (orgUrl.includes('eon--edgsit')) {
        orgKey = 'isOnSIT';
      } else if (orgUrl.includes('eon--preprod3')) {
        orgKey = 'isOnPreProd';
      } else if (orgUrl.includes('eon.my.salesforce')) {
        orgKey = 'isOnProd';
      } else if (orgUrl.includes('eon-ewi--ewisit')) {
        orgKey = 'isOnEWISIT';
      } else {
        throw new SfError(`Error. Found no instance salesforce url for alias ${alias}`);
      }
      const packageList = await connection.query<SfpowerscriptsArtifact2>(
        `Select Id,Name,Version__c From SfpowerscriptsArtifact2__c`
      );
      for (const [key, value] of merge.packages) {
        value[orgKey] = false;
        if (packageList?.records) {
          for (const pck of packageList.records) {
            if (pck.Name === key) {
              let packageIndex = value.releaseTag.search('_v');
              if (
                pck.Version__c.localeCompare(value.releaseTag.slice(packageIndex + 1), undefined, {
                  numeric: true,
                  sensitivity: 'base',
                }) > -1
              ) {
                value[orgKey] = true;
                ++GitLabStatus.deploymentCounter[orgKey];
              }
            }
          }
        }
        if (key === 'src-core-crm' || key === 'force-app' || key === 'src-settings' || key === 'src-temp') {
          value[orgKey] = true;
          ++GitLabStatus.deploymentCounter[orgKey];
        }
        //check subscriber package list

        //end check subscriber list
      }
    } catch (e) {
      throw new SfError(`Error. Cannot get a connection to org for alias ${alias}`);
    }
    return merge;
  }

  private async getLastJobIds(): Promise<Map<string, JobDetails>> {
    const jobs = new Map<string, JobDetails>();
    try {
      for (let i = 1; i < 10; i++) {
        const gitLabResponse = await axios({
          method: 'get',
          url: `/api/v4/projects/10309/jobs?&scope[]=failed&scope[]=success&page=${i}`,
        });
        if (gitLabResponse.status === 200 && gitLabResponse.data) {
          for (const job of gitLabResponse.data) {
            if (job.name === 'Install to EDG-FT' && !jobs.get('Install to EDG-FT')) {
              jobs.set(job.name, {
                name: job.name,
                jobId: job.id,
                status: job.status,
                webUrl: job.web_url,
                packages: [],
                alias: 'FT Deployment Pipeline',
              });
            } else if (job.name === 'EDG-FT-Deploy' && !jobs.get('EDG-FT-Deploy')) {
              jobs.set(job.name, {
                name: job.name,
                jobId: job.id,
                status: job.status,
                webUrl: job.web_url,
                packages: [],
                alias: 'FT Deployment Manual',
              });
            } else if (job.name === 'EDG-SIT-Deploy' && !jobs.get('EDG-SIT-Deploy')) {
              jobs.set(job.name, {
                name: job.name,
                jobId: job.id,
                status: job.status,
                webUrl: job.web_url,
                packages: [],
                alias: 'EDG SIT Deployment Pipeline',
              });
            } else if (job.name === 'EWI-SIT-Deploy' && !jobs.get('EWI-SIT-Deploy')) {
              jobs.set(job.name, {
                name: job.name,
                jobId: job.id,
                status: job.status,
                webUrl: job.web_url,
                packages: [],
                alias: 'EWI SIT Deployment Pipeline',
              });
            } else if (job.name === 'build new packages' && !jobs.get('build new packages')) {
              jobs.set(job.name, {
                name: job.name,
                jobId: job.id,
                status: job.status,
                webUrl: job.web_url,
                packages: [],
                alias: 'Package Build Job',
              });
            }
          }
        }
      }
    } catch (e) {
      //no todo
    }
    return jobs;
  }

  private async getJobMetrics(id: number): Promise<string[]> {
    const pckList: string[] = [];
    try {
      const gitLabResponse = await axios({
        method: 'get',
        url: `/api/v4/projects/10309/jobs/${id}/artifacts/.sfpowerscripts/logs/metrics.log`,
      });
      if (gitLabResponse.status === 200 && gitLabResponse.data) {
        const formatedResp = gitLabResponse.data.split('\n');
        if (Array.isArray(formatedResp)) {
          formatedResp.pop();
          for (const line of formatedResp) {
            const parsedLine = JSON.parse(line);
            if (
              parsedLine?.metric === 'sfpowerscripts.build.failed.packages' ||
              parsedLine?.metric === 'sfpowerscripts.package.installation.failure'
            ) {
              pckList.push(parsedLine.tags.package);
            }
          }
        }
      }
    } catch (e) {
      //no todo
    }
    return pckList;
  }
}
