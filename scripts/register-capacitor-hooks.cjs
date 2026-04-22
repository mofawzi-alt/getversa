const fs = require('node:fs');
const path = require('node:path');

const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

packageJson.capacitor = packageJson.capacitor || {};
packageJson.capacitor.hooks = {
  ...(packageJson.capacitor.hooks || {}),
  'capacitor:sync:after': 'node scripts/capacitor-ios-post-sync.mjs',
};

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
console.log('Updated package.json with Capacitor sync hook');
