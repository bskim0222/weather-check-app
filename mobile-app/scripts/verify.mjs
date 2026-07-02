import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

const steps = [
  {
    label: 'typecheck',
    command: process.execPath,
    args: [require.resolve('typescript/bin/tsc'), '--noEmit'],
  },
  {
    label: 'domain',
    command: process.execPath,
    args: [join(rootDir, 'scripts', 'check-domain.mjs')],
  },
  {
    label: 'pwa-export',
    command: process.execPath,
    args: [
      '-e',
      [
        "const { spawnSync } = await import('node:child_process');",
        "const exportResult = spawnSync(process.execPath, ['./node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', 'dist-phone'], { cwd: process.cwd(), stdio: 'inherit' });",
        "if (exportResult.status !== 0) process.exit(exportResult.status ?? 1);",
        "const postResult = spawnSync(process.execPath, ['./scripts/post-export-pwa.mjs'], { cwd: process.cwd(), stdio: 'inherit' });",
        "if (postResult.status !== 0) process.exit(postResult.status ?? 1);",
        "const checkResult = spawnSync(process.execPath, ['./scripts/check-pwa-export.mjs'], { cwd: process.cwd(), stdio: 'inherit' });",
        "if (checkResult.status !== 0) process.exit(checkResult.status ?? 1);",
      ].join(' '),
    ],
  },
  {
    label: 'mock-api',
    command: process.execPath,
    args: [
      '-e',
      [
        "const { createMockApiServer } = await import('./scripts/mock-api-server.mjs');",
        "const server = createMockApiServer();",
        "await new Promise(resolve => server.listen(8794, '127.0.0.1', resolve));",
        "const response = await fetch('http://127.0.0.1:8794/health').then((item) => item.json());",
        "await new Promise(resolve => server.close(resolve));",
        "if (!response.ok) throw new Error('Mock API health check failed.');",
      ].join(' '),
    ],
  },
  {
    label: 'api-mode',
    command: process.execPath,
    args: [join(rootDir, 'scripts', 'check-api-mode.mjs')],
  },
  {
    label: 'backend-mode',
    command: process.execPath,
    args: [join(rootDir, 'scripts', 'check-backend-mode.mjs')],
  },
  {
    label: 'android-preview',
    command: process.execPath,
    args: [join(rootDir, 'scripts', 'check-android-preview.mjs')],
  },
  {
    label: 'release-readiness',
    command: process.execPath,
    args: [join(rootDir, 'scripts', 'check-release-readiness.mjs')],
  },
];

for (const step of steps) {
  console.log(`\n> ${step.label}`);

  const result = spawnSync(step.command, step.args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nAll verification checks passed.');
