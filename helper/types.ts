import { PackageDir } from '@salesforce/core';
import { MetadataInfo } from 'jsforce';

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
export interface CustomMetadata extends MetadataInfo {
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
export interface PackageDirParsed extends PackageDir {
  name?: string;
  fullPath?: string;
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

export interface PackageTree {
  packagename?: string;
  version?: string;
  path?: string;
  managed?: boolean;
  dependency?: PackageTree[];
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
