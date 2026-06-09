/**
 * Legacy no-op. Push now uses the official @onesignal/capacitor-plugin.
 * Do not inject OneSignalFramework into AppDelegate.swift; that causes Xcode
 * "Unable to resolve module dependency" errors in the Capacitor 8 SPM project.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync('node', ['scripts/fix-ios-spm-appdelegate.mjs'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

console.log('\n✅ OneSignal uses the official Capacitor plugin. No manual iOS SDK patch is needed.');
console.log('Next on your Mac: run npm run ios:update');
