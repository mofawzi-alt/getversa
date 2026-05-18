import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceOnly = process.argv.includes('--source-only');

const fail = (message) => {
  console.error(`\nSTOP: ${message}`);
  console.error('Nothing was deleted.');
  process.exit(1);
};

const requiredSourceFiles = [
  'package.json',
  'src',
  'capacitor.config.ts',
  'public/app-icon-1024.png',
  'scripts/capacitor-ios-post-sync.mjs',
  'scripts/ios-sync-verbose.mjs',
];

for (const relativePath of requiredSourceFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    fail(`Missing ${relativePath}`);
  }
}

const capConfig = fs.readFileSync(path.join(root, 'capacitor.config.ts'), 'utf8');
if (!capConfig.includes("appId: 'com.Versa.app'") || !capConfig.includes("appName: 'Versa'")) {
  fail('Native app identity is not Versa.');
}
if (!capConfig.includes('SplashScreen') || !capConfig.includes('launchAutoHide: true')) {
  fail('iOS splash safety config is missing. Run npm install, then npm run ios:sync before archiving.');
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!packageJson.dependencies?.['@capacitor/splash-screen']) {
  fail('Missing @capacitor/splash-screen. Run npm install, then npm run ios:sync before archiving.');
}

const postSync = fs.readFileSync(path.join(root, 'scripts/capacitor-ios-post-sync.mjs'), 'utf8');
const requiredAppleKeys = [
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSPhotoLibraryAddUsageDescription',
  'NSFaceIDUsageDescription',
];
const missingKeys = requiredAppleKeys.filter((key) => !postSync.includes(key));
if (missingKeys.length > 0) {
  fail(`Missing Apple permission fix keys: ${missingKeys.join(', ')}`);
}

if (sourceOnly) {
  console.log('GOOD: source contains Versa identity, app icon source, and Apple camera/photo fixes.');
  process.exit(0);
}

const plistPath = path.join(root, 'ios', 'App', 'App', 'Info.plist');
if (!fs.existsSync(plistPath)) {
  fail('iOS project is missing. Run the START-HERE-MAC.command file from the project folder.');
}

const plist = fs.readFileSync(plistPath, 'utf8');
const missingPlistKeys = requiredAppleKeys.filter((key) => !plist.includes(`<key>${key}</key>`));
if (missingPlistKeys.length > 0) {
  fail(`iOS Info.plist is missing: ${missingPlistKeys.join(', ')}`);
}

const appIconDir = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
const appIconContentsPath = path.join(appIconDir, 'Contents.json');
if (!fs.existsSync(appIconContentsPath)) {
  fail('iOS app icon Contents.json is missing.');
}

const appIconContents = JSON.parse(fs.readFileSync(appIconContentsPath, 'utf8'));
const marketingIcon = appIconContents.images?.find((image) => image.idiom === 'ios-marketing');
if (!marketingIcon?.filename || !fs.existsSync(path.join(appIconDir, marketingIcon.filename))) {
  fail('iOS 1024px marketing app icon is missing.');
}

const pbxPath = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
if (fs.existsSync(pbxPath)) {
  const buildNumber = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  let pbx = fs.readFileSync(pbxPath, 'utf8');
  pbx = pbx.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`);
  fs.writeFileSync(pbxPath, pbx, 'utf8');
  console.log(`GOOD: Apple build number set to ${buildNumber}.`);
}

console.log('GOOD: Apple camera crash fix is present.');
console.log('GOOD: Apple photo permission fix is present.');
console.log('GOOD: App icon is present.');
console.log('GOOD: Versa iOS project is ready to open in Xcode.');