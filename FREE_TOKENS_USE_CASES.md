# Free Tokens Use Cases

Very basic desired behavior
if the user creates a new auth account (in web or desktop app) with a new email they get a confirmation email, when the email is confirmed they get bonus tokens.
If they open the application on a new device (checked with device id) they automatically get bonus tokens. 
We keep track of emails (or auth ids) and device ids used in the free grants table so we know not to give double grants on uninstall/reinstall, multiple emails on same device, etc. 
If they use multiple email auth accounts on the same device we block this by checking for existing device ids in the free grants table. 
These bonus amounts are devined in the server. 

### free_grants table (Supabase)

- **Table name:** `free_grants`
- **Columns (relevant to grants logic):**
  - `id` (uuid) – primary key.
  - `created_at` (timestamptz) – when the grant was recorded.
  - `auth_id` (uuid, nullable) – Supabase Auth user id that received an auth grant.
  - `device_id` (text, nullable) – hashed desktop device id that received a device grant.
  - `received_grant` (boolean) – true if this row represents a grant that has been applied.
  - `grant_amount` (integer) – number of free tokens granted (e.g. `NEW_ANON_TOKENS`, `NEW_AUTH_TOKENS`).



This document describes all possible user scenarios and the expected behavior for each step.

## Key Constants
- `NEW_ANON_TOKENS = <DEFINED IN apps/api-server/SERVER.JS>` - Device grant (desktop only)
- `NEW_AUTH_TOKENS = <DEFINED IN SERVER.JS>` - Auth grant (email confirmation)

## Key Differences: Web vs Desktop
| Aspect | Web | Desktop |
|--------|-----|---------|
| `anonId` | Yes (localStorage) | Yes (electron-store) |
| `deviceId` | **NO** | Yes (hashed machine ID) |
| Device grant eligible | **NO** | Yes |
| Auth grant eligible | Yes | Yes |

---

## Scenario 1: Web-Only User Creates Account (Fresh)

**Precondition:** No existing user row with this anonId or email.

### Steps:
1. **User visits web app**
   - Frontend generates `anonId` (stored in localStorage)
   - No `deviceId` (web has none)

2. **User opens Settings, which calls `/api/users/ensure`**
   - Request: `{ anonId: "abc123" }` (no deviceId)
   - Server checks: no user found by anonId
   - Server creates new user row:
     ```
     { anon_id: "abc123", auth_id: null, device_id: null, tokens_monthly: 0, tokens_added: 0 }
     ```
   - Returns user data

3. **User fills in email/password, clicks "Create Account"**
   - Frontend calls `/api/users/create-account`
   - Request: `{ anonId: "abc123", email: "user@example.com", password: "xxx" }` (no deviceId)
   - Server creates Supabase auth user, gets `authId`
   - Server queries users by anonId → finds 1 row with no auth_id
   - Server updates that row with auth_id, email, password
   - Server generates confirmation token with email + password
   - Server sends confirmation email
   - **Expected Response:** `"Account created! Please check your email to confirm and receive <SERVER_CONSTANT> free tokens."`

4. **User clicks confirmation link in email**
   - Link: `https://[FRONTEND_URL]/#/confirm?token=...`
   - Frontend calls `/api/email/confirm` with token
   - Server decodes token, finds user
   - Server checks `hasAuthReceivedGrant(authId)` → false
   - Server checks `hasDeviceUsedAuthGrant(null)` → false (no device)
   - Server grants `NEW_AUTH_TOKENS` (SERVER CONSTANT) via `applyTokenChange`
   - Server records in `free_grants` table: `{ auth_id: authId, device_id: null }`
   - Server returns `{ success: true, tokensAdded: x, email, password }`
   - THIS PAGE COMPONENT LOGGS IN THE USER AUTOMATICALLY WITH A SUPABASE AUTH CALL FROM THE DECODED MESSAGE. 
   - page says x tokens awarded you how have y available tokens
   - there is a button to view account which goes to #/account (they are already logged in with auth)

---

## Scenario 2: Desktop-Only User (No Account Creation)

**Precondition:** Fresh install, no existing user.

### Steps:
1. **User installs and opens desktop app**
   - Electron generates `anonId` (electron-store)
   - Electron generates `deviceId` (hashed machine ID)

2. **App calls `/api/users/ensure`**
   - Request: `{ anonId: "abc123", deviceId: "device-hash-xyz" }`
   - Server checks `hasDeviceReceivedGrant(deviceId)` → false
   - Server checks: no user found by deviceId or anonId
   - Server creates new user row:
     ```
     { anon_id: "abc123", device_id: "device-hash-xyz", tokens_monthly: 0, tokens_added: 15000 }
     ```
   - Server records in `free_grants` table: `{ device_id: "device-hash-xyz", auth_id: null }`
   - **User sees 15,000 tokens immediately**

---

## Scenario 3: Desktop User Creates Account

**Precondition:** User already has device grant from Scenario 2.

### Steps:
1. **User has 15,000 tokens from device grant**
   - User row exists with `device_id`, `tokens_added: 15000`

2. **User opens Settings, fills email/password, clicks "Create Account"**
   - Request: `{ anonId: "abc123", email: "user@example.com", password: "xxx", deviceId: "device-hash-xyz" }`
   - Server creates Supabase auth user, gets `authId`
   - Server queries users by anonId → finds 1 row with no auth_id
   - Server updates that row with auth_id, email, password
   - Server checks `hasDeviceUsedAuthGrant(deviceId)` → false
   - **Expected Response:** `"Account created! Please check your email to confirm and receive 25,000 free tokens."`

3. **User clicks confirmation link in email**
   - Server checks `hasAuthReceivedGrant(authId)` → false
   - Server checks `hasDeviceUsedAuthGrant(deviceId)` → false
   - Server grants 25,000 tokens
   - Server records: `{ auth_id: authId, device_id: "device-hash-xyz" }`
   - **User now has 15,000 + 25,000 = 40,000 tokens**

---

## Scenario 4: Desktop Reinstall (Same Machine)

**Precondition:** User had device grant, then reinstalled app.

### Steps:
1. **User reinstalls desktop app**
   - New `anonId` generated
   - Same `deviceId` (same machine)

2. **App calls `/api/users/ensure`**
   - Request: `{ anonId: "new-anon-456", deviceId: "device-hash-xyz" }`
   - Server checks `hasDeviceReceivedGrant(deviceId)` → **true**
   - Server looks up user by deviceId → finds existing row
   - Server updates anon_id on that row to new one
   - **No new tokens granted** (device already got grant)
   - User sees their existing tokens

---

## Scenario 5: Desktop User Creates Second Account (Abuse Attempt)

**Precondition:** User already created account and got auth grant on this device.

### Steps:
1. **User tries to create new account on same device**
   - Different email, same deviceId
   - Server creates new auth user
   - Server creates a **new user row for this auth account** (the original user row with `device_id` + first `auth_id` is left untouched)
   - Server checks `hasDeviceUsedAuthGrant(deviceId)` → **true**
   - **Expected Response:** `"Account created. This device has already received free device and account grants so no bonus tokens were added."`

2. **User clicks confirmation link**
   - Server checks `hasAuthReceivedGrant(newAuthId)` → false
   - Server checks `hasDeviceUsedAuthGrant(deviceId)` → **true**
   - **No tokens granted** (device already used for auth grant)

---

## Scenario 6: Web User Tries to Get Device Grant

**Precondition:** User only uses web.

### Result:
- Web has no `deviceId`
- `/api/users/ensure` with no deviceId → no device grant possible
- User can only get `NEW_AUTH_TOKENS` via email confirmation
- **Maximum possible: 25,000 tokens**

---

## Scenario 7: User Uses Both Web and Desktop (Same Email)

**Precondition:** User has accounts in both places.

### Case A: Desktop first, then web login
1. Desktop: Gets device grant (15,000)
2. Desktop: Creates account, confirms email (25,000)
3. Web: Logs in with same email → sees same user row with 40,000 tokens

### Case B: Web first, then desktop
1. Web: Creates account, confirms email (25,000)
 2. Desktop: Fresh install → device grant (15,000) added to same user
  3. Total: 40,000 tokens

---

## Scenario 8: Desktop Fake Email Then Real Email (Same Device)

**Precondition:** User is using the desktop app on a device that has already received its device grant (Scenario 2) or will receive it now.

### Steps:

1. **Desktop: first install and device grant**
   - App calls `/api/users/ensure` with `{ anonId, deviceId }`.
   - If this `deviceId` has **no** entry in `free_grants` yet:
     - Server grants `NEW_ANON_TOKENS` via `applyTokenChange`.
     - Server inserts into `free_grants`: `{ device_id, auth_id: null, received_grant: true, grant_amount: NEW_ANON_TOKENS }`.

2. **User creates account with a fake/unreachable email**
   - In Settings, they enter `fake@example.test` and a password, and click "Create Account".
   - Desktop calls `/api/users/create-account` with `{ anonId, email: fake@example.test, password, deviceId }`.
   - Server creates a Supabase auth user (unconfirmed) and links `auth_id` to the existing `users` row for this device.
   - Server sends a confirmation email to the fake address, but the user can never confirm it.
   - **No call to `/api/email/confirm` ever happens for this fake email.**
   - Result: there is **no `free_grants` row** with this `auth_id`, and `hasAuthReceivedGrant(fakeAuthId)` remains false.

3. **User logs out and creates a second account with a real email on the same device**
   - They log out in Settings (which clears local `authId` and credentials).
   - Then they enter a real email `real@example.com` and a password and click "Create Account".
   - Desktop calls `/api/users/create-account` again with `{ anonId, email: real@example.com, password, deviceId }`.
   - Server creates a new Supabase auth user (`realAuthId`) and links it to the same device/user row.
   - A new confirmation email is sent to the real address.

4. **User confirms the real email**
   - They click the link, which calls `/api/email/confirm` with the JWT token.
   - Server decodes the token, finds the `users` row and `auth_id = realAuthId`.
   - Server checks `hasAuthReceivedGrant(realAuthId)` → **false** (no previous auth grant for this account).
   - Server checks `hasDeviceUsedAuthGrant(deviceId)` → **false** (no previous auth grant recorded for this device, because the fake email never confirmed).
   - Server grants `NEW_AUTH_TOKENS` via `applyTokenChange`.
   - Server records in `free_grants`: `{ auth_id: realAuthId, device_id, received_grant: true, grant_amount: NEW_AUTH_TOKENS }`.
   - Now `hasDeviceUsedAuthGrant(deviceId)` will be **true** for any future auth accounts on this device.

**Outcome:**

- The fake email never confirmed, so it never consumed the auth grant for this device.
- The first **confirmed** email on the device (the real one) receives `NEW_AUTH_TOKENS`.
- Future attempts to create/confirm additional auth accounts on the same device will be blocked from receiving another auth grant by `hasDeviceUsedAuthGrant(deviceId)`.

---

## API Endpoint Summary

### POST /api/users/ensure
- Creates or retrieves user row
- Grants device tokens if: `deviceId` provided AND not already granted
- **Web:** No device grant (no deviceId)
- **Desktop:** Device grant on first install per machine

### POST /api/users/create-account
- Creates Supabase auth user
- Links auth_id to existing user row (or creates new one)
- Sends confirmation email
- Does NOT grant tokens yet

### POST /api/email/confirm
- Confirms email
- Grants auth tokens if: auth_id not already granted AND device not already used for auth grant
- Returns email + password for auto-login

---

## Issues Identified and Fixed

### Issue 1: Wrong Message for Web User ✅ FIXED
- **Bug:** Web user creating account got message "This device already has an account"
- **Cause:** The else branch (multiple anon rows or auth_id set) had a hardcoded message mentioning "device"
- **Fix:** All branches now use the same `confirmMessage` which correctly says:
  - Web (no device): "Account created! Please check your email to confirm and receive 25,000 free tokens."
  - Desktop (device already used): "Account created. This device has already received a free account grant..."

### Issue 2: Confirmation Email Goes to Localhost ⚠️ NEEDS ENV VAR
- **Bug:** Email link points to `http://localhost:3001` instead of production URL
- **Cause:** `FRONTEND_URL` environment variable not set on production server
- **Fix Required:** Set environment variable on Render:
  ```
  FRONTEND_URL=https://scribefold-ai-monorepo.onrender.com
  ```

### Issue 3: Else Branch Logic ✅ FIXED
- **Was:** Else branch assumed multiple anon rows = abuse, showed wrong message
- **Now:** Else branch creates new row but shows correct confirmation message
- User CAN still get tokens on email confirmation (free_grants table determines eligibility, not branch logic)

---

## Environment Variables Required

For the confirmation email to work correctly in production, ensure these are set:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `FRONTEND_URL` | Base URL for confirmation links | `https://scribefold-ai-monorepo.onrender.com` |
| `EMAIL_FROM` | Sender email address | `ScribeFold AI <noreply@yourdomain.com>` |
| `RESEND_KEY` | Resend API key | `re_xxxx...` |
| `EMAIL_CONFIRM_SECRET` | JWT signing secret | (use SUPABASE_SERVICE_ROLE_KEY or a secure random string) |

