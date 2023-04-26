import { js2SourceComponent, parseSourceComponent } from "./xml";

export const addCustomPermission = (permissionSetXml: string, customPermissionName: string): string => {
  const customPermissionJson = {
    enabled: true,
    name: customPermissionName
  }

  let permSetJson = parseSourceComponent(permissionSetXml);
  const currentCP = permSetJson.PermissionSet.customPermissions;
  if (!currentCP) {
    permSetJson.PermissionSet.customPermissions = customPermissionJson
  } else if (!Array.isArray(currentCP)) {
    permSetJson.PermissionSet.customPermissions = [currentCP, customPermissionJson]
  } else {
    permSetJson.PermissionSet.customPermissions.push(customPermissionJson)
  }

  return js2SourceComponent(permSetJson);
}