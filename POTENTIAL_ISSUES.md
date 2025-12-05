# ⚠️ Potential Issues & Critical Notes

This document identifies potential issues that were **AVOIDED** in the current setup, plus items that need attention.

## 🚨 Major Issues AVOIDED (From Original Plan)

### 1. ❌ Git Repository Bloat (FIXED)
**Original Problem:** Committing 500MB builds would make repo unmaintainably large.

**Solution Implemented:**
- Builds go to GitHub Releases (unlimited free storage)
- `.gitignore` blocks all build artifacts
- Only source code is committed

### 2. ❌ Hardcoded Version Numbers (FIXED)
**Original Problem:** Download links like `/downloads/ScribeFold.AI.Setup.1.0.0.exe` require manual updates.

**Solution Implemented:**
- Download page fetches from GitHub API
- Version comes from `package.json` (single source of truth)
- Completely automatic - no manual updates needed

### 3. ❌ Concurrent GitHub Actions Conflicts (FIXED)
**Original Problem:** Three jobs pushing builds simultaneously causes merge conflicts.

**Solution Implemented:**
- All builds upload to artifacts first
- Single job creates release after all builds complete
- No git commits from Actions - uses GitHub Releases API

### 4. ❌ Environment Variables Not Being Gitignored (FIXED)
**Original Problem:** Would commit secrets to git.

**Solution Implemented:**
- `.gitignore` blocks all `.env` files
- `.env.example` templates provided instead
- Secrets configured in Render dashboard

## ⚠️ Items Requiring Your Attention

### 1. Update GitHub Username/Repo Name

**Files to Update:**

**`apps/desktop-app/package.json`** (line 97-98):
```json
"publish": {
  "provider": "github",
  "owner": "YOUR-GITHUB-USERNAME",  // ← Change this
  "repo": "scribefold-ai"           // ← Change if repo name differs
}
```

**`apps/web-portal/src/constants.js`** (line 7):
```javascript
export const GITHUB_REPO = process.env.REACT_APP_GITHUB_REPO || 'YOUR-USERNAME/scribefold-ai';
```

Or set in `apps/web-portal/.env`:
```env
REACT_APP_GITHUB_REPO=YOUR-USERNAME/scribefold-ai
```

### 2. Create .env Files Locally

**CRITICAL:** Copy `.env.example` to `.env` in each app folder and fill in real values:

```bash
cp apps/desktop-app/.env.example apps/desktop-app/.env
cp apps/web-portal/.env.example apps/web-portal/.env
cp apps/api-server/.env.example apps/api-server/.env
```

Then edit each `.env` file with your actual credentials.

### 3. Render.com Environment Variables

After connecting to Render, manually add env vars in the dashboard for:

**API Server (scribefold-ai-api):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEEPSEEK_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_*` (4 tier IDs)
- `STRIPE_PAYMENT_LINK_*` (4 payment links)
- `FRONTEND_URL` (set to your web portal's Render URL)

**Web Portal (scribefold-ai-web-portal):**
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_API_BASE_URL` (set to your API's Render URL)
- `REACT_APP_GITHUB_REPO`
- `REACT_APP_STRIPE_CUSTOMER_PORTAL_URL`

### 4. Clean Up Duplicate Files

**NOTE:** You have two download page files:
- `apps/web-portal/src/pages/DownloadPage.js` (new, GitHub API version)
- `apps/web-portal/src/pages/DownloadsPage.js` (existing, uses new GitHub API version)

The existing `DownloadsPage.js` has been updated with the GitHub API integration. You can delete `DownloadPage.js` and `DownloadPage.css` if they were accidentally created as duplicates.

## ✅ Verified Safe Items

### Git Configuration
- ✅ `.gitignore` blocks `.env`, `node_modules`, builds
- ✅ `.env.example` files are allowed (safe to commit)
- ✅ Build artifacts go to GitHub Releases, not git

### Naming Issues
- ✅ Folder names are consistent (`desktop-app`, `web-portal`, `api-server`)
- ✅ No references to old folder names found
- ✅ All import paths checked and valid

### Environment Variables
- ✅ All hardcoded URLs replaced with `process.env` references
- ✅ Fallback values provided for development
- ✅ Templates created for all services

### Deployment Configuration
- ✅ `render.yaml` properly scoped to app folders
- ✅ Build commands correct for each service
- ✅ GitHub Actions workflow tested pattern

## 🔍 Areas That May Need Testing

### 1. GitHub Actions First Run
**Potential Issue:** First release might fail if:
- GitHub username/repo not updated in `package.json`
- Tag format doesn't match pattern `v*.*.*`

**Test:** Create a test tag `v0.0.1` and verify workflow runs.

### 2. Download Page on First Load
**Potential Issue:** Will show error until first release exists.

**Expected Behavior:** Shows "No releases available yet" - this is correct.

**Fix:** Create first release with `git tag v1.0.0 && git push --tags`

### 3. Render.com Environment Variables
**Potential Issue:** Service won't fully work until all env vars configured.

**Test:** Check Render logs after deployment for missing env var errors.

### 4. CORS on API Server
**Potential Issue:** Web portal might be blocked by CORS.

**Check:** `apps/api-server/server.js` should have CORS configured.

**Current Status:** Need to verify CORS allows your Render URLs.

### 5. Electron Build Icons
**Potential Issue:** Build might fail if icon files missing.

**Files Required:**
- `apps/desktop-app/public/icon.ico` (Windows)
- `apps/desktop-app/public/icon.icns` (macOS)
- `apps/desktop-app/public/icon.png` (Linux)

**Action:** Verify these files exist before first release.

## 🎯 Pre-Push Checklist

Before pushing to GitHub:

- [ ] Updated GitHub username in `apps/desktop-app/package.json`
- [ ] Updated `REACT_APP_GITHUB_REPO` in web portal constants
- [ ] Created local `.env` files (not committed, just for testing)
- [ ] Ran `npm install` in all three apps
- [ ] Tested desktop app starts: `cd apps/desktop-app && npm start`
- [ ] Tested web portal starts: `cd apps/web-portal && npm start`
- [ ] Tested API server starts: `cd apps/api-server && npm start`
- [ ] Verified `.gitignore` is working (check `git status` doesn't show `.env` or `node_modules`)
- [ ] Verified icon files exist in `apps/desktop-app/public/`

## 🚀 Post-Push Checklist

After pushing to GitHub:

- [ ] Repository created on GitHub
- [ ] Code pushed successfully
- [ ] Connected to Render.com via Blueprint
- [ ] Both services created (API and Web Portal)
- [ ] Environment variables configured in Render dashboard
- [ ] Services deployed successfully
- [ ] API health check working
- [ ] Web portal loading
- [ ] Created first release tag (`v1.0.0`)
- [ ] GitHub Actions workflow completed
- [ ] Release created with installers
- [ ] Download page showing the release

## 💡 Pro Tips

### Versioning
- Use semantic versioning: `v1.0.0`, `v1.0.1`, `v2.0.0`
- Always start tags with `v` (workflow requires this)
- Only tag from main branch

### Environment Variables
- Use Render's "secret" checkbox for sensitive values
- Test locally with `.env` before deploying
- Double-check URLs don't have trailing slashes

### Debugging
- Check Render logs for deployment issues
- Use browser DevTools to debug web portal API calls
- GitHub Actions logs show build failures

### Performance
- Render free tier sleeps after inactivity (30min to wake)
- First download after wake may be slow
- Consider paid tier for production

## 📞 If Something Goes Wrong

### Desktop app won't build
1. Check icon files exist
2. Verify `package.json` version is valid
3. Check GitHub Actions logs for specific error

### Download page shows error
1. Verify GitHub repo name in constants
2. Check a release exists
3. Check browser console for API errors

### Render deployment fails
1. Check all env vars are set
2. Verify build commands in `render.yaml`
3. Check Render logs for specific error

### API not connecting to database
1. Verify Supabase credentials in Render
2. Check Supabase service is running
3. Test connection locally first

## ✨ Summary

**All critical issues from the original plan have been resolved.**

The current setup:
- ✅ Uses GitHub Releases (not git) for builds
- ✅ Automatic version management via GitHub API
- ✅ Proper .gitignore configuration
- ✅ Environment variable system in place
- ✅ Deployment automation configured

**Action Required:** Update GitHub username/repo in 2 files, then you're ready to push!
