import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const mobileDir = dirname(dirname(fileURLToPath(import.meta.url)));
const rootDir = dirname(mobileDir);
const backendDir = join(rootDir, 'backend');
const backendPort = Number(process.env.BACKEND_MODE_CHECK_PORT ?? 8798);
const backendNode = process.execPath;
const outDir = join(mobileDir, '.backend-create-check');
const tsconfigPath = join(outDir, 'tsconfig.json');

const backendProcess = spawn(backendNode, ['src/server.mjs'], {
  cwd: backendDir,
  env: {
    ...process.env,
    PORT: String(backendPort),
  },
  stdio: 'pipe',
});

let backendOutput = '';
backendProcess.stdout.on('data', (chunk) => {
  backendOutput += chunk.toString();
});
backendProcess.stderr.on('data', (chunk) => {
  backendOutput += chunk.toString();
});

try {
  await waitForHealth(`http://127.0.0.1:${backendPort}/health`, () => backendOutput);

  process.env.EXPO_PUBLIC_DATA_MODE = 'api';
  process.env.EXPO_PUBLIC_API_BASE_URL = `http://127.0.0.1:${backendPort}`;

  const checkApiModePath = join(mobileDir, 'scripts', 'check-api-mode.mjs');
  const result = spawn(process.execPath, [checkApiModePath], {
    cwd: mobileDir,
    env: process.env,
    stdio: 'inherit',
  });

  const status = await new Promise((resolve) => {
    result.on('close', resolve);
  });

  if (status !== 0) {
    process.exit(status ?? 1);
  }

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
        include: ['../scripts/check-backend-create-test.ts', '../src/**/*.ts'],
      },
      null,
      2,
    ),
  );

  const tscPath = require.resolve('typescript/bin/tsc');
  const compileResult = spawn(process.execPath, [tscPath, '-p', tsconfigPath], {
    cwd: mobileDir,
    stdio: 'inherit',
  });
  const compileStatus = await new Promise((resolve) => {
    compileResult.on('close', resolve);
  });

  if (compileStatus !== 0) {
    process.exit(compileStatus ?? 1);
  }

  const testModule = await import(
    `file://${join(outDir, 'scripts', 'check-backend-create-test.js').replace(/\\/g, '/')}`
  );
  await testModule.runBackendCreateSmokeCheck();

  console.log('Backend mode smoke checks passed.');
} finally {
  rmSync(outDir, { force: true, recursive: true });
  backendProcess.kill();
}

async function waitForHealth(url, getDebugOutput) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10000) {
    try {
      const response = await fetch(url);

      if (response.ok) return;
    } catch {
      // Server is not ready yet.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  throw new Error(`Backend health check timed out.\n${getDebugOutput()}`);
}
