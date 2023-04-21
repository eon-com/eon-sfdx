import fs from "fs/promises";
import { MetadataResolver } from "@salesforce/source-deploy-retrieve";
import { parseSourceComponent } from "./xml";

type PathItem = {
  name: string,
  isCustom: boolean
};

type MetadataFile = {
  content: string;
  filePath: string;
  dirPath: string;
}


const parseComponents = async (paths: string[]): Promise<Array<string>> => {
  const categories = [];
  for await (const path of paths) {
    const xmlString = (await fs.readFile(path)).toString();
    const fields = parseSourceComponent(xmlString).CustomMetadata.values;
    const category = fields.find((field: { field: string; }) => field.field === 'Category__c').value['#text'];

    category && categories.push(category);

  }
  return categories;
}

const parseCategoriesToTree = (categoriesList: string[]): object => {
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

const fetchCategories = async (rootDir: string): Promise<object> => {
  const resolver: MetadataResolver = new MetadataResolver();

  const featureFlagRecordsPaths: string[] = resolver.getComponentsFromPath(rootDir)
    .filter(component => component.type.id === 'custommetadata' && /Feature_Flag\./.test(component.name))
    .map(component => component.xml)

  const categoriesList = await parseComponents(featureFlagRecordsPaths);
  const categoriesTree = parseCategoriesToTree(categoriesList);
  return categoriesTree;
}

const getCategoriesItemsSet = (categoriesTree: object): string[] => {
  const string = JSON.stringify(categoriesTree);
  const regex = /[^\w]/gi;
  return string.split(regex).filter(i => i);
}

export { fetchCategories, getCategoriesItemsSet, PathItem, MetadataFile };