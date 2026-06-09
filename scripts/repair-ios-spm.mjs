import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const iosRoot = path.join(root, 'ios', 'App');
const capAppSpmDir = path.join(iosRoot, 'CapApp-SPM');
const capAppSpmPackage = path.join(capAppSpmDir, 'Package.swift');
const podsTemplate = path.join(root, 'node_modules', '@capacitor', 'cli', 'assets', 'ios-pods-template.tar.gz');

function extractPodsTemplate() {
  if (!fs.existsSync(podsTemplate)) {
    console.error('[ios] STOP: Capacitor iOS Pods template is missing. Run npm install, then npm run ios:update again.');
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'versa-ios-pods-'));
  const extract = spawnSync('tar', ['-xzf', podsTemplate, '-C', tempDir], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (extract.status !== 0) {
    console.error('[ios] STOP: Could not restore generated iOS files.');
    console.error((extract.stderr || extract.stdout || '').trim());
    process.exit(1);
  }

  return tempDir;
}

function restoreMissingGeneratedIosFiles() {
  const usingBrokenSpmProject = fs.existsSync(capAppSpmDir);
  const requiredGeneratedPaths = [
    'App.xcodeproj',
    'App/AppDelegate.swift',
    'App/Base.lproj/Main.storyboard',
    'App/Base.lproj/LaunchScreen.storyboard',
    'Podfile',
  ];
  const missingGeneratedPaths = requiredGeneratedPaths.filter((relativePath) => {
    const target = path.join(iosRoot, relativePath);
    return !fs.existsSync(target);
  });

  const pathsToRestore = usingBrokenSpmProject
    ? Array.from(new Set(['App.xcodeproj', 'Podfile', ...missingGeneratedPaths]))
    : missingGeneratedPaths;

  if (pathsToRestore.length === 0) return;

  fs.mkdirSync(iosRoot, { recursive: true });
  const tempDir = extractPodsTemplate();
  const templateRoot = path.join(tempDir, 'App');

  for (const relativePath of pathsToRestore) {
    const source = path.join(templateRoot, relativePath);
    const target = path.join(iosRoot, relativePath);
    if (!fs.existsSync(source)) {
      console.log(`[ios] Skipped (not in template): ios/App/${relativePath}`);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (usingBrokenSpmProject && fs.existsSync(target) && ['App.xcodeproj', 'Podfile'].includes(relativePath)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
    fs.cpSync(source, target, { recursive: true });
    console.log(`[ios] Restored generated iOS file/folder: ios/App/${relativePath}`);
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
}

restoreMissingGeneratedIosFiles();

const pathsToRemove = [
  path.join(iosRoot, 'App.xcodeproj', 'project.xcworkspace', 'xcshareddata', 'swiftpm', 'Package.resolved'),
  path.join(iosRoot, 'App.xcworkspace', 'xcshareddata', 'swiftpm', 'Package.resolved'),
  path.join(iosRoot, 'CapApp-SPM', '.build'),
  path.join(iosRoot, 'CapApp-SPM', 'Package.resolved'),
  path.join(iosRoot, 'CapApp-SPM'),
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
  console.log(`[ios] Removed stale Swift Package state: ${target}`);
}

if (removed === 0) {
  console.log('[ios] No stale Swift Package state found.');
} else {
  console.log(`[ios] Cleaned ${removed} stale Swift Package ${removed === 1 ? 'entry' : 'entries'}.`);
}

if (fs.existsSync(iosRoot) && !fs.existsSync(capAppSpmPackage)) {
  restoreMissingGeneratedIosFiles();
}