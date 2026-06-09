import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDelegatePath = path.join(root, 'ios', 'App', 'App', 'AppDelegate.swift');

// Known-good AppDelegate for Versa using Swift Package Manager.
// Do NOT import OneSignalFramework or FacebookCore here — those are handled
// by Capacitor plugins. Importing them directly breaks the Xcode build.
const TEMPLATE = `import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
`;

function patchAppDelegate() {
  const dir = path.dirname(appDelegatePath);
  if (!fs.existsSync(dir)) {
    console.error('[ios-spm] STOP: ios/App/App directory is missing. Run npm run ios:update again.');
    process.exit(1);
  }

  const current = fs.existsSync(appDelegatePath) ? fs.readFileSync(appDelegatePath, 'utf8') : '';
  if (current === TEMPLATE) {
    console.log('[ios-spm] AppDelegate.swift already matches known-good Versa template');
    return;
  }

  fs.writeFileSync(appDelegatePath, TEMPLATE, 'utf8');
  console.log('[ios-spm] Rewrote AppDelegate.swift from known-good Versa template');
}

patchAppDelegate();
