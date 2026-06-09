/**
 * Safe compatibility wrapper for the old Facebook iOS command.
 * This project uses Swift Package Manager, not CocoaPods.
 */
import { spawnSync } from 'node:child_process';

for (const args of [
  ['scripts/fix-ios-spm-appdelegate.mjs'],
  ['scripts/add-facebook-sdk-plist.mjs'],
]) {
  const result = spawnSync('node', args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\n✅ Facebook iOS setup is patched for Swift Package Manager.');
console.log('Next on your Mac: run npm run ios:update');
