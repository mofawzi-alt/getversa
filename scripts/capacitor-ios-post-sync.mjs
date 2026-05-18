import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const iosDir = path.join(root, 'ios', 'App', 'App');
const infoPlistPath = path.join(iosDir, 'Info.plist');
const assetCatalogDir = path.join(iosDir, 'Assets.xcassets', 'AppIcon.appiconset');
const sourceIconPath = path.join(root, 'public', 'app-icon-1024.png');

const iconDefinitions = [
  { size: 20, scale: 2, idiom: 'iphone' },
  { size: 20, scale: 3, idiom: 'iphone' },
  { size: 29, scale: 2, idiom: 'iphone' },
  { size: 29, scale: 3, idiom: 'iphone' },
  { size: 40, scale: 2, idiom: 'iphone' },
  { size: 40, scale: 3, idiom: 'iphone' },
  { size: 60, scale: 2, idiom: 'iphone' },
  { size: 60, scale: 3, idiom: 'iphone' },
  { size: 20, scale: 1, idiom: 'ipad' },
  { size: 20, scale: 2, idiom: 'ipad' },
  { size: 29, scale: 1, idiom: 'ipad' },
  { size: 29, scale: 2, idiom: 'ipad' },
  { size: 40, scale: 1, idiom: 'ipad' },
  { size: 40, scale: 2, idiom: 'ipad' },
  { size: 76, scale: 1, idiom: 'ipad' },
  { size: 76, scale: 2, idiom: 'ipad' },
  { size: 83.5, scale: 2, idiom: 'ipad' },
  { size: 1024, scale: 1, idiom: 'ios-marketing' },
];

function ensureInfoPlistKeys() {
  if (!fs.existsSync(infoPlistPath)) {
    console.log('[cap-sync] Info.plist not found, skipping plist patches');
    return;
  }

  let plist = fs.readFileSync(infoPlistPath, 'utf8');
  let changed = false;

  const requiredKeys = [
    {
      key: 'NSFaceIDUsageDescription',
      value: 'Use Face ID to sign in to Versa faster and more securely.',
    },
    {
      key: 'NSCameraUsageDescription',
      value: 'Versa needs access to your camera to take a profile photo.',
    },
    {
      key: 'NSPhotoLibraryUsageDescription',
      value: 'Versa needs access to your photo library to choose a profile picture.',
    },
    {
      key: 'NSPhotoLibraryAddUsageDescription',
      value: 'Versa needs access to save updated profile pictures to your photo library.',
    },
  ];

  for (const { key, value } of requiredKeys) {
    if (!plist.includes(`<key>${key}</key>`)) {
      const insertion = `\n\t<key>${key}</key>\n\t<string>${value}</string>`;
      plist = plist.replace('</dict>', `${insertion}\n</dict>`);
      changed = true;
      console.log(`[cap-sync] Added ${key} to Info.plist`);
    } else {
      console.log(`[cap-sync] ${key} already present`);
    }
  }

  // Ensure CFBundleURLTypes includes custom URL schemes for OAuth callbacks.
  // SFSafariViewController redirects to com.versa.app://auth-callback after OAuth.
  // Include the legacy mixed-case scheme too so older callback URLs still work.
  if (!plist.includes('<string>com.versa.app</string>') || !plist.includes('<string>com.Versa.app</string>')) {
    const urlSchemeBlock = `
\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>com.versa.app</string>
\t\t\t\t<string>com.Versa.app</string>
\t\t\t</array>
\t\t\t<key>CFBundleURLName</key>
\t\t\t<string>com.versa.app</string>
\t\t</dict>
\t</array>`;
    plist = plist.replace('</dict>', `${urlSchemeBlock}\n</dict>`);
    changed = true;
    console.log('[cap-sync] Added CFBundleURLTypes for OAuth callback schemes');
  }

  if (changed) {
    fs.writeFileSync(infoPlistPath, plist, 'utf8');
  }
}

async function generateIcons() {
  if (!fs.existsSync(sourceIconPath)) {
    console.log('[cap-sync] Source app icon not found, skipping icon generation');
    return;
  }
  // Auto-create the AppIcon.appiconset folder if it was wiped or never existed
  if (!fs.existsSync(assetCatalogDir)) {
    fs.mkdirSync(assetCatalogDir, { recursive: true });
    console.log('[cap-sync] Created AppIcon.appiconset folder');
  }

  const { default: sharp } = await import('sharp');
  const images = [];

  for (const def of iconDefinitions) {
    const pixelSize = Math.round(def.size * def.scale);
    // Apple's marketing icon (1024@1x) must be named "AppIcon-512@2x.png" historically,
    // but with modern Xcode any unique filename works. Use idiom-size@scale, where the
    // 1024 marketing icon drops the "@1x" suffix to match Xcode's default template.
    const sizeStr = String(def.size).replace('.', '_');
    const baseName = def.size === 1024
      ? `AppIcon-${sizeStr}.png`
      : `${def.idiom}-${sizeStr}@${def.scale}x.png`;
    const outPath = path.join(assetCatalogDir, baseName);

    await sharp(sourceIconPath)
      .resize(pixelSize, pixelSize)
      .png()
      .toFile(outPath);

    images.push({
      size: `${def.size}x${def.size}`,
      idiom: def.idiom,
      filename: baseName,
      scale: `${def.scale}x`,
    });
  }

  const contents = {
    images,
    info: {
      version: 1,
      author: 'xcode',
    },
  };

  fs.writeFileSync(
    path.join(assetCatalogDir, 'Contents.json'),
    `${JSON.stringify(contents, null, 2)}\n`,
    'utf8',
  );

  console.log('[cap-sync] Regenerated iOS app icon set');
}

async function generateSplash() {
  const splashSource = path.join(root, 'resources', 'splash.png');
  const splashDir = path.join(iosDir, 'Assets.xcassets', 'Splash.imageset');
  if (!fs.existsSync(splashSource)) {
    console.log('[cap-sync] resources/splash.png not found, skipping splash generation');
    return;
  }
  if (!fs.existsSync(splashDir)) {
    fs.mkdirSync(splashDir, { recursive: true });
    console.log('[cap-sync] Created Splash.imageset folder');
  }
  const { default: sharp } = await import('sharp');
  const variants = [
    { name: 'splash-2732x2732.png', scale: '1x' },
    { name: 'splash-2732x2732-1.png', scale: '2x' },
    { name: 'splash-2732x2732-2.png', scale: '3x' },
  ];
  for (const v of variants) {
    await sharp(splashSource).resize(2732, 2732).png().toFile(path.join(splashDir, v.name));
  }
  const contents = {
    images: variants.map(v => ({ idiom: 'universal', filename: v.name, scale: v.scale })),
    info: { version: 1, author: 'xcode' },
  };
  fs.writeFileSync(path.join(splashDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`, 'utf8');
  console.log('[cap-sync] Regenerated iOS Splash.imageset with Versa branding');
}

await generateIcons();
await generateSplash();
ensureInfoPlistKeys();
