/**
 * Patches ios/App/App/Info.plist after `cap sync` to ensure
 * required privacy descriptions survive every sync.
 * Also copies AppIcon if present.
 */
import { readFileSync, writeFileSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const plistPath = path.join(root, 'ios/App/App/Info.plist');

// ── 1. Patch Info.plist with required privacy keys ──
const privacyKeys = {
  NSCameraUsageDescription: 'Versa needs camera access to take photos',
  NSPhotoLibraryUsageDescription: 'Versa needs photo library access to select images',
  NSPhotoLibraryAddUsageDescription: 'Versa needs access to save images to your photo library',
  NSFaceIDUsageDescription: 'Versa uses Face ID for secure authentication',
};

if (!existsSync(plistPath)) {
  console.log('⚠️  Info.plist not found – skipping patch (run cap add ios first)');
  process.exit(0);
}

let plist = readFileSync(plistPath, 'utf8');
let patched = false;

for (const [key, value] of Object.entries(privacyKeys)) {
  if (!plist.includes(`<key>${key}</key>`)) {
    // Insert before closing </dict>
    const entry = `\t<key>${key}</key>\n\t<string>${value}</string>\n`;
    plist = plist.replace('</dict>\n</plist>', entry + '</dict>\n</plist>');
    console.log(`✓ Added ${key}`);
    patched = true;
  } else {
    console.log(`• ${key} already present`);
  }
}

if (!plist.includes('<string>com.versa.app</string>') || !plist.includes('<string>com.Versa.app</string>')) {
  const urlSchemeBlock = `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>com.versa.app</string>\n\t\t\t\t<string>com.Versa.app</string>\n\t\t\t</array>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>com.versa.app</string>\n\t\t</dict>\n\t</array>\n`;
  plist = plist.replace('</dict>\n</plist>', urlSchemeBlock + '</dict>\n</plist>');
  console.log('✓ Added OAuth callback URL schemes');
  patched = true;
}

if (patched) {
  writeFileSync(plistPath, plist);
  console.log('✓ Info.plist patched');
} else {
  console.log('• Info.plist already has all privacy keys');
}

// ── 2. Copy app icon if we have one in resources/ ──
const iconSrc = path.join(root, 'resources/ios/AppIcon.appiconset');
const iconDst = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');

if (existsSync(iconSrc)) {
  mkdirSync(iconDst, { recursive: true });
  cpSync(iconSrc, iconDst, { recursive: true });
  console.log('✓ App icon copied from resources/ios/AppIcon.appiconset');
} else {
  console.log('⚠️  No app icon source found at resources/ios/AppIcon.appiconset');
  console.log('   To persist your app icon, place your AppIcon.appiconset folder there.');
}
