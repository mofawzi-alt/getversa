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

function ensureFaceIdUsageDescription() {
  if (!fs.existsSync(infoPlistPath)) {
    console.log('[cap-sync] Info.plist not found, skipping Face ID patch');
    return;
  }

  const plist = fs.readFileSync(infoPlistPath, 'utf8');
  if (plist.includes('<key>NSFaceIDUsageDescription</key>')) {
    console.log('[cap-sync] Face ID usage description already present');
    return;
  }

  const insertion = `\n\t<key>NSFaceIDUsageDescription</key>\n\t<string>Use Face ID to sign in to Versa faster and more securely.</string>`;
  const updated = plist.replace('</dict>', `${insertion}\n</dict>`);
  fs.writeFileSync(infoPlistPath, updated, 'utf8');
  console.log('[cap-sync] Added NSFaceIDUsageDescription to Info.plist');
}

async function generateIcons() {
  if (!fs.existsSync(assetCatalogDir)) {
    console.log('[cap-sync] AppIcon.appiconset not found, skipping icon generation');
    return;
  }
  if (!fs.existsSync(sourceIconPath)) {
    console.log('[cap-sync] Source app icon not found, skipping icon generation');
    return;
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

await generateIcons();
ensureFaceIdUsageDescription();
