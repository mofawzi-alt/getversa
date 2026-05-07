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

const capConfigPath = path.join(root, 'capacitor.config.ts');
if (fs.existsSync(capConfigPath)) {
  const capConfig = fs.readFileSync(capConfigPath, 'utf8');
  if (capConfig.includes("appId: 'com.Versa.app'") && capConfig.includes("appName: 'Versa'")) {
    console.log('✅ Native app identity matches Versa');
  } else {
    ok = false;
    console.log('❌ Native app identity does not match Versa');
  }
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

const postSyncScript = path.join(root, 'scripts', 'capacitor-ios-post-sync.mjs');
if (fs.existsSync(postSyncScript)) {
  const postSyncText = fs.readFileSync(postSyncScript, 'utf8');
  const requiredIosKeys = [
    'NSCameraUsageDescription',
    'NSPhotoLibraryUsageDescription',
    'NSPhotoLibraryAddUsageDescription',
    'NSFaceIDUsageDescription',
  ];
  const missingKeys = requiredIosKeys.filter((key) => !postSyncText.includes(key));
  if (missingKeys.length === 0) {
    console.log('✅ Apple camera/photo permission keys are included');
  } else {
    ok = false;
    console.log(`❌ Missing Apple permission keys: ${missingKeys.join(', ')}`);
  }
}

if (ok) {
  console.log('\n✅ This looks like the right Versa folder. Safe to continue here.');
  console.log('\nDo NOT delete the whole project.');
  console.log('Do NOT delete src, public, package.json, capacitor.config.ts, or supabase.');
  console.log('\nSafest next step: run npm run ios:update from this folder only.');
  console.log('That command now checks the folder first and refuses to run if the Apple fixes are missing.');
} else {
  console.log('\n❌ This does NOT look like the right/latest Versa folder. Do not delete anything here.');
  console.log('\nTry another Desktop folder, then run: npm run folder:check');
}

process.exit(ok ? 0 : 1);