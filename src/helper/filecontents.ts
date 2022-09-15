export const exportJson: string = `{
    "allOrNone": false,
    "promptOnMissingParentObjects": true,
    "concurrencyMode": "Serial",
    "importCSVFilesAsIs": false,
    "objects": [
        {
            "query": "SELECT id, Name from Account",
            "operation": "Upsert",
            "externalId": "Name"
        },
        {
            "query": "SELECT id, Name from Contact",
            "operation": "Upsert",
            "externalId": "Name"
        }
    ]
}`;

export const eonDevKitYml: string = `
# Include other devkits from other packages by adding the name of the package (e.g. core):
include:
    - 
# List the permissionsets that should be assigned to current user (e.g. Service Agent): 
permissionsets:
    - 
# add location(s) of anonymous apex scripts relative to this file (e.g. scripts/script.apex): 
anonymous-apex:
    - scripts/setup-script.apex
# add location(s) of export.json files if testdata should be imported (e.g. testdata/export.json):
test-data:
    - testdata/export.json
`;

export const exampleApex: string = `
System.debug('Add your scripts here');
`;
