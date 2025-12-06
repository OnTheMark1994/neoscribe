What env variables are needed for each project? 

## Environment Variables Overview

This file is the **single source of truth** for environment variables used in the ScribeFold monorepo.

Projects:
- **api-server** (Node/Express backend)
- **web-portal** (React, CRA)
- **desktop-app** (Electron + React)

For React apps, remember that only variables prefixed with `REACT_APP_` are exposed to the browser.

---

## `PORT`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js`
  - `const PORT = process.env.PORT || 3000;`
- **Purpose**: Port number that the API server listens on locally.
- **Typical values**:
  - Dev: `3000`
  - Production: Usually set by the hosting platform (Render/Heroku/etc.).
- **Stripe test vs prod**: Not Stripe-specific.

---

## `SUPABASE_URL`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js`
  - `if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) { ... }`
- **Purpose**: Base URL for the Supabase project (backend admin connection).
- **Where to get it**: Supabase dashboard → Project Settings → API → Project URL.
- **Notes**:
  - Only used on the server (service role access), **never** expose this directly to the browser.
  - Same value for dev and prod if you share a Supabase project; otherwise use separate projects.
- **Stripe test vs prod**: Independent of Stripe.

---

## `SUPABASE_SERVICE_ROLE_KEY`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js`
  - Passed to `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)`
- **Purpose**: Supabase service role key used by the backend for full DB access.
- **Where to get it**: Supabase dashboard → Project Settings → API → Service role key.
- **Security**:
  - **Must never be exposed** to the frontend (only in server env).
  - Store in hosting provider’s env config.
- **Stripe test vs prod**: Independent of Stripe.

---

## `DEEPSEEK_API_KEY`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js`
  - `const apiKey = process.env.DEEPSEEK_API_KEY;`
  - `/health` exposes `deepseekConfigured: !!process.env.DEEPSEEK_API_KEY`
- **Purpose**: API key for DeepSeek chat completions.
- **Where to get it**: DeepSeek account / API settings.
- **Security**: Server-only, do not expose to frontend.
- **Stripe test vs prod**: Independent of Stripe.

---

## `STRIPE_SECRET_KEY`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js`
  - `if (process.env.STRIPE_SECRET_KEY) { stripe = new Stripe(process.env.STRIPE_SECRET_KEY); }`
- **Purpose**: Secret key for calling Stripe APIs (checkout, subscriptions, customer portal).
- **Where to get it**: Stripe dashboard → Developers → API keys → Secret key.
- **Test vs Production**:
  - **Test mode**: Use **test secret** (starts with `sk_test_...`).
  - **Production**: Use **live secret** (starts with `sk_live_...`).
  - Switching environments requires changing this key to the matching Stripe mode.
- **Security**: Server-only, must never be exposed to browser or checked into git.

---

## `STRIPE_WEBHOOK_SECRET`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js`
  - `/api/stripe/webhook` uses `process.env.STRIPE_WEBHOOK_SECRET` to verify Stripe signatures.
- **Purpose**: Secret used to validate that incoming webhook events are from Stripe.
- **Where to get it**: Stripe dashboard → Developers → Webhooks → your endpoint → “Signing secret”.
- **Test vs Production**:
  - Each webhook endpoint (test and live) has its own **signing secret**.
  - You **must** switch this value when you switch the Stripe environment or webhook endpoint.

---

## `STRIPE_PRICE_ID_LIGHT`
## `STRIPE_PRICE_ID_BASIC`
## `STRIPE_PRICE_ID_FULL`
## `STRIPE_PRICE_ID_HEAVY`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js` in `subscription_tiers` config.
  - Example: `stripe_price_id: process.env.STRIPE_PRICE_ID_BASIC || 'price_1SaNZPQVYKqBO1rjnt5LBAKX'`
- **Purpose**: Stripe **Price IDs** tied to each subscription tier.
- **Where to get them**: Stripe dashboard → Products → specific product → Pricing → Price ID.
- **Test vs Production**:
  - Test prices (IDs start with `price_...` in Stripe **test** mode).
  - Live prices (separate `price_...` values in **live** mode).
  - When you switch from test to production, you need to update all four `STRIPE_PRICE_ID_*` values.
  - The hard-coded defaults in `server.js` are **test-mode** IDs.

---

## `STRIPE_PAYMENT_LINK_LIGHT`
## `STRIPE_PAYMENT_LINK_BASIC`
## `STRIPE_PAYMENT_LINK_FULL`
## `STRIPE_PAYMENT_LINK_HEAVY`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js` in `subscription_tiers` config.
  - Example: `stripe_payment_link: process.env.STRIPE_PAYMENT_LINK_BASIC || 'https://buy.stripe.com/test_...'`
- **Purpose**: Stripe-hosted payment links for each tier.
- **Where to get them**: Stripe dashboard → Payment Links.
- **Test vs Production**:
  - Test links begin with `https://buy.stripe.com/test_...`.
  - Live links begin with `https://buy.stripe.com/...` without `/test_`.
  - When going live, replace these with the **live** payment link URLs.

---

## `FRONTEND_URL`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js`
  - Checkout success/cancel URLs: `const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';`
  - Customer portal redirects: uses the same `FRONTEND_URL`.
- **Purpose**: Base URL of the web portal used for Stripe redirects (success, cancel, customer portal).
- **Typical values**:
  - Local dev: `http://localhost:3001`
  - Production: `https://scribefold-ai-monorepo.onrender.com` (or whatever your actual domain is).
- **Stripe test vs prod**:
  - For test mode in local/dev: point to local or staging portal.
  - For production: must match the public HTTPS portal URL configured in Stripe redirect settings.

---

## `GITHUB_REPO_OWNER`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js` → `/api/releases`
  - `const owner = process.env.GITHUB_REPO_OWNER || 'AbeApple';`
- **Purpose**: GitHub account owner for release fetching.
- **Default**: `'AbeApple'` if not set.
- **Stripe test vs prod**: Not Stripe-related.

---

## `GITHUB_REPO_NAME`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js` → `/api/releases`
  - `const repo = process.env.GITHUB_REPO_NAME || 'scribefold-ai-monorepo';`
- **Purpose**: Repository name for release fetching.
- **Default**: `'scribefold-ai-monorepo'`.
- **Stripe test vs prod**: Not Stripe-related.

---

## `GITHUB_DOWNLOAD_TOKEN`

- **Used by**: `apps/api-server`
- **Where in code**: `apps/api-server/server.js` → `/api/releases`
  - `const token = process.env.GITHUB_DOWNLOAD_TOKEN;`
- **Purpose**: GitHub personal access token for accessing private release data.
- **Where to get it**: GitHub → Developer settings → Personal access tokens.
- **Security**: Server-only, must not be exposed to clients.
- **Stripe test vs prod**: Not Stripe-related.

---

## `REACT_APP_API_BASE_URL`

- **Used by**:
  - `apps/desktop-app` (Electron client)
  - **Note**: Web portal currently uses a hard-coded `API_BASE_URL` in `apps/web-portal/src/constants.js` and does **not** read this env var.
- **Where in code**: `apps/desktop-app/src/utils/constants.js`
  - `export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://scribefold-ai-api-server.onrender.com';`
- **Purpose**: Base URL for API calls from the desktop app.
- **Typical values**:
  - Dev: `http://localhost:3000` (if API server running locally).
  - Production: `https://scribefold-ai-api-server.onrender.com` or your deployed API domain.
- **Stripe test vs prod**: Indirect—should point to the API environment that is configured with the desired Stripe mode.

---

## `REACT_APP_WEB_PORTAL_BASE_URL`

- **Used by**: `apps/desktop-app`
- **Where in code**: `apps/desktop-app/src/utils/constants.js`
  - `export const WEB_PORTAL_BASE_URL = process.env.REACT_APP_WEB_PORTAL_BASE_URL || 'https://scribefold-ai-monorepo.onrender.com';`
- **Purpose**: Web portal URL used by the desktop app (e.g., for opening account pages).
- **Typical values**:
  - Dev: `http://localhost:3001`
  - Production: `https://scribefold-ai-monorepo.onrender.com`
- **Stripe test vs prod**: Should match the frontend URL that Stripe redirects users to.

---

## `REACT_APP_SUPABASE_URL`

- **Used by**: `apps/web-portal`
- **Where in code**: `apps/web-portal/src/supabaseClient.js`
  - `const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;`
- **Purpose**: Public Supabase project URL for the web portal.
- **Where to get it**: Supabase dashboard → Project Settings → API → Project URL.
- **Notes**: Safe for frontend (public) use.
- **Stripe test vs prod**: Independent of Stripe.

---

## `REACT_APP_SUPABASE_ANON_KEY`

- **Used by**: `apps/web-portal`
- **Where in code**: `apps/web-portal/src/supabaseClient.js`
  - Prefers anon key: `process.env.REACT_APP_SUPABASE_ANON_KEY`
- **Purpose**: Public anonymous Supabase key for client-side auth and DB access (RLS-protected).
- **Where to get it**: Supabase dashboard → Project Settings → API → `anon` public key.
- **Security**: Intended to be public; still treat with care (relies on Supabase RLS for protection).
- **Stripe test vs prod**: Independent of Stripe.

---

## `REACT_APP_SUPABASE_SERVICE_ROLE_KEY`

- **Used by**: `apps/web-portal` (fallback only)
- **Where in code**: `apps/web-portal/src/supabaseClient.js`
  - Fallback: `process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;`
- **Purpose**: (Not recommended) Fallback to service role key if anon key is not set.
- **Security Warning**:
  - **Do not** set this in production builds; it would expose full DB access to the browser.
  - Only use the `REACT_APP_SUPABASE_ANON_KEY` in practice.
- **Stripe test vs prod**: Independent of Stripe.

---

## Notes on Test vs Production Stripe Setup

When switching between **Stripe test mode** and **production/live mode**, you must coordinate the following variables **together**:

- `STRIPE_SECRET_KEY` – test vs live secret key.
- `STRIPE_WEBHOOK_SECRET` – signing secret for the corresponding test/live webhook endpoint.
- `STRIPE_PRICE_ID_LIGHT`, `STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_FULL`, `STRIPE_PRICE_ID_HEAVY` – test vs live Price IDs.
- `STRIPE_PAYMENT_LINK_LIGHT`, `STRIPE_PAYMENT_LINK_BASIC`, `STRIPE_PAYMENT_LINK_FULL`, `STRIPE_PAYMENT_LINK_HEAVY` – test vs live payment links.
- `FRONTEND_URL` – should match the frontend base URL you configure as redirect in Stripe (staging vs production).

Desktop and web apps then just talk to the API and follow whatever Stripe mode the API server is configured for.