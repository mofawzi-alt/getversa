/**
 * Read-only Facebook SDK checker for the local iOS project.
 * It does not edit anything. Run from the project root on the Mac:
 *   node scripts/check-facebook-sdk-ios.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const plistPath = path.join(root, 'ios/App/App/Info.plist');
const appDelegatePath = path.join(root, 'ios/App/App/AppDelegate.swift');
const capAppSpmPackagePath = path.join(root, 'ios/App/CapApp-SPM/Package.swift');

const FB_APP_ID = '2007451096553445';
const FB_CLIENT_TOKEN = 'c56baa88249df62d7b4a19c3c067a54c';
const FB_SCHEME = `fb${FB_APP_ID}`;

const checks = [];

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function check(label, passed, fix) {
  checks.push({ label, passed, fix });
}

const plist = read(plistPath);
const appDelegate = read(appDelegatePath);
const capAppSpmPackage = read(capAppSpmPackagePath);

check('ios/App/CapApp-SPM/Package.swift exists', Boolean(capAppSpmPackage), 'Run: cd ~/Desktop/versa && npm run ios:update');
check('Swift package includes Facebook plugin', Boolean(capAppSpmPackage?.includes('CapacitorCommunityFacebookLogin')), 'Run: cd ~/Desktop/versa && npm run ios:update');
check('Swift package exposes FacebookCore to AppDelegate', Boolean(capAppSpmPackage?.includes('FacebookCore')), 'Run: cd ~/Desktop/versa && npm run ios:update');

check('Info.plist exists', Boolean(plist), 'Run: cd ~/Desktop/versa && npx cap sync ios');
check('Info.plist has correct FacebookAppID', Boolean(plist?.includes('<key>FacebookAppID</key>') && plist.includes(`<string>${FB_APP_ID}</string>`)), 'Run: cd ~/Desktop/versa && node scripts/add-facebook-sdk-plist.mjs');
check('Info.plist has correct FacebookClientToken', Boolean(plist?.includes('<key>FacebookClientToken</key>') && plist.includes(`<string>${FB_CLIENT_TOKEN}</string>`)), 'Run: cd ~/Desktop/versa && node scripts/add-facebook-sdk-plist.mjs');
check('Info.plist has FacebookAutoLogAppEventsEnabled true', Boolean(plist?.includes('<key>FacebookAutoLogAppEventsEnabled</key>') && /<key>FacebookAutoLogAppEventsEnabled<\/key>\s*<true\/>/.test(plist)), 'Run: cd ~/Desktop/versa && node scripts/add-facebook-sdk-plist.mjs');
check('Info.plist has FacebookAdvertiserIDCollectionEnabled true', Boolean(plist?.includes('<key>FacebookAdvertiserIDCollectionEnabled</key>') && /<key>FacebookAdvertiserIDCollectionEnabled<\/key>\s*<true\/>/.test(plist)), 'Run: cd ~/Desktop/versa && node scripts/add-facebook-sdk-plist.mjs');
check(`Info.plist has URL scheme ${FB_SCHEME}`, Boolean(plist?.includes(`<string>${FB_SCHEME}</string>`)), 'Run: cd ~/Desktop/versa && node scripts/add-facebook-sdk-plist.mjs');

check('AppDelegate.swift exists', Boolean(appDelegate), 'Run: cd ~/Desktop/versa && npx cap sync ios');
check('AppDelegate imports FacebookCore', Boolean(appDelegate?.includes('import FacebookCore')), 'Run: cd ~/Desktop/versa && npm run ios:update');
check('AppDelegate initializes Facebook SDK on launch', Boolean(appDelegate?.includes('ApplicationDelegate.shared.application(application, didFinishLaunchingWithOptions: launchOptions)')), 'Run: cd ~/Desktop/versa && node scripts/add-facebook-sdk.mjs');

console.log('\nFacebook iOS SDK check\n');
for (const item of checks) {
  console.log(`${item.passed ? '✅' : '❌'} ${item.label}`);
  if (!item.passed) console.log(`   Fix: ${item.fix}`);
}

const failed = checks.filter((item) => !item.passed);
console.log(failed.length === 0
  ? '\n✅ Everything required is present locally. Do not make another build just to repeat setup.'
  : `\n❌ ${failed.length} item(s) missing. Fix only those item(s), then run this check again.`);

process.exit(failed.length === 0 ? 0 : 1);