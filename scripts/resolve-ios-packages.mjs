import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const projectPath = path.join(root, 'ios', 'App', 'App.xcodeproj');

if (process.platform !== 'darwin') {
  console.log('[ios-spm] Skipping Xcode package resolution outside macOS.');
  process.exit(0);
}

if (!fs.existsSync(projectPath)) {
  console.error('[ios-spm] STOP: ios/App/App.xcodeproj is missing. Run npm run ios:update again.');
  process.exit(1);
}

const xcodebuildCheck = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8' });
if (xcodebuildCheck.status !== 0) {
  console.error('[ios-spm] STOP: Xcode command line tools are not ready. Open Xcode once, then try npm run ios:update again.');
  process.exit(1);
}

console.log('[ios-spm] Resolving Xcode Swift packages before opening Xcode. This can take a few minutes.');
const result = spawnSync('xcodebuild', [
  '-resolvePackageDependencies',
  '-project', projectPath,
  '-scheme', 'App',
], {
  cwd: path.join(root, 'ios', 'App'),
  stdio: 'inherit',
});

if (result.status !== 0) {
  console.error('\n[ios-spm] STOP: Xcode could not resolve native packages. Xcode was not opened because it would show red module errors.');
  process.exit(result.status ?? 1);
}

console.log('[ios-spm] Xcode Swift packages resolved successfully.');