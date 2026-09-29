// Builds the Android app (APK) of LIMS Mobile and copies it to downloads/LIMS-Mobile.apk, where the
// LIMS server offers it to phones (Calendar Sessions → Mobile app → Android app).
//   npm run apk
// Needs JDK 21 and the Android SDK. Uses JAVA_HOME / ANDROID_HOME when set, otherwise the per-user
// installs under %LOCALAPPDATA% (Programs\jdk-21*, Android\Sdk).

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'android');
const localAppData = process.env.LOCALAPPDATA ?? '';

const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

const findJdk = () => {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const programs = path.join(localAppData, 'Programs');
  if (!existsSync(programs)) return null;
  const jdk = readdirSync(programs).find((name) => /^jdk-21/i.test(name));
  return jdk ? path.join(programs, jdk) : null;
};

const findSdk = () => {
  for (const candidate of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(localAppData, 'Android', 'Sdk')]) {
    if (candidate && existsSync(path.join(candidate, 'platforms'))) return candidate;
  }
  return null;
};

const windows = process.platform === 'win32';

// The phone app shows only the /m screens: drop the session recordings and the speech-to-text engine
// (about 40 MB) from its copy of the web build, then hand that copy to the Android project.
const webDir = path.join(root, 'dist-app');
if (!existsSync(webDir)) fail('dist-app/ not found. Run `npm run apk`, which builds it first.');
rmSync(path.join(webDir, 'media'), { recursive: true, force: true });
readdirSync(path.join(webDir, 'assets'))
  .filter((name) => name.endsWith('.wasm'))
  .forEach((name) => rmSync(path.join(webDir, 'assets', name)));
if (spawnSync('npx', ['cap', 'sync', 'android'], { cwd: root, stdio: 'inherit', shell: windows }).status !== 0) fail('npx cap sync android failed.');

const javaHome = findJdk();
if (!javaHome) fail('JDK 21 not found. Install it, or set JAVA_HOME.');
const sdk = findSdk();
if (!sdk) fail('Android SDK not found. Install it, or set ANDROID_HOME.');

// Gradle reads the SDK location from android/local.properties (not committed; it is machine-specific).
writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}\n`);

// Full, quoted path: the project folder may contain spaces, and cmd does not always look in the working folder.
const gradlew = windows ? `"${path.join(androidDir, 'gradlew.bat')}"` : './gradlew';
const result = spawnSync(gradlew, ['assembleDebug', '--console=plain'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: windows,
  env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk, PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH}` },
});
if (result.status !== 0) fail('The Android build failed (see the Gradle output above).');

const built = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(built)) fail(`Built APK not found at ${built}.`);
const downloads = path.join(root, 'downloads');
mkdirSync(downloads, { recursive: true });
const target = path.join(downloads, 'LIMS-Mobile.apk');
copyFileSync(built, target);
console.log(`\n✔ ${path.relative(root, target)} (${(statSync(target).size / 1024 / 1024).toFixed(1)} MB)`);
console.log('  Phones can download it from Calendar Sessions → Mobile app → Android app while LIMS is running.\n');
