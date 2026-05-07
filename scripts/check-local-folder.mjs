import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const checks = [
  ['package.json', 'file'],
  ['src', 'dir'],
  ['capacitor.config.ts', 'file'],
  ['scripts/capacitor-ios-post-sync.mjs', 'file'],
  ['scripts/ios-sync-verbose.mjs', 'file'],
  ['public/app-icon-1024.png', 'file'],
];

const exists = (relativePath, type) => {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return false;
  const stat = fs.statSync(fullPath);
  return type === 'dir' ? stat.isDirectory() : stat.isFile();
};

console.log('\nVersa folder check');
console.log('Current folder:', root);

let ok = true;
for (const [relativePath, type] of checks) {
  const passed = exists(relativePath, type);
  if (!passed) ok = false;
  console.log(`${passed ? '✅' : '❌'} ${relativePath}`);
}

let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
} catch {
  ok = false;
}

if (pkg?.scripts?.['ios:sync'] === 'node scripts/ios-sync-verbose.mjs --open') {
  console.log('✅ iOS sync helper is installed');
} else {
  ok = false;
  console.log('❌ iOS sync helper is missing/outdated');
}

const syncScript = path.join(root, 'scripts', 'ios-sync-verbose.mjs');
if (fs.existsSync(syncScript)) {
  const syncText = fs.readFileSync(syncScript, 'utf8');
  if (syncText.includes('scripts/capacitor-ios-post-sync.mjs')) {
    console.log('✅ Camera + icon patch is included in sync');
  } else {
    ok = false;
    console.log('❌ Camera + icon patch is NOT included in sync');
  }
}

if (ok) {
  console.log('\n✅ This looks like the right Versa folder. Safe to continue here.');
  console.log('\nNext baby steps:');
  console.log('1. Close Xcode.');
  console.log('2. In Finder, delete ONLY these folders inside this folder if they exist: ios, dist, node_modules');
  console.log('3. Come back to Terminal.');
  console.log('4. Copy/paste this one line: npm run ios:update');
  console.log('5. Wait. Do not press Control+C unless it shows an error for more than 10 minutes.');
} else {
  console.log('\n❌ This does NOT look like the right/latest Versa folder. Do not delete anything here.');
  console.log('\nTry another Desktop folder, then run: npm run folder:check');
}

process.exit(ok ? 0 : 1);