import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ignoredDirs = new Set([
  '.api-mode-check',
  '.backend-create-check',
  '.git',
  '.pnpm-store',
  'dist',
  'dist-phone',
  'node_modules',
]);
const checkedExtensions = new Set([
  '.env',
  '.json',
  '.js',
  '.jsx',
  '.md',
  '.mjs',
  '.ps1',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml',
]);
const allowedFragments = [
  'your-local-service-key',
  'your-local-windy-point-forecast-key',
  'WeatherCheck/0.1 weathercheck.official@gmail.com',
  'weathercheck.official@gmail.com',
];

const findings = [];

walk(workspaceRoot);

if (findings.length > 0) {
  console.error('Potential secret values were found. Move real keys to terminal environment variables.');
  findings.forEach((finding) => {
    console.error(`- ${finding}`);
  });
  process.exit(1);
}

console.log('Secret hygiene check passed.');

function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (ignoredDirs.has(item.name)) continue;
      walk(join(dir, item.name));
      continue;
    }

    if (!item.isFile()) continue;

    const filePath = join(dir, item.name);
    if (!shouldCheckFile(filePath, item.name)) continue;

    checkFile(filePath);
  }
}

function shouldCheckFile(filePath, fileName) {
  if (statSync(filePath).size > 750_000) return false;
  if (fileName === '.env' || fileName.endsWith('.env') || fileName.endsWith('.local')) return true;

  const dotIndex = fileName.lastIndexOf('.');
  const extension = dotIndex >= 0 ? fileName.slice(dotIndex) : '';

  return checkedExtensions.has(extension);
}

function checkFile(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const rel = relative(workspaceRoot, filePath);
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (allowedFragments.some((fragment) => line.includes(fragment))) return;
    if (isCommentOnly(line)) return;

    if (/[A-Fa-f0-9]{48,}/.test(line)) {
      findings.push(`${rel}:${index + 1} long hex-like token`);
    }

    if (/(KMA_SERVICE_KEY|WINDY_API_KEY|EXPO_PUBLIC_KMA_API_KEY|EXPO_PUBLIC_WINDY_API_KEY)\s*=\s*["']?[^"'\s]+/.test(line)) {
      findings.push(`${rel}:${index + 1} provider key assignment`);
    }
  });
}

function isCommentOnly(line) {
  const trimmed = line.trim();

  return trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('*');
}
