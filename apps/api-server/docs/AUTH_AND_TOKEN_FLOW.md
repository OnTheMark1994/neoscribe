# Auth, Device, and Token Flow

## 1. Anonymous users and devices

- Anonymous usage is tracked in the `users` table via `anon_id`.
- Desktop/web clients generate a stable `anon_id` per installation/browser.
- Desktop additionally sends a hashed `deviceId` for abuse prevention.
- On startup, clients call `POST /api/user/initialize` with `userId = anonId` and optional `authId`.
- `getOrCreateUser(anonId, authId, ip)`:
  - If `authId` exists, it prefers a row with that `auth_id` and will update `anon_id` if needed.
  - Else it looks for rows with `anon_id = anonId`.
  - If none exist, it creates a new `users` row with:
    - `tokens_monthly = 0`
    - `tokens_added = NEW_ANON_TOKENS`
    - `tokens_used = 0`, `tokens_used_all_time = 0`.

## 2. Creating an auth account

Endpoint: `POST /api/users/create-account`

Input:
- `anonId` (required): current anonymous id.
- `email` (required), `password` (required), `name` (optional).
- `deviceId` (optional, desktop-only; used for grant-abuse protection).

Steps:
1. Validates input and blocks disposable email domains.
2. Creates a Supabase auth user via `supabase.auth.admin.createUser` with `email_confirm: false`.
3. Looks up `existingUsers` with `anon_id = anonId`.
4. Checks whether this `deviceId` has **already received** an auth grant via `hasDeviceUsedAuthGrant(deviceId)`.
5. Computes `confirmMessage` based on whether the device is still eligible for an auth grant.

### 2.1 Reusing unconfirmed rows for typos / retries

To avoid multiple token pools when a user mistypes their email and retries:

- `primaryUnconfirmedUser` is selected in this order:
  - First, a user row with `!email_confirmed_at` and matching `device_id` (if `deviceId` is provided).
  - Otherwise, any row with `!email_confirmed_at` for this `anonId`.

Branching:

1. **No existing rows and device not yet used for auth**
   - Insert a new `users` row with:
     - `anon_id = anonId`
     - `auth_id = authId` (from Supabase auth user)
     - `email`, `password`, `device_id`
     - All token fields set to `0` (grant happens on email confirmation).

2. **Existing unconfirmed user for this device/anon and device not yet used for auth**
   - Reuse `primaryUnconfirmedUser`:
     - `auth_id` is updated to the newly created `authId`.
     - `email` and `password` are overwritten with the latest values.
     - `device_id` is set if previously null and `deviceId` is provided.
   - This ensures that typos or repeated attempts on the same device do **not** create separate accounts or token pools.

3. **Single anon row with no `auth_id` and device not yet used for auth**
   - Links `auth_id` to that existing row and updates `email`, `password` and optionally `device_id`.

4. **Device already used for auth grant or ambiguous rows**
   - A new `users` row is created for this new auth account to avoid disturbing the primary existing user row.

In all branches, the chosen `userRow` is the canonical row for this anon/auth/device combination before confirmation.

## 3. Confirmation token lifecycle

### 3.1 Creation

After determining `userRow` in `/api/users/create-account`, the server:

- Calls `generateConfirmationToken(String(userRow.id), email, password)`.
- Stores the resulting JWT token in `users.confirmation_token`.
- Builds a confirmation URL:
  - `FRONTEND_URL + '/#/confirm?token=' + encodeURIComponent(token)`.
- Sends the confirmation email via Resend (when configured).

`generateConfirmationToken` signs a JWT with payload:

- `userId`: the numeric `users.id` as a string.
- `email`: the email at the time of account creation.
- `password`: the password at the time of account creation.

This payload is later used by the web portal for auto-login after confirmation.

### 3.2 Verification and grant

Endpoint: `POST /api/email/confirm`

1. Verifies the provided JWT using `verifyConfirmationToken`.
2. Loads the `users` row by `userId` from the decoded payload.
3. If `email_confirmed_at` is already set, the endpoint returns `alreadyConfirmed: true` with no new tokens.
4. If `confirmation_token` is set and does not match the provided token, the request is rejected.
5. Determines eligibility for `NEW_AUTH_TOKENS` using the `free_grants` table:
   - `hasAuthReceivedGrant(user.auth_id)`
   - `hasDeviceUsedAuthGrant(user.device_id)`
6. Updates the user:
   - Sets `email_confirmed_at` to now.
   - Clears `confirmation_token`.
7. If eligible, calls `applyTokenChange` with a positive `deltaAdded` to grant the auth bonus and records an auth grant row in `free_grants`.
8. Updates Supabase Auth via `supabase.auth.admin.updateUserById(user.auth_id, { email_confirm: true })` (best-effort, `users` remains the primary source of truth).
9. Returns a JSON response including:
   - `tokensAdded`: the number of tokens actually granted (may be `0` if ineligible).
   - `email` and `password` from the decoded token for web-portal auto-login.

## 4. Token model and usage

User token fields (in `users`):

- `tokens_monthly`: current monthly allowance **balance**.
- `tokens_added`: long-lived bonus / top-up bucket.
- `tokens_used`: per-period usage counter.
- `tokens_used_all_time`: lifetime usage counter.

Available tokens:

- `availableTokens = tokens_monthly + tokens_added` (never negative).

### 4.1 Reading token state

- `POST /api/user/initialize` returns:
  - `tokensMonthly`, `tokensAdded`, `tokensUsed`, `tokensUsedAllTime`, `availableTokens`.
- `POST /api/user/tokens/` returns the same fields plus subscription fields:
  - `tier_id`, `subscription_tier_name`, `subscription_status`, `next_billing_date`, etc.
- Desktop and web clients normalize these fields to handle both camelCase and snake_case names.

### 4.2 Applying usage

- All usage mutations go through `updateUserTokens` → `applyTokenChange`.
- Deduction order:
  1. Spend from `tokens_monthly` first.
  2. Then from `tokens_added`.
- `tokens_used` and `tokens_used_all_time` are incremented by the amount consumed.

## 5. Client flows (high level)

### 5.1 Desktop app

- Generates/loads a persistent `anonId` and `deviceId`.
- Calls `/api/user/initialize` to ensure a `users` row exists.
- When the user chooses to create an account:
  - Calls `/api/users/create-account` with `anonId`, `email`, `password`, `deviceId`.
  - This:
    - Creates/links a Supabase auth user.
    - Reuses any unconfirmed row for this device/anon.
    - Issues a confirmation email.
- After confirmation, the user logs in (desktop uses `authId`/`anonId` to query `/api/user/tokens`).

### 5.2 Web portal

- Uses the Supabase JS client (`supabaseClient.js`) and `AuthContext` to manage auth state.
- `AccountPage`:
  - If `user` exists in `AuthContext`, it calls `/api/user/tokens/` with `authId = user.id` to load stats.
- `ConfirmEmailPage`:
  - Calls `/api/email/confirm` with the token from the email link.
  - Displays `tokensAdded` and a "Go to Account" button.
  - When the backend returns `email` and `password`, it builds an `/auto-login` URL that includes them as query params.
- `AccountPage` also handles automatic sign-in for `/auto-login` routes by:
  - Reading `email` and `password` from the query string.
  - Using `signInWithEmail` from `AuthContext` (Supabase auth client) to create a session.
  - Redirecting to `/account` so stats immediately reflect the confirmed account and granted tokens.

This setup keeps a single canonical `users` row per device/anon for unconfirmed accounts and ensures that retries with corrected emails do not fragment token balances across multiple rows.
