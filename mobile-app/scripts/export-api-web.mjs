import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const expoCli = join(appRoot, 'node_modules', 'expo', 'bin', 'cli');
const distRoot = join(appRoot, 'dist-phone');

const env = {
  ...process.env,
  CI: process.env.CI ?? '1',
  EXPO_NO_TELEMETRY: '1',
  EXPO_PUBLIC_DATA_MODE: 'api',
  EXPO_PUBLIC_API_BASE_URL:
    process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://weather-check-backend-hvfs.onrender.com',
};

if (existsSync(distRoot)) {
  rmSync(distRoot, { recursive: true, force: true });
}

run(process.execPath, [expoCli, 'export', '--platform', 'web', '--output-dir', 'dist-phone', '--clear']);
run(process.execPath, [join(appRoot, 'scripts', 'post-export-pwa.mjs')]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
