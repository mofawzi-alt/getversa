import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDelegatePath = path.join(root, 'ios', 'App', 'App', 'AppDelegate.swift');

function replaceAll(source, search, replacement) {
  return source.split(search).join(replacement);
}

function patchAppDelegate() {
  if (!fs.existsSync(appDelegatePath)) {
    console.error('[ios-spm] STOP: AppDelegate.swift is missing. Run npm run ios:update again.');
    process.exit(1);
  }

  let src = fs.readFileSync(appDelegatePath, 'utf8');
  const original = src;

  src = replaceAll(src, 'import OneSignalFramework\n', '');
  src = replaceAll(src, 'import FBSDKCoreKit\n', '');
  src = replaceAll(src, 'import FacebookCore\n', '');
  src = src.replace(/\n?\s*\/\/ ---- OneSignal init \(added by add-onesignal-sdk\.mjs\) ----[\s\S]*?\/\/ ---- end OneSignal init ----\n?/g, '\n');
  src = src.replace(/\n?\/\/ ---- OneSignal push subscription observer \(added by add-onesignal-sdk\.mjs\) ----[\s\S]*?\/\/ ---- end OneSignal observer ----\n?/g, '\n');
  src = src.replace(/\n\s*ApplicationDelegate\.shared\.application\(application, didFinishLaunchingWithOptions: launchOptions\)\n/g, '\n');
  src = src.replace(/\n\s*if (?:FBSDKCoreKit\.)?ApplicationDelegate\.shared\.application\(app, open: url,[\s\S]*?\n\s*\}\n/g, '\n');

  if (src !== original) {
    fs.writeFileSync(appDelegatePath, src, 'utf8');
    console.log('[ios-spm] Normalized AppDelegate.swift for Swift Package Manager');
  } else {
    console.log('[ios-spm] AppDelegate.swift already matches Swift Package Manager setup');
  }
}

patchAppDelegate();