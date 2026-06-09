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
  const envPath = path.join(root, '.env');
  const envText = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const requiredEnvKeys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_PROJECT_ID'];
  const missingEnvKeys = requiredEnvKeys.filter((key) => !new RegExp(`^${key}=.+`, 'm').test(envText));
  const capConfigPath = path.join(root, 'capacitor.config.ts');
  const postSyncPath = path.join(root, 'scripts', 'capacitor-ios-post-sync.mjs');
  const capConfig = existsSync(capConfigPath) ? readFileSync(capConfigPath, 'utf8') : '';
  const postSync = existsSync(postSyncPath) ? readFileSync(postSyncPath, 'utf8') : '';
  const requiredKeys = [
    'NSCameraUsageDescription',
    'NSPhotoLibraryUsageDescription',
    'NSPhotoLibraryAddUsageDescription',
    'NSFaceIDUsageDescription',
    'NSLocationWhenInUseUsageDescription',
    'FacebookAppID',
    'FacebookClientToken',
    'FacebookDisplayName',
    'fb2007451096553445',
  ];
  const missingPermissionKeys = requiredKeys.filter((key) => !postSync.includes(key));
  const identityMatches = capConfig.includes("appId: 'com.Versa.app'") && capConfig.includes("appName: 'Versa'");

  if (missingFiles.length > 0 || missingEnvKeys.length > 0 || missingPermissionKeys.length > 0 || !identityMatches) {
    console.error('\n❌ Refusing to sync iOS from this folder.');
    if (missingFiles.length > 0) console.error(`Missing required files: ${missingFiles.join(', ')}`);
    if (missingEnvKeys.length > 0) console.error(`Missing .env keys: ${missingEnvKeys.join(', ')}`);
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
  { label: 'Pruning removed native plugins', command: 'npm', args: ['prune'] },
  { label: 'Clearing stale Xcode package cache', command: 'node', args: ['scripts/repair-ios-spm.mjs'] },
  { label: 'Repairing native build dependency', command: 'npm', args: ['rebuild', 'esbuild'] },
  { label: 'Building web app', command: 'npm', args: ['run', 'build'] },
  { label: 'Syncing iOS project', command: 'npx', args: ['cap', 'sync', 'ios'] },
  { label: 'Patching iOS permissions & app icon', command: 'node', args: ['scripts/capacitor-ios-post-sync.mjs'] },
  { label: 'Repairing iOS Swift package imports', command: 'node', args: ['scripts/fix-ios-spm-appdelegate.mjs'] },
  { label: 'Resolving iOS Swift packages', command: 'node', args: ['scripts/resolve-ios-packages.mjs'] },
  { label: 'Verifying Xcode project before opening', command: 'node', args: ['scripts/apple-release-ready.mjs'] },
];

if (args.has('--open')) {
  steps.push({ label: 'Opening Xcode', command: 'npx', args: ['cap', 'open', 'ios'] });
}

const stamp = () => new Date().toLocaleTimeString();

function runStep({ label, command, args }) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${stamp()}] ▶ ${label}`);
    console.log(`$ ${command} ${args.join(' ')}`);

    const timeoutMs = label === 'Opening Xcode'
      ? 30_000
      : label === 'Resolving iOS Swift packages'
        ? 15 * 60_000
        : 10 * 60_000;
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

console.log('\n✅ iOS files are synced and native packages are resolved. If Xcode is already open, press Run ▶️ there.');