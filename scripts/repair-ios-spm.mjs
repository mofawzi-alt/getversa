import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const iosRoot = path.join(root, 'ios', 'App');
const capAppSpmDir = path.join(iosRoot, 'CapApp-SPM');
const capAppSpmPackage = path.join(capAppSpmDir, 'Package.swift');
const spmTemplate = path.join(root, 'node_modules', '@capacitor', 'cli', 'assets', 'ios-spm-template.tar.gz');

const pathsToRemove = [
  path.join(iosRoot, 'App.xcodeproj', 'project.xcworkspace', 'xcshareddata', 'swiftpm', 'Package.resolved'),
  path.join(iosRoot, 'App.xcworkspace', 'xcshareddata', 'swiftpm', 'Package.resolved'),
  path.join(iosRoot, 'CapApp-SPM', '.build'),
  path.join(iosRoot, 'CapApp-SPM', 'Package.resolved'),
  path.join(iosRoot, 'App', 'CapApp-SPM', '.build'),
  path.join(iosRoot, 'App', 'CapApp-SPM', 'Package.resolved'),
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

if (fs.existsSync(iosRoot) && !fs.existsSync(capAppSpmPackage)) {
  if (!fs.existsSync(spmTemplate)) {
    console.error('[ios-spm] STOP: Capacitor iOS SPM template is missing. Run npm install, then npm run ios:update again.');
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'versa-ios-spm-'));
  const extract = spawnSync('tar', ['-xzf', spmTemplate, '-C', tempDir, 'App/CapApp-SPM', 'debug.xcconfig'], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (extract.status !== 0) {
    console.error('[ios-spm] STOP: Could not restore CapApp-SPM.');
    console.error((extract.stderr || extract.stdout || '').trim());
    process.exit(1);
  }

  fs.rmSync(capAppSpmDir, { recursive: true, force: true });
  fs.cpSync(path.join(tempDir, 'App', 'CapApp-SPM'), capAppSpmDir, { recursive: true });
  fs.copyFileSync(path.join(tempDir, 'debug.xcconfig'), path.join(iosRoot, 'debug.xcconfig'));
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('[ios-spm] Restored missing CapApp-SPM package used by Xcode.');
}