# ScribeFold AI Release Process

## Overview
This document explains how versioning works across the entire release pipeline to ensure consistency.

## Version Flow (Single Source of Truth)

```
apps/desktop-app/package.json (version: "1.0.7")
    ↓
scripts/release.js (updates package.json, creates git tag v1.0.7)
    ↓
Git Tag (v1.0.7) pushed to GitHub
    ↓
GitHub Actions Workflow (.github/workflows/release.yml)
    ↓
Electron Builder (reads package.json version)
    ↓
Generates: ScribeFold.AI-Setup-1.0.7.exe
    ↓
GitHub Release (tagged v1.0.7, contains ScribeFold.AI-Setup-1.0.7.exe)
    ↓
Web Portal Downloads Page (fetches releases, shows v1.0.7 with correct .exe)
```

## How to Create a Release

### Option 1: Auto-bump patch version
```bash
npm run release
```
This will:
- Increment patch version (1.0.7 → 1.0.8)
- Update `apps/desktop-app/package.json`
- Commit the change
- Create git tag `v1.0.8`
- Push commit and tag to GitHub
- Trigger GitHub Actions workflow

### Option 2: Set specific version
```bash
npm run release -- -v1.2.0
```
This will:
- Set version to 1.2.0
- Update `apps/desktop-app/package.json`
- Commit the change
- Create git tag `v1.2.0`
- Push commit and tag to GitHub
- Trigger GitHub Actions workflow

## What Happens in GitHub Actions

1. **Version Verification** (NEW!)
   - Workflow checks that git tag matches `package.json` version
   - If `v1.0.8` tag but `package.json` has `1.0.7`, build FAILS
   - This prevents version mismatches

2. **Build Process**
   - Windows: Creates `ScribeFold.AI-Setup-1.0.8.exe`
   - macOS: Creates `ScribeFold.AI-1.0.8.dmg`
   - Linux: Creates `ScribeFold.AI-1.0.8.AppImage`
   - All use `${version}` from `package.json`

3. **Release Creation**
   - Creates GitHub Release with tag `v1.0.8`
   - Attaches all built artifacts
   - Release name: `v1.0.8`

## Downloads Page Behavior

The web portal downloads page:
- Fetches all releases from GitHub API (via secure backend proxy)
- Filters out:
  - Releases without assets
  - Malformed tags (e.g., just "v" instead of "v1.0.7")
- Shows dropdown with valid releases (e.g., `v1.0.7`, `v1.0.6`)
- Auto-selects latest release
- Reads actual asset names from GitHub API
- Generates download URLs like:
  ```
  https://github.com/AbeApple/scribefold-ai-monorepo/releases/download/v1.0.7/ScribeFold.AI-Setup-1.0.7.exe
  ```

## Key Files

### Version Source
- `apps/desktop-app/package.json` - Single source of truth for version number

### Build Configuration
- `apps/desktop-app/package.json` (build section) - Defines artifact naming:
  ```json
  "win": {
    "artifactName": "${productName}-Setup-${version}.${ext}"
  }
  ```

### Release Automation
- `scripts/release.js` - Manages version bumping and git tagging
- `.github/workflows/release.yml` - Builds and creates GitHub releases

### Downloads Page
- `apps/web-portal/src/pages/DownloadsPage.js` - Fetches and displays releases
- `apps/api-server/server.js` (GET /api/releases) - Secure proxy to GitHub API

## Troubleshooting

### Problem: Release has wrong .exe version
**Cause**: `package.json` version didn't match git tag when workflow ran

**Solution**: 
- Always use `npm run release` to create releases
- Never manually create git tags
- Workflow now verifies version match before building

### Problem: Downloads page shows "v" in dropdown
**Cause**: Malformed release with tag "v" exists on GitHub

**Solution**:
- Downloads page now filters out malformed tags
- Delete bad releases from GitHub if needed
- Use `npm run release` for future releases

### Problem: Multiple .exe files in one release
**Cause**: Manually uploading assets or re-running workflow with different versions

**Solution**:
- Each release should only have one .exe (from one workflow run)
- Delete and recreate release if needed
- Use `npm run release` to ensure clean releases

## Version Verification

The workflow now includes these checks:

```yaml
- name: Verify version matches tag
  run: |
    PKG_VERSION=$(node -p "require('./apps/desktop-app/package.json').version")
    GIT_TAG="${{ github.ref_name }}"
    if [ "$GIT_TAG" != "v$PKG_VERSION" ]; then
      echo "❌ Version mismatch!"
      exit 1
    fi
```

This ensures:
- Git tag `v1.0.8` → `package.json` must have `"version": "1.0.8"`
- Prevents building wrong versions
- Fails fast if versions don't match

## Best Practices

1. **Always use `npm run release`** - Don't manually edit versions or create tags
2. **One release = one version** - Don't upload multiple versions to same release
3. **Check workflow logs** - Verify version verification passes
4. **Test downloads page** - Confirm correct version shows and downloads
5. **Delete bad releases** - Remove any malformed releases from GitHub

## Current Status

- ✅ Version verification added to workflow
- ✅ Downloads page filters malformed releases
- ✅ Artifact naming uses `${version}` from package.json
- ✅ Release script handles git tagging automatically
- ✅ Secure API proxy for private repo releases

## Next Release

To create the next release (e.g., v1.0.8):

```bash
# Make sure you're on main branch with latest changes
git checkout main
git pull

# Run release script
npm run release

# Monitor workflow
# https://github.com/AbeApple/scribefold-ai-monorepo/actions

# After ~10 minutes, check downloads page
# https://scribefold.ai/downloads
```

The downloads page will automatically show the new version once the workflow completes.
