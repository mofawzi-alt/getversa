/**
 * One-shot patcher: adds OneSignal iOS SDK back into the native project.
 *
 * Safe to run multiple times — it checks before adding anything.
 *
 * Why this exists:
 *   The original setup used `onesignal-cordova-plugin`. After the iOS project
 *   migrated to SPM (Swift Package Manager) mode in Capacitor 8, Cordova
 *   plugins are no longer auto-bridged. This script installs the OneSignal
 *   iOS SDK directly via CocoaPods (which still works alongside SPM) and
 *   wires it into AppDelegate, so push notifications work again.
 *
 * What it does:
 *   1. Adds `pod 'OneSignalXCFramework'` to ios/App/Podfile
 *   2. Adds OneSignal import + initialization to AppDelegate.swift
 *   3. Auto-syncs the OneSignal player ID + linked user ID to UserDefaults
 *      so the JS side (Capacitor Preferences) can read it.
 *
 * Run from project root:
 *   node scripts/add-onesignal-sdk.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ONESIGNAL_APP_ID = '0b64a490-9689-42c9-80a3-e84a0e4f1a0b';

const root = process.cwd();
const podfilePath = path.join(root, 'ios/App/Podfile');
const appDelegatePath = path.join(root, 'ios/App/App/AppDelegate.swift');

function patchPodfile() {
  if (!fs.existsSync(podfilePath)) {
    console.error('❌ ios/App/Podfile not found. Run `npx cap sync ios` first.');
    process.exit(1);
  }
  let pod = fs.readFileSync(podfilePath, 'utf8');
  if (pod.includes('OneSignalXCFramework')) {
    console.log('• OneSignalXCFramework already in Podfile');
    return;
  }
  pod = pod.replace(
    /target 'App' do\s*\n/,
    `target 'App' do\n  pod 'OneSignalXCFramework', '>= 5.0.0', '< 6.0'\n`,
  );
  fs.writeFileSync(podfilePath, pod);
  console.log("✓ Added pod 'OneSignalXCFramework' to Podfile");
}

const ONESIGNAL_INIT_BLOCK = `        // ---- OneSignal init (added by add-onesignal-sdk.mjs) ----
        OneSignal.Debug.setLogLevel(.LL_WARN)
        OneSignal.initialize("${ONESIGNAL_APP_ID}", withLaunchOptions: launchOptions)
        OneSignal.Notifications.requestPermission({ accepted in
            print("[OneSignal] permission accepted: \\(accepted)")
        }, fallbackToSettings: true)

        // Persist player ID so the JS side can read it via Capacitor Preferences.
        OneSignal.User.pushSubscription.addObserver(PushSubObserver.shared)

        // If the JS side already wrote a user id before the SDK initialized,
        // call login immediately.
        let prefs = UserDefaults(suiteName: "CapacitorStorage") ?? UserDefaults.standard
        if let uid = prefs.string(forKey: "onesignal_pending_user_id"), !uid.isEmpty {
            OneSignal.login(uid)
        }

        // Observe future user-id writes from JS (Capacitor Preferences) and
        // call OneSignal.login / logout accordingly.
        NotificationCenter.default.addObserver(
            forName: UserDefaults.didChangeNotification,
            object: nil,
            queue: .main
        ) { _ in
            let prefs = UserDefaults(suiteName: "CapacitorStorage") ?? UserDefaults.standard
            let uid = prefs.string(forKey: "onesignal_pending_user_id") ?? ""
            if uid.isEmpty {
                OneSignal.logout()
            } else {
                OneSignal.login(uid)
            }
        }
        // ---- end OneSignal init ----

`;

const ONESIGNAL_OBSERVER_CLASS = `
// ---- OneSignal push subscription observer (added by add-onesignal-sdk.mjs) ----
class PushSubObserver: NSObject, OSPushSubscriptionObserver {
    static let shared = PushSubObserver()
    func onPushSubscriptionDidChange(state: OSPushSubscriptionChangedState) {
        if let id = state.current.id {
            let prefs = UserDefaults(suiteName: "CapacitorStorage") ?? UserDefaults.standard
            prefs.set(id, forKey: "onesignal_player_id")
        }
    }
}
// ---- end OneSignal observer ----
`;

function patchAppDelegate() {
  if (!fs.existsSync(appDelegatePath)) {
    console.error('❌ AppDelegate.swift not found.');
    process.exit(1);
  }
  let src = fs.readFileSync(appDelegatePath, 'utf8');
  let changed = false;

  // 1. Import OneSignalFramework
  if (!src.includes('import OneSignalFramework')) {
    src = src.replace(/import Capacitor/, 'import Capacitor\nimport OneSignalFramework');
    changed = true;
    console.log('✓ Added OneSignalFramework import');
  } else {
    console.log('• OneSignalFramework import already present');
  }

  // 2. Inject init block into didFinishLaunchingWithOptions
  if (!src.includes('OneSignal.initialize("' + ONESIGNAL_APP_ID + '"')) {
    src = src.replace(
      /func application\(_ application: UIApplication, didFinishLaunchingWithOptions[^{]*\{\s*\n/,
      (match) => `${match}${ONESIGNAL_INIT_BLOCK}`,
    );
    changed = true;
    console.log('✓ Added OneSignal initialization in didFinishLaunchingWithOptions');
  } else {
    console.log('• OneSignal initialization already present');
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
console.log('   2. Open Xcode → Product → Clean Build Folder → ▶️ Run');
