/**
 * One-shot patcher: adds Facebook SDK to the iOS native project.
 *
 * Safe to run multiple times — it checks before adding anything.
 *
 * What it does:
 *   1. Adds `pod 'FBSDKCoreKit'` to ios/App/Podfile
 *   2. Adds Facebook SDK initialization to ios/App/App/AppDelegate.swift
 *
 * Run from project root:
 *   node scripts/add-facebook-sdk.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const podfilePath = path.join(root, 'ios/App/Podfile');
const appDelegatePath = path.join(root, 'ios/App/App/AppDelegate.swift');

function patchPodfile() {
  if (!fs.existsSync(podfilePath)) {
    console.error('❌ ios/App/Podfile not found. Run `npx cap sync ios` first.');
    process.exit(1);
  }
  let pod = fs.readFileSync(podfilePath, 'utf8');
  if (pod.includes("FBSDKCoreKit")) {
    console.log('• FBSDKCoreKit already in Podfile');
    return;
  }
  // Insert after the App target opens
  pod = pod.replace(
    /target 'App' do\s*\n/,
    `target 'App' do\n  pod 'FBSDKCoreKit'\n`,
  );
  fs.writeFileSync(podfilePath, pod);
  console.log('✓ Added pod \'FBSDKCoreKit\' to Podfile');
}

function patchAppDelegate() {
  if (!fs.existsSync(appDelegatePath)) {
    console.error('❌ AppDelegate.swift not found.');
    process.exit(1);
  }
  let src = fs.readFileSync(appDelegatePath, 'utf8');
  let changed = false;

  // 1. Import
  if (!src.includes('import FBSDKCoreKit')) {
    src = src.replace(/import Capacitor/, 'import Capacitor\nimport FBSDKCoreKit');
    changed = true;
    console.log('✓ Added FBSDKCoreKit import');
  } else {
    console.log('• FBSDKCoreKit import already present');
  }

  // 2. didFinishLaunchingWithOptions init
  if (!src.includes('ApplicationDelegate.shared.application')) {
    src = src.replace(
      /func application\(_ application: UIApplication, didFinishLaunchingWithOptions[^{]*\{\s*\n/,
      (match) => `${match}        ApplicationDelegate.shared.application(application, didFinishLaunchingWithOptions: launchOptions)\n`,
    );
    changed = true;
    console.log('✓ Added Facebook SDK init in didFinishLaunchingWithOptions');
  } else {
    console.log('• Facebook SDK init already present');
  }

  // 3. Open URL handler
  if (!src.includes('ApplicationDelegate.shared.application(app, open: url')) {
    // Look for existing open url method and inject FB handler
    if (src.includes('func application(_ app: UIApplication, open url: URL')) {
      src = src.replace(
        /(func application\(_ app: UIApplication, open url: URL[^{]*\{\s*\n)/,
        `$1        if ApplicationDelegate.shared.application(app, open: url, sourceApplication: options[.sourceApplication] as? String, annotation: options[.annotation] ?? "") {\n            return true\n        }\n`,
      );
      changed = true;
      console.log('✓ Added Facebook openURL handler');
    } else {
      console.log('⚠ Could not find openURL method — you may need to add it manually');
    }
  } else {
    console.log('• Facebook openURL handler already present');
  }

  if (changed) {
    fs.writeFileSync(appDelegatePath, src);
    console.log('✓ AppDelegate.swift patched');
  }
}

patchPodfile();
patchAppDelegate();
console.log('\n✅ Done. Next steps (on your Mac):');
console.log('   1. cd ~/Desktop/versa/ios/App && pod install');
console.log('   2. Open Xcode → Archive → upload new build to App Store Connect');
