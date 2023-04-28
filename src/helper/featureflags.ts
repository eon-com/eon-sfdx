import fs from "fs/promises";
import { MetadataResolver, SourceComponent } from "@salesforce/source-deploy-retrieve";
import { parseSourceComponent } from "./xml";
import { PackageDirParsed, PackageTree, SfdxPermissionSet } from "./types";
import { getAllFiles } from "./package-permissionsets";
import { PackageDir } from "@salesforce/core";

export type PathItem = {
  name: string,
  isCustom: boolean
};

export type MetadataFile = {
  content: string;
  filePath: string;
  dirPath: string;
}

export const getPermsetWithPaths = async (pck: PackageTree): Promise<object[]> => {
  const permissionSetPaths: string[] = getAllFiles(pck.path)
    .filter((file) =>
      file.includes('permissionset-meta.xml')
    );
  const permissionSets = [];
  for (const path of permissionSetPaths) {
    const rawPs = await fs.readFile(path);
    const content = rawPs.toString();
    const label = parseSourceComponent(content).PermissionSet.label;
    permissionSets.push({
      label,
      content,
      path,
      package: pck.packagename
    })
  }

  return permissionSets;
}


export const parseComponents = async (paths: string[]): Promise<Array<string>> => {
  const categories = [];
  for await (const path of paths) {
    const xmlString = (await fs.readFile(path)).toString();
    const fields = parseSourceComponent(xmlString).CustomMetadata.values;
    const category = fields.find((field: { field: string; }) => field.field === 'Category__c').value['#text'];

    category && categories.push(category);

  }
  return categories;
}

export const parseCategoriesToTree = (categoriesList: string[]): object => {
  const objects = categoriesList.reduce((acc, val) => {
    const valArr = val.split('.');

    for (const i in valArr) {
      const index = Number(i);
      const name = valArr[index];
      const parent = valArr[index - 1] || null;
      const itemInAcc = acc.find((a) => a?.name === name);
      if (itemInAcc) {
        if (itemInAcc.parent !== parent) {
          throw "Invalid parent!!";
        }
        continue;
      }
      acc.push({ name, parent });
    }

    return acc;
  }, []);

  const tree = {};

  objects.forEach(obj => {
    obj.children = {};
  });

  objects.forEach(obj => {
    if (obj.parent) {
      const parent = objects.find(o => o.name === obj.parent);
      parent.children[obj.name] = obj.children;
    } else {
      tree[obj.name] = obj.children;
    }
  });

  return tree;
}

export const fetchCategories = async (rootDir: string): Promise<object> => {
  const resolver: MetadataResolver = new MetadataResolver();

  const featureFlagContents: string[] = getFeatureFlags(rootDir)
    .map(component => component.xml);

  const categoriesList = await parseComponents(featureFlagContents);
  const categoriesTree = parseCategoriesToTree(categoriesList);
  return categoriesTree;
}

export const getCategoriesItemsSet = (categoriesTree: object): string[] => {
  const string = JSON.stringify(categoriesTree);
  const regex = /[^\w]/gi;
  return string.split(regex).filter(i => i);
}

export const getFeatureFlags = (rootDir: string): SourceComponent[] => {
  const resolver: MetadataResolver = new MetadataResolver();

  const featureFlagComponents: SourceComponent[] = resolver.getComponentsFromPath(rootDir)
    .filter(component => component.type.id === 'custommetadata' && /Feature_Flag\./.test(component.name));

  return featureFlagComponents;
}

export const getFeatureFlagNames = (rootDir: string): string[] => {
  return getFeatureFlags(rootDir)
    .map(flag => flag.name)

  return [];
}