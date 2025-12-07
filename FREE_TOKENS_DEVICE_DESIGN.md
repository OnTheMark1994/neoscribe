# Free Token Grants, Device IDs, and Abuse Control

This document defines how free token grants work across:

- Web editor (browser/Electron renderer)
- Web portal
- Desktop Electron app (with `device_id` based on `node-machine-id`)

Goal: **Give each user a generous but bounded free allowance with minimal friction, while preventing trivial abuse** (e.g. infinite anon accounts via incognito / reinstall).

**Token grant amounts (defined as constants in `apps/api-server/server.js`):**
- `NEW_ANON_TOKENS` – device grant for desktop app first install (currently 15,000)
- `NEW_AUTH_TOKENS` – account creation grant (currently 25,000)

---

## Entities and identifiers

token_log table:
id
created_at
tokens int8 (the number of tokens - for deduction + for addition, ex 15000 for initial add -2000 for an api call)
user_id text (the user in the user table this was applied to)
note text (note about what happened ex: "New anon user initial tokens, api usage (deepseek), etc)


### User row (backend `users` table)

Key columns (simplified):

- `id` – primary key
- `anon_id` – ephemeral identifier for anonymous sessions (desktop or web). On **web**, this is mainly used to correlate requests, logs, and usage for users who have not created an account yet; it is **not** used to grant free tokens (those are keyed by `auth_id`).
- `auth_id` – authentication identifier (Supabase Auth / email+password, etc.)
- `device_id` – hashed machine identifier (desktop app only)
- `tokens_monthly` – current monthly allowance balance for the user
- `tokens_added` – long-lived, carry-over bucket for extra tokens (top-ups, bonuses, free grants, including the device/account grants described here)
- `tokens_used` – tokens used in the current billing period (this month)
- `tokens_used_all_time` – lifetime total tokens used

### Free grants table (canonical grant tracking)

The new `free_grants` table is the single source of truth for **who has received which free grant**:

- `id` – primary key (Supabase default)
- `created_at` – timestamp (Supabase default)
- `auth_id` – the account that received an auth-based grant (nullable)
- `device_id` – the device that received a device-based grant (nullable)
- `received_grant` – boolean; whether this record represents a grant that has been applied
- `grant_amount` – integer; how many free tokens were granted (`NEW_AUTH_TOKENS` or `NEW_ANON_TOKENS`)

Rules:

- For **auth-based grants** (`NEW_AUTH_TOKENS`):
  - There is at most **one `free_grants` row with `auth_id = X` and `received_grant = true`** for a given account.
- For **device-based grants** (`NEW_ANON_TOKENS`):
  - There is at most **one `free_grants` row with `device_id = D` and `received_grant = true`** for a given physical device.

The `users` table holds the **current token balances**; `free_grants` is used to decide **whether we are allowed to apply a new free grant** for a given `auth_id` or `device_id`, and to keep an audit trail of which grant was given.

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

**Identifier summary (web):**

- Web has **no `device_id`**.
- Free tokens in pure web flows are only ever granted based on `auth_id` (account creation).

### Web editor – user creates a free account

**Scenario:**

1. Banner is visible (user is anon-only).
2. User opens Account Settings from the banner.
3. They create an account (email/password, etc.).
4. Backend logic:
   - Create a `users` row or update existing one.
   - Check `free_grants` for `{ auth_id: A, received_grant: true }`.
     - If **none**:
       - Apply `NEW_AUTH_TOKENS` to this user’s `tokens_added`.
       - Insert a `free_grants` row: `{ auth_id: A, device_id: null, received_grant: true, grant_amount: NEW_AUTH_TOKENS }`.
   - Mark the client as authenticated so subsequent calls include `auth_id`.
5. Next time they visit (same browser), they are logged in (session / refresh token), and see their token balance.

**Constraints:**

- Only **one** `NEW_AUTH_TOKENS` grant per `auth_id` (enforced via `free_grants`).
- Multiple browsers/devices logging into the same account share the same pool of tokens.

### Desktop app – first install, no existing account

**Scenario:**

1. User downloads and runs the desktop app.
2. Main process computes `device_id` (hashed machine id).
3. Renderer obtains:
   - `anon_id` from store (existing logic).
   - `device_id` via `window.electronAPI.getDeviceId()`.
4. App calls backend: `POST /api/users/ensure` with `{ anonId, deviceId }`.

**Backend logic (desktop device grant):**

1. Use **`device_id` as the primary stable key for desktop anon users**:
   - If there is a `users` row with this `device_id`, reuse that row even if `anon_id` is new or missing.
   - If no such row exists yet, fall back to `anon_id` lookup or create a new row.
2. If this `device_id` **has never received** a device grant (per `free_grants` table):
   - Apply `NEW_ANON_TOKENS` to `tokens_added`.
3. If this `device_id` **has already received** a device grant:
   - Do **not** add tokens again.
4. Always keep `device_id` populated on the row used for this device.

**UX:**

- User gets `NEW_ANON_TOKENS` (15,000) automatically the first time they run the desktop app on that machine.
- No login required initially.

### Desktop app – uninstall/reinstall, all local data removed

**Scenario:**

1. User had previously installed the app and consumed some of the 15k via device grant.
2. They uninstall the app and delete local data (local `anon_id` is lost).
3. They reinstall the app later.
4. App generates a **new `anon_id`** but the **same `device_id`**.
5. App calls backend with `{ anonId (new), deviceId (same) }`.

**Backend behavior (desired):**

- **Primary lookup by `device_id`:**
  - Find the existing `users` row for this `device_id`.
  - Reuse that row even if `anon_id` has changed.
- Maintain continuity of tokens:
  - Do **not** grant new `NEW_ANON_TOKENS` (device grant already used for this device).
  - Keep `tokens_added` / `tokens_used` exactly as they were.
- Optionally update `anon_id` on that row to the new one, but `device_id` remains the canonical key.

**Renderer UX:**

- After reinstall, the user still sees whatever remains of their original 15k (for example, 10k left).
- In the AI chat area, if `device_id` has already consumed the grant and account is not linked:
  - Show a message like: "This device has already received its free tokens. To get more tokens, create a free account or sign into your existing account."
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

- If they started on desktop as anon first (already have a `users` row with `device_id` and a `NEW_ANON_TOKENS` grant), the **create-account flow updates that same row**:
  - Adds `auth_id` to it.
  - Applies `NEW_AUTH_TOKENS` to `tokens_added` on top of whatever remains from the device grant.
  - Result: one combined token pool (device grant + account grant) on a single row.
- If they started on web and then later use desktop, the device grant is still applied once per `device_id`, and the backend should converge toward a single row per person (same `auth_id`, with `device_id` attached where applicable).

So behavior:

- A person can receive **one `NEW_AUTH_TOKENS` grant per account** and **one `NEW_ANON_TOKENS` grant per desktop device**, and when the desktop anon row is upgraded to auth, those grants live together on the same row.

---

## Canonical user flows and expectations

Below is a non-exhaustive list of flows and the expected behavior. We’ll use this list when implementing and testing.

### 1. Web-only, first-time visitor → free account

- **Steps**:
  1. User visits web editor for the first time.
  2. Sees the banner in AI chat: must create account or download desktop to get free tokens.
  3. Clicks **Open Account Settings**.
  4. Creates a free account.
- **Backend (using `free_grants`)**:
  - Create or reuse a `users` row with `auth_id = A`.
  - Check `free_grants` for `{ auth_id: A, received_grant: true }`.
    - If **none**:
      - Apply `NEW_AUTH_TOKENS` to this user’s `tokens_added`.
      - Insert a `free_grants` row: `{ auth_id: A, device_id: null, received_grant: true, grant_amount: NEW_AUTH_TOKENS }`.
    - If **present**:
      - Do **not** apply another auth grant.
- **Outcome**:
  - User is logged in and sees `NEW_AUTH_TOKENS` available.
  - Any browser where they log in as `auth_id = A` sees the same account-level balance.

### 2. Desktop-only, no account

- **Steps**:
  1. User installs desktop app.
  2. App obtains `anon_id` + `device_id = D1` and calls backend.
- **Backend (using `free_grants`)**:
  - `/api/users/ensure` looks up `free_grants` for `{ device_id: D1, received_grant: true }`.
    - If **none**:
      - Create or reuse an anon `users` row with `device_id = D1`.
      - Apply `NEW_ANON_TOKENS` to that row’s `tokens_added`.
      - Insert `free_grants` row: `{ auth_id: null, device_id: D1, received_grant: true, grant_amount: NEW_ANON_TOKENS }`.
    - If **present**:
      - Do **not** apply another device grant.
- **Outcome**:
  - First install on that physical device: `NEW_ANON_TOKENS` free tokens.
  - Subsequent reinstalls on the same machine: `free_grants` blocks new device grants.

### 3. Desktop reinstall with data wipe

- **Steps**:
  1. User consumes some or all of the device grant on desktop.
  2. Uninstalls the app and deletes local data.
  3. Reinstalls the app.
- **Backend (using `free_grants`)**:
  - App generates a new `anon_id` but the same `device_id = D1`.
  - `/api/users/ensure` again checks `free_grants` for `{ device_id: D1, received_grant: true }`.
  - Since a device grant row exists, backend **does not** grant `NEW_ANON_TOKENS` again.
  - The remaining balance lives on the existing user row(s) associated with that device/account.
- **Outcome**:
  - Desktop UI can show a banner: device already used its free tokens; create/login to account for more.
  - User does not receive additional free device grants by reinstalling.

### 4. Web free account first, then desktop device grant

- **Steps**:
  1. User creates a free account on web and gets `NEW_AUTH_TOKENS` (Flow 1 via `free_grants(auth_id = A, ...)`).
  2. Later installs desktop app on a machine.
  3. Desktop app runs anon, sends `device_id = D1` to `/api/users/ensure`.
- **Backend (using `free_grants`)**:
  - Web create-account has already inserted a `free_grants` row for `auth_id = A`.
  - Desktop ensure now checks `free_grants` for `{ device_id: D1, received_grant: true }`.
    - If **none**:
      - Grants `NEW_ANON_TOKENS` to a `users` row bound to `device_id = D1`.
      - Inserts `free_grants(device_id = D1, received_grant = true, grant_amount = NEW_ANON_TOKENS)`.
- **Outcome**:
  - User now has one account grant (`NEW_AUTH_TOKENS` for `auth_id = A`) and one device grant (`NEW_ANON_TOKENS` for `device_id = D1`).
  - Once they log into the same account in the desktop app, these pools are combined logically (next flow).

### 5. Logging into existing account on desktop (merging auth + device grants)

- **Steps**:
  1. User has some combination of web auth grant (`auth_id = A`) and/or desktop anon device grant (`device_id = D1`).
  2. They log into their account on desktop.
- **Backend (using `free_grants`)**:
  - Desktop login sends `authId = A` (and ideally `deviceId = D1`).
  - Backend loads:
    - The **auth-backed** `users` row(s) for `auth_id = A` (which already used `NEW_AUTH_TOKENS` if `free_grants(auth_id = A)` exists).
    - The **device-backed** `users` row(s) for `device_id = D1` that may be anon-only (and have `NEW_ANON_TOKENS` if `free_grants(device_id = D1)` exists).
  - If there is exactly one auth-only row and one device-only row:
    - Merge them logically:
      - Choose one canonical row (usually the auth row).
      - Add remaining device tokens into that row’s `tokens_added` / `tokens_used_all_time`.
      - Set `device_id = D1` on the canonical row.
      - Mark the device-only row as merged (e.g. zero out balances or archive).
    - **Do not** alter the existing `free_grants` rows; they remain the proof that both grants have already been used.
- **Outcome**:
  - Tokens from both grants live in a single logical pool for that person.
  - Future calls to `/api/users/ensure` and `/api/users/create-account` consult `free_grants` to ensure no extra free grants are applied for that `auth_id` or `device_id`.

### 6. User uses multiple browsers on web

- **Steps**:
  1. User visits with Browser A, creates a free account, gets `NEW_AUTH_TOKENS` (Flow 1).
  2. Later visits with Browser B, logs into the same account.
- **Backend (using `free_grants`)**:
  - Single `free_grants` row with `auth_id = A, received_grant = true` controls the auth grant.
- **Outcome**:
  - They see the *same* balance and usage across Browser A and Browser B.
  - They do **not** get another auth grant for using a different browser.

### 7. User tries to abuse via multiple accounts

Potential abuse patterns and mitigations:

- **Create many accounts with different emails to farm free grants.**
  - **Desktop-specific mitigations (via `device_id` + `free_grants`):**
    - `NEW_ANON_TOKENS` is already limited to one grant per `device_id` via `free_grants(device_id = D, received_grant = true)`.
    - When creating an auth account on desktop, we also:
      - Check how many auth-based `free_grants` rows exist for the same `device_id`.
      - If **any** auth-based grant has already been given for that `device_id`, do **not** give another `NEW_AUTH_TOKENS` grant to new accounts created from that device and return a friendly message ("this device has already received a free account grant").
  - **Web-specific mitigations (via email + IP):**
    - Require **email verification** before applying `NEW_AUTH_TOKENS`:
      - On sign-up, user gets a Supabase confirmation email.
      - A shared grant function can be triggered in two ways:
        - **Webhook path:** a Supabase email-confirmed webhook calls our backend with `auth_id`, which then checks `email_confirmed_at` and `free_grants(auth_id = A, received_grant = true)` before applying `NEW_AUTH_TOKENS` and inserting a `free_grants` row.
        - **Manual refresh path:** a "refresh grants" endpoint that the client calls after the user clicks a Refresh button; it performs the same checks and applies the grant if the webhook did not.
      - This way, even if the webhook fails or is delayed, the manual refresh still applies the grant once the email is verified.
    - Maintain a small **disposable-email domain blacklist** and skip the auth grant for those domains.
    - Optionally **rate-limit** new auth grants by IP (e.g. only a few `NEW_AUTH_TOKENS` grants per IP per 24 hours), returning a message to try again later if exceeded.
- **Reinstall desktop on same machine repeatedly.**
  - **Mitigation**: per-`device_id` device grant enforced via `free_grants(device_id)`; reinstall does not bypass and cannot create a second device grant.
- **Use many devices + many accounts.**
  - We accept some limited multi-device usage as part of being generous (each physical device can get one `NEW_ANON_TOKENS` grant).
  - Abuse at scale would show up via monitoring on the `free_grants` table (e.g. many grants from the same IP block or suspicious patterns across devices).

### 8. User moves between web portal, web editor, and desktop

- **Web portal** uses the same backend `users` table for auth and tokens.
- When user logs in on web portal:
  - They see token balance aligned with web editor / desktop.
- When user logs out from web portal and logs in from desktop (or vice versa):
  - The same `auth_id` is used; they see consistent token balances.

Key requirement:

- **Single source of truth** for token balances (`users` table) and grant history/eligibility (`free_grants` table) is the backend.
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
   - Add `device_id` column to `users` (already added) and create/use the `free_grants` table.
   - Implement endpoint(s) that accept `{ anonId, authId?, deviceId? }` and:
     - Ensure user.
     - Perform free grant logic based on `auth_id` and `device_id` using `free_grants` as the canonical ledger.
   - Enforce via `free_grants`:
     - One `NEW_AUTH_TOKENS` grant per `auth_id`.
     - One `NEW_ANON_TOKENS` grant per `device_id`.

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

- Giving each **account** a generous `NEW_AUTH_TOKENS` free grant.
- Giving each **desktop device** a one-time `NEW_ANON_TOKENS` anon grant.
- Avoiding trivial abuse via incognito/reinstall.
- Keeping the user messaging simple and intuitive across web and desktop.

**Abuse monitoring & extra safeguards (optional, later)**

Email confirmations:
these are necessary to make sure user does not type in many random email addresses to get a token for each fake account. They can still create many fake emails but that takes time and is tedious so it will happen less. We will also block certain email domains like from disposable email servers. 

Flow:
1. User signs up → your Express server creates Supabase user (admin API)
   return is message saying account created please click confirmation link in email to collect free tokens. 
2. your server generates a short-lived signed confirmation token (e.g. JWT or Supabase OTP) (stored in the users table probably)
3. your server sends a nice Resend email with your own link:
   https://your-app.onrender.com/#/confirm?token=abc123
   It auto confirms by calling an api
   api finds the corresponding user, sets `email_confirmed_at = now()`, adds N bonus tokens, returns message saying what happened
   Messages says somethings like Thank you for confirming! 
   If it added tokens the user sees a message saying so and how many. 
   And that they can return to the application and press refresh to see tokens (if there are any)
4. User returns to application and can use bonus tokens

added to the users table:
email_confirmed_at (set when the email is confirmed)
confirmation_token (used by the confirmation link)

added to server .env:
RESEND_KEY 

the create account endpoint creates the account, cretes the user row if necessary, creates the token, puts it in the user table, and sends the email with the api. this same crete account api is called regardless of where the user is (desktop, web app, web-portal etc)
To do this the create-account endpoint might be sent the device id or whatever identifying information should be used to check for the other flows in this file (if thats necessary?). 

so we need to update the create user endpoint to do all of these things
and crete the confirm hash router endpoint in the web-portal
