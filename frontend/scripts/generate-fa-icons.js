#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const METADATA_DIR = path.join(ROOT, 'node_modules/@fortawesome/fontawesome-free/metadata');
const OUTPUT_FILE = path.join(ROOT, 'src/lib/fa-icons-data.json');

const icons = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, 'icon-families.json'), 'utf8'));
const catYaml = fs.readFileSync(path.join(METADATA_DIR, 'categories.yml'), 'utf8');

const categories = {};
let currentCat = null;
let inIcons = false;

for (const line of catYaml.split('\n')) {
  if (line.match(/^[a-z0-9-]+:$/)) {
    currentCat = line.replace(':', '');
    categories[currentCat] = { icons: new Set(), label: '' };
    inIcons = false;
  } else if (line.trim() === 'icons:') {
    inIcons = true;
  } else if (line.trim().startsWith('label:')) {
    if (currentCat) categories[currentCat].label = line.trim().replace('label: ', '');
    inIcons = false;
  } else if (inIcons && line.trim().startsWith('- ')) {
    const iconName = line.trim().replace('- ', '').replace(/["']/g, '');
    if (currentCat) categories[currentCat].icons.add(iconName);
  }
}

const freeIcons = { solid: [], regular: [], brands: [] };
const iconCategories = {};

for (const [catId, catData] of Object.entries(categories)) {
  for (const iconName of catData.icons) {
    if (!iconCategories[iconName]) iconCategories[iconName] = [];
    iconCategories[iconName].push(catId);
  }
}

for (const [name, data] of Object.entries(icons)) {
  const freeStyles = data.familyStylesByLicense?.free || [];
  const searchTerms = data.search?.terms || [];
  const label = data.label || name;
  const cats = iconCategories[name] || [];
  
  for (const fs of freeStyles) {
    const iconData = { name, label, terms: searchTerms, categories: cats };
    if (fs.family === 'classic' && fs.style === 'solid') freeIcons.solid.push(iconData);
    else if (fs.family === 'classic' && fs.style === 'regular') freeIcons.regular.push(iconData);
    else if (fs.family === 'classic' && fs.style === 'brands') freeIcons.brands.push(iconData);
  }
}

freeIcons.solid.sort((a, b) => a.name.localeCompare(b.name));
freeIcons.regular.sort((a, b) => a.name.localeCompare(b.name));
freeIcons.brands.sort((a, b) => a.name.localeCompare(b.name));

const catList = Object.entries(categories)
  .map(([id, data]) => ({ id, label: data.label, count: data.icons.size }))
  .filter(c => c.count > 0)
  .sort((a, b) => a.label.localeCompare(b.label));

const output = {
  icons: freeIcons,
  categories: catList,
  stats: {
    solid: freeIcons.solid.length,
    regular: freeIcons.regular.length,
    brands: freeIcons.brands.length,
    total: freeIcons.solid.length + freeIcons.regular.length + freeIcons.brands.length,
    categories: catList.length
  }
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
console.log('Generated', OUTPUT_FILE);
console.log('Stats:', output.stats);
