import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const iosDir = path.join(root, 'ios', 'App', 'App');
const infoPlistPath = path.join(iosDir, 'Info.plist');
const assetCatalogDir = path.join(iosDir, 'Assets.xcassets', 'AppIcon.appiconset');
const sourceIconPath = path.join(root, 'public', 'app-icon-1024.png');

if (!fs.existsSync(path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'))) {
  console.error('[cap-sync] STOP: Xcode project is incomplete. Run npm run ios:update again so generated iOS files can be restored.');
  process.exit(1);
}

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
    fs.mkdirSync(iosDir, { recursive: true });
    fs.writeFileSync(infoPlistPath, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleDisplayName</key>
	<string>Versa</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>UILaunchStoryboardName</key>
	<string>LaunchScreen</string>
	<key>UIMainStoryboardFile</key>
	<string>Main</string>
	<key>UIRequiredDeviceCapabilities</key>
	<array>
		<string>armv7</string>
	</array>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>UISupportedInterfaceOrientations~ipad</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>UIViewControllerBasedStatusBarAppearance</key>
	<true/>
</dict>
</plist>
`, 'utf8');
    console.log('[cap-sync] Recreated missing Info.plist');
  }

  let plist = fs.readFileSync(infoPlistPath, 'utf8');
  let changed = false;

  const stringKeys = [
    { key: 'NSFaceIDUsageDescription', value: 'Use Face ID to sign in to Versa faster and more securely.' },
    { key: 'NSCameraUsageDescription', value: 'Versa needs access to your camera to take a profile photo.' },
    { key: 'NSPhotoLibraryUsageDescription', value: 'Versa needs access to your photo library to choose a profile picture.' },
    { key: 'NSPhotoLibraryAddUsageDescription', value: 'Versa needs access to save updated profile pictures to your photo library.' },
    { key: 'FacebookAppID', value: '2213580409403160' },
    { key: 'FacebookClientToken', value: '1e9cc014894aa3fefc2d52e6f1121de3' },
    { key: 'FacebookDisplayName', value: 'getversa' },
  ];

  for (const { key, value } of stringKeys) {
    if (!plist.includes(`<key>${key}</key>`)) {
      const insertion = `\t<key>${key}</key>\n\t<string>${value}</string>\n`;
      plist = plist.replace('</dict>\n</plist>', `${insertion}</dict>\n</plist>`);
      changed = true;
      console.log(`[cap-sync] Added ${key} to root of Info.plist`);
    } else {
      console.log(`[cap-sync] ${key} already present`);
    }
  }

  const requiredUrlSchemes = ['com.versa.app', 'com.Versa.app', 'fb2213580409403160'];
  const missingUrlSchemes = requiredUrlSchemes.filter((scheme) => !plist.includes(`<string>${scheme}</string>`));
  if (missingUrlSchemes.length > 0 && !plist.includes('<key>CFBundleURLTypes</key>')) {
    const urlSchemeBlock = `
\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t${requiredUrlSchemes.map((scheme) => `<string>${scheme}</string>`).join('\n\t\t\t\t')}
\t\t\t</array>
\t\t\t<key>CFBundleURLName</key>
\t\t\t<string>com.versa.app</string>
\t\t</dict>
\t</array>`;
    plist = plist.replace('</dict>\n</plist>', `${urlSchemeBlock}\n</dict>\n</plist>`);
    changed = true;
    console.log('[cap-sync] Added URL schemes for OAuth and Facebook callbacks');
  } else if (missingUrlSchemes.length > 0) {
    plist = plist.replace(
      /(<key>CFBundleURLSchemes<\/key>\s*<array>)/,
      `$1\n\t\t\t\t${missingUrlSchemes.map((scheme) => `<string>${scheme}</string>`).join('\n\t\t\t\t')}`,
    );
    changed = true;
    console.log(`[cap-sync] Added missing URL schemes: ${missingUrlSchemes.join(', ')}`);
  }

  const querySchemes = ['fbapi', 'fb-messenger-share-api', 'fbauth2', 'fbshareextension'];
  const missingQuerySchemes = querySchemes.filter((scheme) => !plist.includes(`<string>${scheme}</string>`));
  if (missingQuerySchemes.length > 0 && !plist.includes('<key>LSApplicationQueriesSchemes</key>')) {
    const lsBlock = `
\t<key>LSApplicationQueriesSchemes</key>
\t<array>
\t\t${querySchemes.map((scheme) => `<string>${scheme}</string>`).join('\n\t\t')}
\t</array>`;
    plist = plist.replace('</dict>\n</plist>', `${lsBlock}\n</dict>\n</plist>`);
    changed = true;
    console.log('[cap-sync] Added Facebook application query schemes');
  } else if (missingQuerySchemes.length > 0) {
    plist = plist.replace(
      /(<key>LSApplicationQueriesSchemes<\/key>\s*<array>)/,
      `$1\n\t\t${missingQuerySchemes.map((scheme) => `<string>${scheme}</string>`).join('\n\t\t')}`,
    );
    changed = true;
    console.log(`[cap-sync] Added missing Facebook query schemes: ${missingQuerySchemes.join(', ')}`);
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
