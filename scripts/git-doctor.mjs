import { spawnSync } from 'node:child_process';

const run = (label, command, args) => {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('Showing current branch and status', 'git', ['status', '--short', '--branch']);
run('Checking repository integrity', 'git', ['fsck', '--no-dangling']);
run('Refreshing Git index', 'git', ['update-index', '--refresh']);
run('Fetching latest main', 'git', ['fetch', 'origin', 'main', '--prune']);

console.log('\n✅ Git can read this repo. If pull is still stuck, stop it and run: git reset --hard origin/main');
