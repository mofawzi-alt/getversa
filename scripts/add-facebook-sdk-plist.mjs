/**
 * Adds the Facebook SDK Info.plist keys required for events to flow.
 * Without these, the SDK loads but never reports to Meta → "Never received events".
 *
 * Run from project root (on your Mac):
 *   node scripts/add-facebook-sdk-plist.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const FB_APP_ID = '2007451096553445';
const FB_CLIENT_TOKEN = 'c56baa88249df62d7b4a19c3c067a54c';
const FB_DISPLAY_NAME = 'Ask Versa';

const plistPath = path.join(process.cwd(), 'ios/App/App/Info.plist');
if (!fs.existsSync(plistPath)) {
  console.error('❌ ios/App/App/Info.plist not found. Run `npx cap sync ios` first.');
  process.exit(1);
}

let plist = fs.readFileSync(plistPath, 'utf8');
let changed = false;

function ensureStringKey(key, value) {
  const expectedXml = `<string>${value}</string>`;
  const keyRegex = new RegExp(`(<key>${key}<\\/key>\\s*)<string>[^<]*<\\/string>`);
  if (keyRegex.test(plist)) {
    if (!plist.includes(`<key>${key}</key>\n\t${expectedXml}`)) {
      plist = plist.replace(keyRegex, `$1${expectedXml}`);
      changed = true;
      console.log(`✓ Corrected ${key}`);
    } else {
      console.log(`• ${key} already correct`);
    }
    return;
  }
  plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/,
    `\t<key>${key}</key>\n\t${expectedXml}\n</dict>\n</plist>\n`);
  changed = true;
  console.log(`✓ Added ${key}`);
}

function ensureKey(key, valueXml) {
  if (plist.includes(`<key>${key}</key>`)) {
    console.log(`• ${key} already present`);
    return;
  }
  plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/,
    `\t<key>${key}</key>\n\t${valueXml}\n</dict>\n</plist>\n`);
  changed = true;
  console.log(`✓ Added ${key}`);
}

ensureStringKey('FacebookAppID', FB_APP_ID);
ensureStringKey('FacebookClientToken', FB_CLIENT_TOKEN);
ensureStringKey('FacebookDisplayName', FB_DISPLAY_NAME);
ensureKey('FacebookAutoLogAppEventsEnabled', `<true/>`);
ensureKey('FacebookAdvertiserIDCollectionEnabled', `<true/>`);

// URL scheme fb<APPID> so FB can open back into the app
if (!plist.includes(`fb${FB_APP_ID}`)) {
  const urlTypesBlock = `\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>fb${FB_APP_ID}</string>
\t\t\t</array>
\t\t</dict>
\t</array>\n`;
  if (plist.includes('<key>CFBundleURLTypes</key>')) {
    // Inject the fb scheme into the first existing CFBundleURLSchemes array
    plist = plist.replace(/<key>CFBundleURLSchemes<\/key>\s*<array>/,
      m => `${m}\n\t\t\t\t<string>fb${FB_APP_ID}</string>`);
    console.log(`✓ Injected fb${FB_APP_ID} into existing CFBundleURLTypes`);
  } else {
    plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `${urlTypesBlock}</dict>\n</plist>\n`);
    console.log(`✓ Added CFBundleURLTypes with fb${FB_APP_ID}`);
  }
  changed = true;
}

// LSApplicationQueriesSchemes (needed for FB login / share fallback)
const queriesNeeded = ['fbapi', 'fb-messenger-share-api', 'fbauth2', 'fbshareextension'];
if (!plist.includes('<key>LSApplicationQueriesSchemes</key>')) {
  const block = `\t<key>LSApplicationQueriesSchemes</key>
\t<array>
${queriesNeeded.map(s => `\t\t<string>${s}</string>`).join('\n')}
\t</array>\n`;
  plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `${block}</dict>\n</plist>\n`);
  changed = true;
  console.log('✓ Added LSApplicationQueriesSchemes');
} else {
  console.log('• LSApplicationQueriesSchemes already present');
}

if (changed) {
  fs.writeFileSync(plistPath, plist);
  console.log('\n✅ Info.plist updated.');
} else {
  console.log('\n✓ Nothing to change — Info.plist already has Facebook keys.');
}

console.log('\nNext on your Mac:');
console.log('  1. cd ~/Desktop/versa');
console.log('  2. npm run ios:update');
console.log('  3. node scripts/add-facebook-sdk-plist.mjs  # this script (Info.plist)');
console.log('  4. Open Xcode → Archive → upload to App Store Connect');
