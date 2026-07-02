import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const checks = [];

const appJson = readJson(join(appRoot, 'app.json'));
const easJson = readJson(join(appRoot, 'eas.json'));
const packageJson = readJson(join(appRoot, 'package.json'));
const easIgnorePath = join(appRoot, '.easignore');
const easIgnore = existsSync(easIgnorePath) ? readFileSync(easIgnorePath, 'utf8') : '';

check('Expo app name exists', hasText(appJson.expo?.name));
check('Expo slug is weather-check', appJson.expo?.slug === 'weather-check');
check('Android package is com.bskim.weathercheck', appJson.expo?.android?.package === 'com.bskim.weathercheck');
check('Android versionCode is positive', Number(appJson.expo?.android?.versionCode) > 0);
check('Android location permissions exist', hasAndroidLocationPermissions(appJson));
check('Preview build creates APK', easJson.build?.preview?.android?.buildType === 'apk');
check('Preview build is internal distribution', easJson.build?.preview?.distribution === 'internal');
check('Android preview package script exists', hasScript(packageJson, 'build:android:preview'));
check('Android API preview package script exists', hasScript(packageJson, 'build:android:api-preview'));
check('Android cloud preview package script exists', hasScript(packageJson, 'build:android:cloud-preview'));
check('react-native-maps dependency exists', hasDependency(packageJson, 'react-native-maps'));
check('.easignore exists', existsSync(easIgnorePath));
check('.easignore excludes node_modules', easIgnore.includes('node_modules/'));
check('.easignore excludes dist-phone', easIgnore.includes('dist-phone/'));
check('.easignore excludes logs', easIgnore.includes('logs/'));
check('.easignore excludes local env files', easIgnore.includes('.env'));

[
  'assets/icon.png',
  'assets/android-icon-foreground.png',
  'assets/android-icon-background.png',
  'assets/android-icon-monochrome.png',
  'assets/splash-icon.png',
].forEach((assetPath) => {
  check(`${assetPath} exists and is not empty`, fileExistsWithBytes(join(appRoot, assetPath)));
});

const failed = checks.filter((item) => !item.ok);

checks.forEach((item) => {
  console.log(`${item.ok ? 'OK' : 'FAIL'} ${item.label}`);
});

if (failed.length > 0) {
  console.error(`\n${failed.length} Android preview preflight check(s) failed.`);
  process.exit(1);
}

console.log('\nAndroid preview preflight checks passed.');

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

function fileExistsWithBytes(path) {
  return existsSync(path) && statSync(path).size > 0;
}

function hasAndroidLocationPermissions(config) {
  const permissions = config.expo?.android?.permissions;

  return (
    Array.isArray(permissions) &&
    permissions.includes('ACCESS_COARSE_LOCATION') &&
    permissions.includes('ACCESS_FINE_LOCATION')
  );
}
