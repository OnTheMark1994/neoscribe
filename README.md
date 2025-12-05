# ScribeFold AI Monorepo

A comprehensive monorepo containing the ScribeFold AI ecosystem:
- **Desktop App**: Electron-based desktop application
- **Web Portal**: React web app for account management and downloads
- **API Server**: Express backend with AI integration

## 🏗️ Project Structure

```
scribefold-ai/
├── apps/
│   ├── desktop-app/       # Electron desktop application
│   ├── web-portal/        # React web portal
│   └── api-server/        # Express API server
├── .github/
│   └── workflows/
│       └── release-desktop.yml  # Automated release workflow
├── .gitignore             # Git ignore rules
├── package.json           # Root workspace config
├── render.yaml            # Render.com deployment config
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/scribefold-ai.git
   cd scribefold-ai
   ```

2. **Install dependencies for all apps**
   ```bash
   cd apps/desktop-app && npm install
   cd ../web-portal && npm install
   cd ../api-server && npm install
   cd ../..
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env` in each app folder and fill in your values:
   
   ```bash
   # Desktop App
   cp apps/desktop-app/.env.example apps/desktop-app/.env
   
   # Web Portal
   cp apps/web-portal/.env.example apps/web-portal/.env
   
   # API Server
   cp apps/api-server/.env.example apps/api-server/.env
   ```

4. **Start development servers**

   **Desktop App:**
   ```bash
   cd apps/desktop-app
   npm start
   ```

   **Web Portal:**
   ```bash
   cd apps/web-portal
   npm start
   ```

   **API Server:**
   ```bash
   cd apps/api-server
   npm run dev
   ```

## 📦 Building

### Desktop App Builds

Build for all platforms:
```bash
cd apps/desktop-app
npm run build
```

Build for specific platforms:
```bash
npm run build:win      # Windows
npm run build:mac      # macOS
npm run build:linux    # Linux
```

Built files will be in `apps/desktop-app/release/`

### Web Portal Build

```bash
cd apps/web-portal
npm run build
```

## 🚢 Deployment

### Automated Desktop Releases

Desktop app releases are automated via GitHub Actions:

1. **Update version** in `apps/desktop-app/package.json`
2. **Commit and tag:**
   ```bash
   git add apps/desktop-app/package.json
   git commit -m "Release v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```
3. **GitHub Actions will:**
   - Build for Windows, macOS, and Linux
   - Create a GitHub Release with installers
   - Automatically update download links on web portal

### Deploy to Render.com

#### First-Time Setup

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial monorepo setup"
   git push origin main
   ```

2. **Connect to Render.com:**
   - Go to [render.com](https://render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will read `render.yaml` and create both services

3. **Configure Environment Variables:**
   
   For **API Server**, add in Render dashboard:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_key
   DEEPSEEK_API_KEY=your_key
   STRIPE_SECRET_KEY=your_key
   STRIPE_WEBHOOK_SECRET=your_key
   STRIPE_PRICE_ID_LIGHT=price_xxx
   STRIPE_PRICE_ID_BASIC=price_xxx
   STRIPE_PRICE_ID_FULL=price_xxx
   STRIPE_PRICE_ID_HEAVY=price_xxx
   STRIPE_PAYMENT_LINK_LIGHT=https://...
   STRIPE_PAYMENT_LINK_BASIC=https://...
   STRIPE_PAYMENT_LINK_FULL=https://...
   STRIPE_PAYMENT_LINK_HEAVY=https://...
   FRONTEND_URL=https://your-web-portal.onrender.com
   ```

   For **Web Portal**, add in Render dashboard:
   ```
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_key
   REACT_APP_API_BASE_URL=https://your-api.onrender.com
   REACT_APP_GITHUB_REPO=your-username/scribefold-ai
   REACT_APP_STRIPE_CUSTOMER_PORTAL_URL=https://billing.stripe.com/...
   ```

4. **Deploy:**
   - Both services will deploy automatically
   - Note the URLs for API and Web Portal

#### Subsequent Deployments

Simply push to main branch:
```bash
git push origin main
```

Render will automatically redeploy the affected services.

## 🔧 Configuration

### Desktop App (`apps/desktop-app/.env`)
```env
REACT_APP_API_BASE_URL=https://your-api-server-url.onrender.com
REACT_APP_WEB_PORTAL_BASE_URL=https://your-web-portal-url.onrender.com
```

### Web Portal (`apps/web-portal/.env`)
```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
REACT_APP_API_BASE_URL=https://your-api-server-url.onrender.com
REACT_APP_GITHUB_REPO=your-username/scribefold-ai
```

### API Server (`apps/api-server/.env`)
```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DEEPSEEK_API_KEY=your_deepseek_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
FRONTEND_URL=https://your-web-portal-url.onrender.com
```

## 📝 Updating Desktop App Package.json

**IMPORTANT:** When creating releases, update these fields in `apps/desktop-app/package.json`:

1. Update the `version` field:
   ```json
   "version": "1.0.1"
   ```

2. Update the `publish` section with your GitHub repo:
   ```json
   "publish": {
     "provider": "github",
     "owner": "your-username",
     "repo": "scribefold-ai"
   }
   ```

## 🎯 Workflow Summary

### For Code Changes:
1. Make changes to any app
2. Commit and push to main
3. Render automatically redeploys affected services

### For New Desktop Release:
1. Update version in `apps/desktop-app/package.json`
2. Commit and create a version tag (`v1.0.1`)
3. Push with tags
4. GitHub Actions builds and releases
5. Web portal automatically shows new version

## 🔐 Security Notes

- **Never commit `.env` files** (already in `.gitignore`)
- Store secrets in Render dashboard, not in code
- Use environment variables for all sensitive data
- The `.env.example` files are safe to commit (no real values)

## 🐛 Troubleshooting

### Desktop app won't start
- Run `npm install` in `apps/desktop-app`
- Check `.env` file exists with correct API URLs

### Web portal can't fetch downloads
- Verify `REACT_APP_GITHUB_REPO` is set correctly
- Ensure at least one release exists on GitHub
- Check browser console for API errors

### API server errors
- Verify all environment variables are set in Render dashboard
- Check Render logs for specific error messages
- Ensure Supabase and Stripe credentials are correct

## 📚 Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Create React App](https://create-react-app.dev/)
- [Express.js Guide](https://expressjs.com/)
- [Render.com Docs](https://render.com/docs)
- [GitHub Actions](https://docs.github.com/en/actions)

## 📄 License

MIT
