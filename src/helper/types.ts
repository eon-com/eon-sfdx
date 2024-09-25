import { NamedPackageDir } from '@salesforce/core';
import { PackagePackageDir, PackageDirDependency } from '@salesforce/schemas';
import { QueryResult } from 'jsforce';

export declare type DateString = string & {
  __DateBrand: never;
};
export declare type BlobString = string & {
  __BlobBrand: never;
};
export declare type Address = {
  city: string | null;
  country: string | null;
  geocodeAccuracy: string | null;
  latitude: number | null;
  longitude: number | null;
  postalCode: string | null;
  state: string | null;
  street: string | null;
};

export declare type SObjectFieldType = number | boolean | DateString | BlobString | string | Address;

export interface SObjectDefinition<N extends string = string> {
  Name: N;
  Fields: {
      [name: string]: SObjectFieldType | null;
  };
  ParentReferences: {
      [name: string]: SObjectDefinition | null;
  };
  ChildRelationships: {
      [name: string]: SObjectDefinition;
  };
}

export enum ComponentStatus {
  Created = 'Created',
  Changed = 'Changed',
  Unchanged = 'Unchanged',
  Deleted = 'Deleted',
  Failed = 'Failed',
}

interface FileResponseBase {
  fullName: string;
  type: string;
  filePath?: string;
}

interface FileResponseSuccess extends FileResponseBase {
  state: Exclude<ComponentStatus, ComponentStatus.Failed>;
}

interface FileResponseFailure extends FileResponseBase {
  state: ComponentStatus.Failed;
  lineNumber?: number;
  columnNumber?: number;
  error: string;
  problemType: 'Warning' | 'Error';
}

export interface NamedCredential {
  Id?: string;
  IsDeleted?: boolean;
  DeveloperName?: string;
  Language?: string;
  MasterLabel?: string;
  NamespacePrefix?: string;
  ManageableState?: string;
  CreatedDate?: string;
  CreatedById?: string;
  LastModifiedDate?: string;
  LastModifiedById?: string;
  SystemModstamp?: string;
  Endpoint?: string;
  PrincipalType?: string;
  Protocol?: string;
  Username?: string;
  Password?: string;
  Metadata?: NamedCredentialMeta;
  [x: string | number | symbol]: unknown;
}
export interface NamedCredentialMeta {
  label?: string;
  endpoint?: string;

  [x: string | number | symbol]: unknown;
}

export interface ExternalDataSource {
  [x: string | number | symbol]: unknown;
  Id?: string;
  DeveloperName?: string;
  Language?: string;
  MasterLabel?: string;
  Endpoint?: string;
  Metadata?: ExternalDataSourceMeta;
}
export interface ExternalDataSourceMeta {
  isWritable?: boolean;
  label?: string;
  protocol?: string;
  principalType?: string;
  endpoint?: string;
  type?: string;
  [x: string | number | symbol]: unknown;
}
export interface CustomMetadata  {
  Id?: string;
  DeveloperName?: string;
  MasterLabel?: string;
  Language?: string;
  NamespacePrefix?: string;
  Label?: string;
  QualifiedApiName?: string;
  values?: CustomMetadataValue[];
  [x: string | number | symbol]: unknown;
}
export interface CustomMetadataValue {
  field?: string;
  value?: string;
}
export interface CustomLabel {
  Id?: string;
  Name?: string;
  MasterLabel?: string;
  Value?: string;
  IsProtected?: string;
  Category?: string;
  Language?: string;
  NamespacePrefix?: string;
  ManageableState?: string;
  CreatedDate?: string;
  CreatedById?: string;
  LastModifiedDate?: string;
  LastModifiedById?: string;
  SystemModstamp?: string;
  IsDeleted?: boolean;
  [x: string | number | symbol]: unknown;
}

export interface ProjectJsonParsed {
  packageDirectories: PackageDirParsed[];
  [x: string | number | symbol]: unknown;
}
export type PackageDirParsed = PackagePackageDir & {
  name?: string;
  fullPath?: string;
  ignoreOnStage?: string[];
}
export type FileResponse = FileResponseSuccess | FileResponseFailure;

export interface PluginSettings {
  workItemFilter?: string;
  enableReadmeGeneration?: boolean;
  sfdxContentSubPath?: string;
  workItemUrl?: string;
  environmentConfigurationFilePath?: string;
  awsRegion?: string;
  awsSecretFormat?: string;
  metadataPlaceholderFormat?: string;
}

export interface PackagePermissionset {
  label?: string;
  description?: string;
  [x: string | number | symbol]: unknown;
}

export interface SfdxPermissionSet {
  PermissionSet: PackagePermissionset;
}
export interface readme {
  body?: string;
  path?: string;
}

export interface environmentConfigFile {
  settings: environmentConfigSettings;
  documentation: stringProperties;
}

export interface environmentConfigSettings {
  [x: string]: stringProperties;
}
export interface stringProperties {
  [x: string]: string;
}
export interface featureSettingsConfigFile {
  settings?: featureSettings;
  documentation?: stringProperties;
}
export interface featureSettings {
  [x: string]: featureSetting;
}
export interface featureSetting {
  [x: string]: featureSettingField;
}
export interface featureSettingField {
  [x: string]: boolean;
}
export interface PackageTree {
  packagename?: string;
  version?: string;
  path?: string;
  managed?: boolean;
  dependency?: PackageTree[];
}

export interface PackageInfo {
  message?: string;
  path?: string;
  postDeploymentScript?: string;
  preDeploymentScript?: string;
}

export interface Status {
  hasError?: boolean;
  message?: string;
}

export interface DeployError {
  LineNumber?: string;
  Name?: string;
  Type?: string;
  Status?: string;
  Message?: string;
}

export interface ApexClass {
  Id?: string;
  Name?: string;
  Body?: string;
}

export interface ApexTestQueueItem {
  Id?: string;
  ApexClass?: ApexClass;
  ApexClassId?: string;
  Status?: string;
  ExtendedStatus?: string;
  ParentJobId?: string;
  TestRunResultId?: string;
}

export interface ApexCodeCoverageAggregate {
  ApexClassOrTrigger?: ApexClassOrTrigger;
  NumLinesCovered?: number;
  NumLinesUncovered?: number;
}

export interface ApexTestResult {
  ApexClass?: ApexClass;
  Outcome?: string;
  MethodName?: string;
  Message?: string;
}

export interface ApexTestQueueResult {
  QueuedList: string[];
  CompletedList: string[];
  FailedList: string[];
  ProcessingList: string[];
  OtherList: string[];
}

export type NamedPackageDirLarge = PackagePackageDir & {
  ignoreOnStage?: string[];
  fullPath?: string;
  postDeploymentScript?: string;
  preDeploymentScript?: string;
  type?: string;
}

export interface CustomRecordResult {
  id?: string;
  success?: boolean;
  errors?: string[];
  warnings?: string[];
  infos?: string[];
}

export interface RecordIds {
  attributes: [Object];
  Id?: string;
}

export interface ApexClassOrTrigger {
  Name?: string;
}

export interface ApexTestclassCheck {
  Id?: string;
  isTest?: boolean;
}

export interface SourcePackageComps {
  comps?: string[];
  apexClassNames?: string[];
  apexTestclassNames?: string[];
}

export interface CodeCoverageWarnings {
  id: string;
  message: string;
  name?: string;
  namespace: {}
}

export interface SingleMergeRequest {
  id: number;
  packages: Map<string, GitPackageInfos>;
  labels: string;
  commitSHA: string;
  author: string;
  username: string;
  title: string;
  web_url: string;
  createdat: string;
  description: string;
  merged_by: string;
  reviewer: string;
  isBuild: boolean;
  isOnFT: boolean;
  isOnSIT: boolean;
  isOnPreProd: boolean;
  isOnProd: boolean;
  isOnEWISIT: boolean;
  mergeStatus: string;
  milestone: string;
}

export interface GitPackageInfos {
  package: string;
  version: string;
  srcChange: boolean;
  releaseTag: string;
  commitId: string;
  isOnFT: boolean;
  isOnSIT: boolean;
  isOnPreProd: boolean;
  isOnProd: boolean;
  isOnEWISIT: boolean;
}

export interface PackageChange{
  old_path?: string;
  new_path?: string;
}

export interface SfpowerscriptsArtifact2{
  Id?: string;
  Name?: string;
  Version__c?: string;
  CommitId__c?: string;
}

export interface JobDetails{
  name: string;
  alias: string;
  jobId: number;
  status: string;
  webUrl: string;
  packages: string[];
}

export interface UnassignPackage {
  Package: string;
  Id?: string;
  UnassignKeys: UnassignKeys[];
}

export interface UnassignKeys {
  Type: string;
  Component: string;
  ParentObject?: string
  IsRemoved?: boolean;
  Message?: string
}

export interface ProjectValidationOutput {
  Process: string;
  Package: string;
  Message: string;
}

export type MetadataPackageVersions = {
  Id: string;
  MajorVersion: string;
  MinorVersion: string;
  PatchVersion: string;
  BuildNumber: string;
  SystemModstamp: Date;
}

export type MetadataPackage = {
  SObjects: {
    [name: string]: SObjectDefinition;
  };
  Name: string;
  MetadataPackageVersions: QueryResult<MetadataPackageVersions>;
}

export type MetadataPackageVersion = {
  id: string;
  name: string;
  version: string;
  modifiedDate: Date;
}

export type Dependencies = {
  ids?: SubscriberPackageVersionId[];
};

export type SubscriberPackageVersion = {
  Dependencies: Dependencies;
}

export type SubscriberPackageVersionId = {
  subscriberPackageVersionId: string;
};

export type BranchCreateResponse = {
  commit: string;
  version: string;
};

export type Flow = {
  Id: string
  VersionNumber: number
  Status: string
  MasterLabel: string
}

export type AggregateResult = {
  expr0: number
  MasterLabel: string
}

export type PackageCharacter = {
  hasManagedPckDeps: boolean
  reason: string
  versionNumber: string
  type: string
  packageDeps: PackageDirDependency[]
  path: string
  hasError: boolean
  errorMessage: string
  targetTree: NamedPackageDirLarge
}

export type Package2Version = {
  Id: string
  SubscriberPackageVersionId: string
}









