import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const required = [
  'package.json',
  'src',
  'capacitor.config.ts',
  'scripts/ios-sync-verbose.mjs',
  'scripts/capacitor-ios-post-sync.mjs',
  'public/app-icon-1024.png',
];

const missing = required.filter((item) => !fs.existsSync(path.join(root, item)));

console.log('\nVersa iOS helper');
console.log('Folder:', root);

if (missing.length > 0) {
  console.log('\nSTOP. Do not delete anything.');
  console.log('This is not the updated Versa folder.');
  console.log('Missing:', missing.join(', '));
  process.exit(1);
}

const check = spawnSync('node', ['scripts/ios-sync-verbose.mjs', '--check-only'], {
  cwd: root,
  stdio: 'pipe',
  encoding: 'utf8',
  timeout: 30_000,
});

if (check.status !== 0) {
  console.log('\nSTOP. Do not delete anything.');
  console.log('The Apple iOS fixes are not confirmed in this folder.');
  console.log((check.stdout || '').trim());
  console.log((check.stderr || '').trim());
  process.exit(1);
}

console.log('\nGOOD. This folder has the Apple camera/photo/icon fixes.');
console.log('Next: run exactly this one command:');
console.log('\nnpm run ios:update\n');