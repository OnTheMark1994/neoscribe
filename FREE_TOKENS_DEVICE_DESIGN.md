# Free Token Grants, Device IDs, and Abuse Control

This document defines how free token grants work across:

- Web editor (browser/Electron renderer)
- Web portal
- Desktop Electron app (with `device_id` based on `node-machine-id`)

Goal: **Give each user a generous but bounded free allowance with minimal friction, while preventing trivial abuse** (e.g. infinite anon accounts via incognito / reinstall).

**Token grant amounts (defined as constants in `server.js`):**
- `NEW_ANON_TOKENS = 15,000` – device grant for desktop app first install
- `NEW_AUTH_TOKENS = 25,000` – account creation grant (web or desktop)

---

## Entities and identifiers

### User row (backend `users` table)

Key columns (simplified):

- `id` – primary key
- `anon_id` – anonymous identifier (web or desktop)
- `auth_id` – authentication identifier (Supabase Auth / email+password, etc.)
- `device_id` – hashed machine identifier (desktop app only)
- `free_grant_used` – boolean flag: has this *user account* received a 15k free grant?
- `tokens_monthly` – current monthly allowance balance for the user
- `tokens_added` – long-lived, carry-over bucket for extra tokens (top-ups, bonuses, free grants, including the 15k device/account grants described here)
- `tokens_used` – tokens used in the current billing period (this month)
- `tokens_used_all_time` – lifetime total tokens used

### Device grants table (optional, but recommended)

`device_grants` (or similar):

- `device_id` – hashed device id (see below)
- `user_id` – the user row that received the grant for this device
- `free_grant_used` – boolean
- `granted_at` – timestamp

This allows us to:

- Enforce **one free grant per physical machine** (via `device_id`).
- Track which user ended up owning that grant.

### Device ID (desktop app only)

- Generated in `electron.js` using `node-machine-id` + a server-side salt:
  - Get raw `machineId` via `machineIdSync({ original: true })`.
  - Hash + salt in the main process: `sha256(machineId + DEVICE_ID_SALT)`.
- Exposed to renderer via IPC: `window.electronAPI.getDeviceId()`.
- **Never** store or transmit the raw OS machine ID.

### Auth vs anon and grant types

- **Anon**: identified only by `anon_id` (web or desktop), not logged-in.
- **Auth**: user has a real account (`auth_id`), may have multiple devices and browsers.

Two free grant types are defined as constants in `server.js` (see `TOKEN_TRACKING.md`):

- `NEW_ANON_TOKENS`
  - Initial **anon desktop grant** applied to `tokens_added` when a new device runs the desktop app.
  - One-time per `device_id`.
- `NEW_AUTH_TOKENS`
  - **Auth upgrade / account-creation grant** applied to `tokens_added` when a user creates an account (or links anon → auth).
  - One-time per `auth_id`.

Rules:

- Each **device_id** is eligible for **one `NEW_ANON_TOKENS` grant** (desktop only, anon flow, added to `tokens_added`).
- Each **auth account** is eligible for **one `NEW_AUTH_TOKENS` grant** (web or desktop account creation, added to `tokens_added`).
- A given person can:
  - Get `NEW_AUTH_TOKENS` by creating an account on web or desktop.
  - Get `NEW_ANON_TOKENS` from the desktop app’s per-device grant.
  - But **cannot** farm infinite tokens by reinstalling or hopping browsers; grants are keyed off `device_id` and `auth_id` server-side.

---

## High-level behaviors

### Web editor (browser) – anon first visit

**Scenario:**

1. User visits web editor for the first time.
2. They have `anon_id` only (no `auth_id`).
3. In the AI chat area, we show a banner:
   - Explains that to prevent abuse, free tokens require either:
     - Creating a free account in Settings, **or**
     - Downloading the desktop app.
   - Promises free tokens on doing either (`NEW_ANON_TOKENS` for desktop, `NEW_AUTH_TOKENS` for account creation).
   - Provides buttons:
     - **Open Account Settings** (web settings window, `tab='account'`).
     - **Download Desktop App** (opens downloads page in new tab).

**Backend:**

- No automatic anon free grant for pure-anon web users.
- When they create an account on the web:
  - Backend applies the **`NEW_AUTH_TOKENS` grant to `tokens_added`** for that `auth_id` (if not already used).
  - There is **no** `NEW_ANON_TOKENS` grant in web-only flows, because we cannot reliably tie an anon web user to a stable device.

### Web editor – user creates a free account

**Scenario:**

1. Banner is visible (user is anon-only).
2. User opens Account Settings from the banner.
3. They create an account (email/password, etc.).
4. Backend logic:
   - Create a `users` row or update existing one.
   - If this `auth_id` **has not** used its auth grant yet:
     - Apply `NEW_AUTH_TOKENS` to `tokens_added`.
     - Set `free_grant_used = true` (or equivalent flag) for that user.
   - Mark the client as authenticated so subsequent calls include `auth_id`.
5. Next time they visit (same browser), they are logged in (session / refresh token), and see their token balance.

**Constraints:**

- Only **one** `NEW_AUTH_TOKENS` grant per `auth_id`.
- Multiple browsers/devices logging into the same account share the same pool of tokens.

### Desktop app – first install, no existing account

**Scenario:**

1. User downloads and runs the desktop app.
2. Main process computes `device_id` (hashed machine id).
3. Renderer obtains:
   - `anon_id` from store (existing logic).
   - `device_id` via `window.electronAPI.getDeviceId()`.
4. App calls backend: `POST /api/user/ensure` (or similar) with `{ anonId, deviceId }`.

**Backend logic:**

1. Check `device_grants` for `device_id` with `free_grant_used = true`.
   - If found: no new free tokens (this device has already consumed its free grant).
2. Else:
   - Find or create a `users` row for this `anon_id` (no `auth_id` yet).
   - Apply the **`NEW_ANON_TOKENS` device grant to `tokens_added`**.
   - Insert / update `device_grants` row for this `device_id` with `free_grant_used = true` and link to `user_id`.

**UX:**

- User gets `NEW_ANON_TOKENS` (15,000) automatically the first time they run the desktop app on that machine.
- No login required initially.

### Desktop app – uninstall/reinstall, all local data removed

**Scenario:**

1. User had previously installed the app and consumed their 15k via device grant.
2. They uninstall the app and delete all local data.
3. They reinstall the app.
4. App generates a **new `anon_id`** but the **same `device_id`**.
5. App calls backend with `{ anonId (new), deviceId (same) }`.

**Backend behavior:**

- Looks up `device_grants` for this `device_id` and sees `free_grant_used = true`.
- Does **not** grant new free tokens.
- Can still create a new `users` row for the new `anon_id` (if desired), but with `tokens_added = 0`.

**Renderer UX:**

- In the AI chat area, show a message:
  - "This device has already received its free tokens. To get more tokens, create a free account or sign into your existing account."
- Provide buttons:
  - Open Account Settings (for account creation / login).
  - Open web portal / downloads page as needed.

### Web first, then desktop

**Scenario:**

1. User visits web editor.
2. They see the banner and choose to create a **free account** in web settings.
3. Backend:
   - Creates a user with `auth_id`.
   - If this `auth_id` has not used its auth grant yet, applies `NEW_AUTH_TOKENS` to `tokens_added` and marks the grant as used.
4. Later, user downloads and runs the desktop app on some machine.
5. Desktop app starts as anon with `anon_id`, obtains `device_id`, and calls backend.

**Backend logic:**

- If this `device_id` has **never** consumed a device grant:
  - Option A (simpler, aligns with your request):
    - Treat the device grant as **separate** from the account grant:
      - Grant 15k to the anon user bound to this `device_id`.
  - Option B (stricter):
    - Detect that this person already has an auth account grant (e.g. by same email once they log in) and avoid double-granting.

**You requested**: "they do the free account on web, they then download, they get the 15k" → that’s **Option A**: one 15k per account, plus one 15k per device.

Once they log into the **same account** in desktop:

- Desktop app sends `auth_id` to backend.
- Backend links `device_id` and `auth_id` (if not already).
- For simplicity, we:
  - Switch to the logged-in account’s token balance for all future AI calls.
  - Ignore leftover anon credits if any.

So behavior:

- Web auth grant (15k) + desktop device grant (15k) both end up effectively under the same person, but after login we always show/use the **auth account balance**.

---

## Canonical user flows and expectations

Below is a non-exhaustive list of flows and the expected behavior. We’ll use this list when implementing and testing.

### 1. Web-only, first-time visitor → free account

- **Steps**:
  1. User visits web editor for the first time.
  2. Sees the banner in AI chat: must create account or download desktop to get free tokens.
  3. Clicks **Open Account Settings**.
  4. Creates a free account.
- **Backend**:
  - New `users` row with `auth_id`.
  - `free_grant_used = false` initially → we set it to true and add `NEW_AUTH_TOKENS` to `tokens_added`.
- **Outcome**:
  - User is logged in and sees `NEW_AUTH_TOKENS` (25,000) available.
  - Next visits in same browser: they stay logged in and can use remaining tokens.

### 2. Desktop-only, no account

- **Steps**:
  1. User installs desktop app.
  2. App obtains `anon_id` + `device_id` and calls backend.
- **Backend**:
  - If `device_id` has not used grant:
    - Create or reuse anon `users` row and **grant `NEW_ANON_TOKENS`** to `tokens_added`.
  - If `device_id` already used grant:
    - No new tokens.
- **Outcome**:
  - First install: `NEW_ANON_TOKENS` (15,000) free tokens.
  - Subsequent reinstalls on same machine: no new tokens.

### 3. Desktop reinstall with data wipe

- **Steps**:
  1. User consumes some or all of 15k on desktop.
  2. Uninstalls the app and deletes local data.
  3. Reinstalls the app.
- **Backend**:
  - New `anon_id` but same `device_id`.
  - `device_grants` already has `free_grant_used = true` for this `device_id`.
  - Backend **does not grant** 15k again.
- **Outcome**:
  - Desktop UI shows banner: device already used its free tokens; create/login to account for more.

### 4. Web free account first, then desktop device grant

- **Steps**:
  1. User creates a free account on web and gets 15k.
  2. Later installs desktop app on a machine.
  3. Desktop app as anon, `device_id` has no device grant yet.
- **Backend** (Option A per your preference):
  - Grants 15k device tokens when desktop first runs.
- **Outcome**:
  - User has effectively 15k tied to account and 15k tied to device anon user.
  - Once they log into the *same account* in the desktop app, UI simply shows/logs in with account balance and no longer emphasizes anon/device balance.

### 5. Logging into existing account on desktop

- **Steps**:
  1. User used desktop anon grant or not.
  2. They now log into the same account they created on web (or create a new account on desktop).
- **Backend**:
  - On login, desktop app sends `auth_id` and `device_id`.
  - Backend links `device_id` with this `auth_id` for future reference.
  - No further free grant if `free_grant_used` is already true for this `auth_id`.
- **Outcome**:
  - Desktop app behaves as a logged-in client to that account.
  - Tokens displayed/consumed are from the `auth_id` account.
  - Anon tokens on this device are effectively ignored going forward.

### 6. User uses multiple browsers on web

- **Steps**:
  1. User visits with Browser A, creates a free account, gets 15k.
  2. Later visits with Browser B, logs into the same account.
- **Backend**:
  - Single `auth_id` with `free_grant_used = true`.
- **Outcome**:
  - They see the *same* balance and usage across Browser A and Browser B.
  - They do **not** get another 15k for a different browser.

### 7. User tries to abuse via multiple accounts

Potential abuse patterns and mitigations:

- Create many accounts with different emails to farm free grants.
  - **Mitigations** (policy-level, not all enforced in code yet):
    - Rate-limit free grants per IP range per day.
    - Optional email verification before granting.
    - Heuristic checks: many accounts from same IP/user-agent/device.
- Reinstall desktop on same machine repeatedly.
  - **Mitigation**: per-`device_id` grant; reinstall does not bypass.
- Use many devices + many accounts.
  - We accept some limited multi-device usage as part of being generous.
  - Abuse at scale would show up in monitoring (e.g. many grants from same IP block).

### 8. User moves between web portal, web editor, and desktop

- **Web portal** uses the same backend `users` table for auth and tokens.
- When user logs in on web portal:
  - They see token balance aligned with web editor / desktop.
- When user logs out from web portal and logs in from desktop (or vice versa):
  - The same `auth_id` is used; they see consistent token balances.

Key requirement:

- **Single source of truth** for tokens and `free_grant_used` is the backend.
- All clients (web editor, web portal, desktop) must:
  - Include `auth_id`, `anon_id`, and `device_id` (when available) in token APIs.
  - Respect backend token balances without trying to cache/compute them locally.

---

## Implementation checklist (high level)

We will implement in roughly this order:

1. **Desktop main process**
   - Install `node-machine-id` (already done).
   - Add `getDeviceId()` helper in `electron.js` that hashes + salts machineId.
   - Expose `getDeviceId` via IPC in `preload.js`.

2. **Backend**
   - Add `device_id` column to `users` (already added) and/or create `device_grants` table.
   - Implement endpoint(s) that accept `{ anonId, authId?, deviceId? }` and:
     - Ensure user.
     - Perform free grant logic based on `auth_id` and `device_id`.
   - Enforce:
     - One grant per `auth_id` (15k).
     - One grant per `device_id` (15k).

3. **Desktop renderer (React app)**
   - On startup (after obtaining `anon_id`), call `window.electronAPI.getDeviceId()` and pass it to backend when hydrating user/token state.
   - In AISidebar/Settings UI, show appropriate banners when device already consumed free grant but user is anon.

4. **Web editor (browser)**
   - Add AI chat banner for non-auth web users explaining:
     - Need to create account or use desktop app.
     - They’ll receive 15k free tokens by doing either.
   - Wire buttons to:
     - Open web settings modal on `account` tab.
     - Open downloads page in a new tab.

5. **Web portal**
   - Ensure portal surfaces the same token balances and correctly reflects whether the free grant has been consumed.

6. **Abuse monitoring & extra safeguards (optional, later)**
   - Add IP-based rate limiting for free grants.
   - Consider CAPTCHA for suspicious patterns.
   - Add logs / dashboards to watch free-grant usage over time.

---

This design keeps the API safer while still:

- Giving each **account** a generous 15k free grant.
- Giving each **desktop device** a one-time 15k anon grant.
- Avoiding trivial abuse via incognito/reinstall.
- Keeping the user messaging simple and intuitive across web and desktop.
