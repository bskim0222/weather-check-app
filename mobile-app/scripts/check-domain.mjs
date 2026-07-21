import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(rootDir, '.domain-check');
const tsconfigPath = join(outDir, 'tsconfig.json');

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
      include: ['../scripts/check-domain-test.ts', '../src/**/*.ts'],
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

try {
  const domainTests = await import(`file://${join(outDir, 'scripts', 'check-domain-test.js').replace(/\\/g, '/')}`);
  await domainTests.verifyPersistentDeviceIdentity?.();
} finally {
  rmSync(outDir, { force: true, recursive: true });
}
