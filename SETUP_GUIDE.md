# 🚀 Quick Setup Guide

This guide walks you through the next steps to get your monorepo fully operational.

## ✅ What's Already Done

- ✅ Monorepo structure created
- ✅ Git ignore configured (blocks .env, node_modules, builds)
- ✅ Environment variable system set up
- ✅ Constants updated to use env vars
- ✅ GitHub Actions workflow for automated releases
- ✅ Download page that fetches from GitHub API (no version hardcoding!)
- ✅ Render.com deployment configuration

## 📋 Next Steps

### 1. Install Dependencies

Run this for each app:

```bash
cd apps/desktop-app
npm install

cd ../web-portal
npm install

cd ../api-server
npm install

cd ../..
```

### 2. Create Local .env Files

**Desktop App** (`apps/desktop-app/.env`):
```env
REACT_APP_API_BASE_URL=http://localhost:3000
REACT_APP_WEB_PORTAL_BASE_URL=http://localhost:3001
```

**Web Portal** (`apps/web-portal/.env`):
```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_API_BASE_URL=http://localhost:3000
REACT_APP_GITHUB_REPO=your-username/scribefold-ai
REACT_APP_STRIPE_CUSTOMER_PORTAL_URL=your_stripe_portal_url
```

**API Server** (`apps/api-server/.env`):
```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DEEPSEEK_API_KEY=your_deepseek_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
FRONTEND_URL=http://localhost:3001
# ... plus all the Stripe price IDs and payment links
```

### 3. Test Locally

**Terminal 1 - API Server:**
```bash
cd apps/api-server
npm start
```

**Terminal 2 - Web Portal:**
```bash
cd apps/web-portal
npm start
```

**Terminal 3 - Desktop App:**
```bash
cd apps/desktop-app
npm start
```

### 4. Update GitHub Repo Config

Before pushing, update `apps/desktop-app/package.json`:

```json
"publish": {
  "provider": "github",
  "owner": "YOUR-GITHUB-USERNAME",
  "repo": "scribefold-ai"
}
```

Also update `apps/web-portal/.env`:
```env
REACT_APP_GITHUB_REPO=YOUR-GITHUB-USERNAME/scribefold-ai
```

### 5. Push to GitHub

```bash
git init  # If not already initialized
git add .
git commit -m "Initial monorepo setup"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/scribefold-ai.git
git push -u origin main
```

### 6. Deploy to Render.com

1. Go to [render.com](https://render.com)
2. Click **New** → **Blueprint**
3. Connect your GitHub repository
4. Render reads `render.yaml` and creates 2 services:
   - `scribefold-ai-api`
   - `scribefold-ai-web-portal`

5. **Add environment variables** in Render dashboard for each service (see `.env.example` files)

6. Note the deployed URLs:
   - API: `https://scribefold-ai-api.onrender.com`
   - Web Portal: `https://scribefold-ai-web-portal.onrender.com`

7. **Update production env vars** with real URLs:
   - In API service settings, set `FRONTEND_URL` to web portal URL
   - In Web Portal settings, set `REACT_APP_API_BASE_URL` to API URL

### 7. Create First Desktop Release

1. Update version in `apps/desktop-app/package.json`:
   ```json
   "version": "1.0.0"
   ```

2. Commit and tag:
   ```bash
   git add apps/desktop-app/package.json
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```

3. GitHub Actions will:
   - Build Windows, macOS, and Linux installers
   - Create a GitHub Release
   - Upload installers to the release

4. Web portal will automatically fetch and display the new version!

## 🎯 How It Works (No Manual Updates Needed!)

### When you push a new desktop version:

1. Update version in `package.json`
2. Tag and push: `git tag v1.0.1 && git push --tags`
3. GitHub Actions builds all platforms
4. Creates GitHub Release with artifacts
5. Web portal automatically fetches latest from GitHub API
6. Download links update automatically - **no code changes needed!**

### File naming is automatic:

```
ScribeFold AI-Setup-1.0.0.exe    (Windows)
ScribeFold AI-1.0.0.dmg          (macOS)
ScribeFold AI-1.0.0.AppImage     (Linux)
```

Version comes from `package.json` - the only place you update it!

## ⚠️ Important: What NOT to Commit

The `.gitignore` prevents these from being committed:
- ❌ `.env` files (contain secrets)
- ❌ `node_modules/` (too large)
- ❌ `build/` and `dist/` folders
- ❌ `release/` folder (Electron builds go to GitHub Releases, not git)

✅ **DO commit:**
- `.env.example` files (no real secrets)
- Source code
- Configuration files

## 🔍 Critical Differences from Original Plan

### ❌ Original (Flawed) Approach:
- Committed 500MB+ builds to git
- Hardcoded version numbers in download links
- Manual updates needed for every release

### ✅ New (Correct) Approach:
- Builds go to GitHub Releases (unlimited storage)
- Download page fetches from GitHub API
- Zero manual updates - completely automatic

## 📝 Quick Reference Commands

```bash
# Install all dependencies
npm run install:all

# Start desktop app
npm run start:desktop

# Start web portal
npm run start:web

# Start API server
npm run start:api

# Build desktop app
npm run build:desktop

# Build web portal
npm run build:web
```

## 🆘 Troubleshooting

**Error: "REACT_APP_API_BASE_URL is not defined"**
- Create `.env` file in that app's folder
- Copy from `.env.example` and fill in values

**Downloads page shows "No releases available"**
- Create your first release with `git tag v1.0.0 && git push --tags`
- Check `REACT_APP_GITHUB_REPO` is set correctly

**Render deployment fails**
- Check all required env vars are set in Render dashboard
- View logs in Render for specific errors

## 🎉 You're Ready!

Once you complete these steps, you'll have:
- ✅ Working local development environment
- ✅ Deployed web portal and API on Render
- ✅ Automated desktop releases via GitHub Actions
- ✅ Self-updating download page
- ✅ No manual version management needed ever again!
