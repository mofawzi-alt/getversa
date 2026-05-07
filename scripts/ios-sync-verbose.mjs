import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const root = process.cwd();

const steps = [
  ...(args.has('--install') ? [{ label: 'Installing dependencies', command: 'npm', args: ['install'] }] : []),
  { label: 'Repairing native build dependency', command: 'npm', args: ['rebuild', 'esbuild'] },
  { label: 'Building web app', command: 'npm', args: ['run', 'build'] },
  { label: 'Syncing iOS project', command: 'npx', args: ['cap', 'sync', 'ios'] },
  { label: 'Patching iOS permissions & app icon', command: 'node', args: ['scripts/patch-ios-plist.mjs'] },
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

if (!existsSync(path.join(root, 'capacitor.config.ts'))) {
  console.error('Run this command from the getversa project folder.');
  process.exit(1);
}

for (const step of steps) {
  await runStep(step);
}

console.log('\n✅ iOS files are synced. If Xcode is already open, press Run ▶️ there.');