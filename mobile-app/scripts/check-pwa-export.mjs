import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distRoot = join(appRoot, 'dist-phone');
const checks = [];

const indexPath = join(distRoot, 'index.html');
const manifestPath = join(distRoot, 'manifest.webmanifest');
const iconPath = join(distRoot, 'pwa', 'icon.png');

check('dist-phone/index.html exists', existsSync(indexPath));
check('manifest.webmanifest exists', existsSync(manifestPath));
check('PWA icon exists', existsSync(iconPath));

if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, 'utf8');
  check('index links manifest', html.includes('rel="manifest"'));
  check('index has apple touch icon', html.includes('apple-touch-icon'));
  check('index has theme color', html.includes('theme-color'));
}

if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  check('manifest name is set', manifest.name === '웨더체크');
  check('manifest display is standalone', manifest.display === 'standalone');
  check('manifest has icons', Array.isArray(manifest.icons) && manifest.icons.length >= 2);
}

const failed = checks.filter((item) => !item.ok);
checks.forEach((item) => {
  console.log(`${item.ok ? 'OK' : 'FAIL'} ${item.label}`);
});

if (failed.length > 0) {
  console.error(`\n${failed.length} PWA export check(s) failed.`);
  process.exit(1);
}

console.log('\nPWA export checks passed.');

function check(label, ok) {
  checks.push({ label, ok: Boolean(ok) });
}
