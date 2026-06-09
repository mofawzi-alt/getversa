import { spawnSync } from 'node:child_process';

if (process.platform !== 'darwin') {
  console.log('[ios] Skipping CocoaPods repo update outside macOS.');
  process.exit(0);
}

const podCheck = spawnSync('pod', ['--version'], { encoding: 'utf8' });
if (podCheck.status !== 0) {
  console.error('[ios] STOP: CocoaPods is not installed. Run: sudo gem install cocoapods');
  process.exit(1);
}

console.log('[ios] Updating CocoaPods spec repo so the latest OneSignal/Facebook pods are available. This can take 1-3 minutes the first time.');

// Use the modern CDN-backed repo update (fast). Falls back to full update if needed.
let result = spawnSync('pod', ['repo', 'update', '--silent'], { stdio: 'inherit' });

if (result.status !== 0) {
  console.log('[ios] First repo update attempt failed, retrying with full update...');
  result = spawnSync('pod', ['repo', 'update'], { stdio: 'inherit' });
}

if (result.status !== 0) {
  console.error('[ios] STOP: pod repo update failed. Check your internet connection and try again.');
  process.exit(result.status ?? 1);
}

console.log('[ios] CocoaPods spec repo is up to date.');
