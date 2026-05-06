const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const DESKTOP_PKG_PATH = './apps/scribefold-editor/package.json';
const LOG_FILE = './release.log';

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  fs.appendFileSync(LOG_FILE, line + '\n');
  console.log(line);
}

function exec(command, description) {
  log(`Executing: ${description}`);
  try {
    const output = execSync(command, { encoding: 'utf8' });
    if (output) log(`Output: ${output.trim()}`);
    return output;
  } catch (error) {
    log(`ERROR: ${error.message}`);
    throw error;
  }
}

// Initialize log
fs.writeFileSync(LOG_FILE, `Release Script Log - ${new Date().toISOString()}\n\n`);

try {
  log('=== RELEASE SCRIPT STARTED ===');

  // Parse arguments
  const args = process.argv.slice(2);
  const versionArg = args.find(arg => arg.startsWith('-v')) || '--bump';
  log(`Version argument: ${versionArg}`);

  // Load current package.json
  const pkgPath = path.resolve(DESKTOP_PKG_PATH);
  log(`Loading package.json from: ${pkgPath}`);
  
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`Package.json not found at ${pkgPath}`);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;
  log(`Current version: ${currentVersion}`);

  // Determine new version
  let newVersion;
  if (versionArg === '--bump') {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    newVersion = `${major}.${minor}.${patch + 1}`;
    log(`Auto-bumping patch version: ${currentVersion} -> ${newVersion}`);
  } else if (versionArg.startsWith('-v')) {
    newVersion = versionArg.substring(2);
    if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
      throw new Error(`Invalid version format: ${newVersion}. Must be X.Y.Z`);
    }
    log(`Setting explicit version: ${currentVersion} -> ${newVersion}`);
  } else {
    throw new Error('Usage: npm run release OR npm run release -- -v1.0.5');
  }

  // Update package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  log(`✓ Updated ${DESKTOP_PKG_PATH} to version ${newVersion}`);

  // Verify the file was written
  const verifyPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (verifyPkg.version !== newVersion) {
    throw new Error(`Version verification failed! Expected ${newVersion}, got ${verifyPkg.version}`);
  }
  log(`✓ Verified package.json contains version ${newVersion}`);

  // Git operations
  log('--- Starting Git Operations ---');

  // Check for uncommitted changes
  const status = exec('git status --porcelain', 'Check git status');
  log(`Git status: ${status ? 'Has changes' : 'Clean'}`);

  // Stage the package.json
  exec(`git add ${DESKTOP_PKG_PATH}`, 'Stage package.json');
  log(`✓ Staged ${DESKTOP_PKG_PATH}`);

  // Commit the version change
  exec(`git commit -m "release: bump version to v${newVersion}"`, 'Commit version change');
  log(`✓ Created commit for v${newVersion}`);

  // Delete existing tag if present (local and remote)
  try {
    log(`Checking for existing tag v${newVersion}...`);
    exec(`git tag -d v${newVersion}`, 'Delete local tag');
    exec(`git push origin :refs/tags/v${newVersion}`, 'Delete remote tag');
    log(`✓ Removed existing tag v${newVersion}`);
  } catch (e) {
    log(`No existing tag v${newVersion} found (this is normal)`);
  }

  // Create new tag
  exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`, 'Create annotated tag');
  log(`✓ Created tag v${newVersion}`);

  // Push everything
  exec('git push origin HEAD', 'Push commit to origin');
  log(`✓ Pushed commit to origin`);

  exec(`git push origin v${newVersion}`, 'Push tag to origin');
  log(`✓ Pushed tag v${newVersion} to origin`);

  // Verify remote state
  const remoteTags = exec('git ls-remote --tags origin', 'List remote tags');
  if (remoteTags.includes(`v${newVersion}`)) {
    log(`✓ Verified tag v${newVersion} exists on remote`);
  } else {
    throw new Error(`Tag v${newVersion} not found on remote!`);
  }

  log('=== RELEASE SCRIPT COMPLETED SUCCESSFULLY ===');
  log(`Version: v${newVersion}`);
  log(`GitHub Actions should now be triggered`);
  log(`Downloads page will update once workflow completes`);
  
  console.log('\n✅ Release v' + newVersion + ' completed successfully!');
  console.log('📋 Check release.log for detailed information');
  console.log('🔗 Monitor workflow: https://github.com/OnTheMark1994/neoscribe/actions');

} catch (error) {
  log(`\n💥 FATAL ERROR: ${error.message}`);
  log(`Stack trace: ${error.stack}`);
  console.error('\n❌ Release failed! Check release.log for details');
  process.exit(1);
}
