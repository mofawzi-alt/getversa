import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJsonPath = path.join(root, 'package.json');
const appDelegatePath = path.join(root, 'ios', 'App', 'App', 'AppDelegate.swift');
const capAppSpmPackagePath = path.join(root, 'ios', 'App', 'CapApp-SPM', 'Package.swift');

const packageJson = fs.existsSync(packageJsonPath)
  ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  : { dependencies: {} };

const usesFacebookLogin = Boolean(packageJson.dependencies?.['@capacitor-community/facebook-login']);

function replaceAll(source, search, replacement) {
  return source.split(search).join(replacement);
}

function ensureFacebookCorePackage() {
  if (!usesFacebookLogin || !fs.existsSync(capAppSpmPackagePath)) return;

  let swiftPackage = fs.readFileSync(capAppSpmPackagePath, 'utf8');
  let changed = false;

  if (!swiftPackage.includes('facebook-ios-sdk')) {
    swiftPackage = swiftPackage.replace(
      /(\.package\(url: "https:\/\/github\.com\/ionic-team\/capacitor-swift-pm\.git", [^)]+\))/,
      '$1,\n        .package(url: "https://github.com/facebook/facebook-ios-sdk.git", from: "17.4.0")',
    );
    changed = true;
  }

  if (!swiftPackage.includes('.product(name: "FacebookCore", package: "facebook-ios-sdk")')) {
    swiftPackage = swiftPackage.replace(
      /(\.product\(name: "Cordova", package: "capacitor-swift-pm"\))([\s\S]*?\n\s*\])/,
      '$1,\n                .product(name: "FacebookCore", package: "facebook-ios-sdk")$2',
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(capAppSpmPackagePath, swiftPackage, 'utf8');
    console.log('[ios-spm] Added direct FacebookCore SPM dependency for AppDelegate.swift');
  }
}

function patchAppDelegate() {
  if (!fs.existsSync(appDelegatePath)) {
    console.error('[ios-spm] STOP: AppDelegate.swift is missing. Run npm run ios:update again.');
    process.exit(1);
  }

  let src = fs.readFileSync(appDelegatePath, 'utf8');
  const original = src;

  src = replaceAll(src, 'import OneSignalFramework\n', '');
  src = src.replace(/\n?\s*\/\/ ---- OneSignal init \(added by add-onesignal-sdk\.mjs\) ----[\s\S]*?\/\/ ---- end OneSignal init ----\n?/g, '\n');
  src = src.replace(/\n?\/\/ ---- OneSignal push subscription observer \(added by add-onesignal-sdk\.mjs\) ----[\s\S]*?\/\/ ---- end OneSignal observer ----\n?/g, '\n');

  if (usesFacebookLogin) {
    src = replaceAll(src, 'import FBSDKCoreKit', 'import FacebookCore');
    if (!src.includes('import FacebookCore')) {
      src = src.replace(/import Capacitor\n/, 'import Capacitor\nimport FacebookCore\n');
    }

    src = replaceAll(src, 'FBSDKCoreKit.ApplicationDelegate.shared', 'ApplicationDelegate.shared');
    src = src.replace(
      /if ApplicationDelegate\.shared\.application\(app, open: url, sourceApplication: options\[\.sourceApplication\] as\? String, annotation: options\[\.annotation\] \?\? ""\) \{\n\s*return true\n\s*\}\n/g,
      'if ApplicationDelegate.shared.application(app, open: url, options: options) {\n            return true\n        }\n',
    );

    if (!src.includes('ApplicationDelegate.shared.application(application, didFinishLaunchingWithOptions: launchOptions)')) {
      src = src.replace(
        /func application\(_ application: UIApplication, didFinishLaunchingWithOptions[^{]*\{\s*\n/,
        (match) => `${match}        ApplicationDelegate.shared.application(application, didFinishLaunchingWithOptions: launchOptions)\n`,
      );
    }

    if (!src.includes('ApplicationDelegate.shared.application(app, open: url, options: options)')) {
      src = src.replace(
        /(func application\(_ app: UIApplication, open url: URL[^{]*\{\s*\n)/,
        '$1        if ApplicationDelegate.shared.application(app, open: url, options: options) {\n            return true\n        }\n',
      );
    }
  } else {
    src = replaceAll(src, 'import FBSDKCoreKit\n', '');
    src = replaceAll(src, 'import FacebookCore\n', '');
  }

  if (src !== original) {
    fs.writeFileSync(appDelegatePath, src, 'utf8');
    console.log('[ios-spm] Normalized AppDelegate.swift for Swift Package Manager');
  } else {
    console.log('[ios-spm] AppDelegate.swift already matches Swift Package Manager setup');
  }
}

ensureFacebookCorePackage();
patchAppDelegate();