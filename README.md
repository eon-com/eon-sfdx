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
@eon-com/eon-sfdx/1.6.0 darwin-x64 node-v16.6.1
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->

<!-- commands -->
* [`sfdx eon:activate:bot -v <number> -d <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonactivatebot--v-number--d-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:beta:gitlab:merge:status -t <string> -m <integer> -a <string> -u <string> [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonbetagitlabmergestatus--t-string--m-integer--a-string--u-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:commit [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eoncommit---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:deactivate:bot -d <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eondeactivatebot--d-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:org:features:update -f <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonorgfeaturesupdate--f-string--a-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:org:gettype [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonorggettype--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:package:deploy [-p <string>] [-i] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonpackagedeploy--p-string--i--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:package:devkit:apply -p <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonpackagedevkitapply--p-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:package:devkit:create -p <string> [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonpackagedevkitcreate--p-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:package:devkit:testdata:retrieve -p <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonpackagedevkittestdataretrieve--p-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:package:validate [-t <string>] [-s <string>] [-d] [-p <string>] [-g <string>] [-a <string>] [-o] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonpackagevalidate--t-string--s-string--d--p-string--g-string--a-string--o--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:package:validate:source [-t <string>] [-s <string>] [-d] [-p <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonpackagevalidatesource--t-string--s-string--d--p-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:project:validate [-s <string>] [-v -t <string>] [-m] [-o] [-d] [-p <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonprojectvalidate--s-string--v--t-string--m--o--d--p-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:unassign:packagemember [-p <string> -t <string> -c <string>] [-f <string>] [-o <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonunassignpackagemember--p-string--t-string--c-string--f-string--o-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:update:customlabel -n <string> -c <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonupdatecustomlabel--n-string--c-string--a-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:update:externaldatasource -n <string> [-e <string>] [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonupdateexternaldatasource--n-string--e-string--a-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:update:metadata -d <string> -p <string> -v <string> [-k <string>] [-a <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonupdatemetadata--d-string--p-string--v-string--k-string--a-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:update:namedcredential -n <string> [-e <string>] [-p <string>] [-s <string>] [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonupdatenamedcredential--n-string--e-string--p-string--s-string--a-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx eon:upsert:customsetting -n <string> -k <string> -v <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-eonupsertcustomsetting--n-string--k-string--v-string--a-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx eon:activate:bot -v <number> -d <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Activate a bot after deployment is finished

```
USAGE
  $ sfdx eon:activate:bot -v <number> -d <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --developername=developername                                                 (required) Bot developer name to
                                                                                    activate

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -v, --version=version                                                             (required) Bot Version to activate

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx eon:activate:bot --version 15 --developername chat
```

_See code: [src/commands/eon/activate/bot.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/activate/bot.ts)_

## `sfdx eon:beta:gitlab:merge:status -t <string> -m <integer> -a <string> -u <string> [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

This command fetch the current deployment status for a merge request

```
USAGE
  $ sfdx eon:beta:gitlab:merge:status -t <string> -m <integer> -a <string> -u <string> [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --aliases=aliases                                                             (required) Orgs Alias for deplyoment
                                                                                    status

  -m, --mergeid=mergeid                                                             (required) Merge Request Id

  -t, --token=token                                                                 (required) User Token from GitLab
                                                                                    Repository

  -u, --url=url                                                                     (required) GitLab API Url

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:gitlab:merge:status --token gitlabxxxxx --url gitlab.com --aliases dev,ft,sit --mergeid 1523
  sfdx eon:gitlab:merge:status -t gitlabxxxxx -u gitlab.com -a dev,ft,sit -m 1523
```

_See code: [src/commands/eon/beta/gitlab/merge/status.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/beta/gitlab/merge/status.ts)_

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

_See code: [src/commands/eon/commit.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/commit.ts)_

## `sfdx eon:deactivate:bot -d <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Search active version and deactivate the bot before deployment

```
USAGE
  $ sfdx eon:deactivate:bot -d <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --developername=developername                                                 (required) Bot developer name to
                                                                                    deactivate

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx eon:deactivate:bot --developername chat
```

_See code: [src/commands/eon/deactivate/bot.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/deactivate/bot.ts)_

## `sfdx eon:org:features:update -f <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Updates all custom settings for features with org specific values

```
USAGE
  $ sfdx eon:org:features:update -f <string> [-a <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --alias=alias                                                                 Environment Alias matching the
                                                                                    target Org and the settings file

  -f, --settingsfile=settingsfile                                                   (required) Path to file that
                                                                                    contains the feature settings

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx eon:org:features:update -f feature-settings.yml -a production
```

_See code: [src/commands/eon/org/features/update.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/org/features/update.ts)_

## `sfdx eon:org:gettype [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Returns the type of the target org

```
USAGE
  $ sfdx eon:org:gettype [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx eon:org:type
```

_See code: [src/commands/eon/org/gettype.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/org/gettype.ts)_

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

_See code: [src/commands/eon/package/deploy.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/package/deploy.ts)_

## `sfdx eon:package:devkit:apply -p <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Applys scripts and testdata of a devkit to an scratch org

```
USAGE
  $ sfdx eon:package:devkit:apply -p <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -p, --package=package                                                             (required) Name of the package where
                                                                                    the devkit should be created

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:devkit:create
  sfdx eon:devkit:apply
```

_See code: [src/commands/eon/package/devkit/apply.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/package/devkit/apply.ts)_

## `sfdx eon:package:devkit:create -p <string> [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Initialize a devkit for a package

```
USAGE
  $ sfdx eon:package:devkit:create -p <string> [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -p, --package=package                                                             (required) Name of the package where
                                                                                    the devkit should be created

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:devkit:create
  sfdx eon:devkit:apply
```

_See code: [src/commands/eon/package/devkit/create.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/package/devkit/create.ts)_

## `sfdx eon:package:devkit:testdata:retrieve -p <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Applys scripts and testdata of a devkit to an scratch org

```
USAGE
  $ sfdx eon:package:devkit:testdata:retrieve -p <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -p, --package=package                                                             (required) Name of the package where
                                                                                    the devkit should be created

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:devkit:create
  sfdx eon:devkit:apply
```

_See code: [src/commands/eon/package/devkit/testdata/retrieve.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/package/devkit/testdata/retrieve.ts)_

## `sfdx eon:package:validate [-t <string>] [-s <string>] [-d] [-p <string>] [-g <string>] [-a <string>] [-o] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Validation Job to check package changes on scratch

```
USAGE
  $ sfdx eon:package:validate [-t <string>] [-s <string>] [-d] [-p <string>] [-g <string>] [-a <string>] [-o] [-u 
  <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --devhubalias=devhubalias                                                     Target dev hub alias

  -d, --deploymentscripts                                                           Flag to run pre/post deployment
                                                                                    scripts

  -g, --pooltag=pooltag                                                             Pool tag to fetch scratch orgs

  -o, --onlytests                                                                   Run validation without deployment
                                                                                    only for testclass execution

  -p, --package=package                                                             Validate one selected package

  -s, --source=source                                                               Flag for source branch

  -t, --target=target                                                               Flag for target branch

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:validate -t origin/main
  sfdx  eon:validate -t origin/main -p core
  sfdx  eon:validate -t origin/main -p core -o
  sfdx  eon:validate --target origin/main --package --onlytests
```

_See code: [src/commands/eon/package/validate.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/package/validate.ts)_

## `sfdx eon:package:validate:source [-t <string>] [-s <string>] [-d] [-p <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Validation Job to check source packages on org

```
USAGE
  $ sfdx eon:package:validate:source [-t <string>] [-s <string>] [-d] [-p <string>] [-u <string>] [--apiversion 
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --deploymentscripts                                                           Flag to run pre/post deployment
                                                                                    scripts

  -p, --package=package                                                             Validate one selected package

  -s, --source=source                                                               Flag for source branch

  -t, --target=target                                                               Flag for target branch

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:validate:source
  sfdx  eon:validate:source -p mypackage
  sfdx  eon:validate:source -p mypackage -o
  sfdx  eon:validate:source --package mypackage --onlytests
```

_See code: [src/commands/eon/package/validate/source.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/package/validate/source.ts)_

## `sfdx eon:project:validate [-s <string>] [-v -t <string>] [-m] [-o] [-d] [-p <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

This command performs static checks in the sfdx-project json file for changed packages. Optional flags are used to control which validations are to be carried out. The individual tests are described with the flags.

```
USAGE
  $ sfdx eon:project:validate [-s <string>] [-v -t <string>] [-m] [-o] [-d] [-p <string>] [-u <string>] [--apiversion 
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --depsversion
      Checks whether the dependent packages have at least the versions of the dependent packages. Default this commands
      checks only the required versions.

  -m, --missingdeps
      Checks whether all dependend packages are present in the unlocked package tree

  -o, --order
      Checks if the dependent packages are arranged in the correct order in the package tree. Furthermore, it is checked
      that the dependend packages are arranged in front of the unlocked package in the tree.

  -p, --package=package
      Validate only one selected package

  -s, --source=source
      This flag is required for the git diff check and describes the source value. The default value is HEAD

  -t, --target=target
      This flag is required for the git diff check and describes the target value. For example main branch.

  -u, --targetusername=targetusername
      username or alias for the target org; overrides default target org

  -v, --versionupdate
      Checks whether the versions of the changed packages for the merge request have been updated. The check is against
      the target flag.

  --apiversion=apiversion
      override the api version used for api requests made by this command

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

EXAMPLES
  sfdx eon:project:validate -t origin/main --versionupdate
  sfdx eon:project:validate -t --order -p core
  sfdx eon:project:validate -t origin/main --versionupdate --missingdeps --order --depsversion
  sfdx eon:project:validate -t origin/main - -v -m -o -d
```

_See code: [src/commands/eon/project/validate.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/project/validate.ts)_

## `sfdx eon:unassign:packagemember [-p <string> -t <string> -c <string>] [-f <string>] [-o <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Unassign package member from a selected package

```
USAGE
  $ sfdx eon:unassign:packagemember [-p <string> -t <string> -c <string>] [-f <string>] [-o <string>] [-u <string>] 
  [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --component=component                                                         Component name to unassign

  -f, --configfile=configfile                                                       Config file to unassign several
                                                                                    components

  -o, --parentobject=parentobject                                                   Identifier for the parent object
                                                                                    name from the component

  -p, --packagename=packagename                                                     Package to unassign a component

  -t, --type=type                                                                   Type from the component to unassign

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx eon:packagemember:unassign --packagename --type --component --configfile
```

_See code: [src/commands/eon/unassign/packagemember.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/unassign/packagemember.ts)_

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

_See code: [src/commands/eon/update/customlabel.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/update/customlabel.ts)_

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

_See code: [src/commands/eon/update/externaldatasource.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/update/externaldatasource.ts)_

## `sfdx eon:update:metadata -d <string> -p <string> -v <string> [-k <string>] [-a <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Replace placeholder in XML files

```
USAGE
  $ sfdx eon:update:metadata -d <string> -p <string> -v <string> [-k <string>] [-a <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --alias=alias                                                                 Environment Alias matching the
                                                                                    target Org and the settings file

  -d, --directory=directory                                                         (required) Directory to file or
                                                                                    folder containing the file(s) to be
                                                                                    changed

  -k, --artifactdirectory=artifactdirectory                                         Optional directory if deployed src
                                                                                    is unpacked from artifact

  -p, --placeholder=placeholder                                                     (required) Name of the placeholder
                                                                                    inside the XML that should be
                                                                                    replaced

  -v, --value=value                                                                 (required) value used to replace the
                                                                                    placeholder

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx eon:update:metadata --directory 'src/packagepath' --placeholder 'placeholdername' --value 'settings:runningUser' 
  --alias $ALIAS 
  sfdx eon:update:metadata --directory 'src/packagepath' --placeholder 'defaultRunningUserReport' --value 
  'test@test.com.staging' --alias $ALIAS
```

_See code: [src/commands/eon/update/metadata.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/update/metadata.ts)_

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

_See code: [src/commands/eon/update/namedcredential.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/update/namedcredential.ts)_

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

_See code: [src/commands/eon/upsert/customsetting.ts](https://github.com/eon-com/eon-sfdx/blob/v1.6.0/src/commands/eon/upsert/customsetting.ts)_
<!-- commandsstop -->
<!-- debugging-your-plugin -->
