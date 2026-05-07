import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const root = process.cwd();

const steps = [
  ...(args.has('--install') ? [{ label: 'Installing dependencies', command: 'npm', args: ['install'] }] : []),
  { label: 'Building web app', command: 'npm', args: ['run', 'build'] },
  { label: 'Syncing iOS project', command: 'npx', args: ['cap', 'sync', 'ios'] },
];

if (args.has('--open')) {
  steps.push({ label: 'Opening Xcode', command: 'npx', args: ['cap', 'open', 'ios'] });
}

const stamp = () => new Date().toLocaleTimeString();

function runStep({ label, command, args }) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${stamp()}] ▶ ${label}`);
    console.log(`$ ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
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