import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMockApiServer } from './mock-api-server.mjs';

const require = createRequire(import.meta.url);
const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(rootDir, '.api-mode-check');
const tsconfigPath = join(outDir, 'tsconfig.json');
const apiPort = Number(process.env.API_MODE_CHECK_PORT ?? 8795);

rmSync(outDir, { force: true, recursive: true });
mkdirSync(outDir, { recursive: true });

writeFileSync(
  tsconfigPath,
  JSON.stringify(
    {
      extends: '../tsconfig.json',
      compilerOptions: {
        module: 'Node16',
        moduleResolution: 'Node16',
        outDir: '.',
        rootDir: '..',
        noEmit: false,
        noEmitOnError: true,
      },
      include: ['../scripts/check-api-mode-test.ts', '../src/**/*.ts'],
    },
    null,
    2,
  ),
);

const tscPath = require.resolve('typescript/bin/tsc');
const result = spawnSync(process.execPath, [tscPath, '-p', tsconfigPath], {
  cwd: rootDir,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (result.status !== 0) {
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  rmSync(outDir, { force: true, recursive: true });
  process.exit(result.status ?? 1);
}

const server = createMockApiServer();

try {
  await new Promise((resolve) => {
    server.listen(apiPort, '127.0.0.1', resolve);
  });

  process.env.EXPO_PUBLIC_DATA_MODE = 'api';
  process.env.EXPO_PUBLIC_API_BASE_URL = `http://127.0.0.1:${apiPort}`;

  const testModule = await import(`file://${join(outDir, 'scripts', 'check-api-mode-test.js').replace(/\\/g, '/')}`);
  await testModule.runApiModeSmokeCheck();
  console.log('API mode smoke checks passed.');
} finally {
  await new Promise((resolve) => {
    server.close(resolve);
  });
  rmSync(outDir, { force: true, recursive: true });
}
