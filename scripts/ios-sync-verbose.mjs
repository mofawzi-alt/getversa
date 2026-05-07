import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const root = process.cwd();

function assertVersaNativePreflight() {
  const requiredFiles = [
    'package.json',
    'src',
    'capacitor.config.ts',
    'scripts/capacitor-ios-post-sync.mjs',
    'public/app-icon-1024.png',
  ];
  const missingFiles = requiredFiles.filter((relativePath) => !existsSync(path.join(root, relativePath)));
  const capConfigPath = path.join(root, 'capacitor.config.ts');
  const postSyncPath = path.join(root, 'scripts', 'capacitor-ios-post-sync.mjs');
  const capConfig = existsSync(capConfigPath) ? readFileSync(capConfigPath, 'utf8') : '';
  const postSync = existsSync(postSyncPath) ? readFileSync(postSyncPath, 'utf8') : '';
  const requiredKeys = [
    'NSCameraUsageDescription',
    'NSPhotoLibraryUsageDescription',
    'NSPhotoLibraryAddUsageDescription',
    'NSFaceIDUsageDescription',
  ];
  const missingPermissionKeys = requiredKeys.filter((key) => !postSync.includes(key));
  const identityMatches = capConfig.includes("appId: 'com.Versa.app'") && capConfig.includes("appName: 'Versa'");

  if (missingFiles.length > 0 || missingPermissionKeys.length > 0 || !identityMatches) {
    console.error('\n❌ Refusing to sync iOS from this folder.');
    if (missingFiles.length > 0) console.error(`Missing required files: ${missingFiles.join(', ')}`);
    if (!identityMatches) console.error('Native app identity does not match Versa.');
    if (missingPermissionKeys.length > 0) console.error(`Missing Apple permission keys: ${missingPermissionKeys.join(', ')}`);
    console.error('This prevents stale/wrong folders from overwriting the Apple fixes.');
    process.exit(1);
  }

  console.log('✅ Versa native preflight passed');
}

assertVersaNativePreflight();

if (args.has('--check-only')) {
  console.log('✅ iOS sync command is safe to run from this folder.');
  process.exit(0);
}

const steps = [
  ...(args.has('--install') ? [{ label: 'Installing dependencies', command: 'npm', args: ['install'] }] : []),
  { label: 'Repairing native build dependency', command: 'npm', args: ['rebuild', 'esbuild'] },
  { label: 'Building web app', command: 'npm', args: ['run', 'build'] },
  { label: 'Syncing iOS project', command: 'npx', args: ['cap', 'sync', 'ios'] },
  { label: 'Patching iOS permissions & app icon', command: 'node', args: ['scripts/capacitor-ios-post-sync.mjs'] },
  { label: 'Clearing stale Xcode package cache', command: 'node', args: ['scripts/repair-ios-spm.mjs'] },
];

if (args.has('--open')) {
  steps.push({ label: 'Opening Xcode', command: 'npx', args: ['cap', 'open', 'ios'] });
}

const stamp = () => new Date().toLocaleTimeString();

function runStep({ label, command, args }) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${stamp()}] ▶ ${label}`);
    console.log(`$ ${command} ${args.join(' ')}`);

    const timeoutMs = label === 'Opening Xcode' ? 30_000 : 10 * 60_000;
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`));
    }, timeoutMs);

    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log(`[${stamp()}] ✓ ${label} complete`);
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });
  });
}

for (const step of steps) {
  await runStep(step);
}

console.log('\n✅ iOS files are synced. If Xcode is already open, press Run ▶️ there.');