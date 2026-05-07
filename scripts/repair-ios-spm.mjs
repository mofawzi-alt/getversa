import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const iosRoot = path.join(root, 'ios', 'App');

const pathsToRemove = [
  path.join(iosRoot, 'App.xcodeproj', 'project.xcworkspace', 'xcshareddata', 'swiftpm', 'Package.resolved'),
  path.join(iosRoot, 'App.xcworkspace', 'xcshareddata', 'swiftpm', 'Package.resolved'),
  path.join(iosRoot, 'App', 'CapApp-SPM', '.build'),
  path.join(os.homedir(), 'Library', 'Caches', 'org.swift.swiftpm'),
  path.join(os.homedir(), 'Library', 'Developer', 'Xcode', 'DerivedData'),
];

let removed = 0;

for (const target of pathsToRemove) {
  if (!fs.existsSync(target)) continue;
  fs.rmSync(target, { recursive: true, force: true });
  removed += 1;
  console.log(`[ios-spm] Removed stale Xcode package state: ${target}`);
}

if (removed === 0) {
  console.log('[ios-spm] No stale Xcode package state found.');
} else {
  console.log(`[ios-spm] Cleaned ${removed} stale Swift Package cache ${removed === 1 ? 'entry' : 'entries'}.`);
}