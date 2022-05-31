export interface PackageTree {
    packagename?: string;
    path?: string;
    managed?: boolean;
    dependency?: PackageTree[];
  }
  
  export interface Status {
    hasError?: boolean;
    message?: string;
  }
  
  export interface DeployError {
    Name?: string;
    Type?: string;
    Status?: string;
    Message?: string;
  }

  export interface PackageMap {
    name?: string
    packageTree?: PackageTree
  }