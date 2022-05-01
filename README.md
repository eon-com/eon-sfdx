# SFDX EON Plugin

Salesforce DX (SFDX) commands to support salesforce developments &amp; deployments

[![Version](https://img.shields.io/npm/v/@eon-com/eon-sfdx.svg)](https://npmjs.org/package/eon-sfdx)
[![Downloads/week](https://img.shields.io/npm/dw/@eon-com/eon-sfdx.svg)](https://npmjs.org/package/eon-sfdx)
[![License](https://img.shields.io/npm/l/@eon-com/eon-sfdx.svg)](https://github.com/eon-com/eon-sfdx/blob/master/package.json)

<!-- toc -->
* [SFDX EON Plugin](#sfdx-eon-plugin)
<!-- tocstop -->
<!-- install -->
<!-- usage -->
```sh-session
$ npm install -g @eon-com/eon-sfdx
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
@eon-com/eon-sfdx/0.0.1-beta.3 darwin-x64 node-v16.6.1
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->

<!-- commands -->
* [`sfdx eon:commit [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eoncommit---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:package:deploy [-p <string>] [-i] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonpackagedeploy--p-string--i--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:update:customlabel -n <string> -c <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonupdatecustomlabel--n-string--c-string--a-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:update:externaldatasource -n <string> [-e <string>] [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonupdateexternaldatasource--n-string--e-string--a-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:update:metadata -d <string> -p <string> -v <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonupdatemetadata--d-string--p-string--v-string--a-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:update:namedcredential -n <string> [-e <string>] [-p <string>] [-s <string>] [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonupdatenamedcredential--n-string--e-string--p-string--s-string--a-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:upsert:customsetting -n <string> -k <string> -v <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonupsertcustomsetting--n-string--k-string--v-string--a-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx eon:commit [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Commit changes to a package while maintaining versions

```
USAGE
  $ sfdx eon:commit [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx eon:commit
```

_See code: [src/commands/eon/commit.ts](https://github.com/eon-com/eon-sfdx/blob/v0.0.1-beta.3/src/commands/eon/commit.ts)_

## `sfdx eon:package:deploy [-p <string>] [-i] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

deploy package source files by package name

```
USAGE
  $ sfdx eon:package:deploy [-p <string>] [-i] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -i, --includedependencies                                                         set true to deploy dependencies
  -p, --packagename=packagename                                                     Name of Package to be deployed

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:deploy:package --packagename api-gateway --includedependencies
  sfdx eon:deploy:package --packagename core-datamodel
```

_See code: [src/commands/eon/package/deploy.ts](https://github.com/eon-com/eon-sfdx/blob/v0.0.1-beta.3/src/commands/eon/package/deploy.ts)_

## `sfdx eon:update:customlabel -n <string> -c <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Update Custom Label Settings

```
USAGE
  $ sfdx eon:update:customlabel -n <string> -c <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] 
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --alias=alias                                                                 Environment Alias matching the
                                                                                    target Org and the settings file

  -c, --value=value                                                                 (required) Optional Flag For Value
                                                                                    Update

  -n, --name=name                                                                   (required) Required Developer Name
                                                                                    To Select Correct Data For Update

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:upsert:customlabel --name my_label --value 'settings:SomeKeyInYaml' --alias staging
  sfdx eon:upsert:customlabel --targetusername myOrg@example.com --name my_label --value xxx --alias staging
  sfdx eon:upsert:customlabel --targetusername myOrg@example.com -n my_label -v XXX
```

_See code: [src/commands/eon/update/customlabel.ts](https://github.com/eon-com/eon-sfdx/blob/v0.0.1-beta.3/src/commands/eon/update/customlabel.ts)_

## `sfdx eon:update:externaldatasource -n <string> [-e <string>] [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Update dataSource

```
USAGE
  $ sfdx eon:update:externaldatasource -n <string> [-e <string>] [-a <string>] [-u <string>] [--apiversion <string>] 
  [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --alias=alias                                                                 Environment Alias matching the
                                                                                    target Org and the settings file

  -e, --endpoint=endpoint                                                           Optional Flag For Endpoint Update

  -n, --name=name                                                                   (required) Required Developer Name
                                                                                    To Select Correct Data For Update

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:update:datasource --name my_datasource --endpoint 'settings:dataSourceURL' --alias $ALIAS
  sfdx eon:update:datasource --targetusername myOrg@example.com --name my_datasource --endpoint xxx --alias staging
  sfdx eon:update:datasource --targetusername myOrg@example.com -n my_source -e https://test.com
```

_See code: [src/commands/eon/update/externaldatasource.ts](https://github.com/eon-com/eon-sfdx/blob/v0.0.1-beta.3/src/commands/eon/update/externaldatasource.ts)_

## `sfdx eon:update:metadata -d <string> -p <string> -v <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Replace placeholder in XML files

```
USAGE
  $ sfdx eon:update:metadata -d <string> -p <string> -v <string> [-a <string>] [-u <string>] [--apiversion <string>] 
  [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --alias=alias                                                                 Environment Alias matching the
                                                                                    target Org and the settings file

  -d, --directory=directory                                                         (required) Directory to file or
                                                                                    folder containing the file(s) to be
                                                                                    changed

  -p, --placeholder=placeholder                                                     (required) Name of the placeholder
                                                                                    inside the XML that should be
                                                                                    replaced

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -v, --value=value                                                                 (required) value used to replace the
                                                                                    placeholder

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:update:metadata --directory 'src/packagepath' --placeholder 'placeholdername' --value 'settings:runningUser' 
  --alias $ALIAS 
  sfdx eon:update:metadata --directory 'src/packagepath' --placeholder 'defaultRunningUserReport' --value 
  'test@test.com.staging' --alias $ALIAS
```

_See code: [src/commands/eon/update/metadata.ts](https://github.com/eon-com/eon-sfdx/blob/v0.0.1-beta.3/src/commands/eon/update/metadata.ts)_

## `sfdx eon:update:namedcredential -n <string> [-e <string>] [-p <string>] [-s <string>] [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Update NamedCredential

```
USAGE
  $ sfdx eon:update:namedcredential -n <string> [-e <string>] [-p <string>] [-s <string>] [-a <string>] [-u <string>] 
  [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --alias=alias                                                                 Environment Alias matching the
                                                                                    target Org and the settings file

  -e, --endpoint=endpoint                                                           Optional Flag For Update Endpoint

  -n, --name=name                                                                   (required) Required Developer Name
                                                                                    To Select Correct Data For Update

  -p, --password=password                                                           Optional Flag For Password Update

  -s, --username=username                                                           Optional Flag For Update Username

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:update:namedcredentials --name Mulesoft --username 'settings:mulesoftUser' --password 
  'settings:mulesoftPassword --endpoint 'settings:mulesoftEndpoint' --alias=$ALIAS
  sfdx eon:update:namedcredentials --targetusername myOrg@example.com --name xx_mule --password xxx --alias staging
  sfdx eon:update:namedcredentials --targetusername myOrg@example.com -n xx_base -e https://test.com
```

_See code: [src/commands/eon/update/namedcredential.ts](https://github.com/eon-com/eon-sfdx/blob/v0.0.1-beta.3/src/commands/eon/update/namedcredential.ts)_

## `sfdx eon:upsert:customsetting -n <string> -k <string> -v <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Update Custom Settings

```
USAGE
  $ sfdx eon:upsert:customsetting -n <string> -k <string> -v <string> [-a <string>] [-u <string>] [--apiversion 
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --alias=alias                                                                 Environment Alias matching the
                                                                                    target Org and the settings file

  -k, --key=key                                                                     (required) Required Flag For Custom
                                                                                    Setting Field Key

  -n, --name=name                                                                   (required) Required Developer Name
                                                                                    To Select Correct Data For Update

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -v, --value=value                                                                 (required) Optional Flag For Custom
                                                                                    Setting Value Update

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:update:customsetting --targetusername myOrg@example.com --name my_object__c --key my_column --value my_value 
  --alias staging
  sfdx eon:update:customsetting --targetusername myOrg@example.com -n my_object__c -k XXX -v xxx
```

_See code: [src/commands/eon/upsert/customsetting.ts](https://github.com/eon-com/eon-sfdx/blob/v0.0.1-beta.3/src/commands/eon/upsert/customsetting.ts)_
<!-- commandsstop -->
<!-- debugging-your-plugin -->
