import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const iosDir = path.join(root, 'ios', 'App');
const workspacePath = path.join(iosDir, 'App.xcworkspace');
const podfilePath = path.join(iosDir, 'Podfile');

if (process.platform !== 'darwin') {
  console.log('[ios-spm] Skipping Xcode package resolution outside macOS.');
  process.exit(0);
}

if (!fs.existsSync(podfilePath)) {
  console.error('[ios] STOP: ios/App/Podfile is missing. Run npm run ios:update again.');
  process.exit(1);
}

const xcodebuildCheck = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8' });
if (xcodebuildCheck.status !== 0) {
  console.error('[ios-spm] STOP: Xcode command line tools are not ready. Open Xcode once, then try npm run ios:update again.');
  process.exit(1);
}

console.log('[ios] Installing iOS native dependencies before opening Xcode. This can take a few minutes.');
const podResult = spawnSync('pod', ['install'], {
  cwd: iosDir,
  stdio: 'inherit',
});

if (podResult.status !== 0) {
  console.error('\n[ios] STOP: CocoaPods could not install native dependencies. Xcode was not opened because it would show red module errors.');
  process.exit(podResult.status ?? 1);
}

if (!fs.existsSync(workspacePath)) {
  console.error('[ios] STOP: ios/App/App.xcworkspace was not created. Run npm run ios:update again.');
  process.exit(1);
}

console.log('[ios] iOS native dependencies installed successfully.');