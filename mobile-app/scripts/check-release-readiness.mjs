import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(appRoot);
const checks = [];

const appJson = readJson(join(appRoot, 'app.json'));
const easJson = readJson(join(appRoot, 'eas.json'));
const packageJson = readJson(join(appRoot, 'package.json'));

check('app name is set', appJson.expo?.name === '웨더체크');
check('app slug is set', appJson.expo?.slug === 'weather-check');
check('iOS bundle id is set', appJson.expo?.ios?.bundleIdentifier === 'com.bskim.weathercheck');
check('Android package is set', appJson.expo?.android?.package === 'com.bskim.weathercheck');
check('iOS location permission copy is set', hasText(appJson.expo?.ios?.infoPlist?.NSLocationWhenInUseUsageDescription));
check('Android location permissions are declared', hasAndroidLocationPermissions(appJson));

[
  'assets/icon.png',
  'assets/favicon.png',
  'assets/android-icon-foreground.png',
  'assets/android-icon-background.png',
  'assets/android-icon-monochrome.png',
].forEach((assetPath) => {
  check(`${assetPath} exists`, existsSync(join(appRoot, assetPath)));
});

check('EAS preview profile builds APK', easJson.build?.preview?.android?.buildType === 'apk');
check('EAS production profile builds AAB', easJson.build?.production?.android?.buildType === 'app-bundle');
check('Android preview script exists', hasScript(packageJson, 'build:android:preview'));
check('Checked Android preview script exists', hasScript(packageJson, 'build:android:preview:checked'));
check('Android API preview script exists', hasScript(packageJson, 'build:android:api-preview'));
check('Android cloud preview script exists', hasScript(packageJson, 'build:android:cloud-preview'));
check('Android production script exists', hasScript(packageJson, 'build:android:production'));
check('EAS login script exists', hasScript(packageJson, 'eas:login'));
check('EAS account check script exists', hasScript(packageJson, 'eas:whoami'));
check('Android preview preflight script exists', hasScript(packageJson, 'check:android-preview'));
check('API web preview script exists', hasScript(packageJson, 'web:api'));
check('PWA web export script exists', hasScript(packageJson, 'export:web'));
check('API web export script exists', hasScript(packageJson, 'export:web:api'));
check('PWA export check script exists', hasScript(packageJson, 'check:pwa'));
check('verify script exists', hasScript(packageJson, 'verify'));
check('EAS CLI dependency exists', hasDependency(packageJson, 'eas-cli'));
check('Expo dependency exists', hasDependency(packageJson, 'expo'));
check('Native location dependency exists', hasDependency(packageJson, 'expo-location'));
check('Native storage dependency exists', hasDependency(packageJson, '@react-native-async-storage/async-storage'));
check('Native map dependency exists', hasDependency(packageJson, 'react-native-maps'));

[
  'docs/05-mvp-release-checklist.md',
  'docs/06-privacy-and-safety-draft.md',
  'docs/07-store-listing-draft.md',
  'docs/09-android-test-build-guide.md',
  'docs/11-local-api-mode-quickstart.md',
  'docs/12-friend-web-test-guide.md',
].forEach((docPath) => {
  check(`${docPath} exists`, existsSync(join(workspaceRoot, docPath)));
});

const failed = checks.filter((item) => !item.ok);

checks.forEach((item) => {
  console.log(`${item.ok ? 'OK' : 'FAIL'} ${item.label}`);
});

if (failed.length > 0) {
  console.error(`\n${failed.length} release readiness check(s) failed.`);
  process.exit(1);
}

console.log('\nRelease readiness checks passed.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function check(label, ok) {
  checks.push({ label, ok: Boolean(ok) });
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasScript(pkg, scriptName) {
  return typeof pkg.scripts?.[scriptName] === 'string' && pkg.scripts[scriptName].trim().length > 0;
}

function hasDependency(pkg, dependencyName) {
  return Boolean(pkg.dependencies?.[dependencyName] || pkg.devDependencies?.[dependencyName]);
}

function hasAndroidLocationPermissions(config) {
  const permissions = config.expo?.android?.permissions;

  return (
    Array.isArray(permissions) &&
    permissions.includes('ACCESS_COARSE_LOCATION') &&
    permissions.includes('ACCESS_FINE_LOCATION')
  );
}
