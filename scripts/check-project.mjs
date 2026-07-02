import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const steps = [
  {
    label: 'secret hygiene',
    cwd: workspaceRoot,
    command: process.execPath,
    args: ['scripts/check-secrets.mjs'],
  },
  {
    label: 'backend verify',
    cwd: join(workspaceRoot, 'backend'),
    command: process.execPath,
    args: ['scripts/verify.mjs'],
  },
  {
    label: 'mobile app verify',
    cwd: join(workspaceRoot, 'mobile-app'),
    command: process.execPath,
    args: ['scripts/verify.mjs'],
  },
];

for (const step of steps) {
  console.log(`\n> ${step.label}`);

  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nProject checks passed.');
