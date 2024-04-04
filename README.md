# EON Plugin

Salesforce DX (SFDX) commands to support salesforce developments &amp; deployments

[![Version](https://img.shields.io/npm/v/@eon-com/eon-sfdx.svg)](https://npmjs.org/package/eon-sfdx)
[![Downloads/week](https://img.shields.io/npm/dw/@eon-com/eon-sfdx.svg)](https://npmjs.org/package/eon-sfdx)
[![License](https://img.shields.io/npm/l/@eon-com/eon-sfdx.svg)](https://github.com/eon-com/eon-sfdx/blob/master/package.json)

<!-- toc -->
* [EON Plugin](#eon-plugin)
<!-- tocstop -->
<!-- install -->
<!-- usage -->
```sh-session
$ npm install -g @eon-com/eon-sfdx
$ eon COMMAND
running command...
$ eon (--version)
@eon-com/eon-sfdx/2.0.1-beta.1 darwin-x64 node-v20.5.1
$ eon --help [COMMAND]
USAGE
  $ eon COMMAND
...
```
<!-- usagestop -->

<!-- commands -->
* [`eon beta:gitlab:merge:status`](#eon-betagitlabmergestatus)
* [`eon changelog`](#eon-changelog)
* [`eon org:features:update`](#eon-orgfeaturesupdate)
* [`eon org:gettype`](#eon-orggettype)
* [`eon package:deploy [FILE]`](#eon-packagedeploy-file)
* [`eon package:devkit:apply`](#eon-packagedevkitapply)
* [`eon package:devkit:create`](#eon-packagedevkitcreate)
* [`eon package:devkit:testdata:retrieve`](#eon-packagedevkittestdataretrieve)
* [`eon package:validate`](#eon-packagevalidate)
* [`eon package:validate:source`](#eon-packagevalidatesource)
* [`eon project:validate`](#eon-projectvalidate)
* [`eon update:customlabel`](#eon-updatecustomlabel)
* [`eon update:externaldatasource`](#eon-updateexternaldatasource)
* [`eon update:metadata`](#eon-updatemetadata)
* [`eon update:namedcredential`](#eon-updatenamedcredential)
* [`eon upsert:customsetting`](#eon-upsertcustomsetting)

## `eon beta:gitlab:merge:status`

This command fetch the current deployment status for a merge request

```
USAGE
  $ eon beta:gitlab:merge:status -t <value> -m <value> -a <value> -u <value>

FLAGS
  -a, --aliases=<value>  (required) Orgs Alias for deplyoment status
  -m, --mergeid=<value>  (required) Merge Request Id
  -t, --token=<value>    (required) User Token from GitLab Repository
  -u, --url=<value>      (required) GitLab API Url

DESCRIPTION
  This command fetch the current deployment status for a merge request

EXAMPLES
  sfdx eon:gitlab:merge:status --token gitlabxxxxx --url gitlab.com --aliases dev,ft,sit --mergeid 1523

  sfdx eon:gitlab:merge:status -t gitlabxxxxx -u gitlab.com -a dev,ft,sit -m 1523
```

_See code: [src/commands/beta/gitlab/merge/status.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/beta/gitlab/merge/status.ts)_

## `eon changelog`

Commit changes to a package while maintaining versions

```
USAGE
  $ eon changelog [-o <value>]

FLAGS
  -o, --target-org=<value>  Login username or alias for the target org.

DESCRIPTION
  Commit changes to a package while maintaining versions

EXAMPLES
  $ eon changelog
```

_See code: [src/commands/changelog.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/changelog.ts)_

## `eon org:features:update`

Updates all custom settings for features with org specific values

```
USAGE
  $ eon org:features:update -f <value> -o <value> [-a <value>]

FLAGS
  -a, --alias=<value>         Environment Alias matching the target Org and the settings file
  -f, --settingsfile=<value>  (required) Path to file that contains the feature settings
  -o, --target-org=<value>    (required) Login username or alias for the target org.

DESCRIPTION
  Updates all custom settings for features with org specific values

EXAMPLES
  $ eon org:features:update -f feature-settings.yml -a production
```

_See code: [src/commands/org/features/update.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/org/features/update.ts)_

## `eon org:gettype`

Returns the type of the target org

```
USAGE
  $ eon org:gettype

DESCRIPTION
  Returns the type of the target org

EXAMPLES
  $ eon org:type
```

_See code: [src/commands/org/gettype.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/org/gettype.ts)_

## `eon package:deploy [FILE]`

deploy package source files by package name

```
USAGE
  $ eon package:deploy [FILE] -o <value> [-p <value>] [-i] [-s <value>]

FLAGS
  -i, --includedependencies  set true to deploy dependencies
  -o, --target-org=<value>   (required) Login username or alias for the target org.
  -p, --packagename=<value>  Name of Package to be deployed
  -s, --start=<value>        Start deployment at the point of this package name

DESCRIPTION
  deploy package source files by package name

EXAMPLES
  $ eon deploy:package --packagename api-gateway --includedependencies

  $ eon deploy:package --packagename core-datamodel --start force-di
```

_See code: [src/commands/package/deploy.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/package/deploy.ts)_

## `eon package:devkit:apply`

Applys scripts and testdata of a devkit to an scratch org

```
USAGE
  $ eon package:devkit:apply -p <value> -o <value>

FLAGS
  -o, --target-org=<value>  (required) Login username or alias for the target org.
  -p, --package=<value>     (required) Name of the package where the devkit should be created

DESCRIPTION
  Applys scripts and testdata of a devkit to an scratch org

EXAMPLES
  $ eon devkit:create

  sfdx eon:devkit:apply
```

_See code: [src/commands/package/devkit/apply.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/package/devkit/apply.ts)_

## `eon package:devkit:create`

Initialize a devkit for a package

```
USAGE
  $ eon package:devkit:create -p <value> -o <value>

FLAGS
  -o, --target-org=<value>  (required) Login username or alias for the target org.
  -p, --package=<value>     (required) Name of the package where the devkit should be created

DESCRIPTION
  Initialize a devkit for a package

EXAMPLES
  $ eon devkit:create

  sfdx eon:devkit:apply
```

_See code: [src/commands/package/devkit/create.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/package/devkit/create.ts)_

## `eon package:devkit:testdata:retrieve`

Applys scripts and testdata of a devkit to an scratch org

```
USAGE
  $ eon package:devkit:testdata:retrieve -p <value> -o <value>

FLAGS
  -o, --target-org=<value>  (required) Login username or alias for the target org.
  -p, --package=<value>     (required) Name of the package where the devkit should be created

DESCRIPTION
  Applys scripts and testdata of a devkit to an scratch org

EXAMPLES
  $ eon devkit:create

  sfdx eon:devkit:apply
```

_See code: [src/commands/package/devkit/testdata/retrieve.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/package/devkit/testdata/retrieve.ts)_

## `eon package:validate`

Validation Job to check package changes on scratch

```
USAGE
  $ eon package:validate --targetusername <value> [-t <value>] [-s <value>] [-d] [-p <value>] [-g <value>] [-a
    <value>] [-o]

FLAGS
  -a, --devhubalias=<value>     Target dev hub alias
  -d, --deploymentscripts       Flag to run pre/post deployment scripts
  -g, --pooltag=<value>         Pool tag to fetch scratch orgs
  -o, --onlytests               Run validation without deployment only for testclass execution
  -p, --package=<value>         Validate one selected package
  -s, --source=<value>          Flag for source branch
  -t, --target=<value>          Flag for target branch
      --targetusername=<value>  (required) Login username or alias for the target org.

DESCRIPTION
  Validation Job to check package changes on scratch

EXAMPLES
  sfdx eon:validate -t origin/main

  sfdx  eon:validate -t origin/main -p core

  sfdx  eon:validate -t origin/main -p core -o

  sfdx  eon:validate --target origin/main --package --onlytests
```

_See code: [src/commands/package/validate.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/package/validate.ts)_

## `eon package:validate:source`

Validation Job to check source packages on org

```
USAGE
  $ eon package:validate:source -o <value> [-t <value>] [-s <value>] [-d] [-p <value>]

FLAGS
  -d, --deploymentscripts   Flag to run pre/post deployment scripts
  -o, --target-org=<value>  (required) Login username or alias for the target org.
  -p, --package=<value>     Validate one selected package
  -s, --source=<value>      Flag for source branch
  -t, --target=<value>      Flag for target branch

DESCRIPTION
  Validation Job to check source packages on org

EXAMPLES
  $ eon validate:source

  $ eon validate:source -p mypackage

  $ eon validate:source -p mypackage -o

  $ eon validate:source --package mypackage --onlytests
```

_See code: [src/commands/package/validate/source.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/package/validate/source.ts)_

## `eon project:validate`

This command performs static checks in the sfdx-project json file for changed packages. Optional flags are used to control which validations are to be carried out. The individual tests are described with the flags.

```
USAGE
  $ eon project:validate -v <value> [-t <value>] [-s <value>] [-v] [-m] [-o] [-d] [-p <value>] [-a] [-c]

FLAGS
  -a, --all                           Runs all checks
  -c, --change                        Change project json file after validations
  -d, --depsversion                   Checks whether the dependent packages have at least the versions of the dependent
                                      packages. Default this commands checks only the required versions.
  -m, --missingdeps                   Checks whether all dependend packages are present in the unlocked package tree
  -o, --order                         Checks if the dependent packages are arranged in the correct order in the package
                                      tree. Furthermore, it is checked that the dependend packages are arranged in front
                                      of the unlocked package in the tree.
  -p, --package=<value>               Validate only one selected package
  -s, --source=<value>                This flag is required for the git diff check and describes the source value. The
                                      default value is HEAD
  -t, --target=<value>                [default: origin/main] This flag is required for the git diff check and describes
                                      the target value. The default value is origin/main
  -v, --targetdevhubusername=<value>  (required) Login username or alias for the devhub org.
  -v, --versionupdate                 Checks whether the versions of the changed packages for the merge request have
                                      been updated. The check is against the target flag.

DESCRIPTION
  This command performs static checks in the sfdx-project json file for changed packages. Optional flags are used to
  control which validations are to be carried out. The individual tests are described with the flags.

EXAMPLES
  $ eon project:validate -t origin/main --versionupdate

  $ eon project:validate -t --order -p core

  $ eon project:validate -t origin/main --versionupdate --missingdeps --order --depsversion

  $ eon project:validate -t origin/main - -v -m -o -d

  $ eon project:validate --all
```

_See code: [src/commands/project/validate.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/project/validate.ts)_

## `eon update:customlabel`

Update Custom Label Settings

```
USAGE
  $ eon update:customlabel -n <value> -c <value> -o <value> [-a <value>]

FLAGS
  -a, --alias=<value>       Environment Alias matching the target Org and the settings file
  -c, --value=<value>       (required) Optional Flag For Value Update
  -n, --name=<value>        (required) Required Developer Name To Select Correct Data For Update
  -o, --target-org=<value>  (required) Login username or alias for the target org.

DESCRIPTION
  Update Custom Label Settings

EXAMPLES
  sfdx eon:upsert:customlabel --name my_label --value 'settings:SomeKeyInYaml' --alias staging

  sfdx eon:upsert:customlabel --targetusername myOrg@example.com --name my_label --value xxx --alias staging

  sfdx eon:upsert:customlabel --targetusername myOrg@example.com -n my_label -v XXX
```

_See code: [src/commands/update/customlabel.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/update/customlabel.ts)_

## `eon update:externaldatasource`

Update dataSource

```
USAGE
  $ eon update:externaldatasource -n <value> -o <value> [-e <value>] [-a <value>]

FLAGS
  -a, --alias=<value>       Environment Alias matching the target Org and the settings file
  -e, --endpoint=<value>    Optional Flag For Endpoint Update
  -n, --name=<value>        (required) Required Developer Name To Select Correct Data For Update
  -o, --target-org=<value>  (required) Login username or alias for the target org.

DESCRIPTION
  Update dataSource

EXAMPLES
  sfdx eon:update:datasource --name my_datasource --endpoint 'settings:dataSourceURL' --alias $ALIAS

  sfdx eon:update:datasource --targetusername myOrg@example.com --name my_datasource --endpoint xxx --alias staging

  sfdx eon:update:datasource --targetusername myOrg@example.com -n my_source -e https://test.com
```

_See code: [src/commands/update/externaldatasource.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/update/externaldatasource.ts)_

## `eon update:metadata`

Replace placeholder in XML files

```
USAGE
  $ eon update:metadata -d <value> -p <value> -v <value> -o <value> [-k <value>] [-a <value>]

FLAGS
  -a, --alias=<value>              Environment Alias matching the target Org and the settings file
  -d, --directory=<value>          (required) Directory to file or folder containing the file(s) to be changed
  -k, --artifactdirectory=<value>  Optional directory if deployed src is unpacked from artifact
  -o, --target-org=<value>         (required) Login username or alias for the target org.
  -p, --placeholder=<value>        (required) Name of the placeholder inside the XML that should be replaced
  -v, --value=<value>              (required) value used to replace the placeholder

DESCRIPTION
  Replace placeholder in XML files

EXAMPLES
  sfdx eon:update:metadata --directory 'src/packagepath' --placeholder 'placeholdername' --value 'settings:runningUser' --alias $ALIAS 

  sfdx eon:update:metadata --directory 'src/packagepath' --placeholder 'defaultRunningUserReport' --value 'test@test.com.staging' --alias $ALIAS
```

_See code: [src/commands/update/metadata.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/update/metadata.ts)_

## `eon update:namedcredential`

Update NamedCredential

```
USAGE
  $ eon update:namedcredential -n <value> -o <value> [-e <value>] [-p <value>] [-s <value>] [-a <value>]

FLAGS
  -a, --alias=<value>       Environment Alias matching the target Org and the settings file
  -e, --endpoint=<value>    Optional Flag For Update Endpoint
  -n, --name=<value>        (required) Required Developer Name To Select Correct Data For Update
  -o, --target-org=<value>  (required) Login username or alias for the target org.
  -p, --password=<value>    Optional Flag For Password Update
  -s, --username=<value>    Optional Flag For Update Username

DESCRIPTION
  Update NamedCredential

EXAMPLES
  sfdx eon:update:namedcredentials --name Mulesoft --username 'settings:mulesoftUser' --password 'settings:mulesoftPassword --endpoint 'settings:mulesoftEndpoint' --alias=$ALIAS

  sfdx eon:update:namedcredentials --targetusername myOrg@example.com --name xx_mule --password xxx --alias staging

  sfdx eon:update:namedcredentials --targetusername myOrg@example.com -n xx_base -e https://test.com
```

_See code: [src/commands/update/namedcredential.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/update/namedcredential.ts)_

## `eon upsert:customsetting`

Update Custom Settings

```
USAGE
  $ eon upsert:customsetting -n <value> -k <value> -v <value> -o <value> [-a <value>]

FLAGS
  -a, --alias=<value>       Environment Alias matching the target Org and the settings file
  -k, --key=<value>         (required) Required Flag For Custom Setting Field Key
  -n, --name=<value>        (required) Required Developer Name To Select Correct Data For Update
  -o, --target-org=<value>  (required) Login username or alias for the target org.
  -v, --value=<value>       (required) Optional Flag For Custom Setting Value Update

DESCRIPTION
  Update Custom Settings

EXAMPLES
  $ eon update:customsetting --targetusername myOrg@example.com --name my_object__c --key my_column --value my_value --alias staging

  $ eon update:customsetting --targetusername myOrg@example.com -n my_object__c -k XXX -v xxx
```

_See code: [src/commands/upsert/customsetting.ts](https://github.com/eon-com/eon-sfdx/blob/v2.0.1-beta.1/src/commands/upsert/customsetting.ts)_
<!-- commandsstop -->
<!-- debugging-your-plugin -->
