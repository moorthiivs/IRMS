import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

function run(command, cwd = process.cwd()) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: 'inherit', cwd });
}

console.log('🚀 Starting fully automated release process...');

try {
  // 1. Build the Vite React frontend
  console.log('\n📦 Building Web App...');
  run('npm run build');

  // 2. Sync assets with Capacitor
  console.log('\n🔄 Syncing Capacitor...');
  run('npx cap sync android');

  // 3. Build the Android APK using Gradle
  console.log('\n🤖 Building Android APK...');
  const isWindows = process.platform === 'win32';
  const gradleCmd = isWindows ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug';
  run(gradleCmd, join(process.cwd(), 'android'));

  // 4. Copy the newly generated APK to public/irms.apk
  console.log('\n📋 Copying APK to public folder...');
  const sourceApk = join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const destApk = join(process.cwd(), 'public', 'irms.apk');
  
  if (existsSync(sourceApk)) {
    copyFileSync(sourceApk, destApk);
    console.log('✅ Successfully copied APK to public/irms.apk');
  } else {
    throw new Error('❌ Source APK not found! Build might have failed.');
  }

  // 5. Git operations
  console.log('\n🐙 Pushing to GitHub...');
  run('git add .');
  try {
    run('git commit -m "chore: auto-build and release APK [skip ci]"');
  } catch (e) {
    console.log('No changes to commit, proceeding to push...');
  }
  run('git push');

  console.log('\n🎉 Release process completed successfully!');
} catch (error) {
  console.error('\n❌ Release process failed!');
  process.exit(1);
}
