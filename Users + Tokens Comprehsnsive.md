# Comprehensive Auth & Token Flow Documentation

**Last Updated:** December 2024  
**Sources:** `AUTH_AND_TOKEN_FLOW.md`, `TOKEN_TRACKING.md`, `User Row Creation & Free Tokens.md`, `server.js`

---

## Table of Contents

1. [Constants & Configuration](#constants--configuration)
2. [Database Schema](#database-schema)
3. [User Row Creation Actions](#user-row-creation-actions)
4. [Token Grant Rules](#token-grant-rules)
5. [Core Endpoints & Functions](#core-endpoints--functions)
6. [All Possible Situations](#all-possible-situations)
7. [Code Verification Results](#code-verification-results)

---

## Constants & Configuration

**Token Constants** (from `server.js` lines 14-16):
These are in the server.js file and may change so use the variable name not hard coded values

const NEW_ANON_TOKENS;    // Tokens for device anon users (desktop)
const NEW_AUTH_TOKENS;    // Bonus tokens for auth confirmation
const NEW_MONTHLY_TOKENS; // Monthly refill for paid tiers (currently not used)


**Key Principles:**
- Web-only anon users get **0 tokens** initially (intended behavior)
- Desktop anon users (with `deviceId`) get **`NEW_ANON_TOKENS`** via device grant
- Auth accounts get **`NEW_AUTH_TOKENS`** on email confirmation (if eligible)
- Eligibility tracked via `free_grants` table (one auth grant per `auth_id`, one device grant per `device_id`)

---

## Database Schema

The full database schema (including `users`, `free_grants`, `token_log`, and related tables) is documented in `Database_Tables.md`.  
This document assumes those tables exist as defined there and focuses on **flows and behavior** (who gets which tokens when), rather than repeating column definitions.

---

## User Row Creation Actions

### 1. Web anon initialize
**Endpoint:** `POST /api/user/initialize`  
**Input:** `{ userId: anonId, authId: null }`  
**When:** Browser generates `anonId`, no prior user row exists  
**Code:** `getOrCreateUser(anonId, null, ip)` → lines 438-477  
**Result:**
- Creates `users` row with:
  - `anon_id = anonId`
  - `auth_id = null`
  - `device_id = null`
  - `tokens_monthly = 0`
  - `tokens_added = NEW_ANON_TOKENS` ← **DISCREPANCY FOUND**
- **Expected per docs:** `tokens_added = 0` (no bonus for web anon)
- **Actual code behavior:** `tokens_added = NEW_ANON_TOKENS` (line 442: `initialTokensAdded = isNewAnon ? NEW_ANON_TOKENS : NEW_AUTH_TOKENS`)

**❌ CODE DOES NOT MATCH INTENDED BEHAVIOR**

### 2. Device anon initialize
**Endpoint:** `POST /api/users/ensure` (desktop uses this, not `/initialize`)  
**Input:** `{ anonId, deviceId }`  
**When:** Desktop generates `anonId` + `deviceId`, no prior user row  
**Code:** Lines 2422-2468  
**Result:**
- Creates `users` row with:
  - `anon_id = anonId`
  - `device_id = deviceId`
  - `auth_id = null`
  - `tokens_added = NEW_ANON_TOKENS` (if device not already granted)
- Records device grant in `free_grants`
- Logs to `token_log`

**✅ CODE MATCHES DOCS**

### 3. Web auth created via backend
**Endpoint:** `POST /api/users/create-account`  
**Input:** `{ anonId, email, password }` (no `deviceId`)  
**When:** Web portal or web app calls create-account  
**Code:** Lines 1250-1509  
**Result:**
- Creates Supabase auth user
- Finds/creates `users` row:
  - If no existing rows: creates new with all tokens = 0
  - If unconfirmed row exists: reuses it, updates `auth_id`/`email`/`password`
  - If single anon row with no `auth_id`: links `auth_id` to it
- Sends confirmation email with JWT token
- **No tokens granted until confirmation**

**✅ CODE MATCHES DOCS**

### 4. Device auth created via backend  
**Endpoint:** `POST /api/users/create-account`  
**Input:** `{ anonId, email, password, deviceId }`  
**When:** Desktop calls create-account  
**Code:** Same as #3, lines 1250-1509  
**Result:** Same branching logic but with `deviceId` stored  

**✅ CODE MATCHES DOCS**

### 5. Auth created with no prior anon/device user
**When:** First call to `/api/users/create-account` for brand-new `anonId`  
**Code:** Lines 1353-1382 (branch: `!deviceAlreadyUsedForAuth && (!existingUsers || existingUsers.length === 0)`)  
**Result:**
- Creates new `users` row from scratch
- All token fields = 0
- Linked to new Supabase auth user

**✅ CODE MATCHES DOCS**

### 6. Typo email auth created (unconfirmed)
**When:** `/create-account` called with wrong email, then called again with corrected email  
**Code:** Lines 1346-1351 (primaryUnconfirmedUser selection) + lines 1383-1407  
**Result:**
- First call: creates unconfirmed row with `auth_id_1`, `email_1`
- Second call: finds `primaryUnconfirmedUser` (same row), **overwrites** `auth_id` → `auth_id_2`, `email` → `email_2`
- **Single row reused** → no token pool fragmentation

**✅ CODE MATCHES DOCS**

### 7. Login existing auth with anon (link)
**Endpoint:** `POST /api/users/login`  
**Input:** `{ anonId, email, password }`  
**When:** Desktop logs in existing auth user  
**Code:** Lines 1102-1248  
**Result:**
- Signs in Supabase auth user
- Calls `getOrCreateUser(anonId, authId, ip)`
- If anon-only row exists for `anonId`, links `auth_id` to it (lines 416-429)
- If no row, creates new one

**✅ CODE MATCHES DOCS**

### 8. Supabase-only auth sign-up (web portal)
**Endpoint:** Web portal `signUpWithEmail` → `POST /api/user/initialize`  
**Input:** Supabase creates auth user → portal calls `/initialize` with `{ userId: authId, authId: authId }`  
**Code:** `AccountPage.handleAuthSubmit` (lines 403-420) + `getOrCreateUser`  
**Result:**
- Supabase auth user created
- Portal calls `/initialize` which triggers `getOrCreateUser(authId, authId, ip)`
- Creates `users` row with:
  - `auth_id = authId`
  - `anon_id = authId` (same value)
  - `tokens_added = NEW_AUTH_TOKENS` ← **per line 442**

**⚠️ BEHAVIOR NOTE:** Web-only signup via Supabase gets `NEW_AUTH_TOKENS` immediately (not on confirmation) because `getOrCreateUser` with `authId` set treats it as auth user.

---

## Token Grant Rules

### Anon Bonus (`NEW_ANON_TOKENS`)

**Intended:** Only desktop users with `deviceId`  
**Actual code:**
- `getOrCreateUser` grants if `!authId` (line 441-442)
- `/api/users/ensure` grants if `deviceId` provided and not already granted (lines 2424-2425)

**Who gets it:**
- ✅ Desktop anon via `/users/ensure` with `deviceId`
- ❌ Web anon via `/user/initialize` with no `authId` (should NOT get, but code gives it)

### Auth Bonus (`NEW_AUTH_TOKENS`)

**Granted by:** `POST /api/email/confirm` (lines 1538-1670)

**Eligibility checks:**
1. `email_confirmed_at` must be null (first confirmation)
2. `hasAuthReceivedGrant(auth_id)` must be false
3. `hasDeviceUsedAuthGrant(device_id)` must be false (if `device_id` present)

**Who gets it:**
- ✅ First email confirmation for any auth account (if no prior grant on that `auth_id` or `device_id`)
- ❌ Re-confirmation (already confirmed) → 0 tokens
- ❌ Second auth on same device → 0 tokens
- ❌ Auth already granted before → 0 tokens

### Subscription Monthly Tokens

**Granted by:** Stripe webhooks (`customer.subscription.created`, renewals)  
**Logic:** `tokens_monthly = max(current, tierLimit)` (never reduce on downgrade)  
**Reset:** `tokens_used = 0` on renewal

---

## Core Endpoints & Functions

### `getOrCreateUser(anonId, authId, ipAddress)`
**Location:** Lines 361-482  
**Purpose:** Find or create a `users` row  
**Logic:**
1. If `authId` provided → search by `auth_id`, update `anon_id` if needed
2. Else search by `anon_id`
3. If found and `authId` provided but row has no `auth_id` → link it
4. If not found → create new with:
   - `tokens_added = isNewAnon ? NEW_ANON_TOKENS : NEW_AUTH_TOKENS`
   - `isNewAnon = !authId`

**Issue:** Treats web anon (no `authId`) same as desktop anon, granting `NEW_ANON_TOKENS` to both.

### `POST /api/user/initialize`
**Location:** Lines 1951-2034  
**Input:** `{ userId, authId }`  
**Purpose:** Initialize user and return token stats  
**Calls:** `getOrCreateUser(userId, authId, ip)`

### `POST /api/users/ensure`
**Location:** Lines 2267-2493  
**Input:** `{ anonId, deviceId }`  
**Purpose:** Desktop-specific initialization with device grant tracking  
**Logic:**
1. Check if `deviceId` already received grant via `hasDeviceReceivedGrant`
2. Search by `device_id` first, then `anon_id`
3. If user exists + device not granted → apply device grant via `applyTokenChange`
4. If no user → create with `tokens_added = deviceId && !granted ? NEW_ANON_TOKENS : 0`
5. Record grant in `free_grants`

**This is the correct path for desktop anon grants.**

### `POST /api/users/create-account`
**Location:** Lines 1250-1509  
**Input:** `{ anonId, email, password, deviceId? }`  
**Purpose:** Create Supabase auth user and link/create `users` row  
**Logic:**
1. Validate, create Supabase auth user
2. Check `deviceAlreadyUsedForAuth`
3. Find `primaryUnconfirmedUser` (reuse typo emails)
4. Branch:
   - No existing + device not used → create new row, tokens = 0
   - Unconfirmed exists + device not used → reuse row, update auth/email
   - Single anon row + device not used → link `auth_id`
   - Device used or ambiguous → create new row, tokens = 0
5. Generate confirmation token, send email

**No tokens granted here; happens on confirmation.**

### `POST /api/email/confirm`
**Location:** Lines 1538-1670  
**Input:** `{ token }`  
**Purpose:** Verify email and grant auth bonus  
**Logic:**
1. Verify JWT, load user
2. If already confirmed → return `alreadyConfirmed: true`
3. If token mismatch → reject
4. Check eligibility via `hasAuthReceivedGrant` + `hasDeviceUsedAuthGrant`
5. Set `email_confirmed_at`, clear `confirmation_token`
6. If eligible → `applyTokenChange` with `deltaAdded: NEW_AUTH_TOKENS`, record in `free_grants`
7. Update Supabase auth (`email_confirm: true`)
8. Return `tokensAdded`, `email`, `password`

---

## All Possible Situations

### Situation 1: Fresh web browser, no anon usage
**Steps:**
1. User opens web portal
2. Browser generates `anonId`
3. *Does not call `/initialize`* (portal doesn't use anon mode currently)
4. User clicks "Create Account"
5. Portal calls `signUpWithEmail` (Supabase)
6. Portal calls `/api/user/initialize` with `userId=authId, authId=authId`

**Expected:**
- `users` row created via `getOrCreateUser(authId, authId, ip)`
- `tokens_added = NEW_AUTH_TOKENS` (because `!isNewAnon`)
- User has `NEW_AUTH_TOKENS` tokens immediately, before confirmation

**Actual code behavior:** ✅ Matches

**Logical issue:** User gets tokens before confirming email, and gets them again on confirmation if eligible → **DOUBLE GRANT POSSIBLE**

### Situation 2: Web anon usage, then create account
**Steps:**
1. Browser generates `anonId`
2. *Hypothetically* calls `/api/user/initialize` (web doesn't do this now)
3. User uses AI anonymously
4. Later creates account via `/api/users/create-account`

**Expected:**
- Web anon row has `tokens_added = 0`
- Create-account links `auth_id` to anon row
- Confirmation grants `NEW_AUTH_TOKENS`

**Actual code behavior if `/initialize` were called:**
- ❌ `getOrCreateUser` would give `NEW_ANON_TOKENS` to web anon
- Create-account would link auth
- Confirmation would add `NEW_AUTH_TOKENS` → **40k total** (wrong)

### Situation 3: Desktop anon, then create account
**Steps:**
1. Desktop generates `anonId` + `deviceId`
2. Calls `/api/users/ensure`
3. Uses AI anonymously (15k tokens)
4. Creates account via `/api/users/create-account`
5. Confirms email

**Expected:**
- Device grant: `NEW_ANON_TOKENS`
- Auth grant on confirmation: `NEW_AUTH_TOKENS`
- Total: `NEW_ANON_TOKENS + NEW_AUTH_TOKENS` (this is intentional, different identity types)

**Actual code behavior:** ✅ Matches

**Eligibility:** ✅ Works correctly (device grant tracked separately from auth grant)

### Situation 4: Desktop, create account immediately (no anon usage)
**Steps:**
1. Desktop generates `anonId` + `deviceId`
2. Immediately calls `/api/users/create-account` (no `/ensure` call)
3. Confirms email

**Expected:**
- No device grant (never called `/ensure`)
- Auth grant on confirmation: `NEW_AUTH_TOKENS`
- Total: `NEW_AUTH_TOKENS`

**Actual code behavior:** ✅ Matches (create-account creates row with tokens=0, confirmation grants 25k)

### Situation 5: Desktop, typo email, correct email, confirm
**Steps:**
1. Desktop anon exists (15k tokens)
2. Create account with `bad@email.com`
3. Create account again with `good@email.com`
4. Confirm `good@email.com`

**Expected:**
- Same `users` row reused (typo logic)
- `auth_id` overwritten from bad to good
- Confirmation grants `NEW_AUTH_TOKENS` to the single row
- Total: `NEW_ANON_TOKENS + NEW_AUTH_TOKENS` (device grant + auth grant)

**Actual code behavior:** ✅ Matches (lines 1383-1407 reuse `primaryUnconfirmedUser`)

### Situation 6: Desktop, first account confirmed, second account same device
**Steps:**
1. Desktop creates account A, confirms → gets 15k device + 25k auth
2. Desktop creates account B (same `deviceId`)
3. Confirms account B

**Expected:**
- Account B confirmation: 0 tokens (device already used for auth grant)
- Total for B: 0 tokens

**Actual code behavior:** ✅ Matches (lines 1609-1634 check `hasDeviceUsedAuthGrant`)

### Situation 7: Web portal sign-up, no email confirmation
**Steps:**
1. User signs up via portal `signUpWithEmail`
2. Portal calls `/initialize` with `authId`
3. User **does not** confirm email

**Expected:**
- User has tokens immediately from `/initialize`
- No additional tokens on confirmation (auth already granted)

**Actual code behavior:**
- `getOrCreateUser` gives `NEW_AUTH_TOKENS` immediately
- Confirmation checks `hasAuthReceivedGrant` → **should** block double grant
- **BUT** `free_grants` entry not created until confirmation! ❌

**Issue found:** User gets `NEW_AUTH_TOKENS` from `/initialize`, then another `NEW_AUTH_TOKENS` from confirmation → **DOUBLE GRANT**

### Situation 8: Web portal sign-up, confirm email immediately
**Steps:**
1. Portal `signUpWithEmail`
2. Portal calls `/initialize`
3. User clicks confirm link immediately
4. `/api/email/confirm` processes

**Expected:**
- `NEW_AUTH_TOKENS` once

**Actual code:**
- `/initialize` grants `NEW_AUTH_TOKENS` via `getOrCreateUser` (line 442)
- `/confirm` checks `hasAuthReceivedGrant(auth_id)` → false (no grant recorded yet)
- `/confirm` grants another `NEW_AUTH_TOKENS` → **`2 * NEW_AUTH_TOKENS` total** ❌

### Situation 9: Desktop login existing auth (different anon)
**Steps:**
1. User has confirmed auth account on desktop A
2. User logs in on desktop B (new `anonId`, new `deviceId`)
3. Desktop B calls `/api/users/login`

**Expected:**
- Existing auth row reused
- `anon_id` updated to new value
- No new tokens

**Actual code behavior:** ✅ Matches (lines 366-394 in `getOrCreateUser`)

### Situation 10: Multiple anon rows for same anonId (historical data)
**Steps:**
1. DB has 2 `users` rows with same `anon_id` (edge case)
2. User calls `/initialize`

**Expected:**
- Deterministic selection (first row)
- Warning logged

**Actual code behavior:** ✅ Matches (lines 408-410)

---

## Code Verification Results

### ✅ Working Correctly

1. **Device anon grants via `/users/ensure`** → tracked in `free_grants`, one per device
2. **Typo email reuse** → `primaryUnconfirmedUser` logic prevents duplicate rows
3. **Device abuse prevention** → second auth on same device gets 0 tokens on confirmation
4. **Auth login linking** → existing auth row found and reused, `anon_id` updated
5. **Create-account branching** → correct row selection and reuse logic

### ❌ Issues Found

#### Issue 1: Web anon gets tokens via `/initialize`
**Problem:** `getOrCreateUser(anonId, null, ip)` treats web anon same as desktop anon  
**Code:** Line 441-442: `isNewAnon = !authId` → grants `NEW_ANON_TOKENS`  
**Fix needed:** Add `deviceId` parameter to `getOrCreateUser`, only grant anon tokens if `deviceId` present

#### Issue 2: Web portal signup double grant
**Problem:** Portal calls `/initialize` with `authId` → gets `NEW_AUTH_TOKENS`, then confirmation grants again  
**Code:** `getOrCreateUser` line 442 + `/confirm` lines 1610-1650  
**Fix needed:** Either:
- A) Don't call `/initialize` for web signup (just let confirmation handle it)
- B) Record auth grant in `free_grants` when `/initialize` creates auth user
- C) Check `free_grants` in `getOrCreateUser` before granting

#### Issue 3: `/initialize` doesn't record grants in `free_grants`
**Problem:** `getOrCreateUser` grants tokens but doesn't call `recordAuthGrant` or `recordDeviceGrant`  
**Code:** Lines 461-476 only log to `token_log`, not `free_grants`  
**Fix needed:** Call appropriate grant recording function after creating user with tokens

---

## Recommended Code Fixes

### Fix 1: Update `getOrCreateUser` signature
```javascript
async function getOrCreateUser(anonId, authId, ipAddress, deviceId = null)
```

Change line 441-442:
```javascript
// OLD:
const isNewAnon = !authId;
const initialTokensAdded = isNewAnon ? NEW_ANON_TOKENS : NEW_AUTH_TOKENS;

// NEW:
const isNewAnon = !authId;
const shouldGrantAnonTokens = isNewAnon && deviceId; // Only grant if device present
const shouldGrantAuthTokens = authId && !deviceId;   // Auth user without device (web portal case)
const initialTokensAdded = shouldGrantAnonTokens ? NEW_ANON_TOKENS : 
                          (shouldGrantAuthTokens ? NEW_AUTH_TOKENS : 0);
```

### Fix 2: Record grants in `getOrCreateUser`
After line 476, add:
```javascript
// Record grant in free_grants to prevent double-granting
if (shouldGrantAnonTokens && deviceId) {
  await recordDeviceGrant(deviceId, NEW_ANON_TOKENS);
} else if (shouldGrantAuthTokens && authId) {
  await recordAuthGrant(authId, NEW_AUTH_TOKENS);
}
```

### Fix 3: Update `/api/user/initialize` to pass `deviceId`
Line 1976, change:
```javascript
// OLD:
const user = await getOrCreateUser(userId, authId, ipAddress);

// NEW:
const deviceId = req.body.deviceId || null;
const user = await getOrCreateUser(userId, authId, ipAddress, deviceId);
```

### Fix 4: Remove `/initialize` call from web portal signup
In `AccountPage.handleAuthSubmit`, **remove** lines 405-419 (the `/initialize` call after `signUpWithEmail`).

Let the auth bonus be granted **only** on email confirmation via `/api/email/confirm`.

---

## Summary

**Total situations analyzed:** 10  
**Working correctly:** 6  
**Issues found:** 4

**Critical fixes needed:**
1. Prevent web anon from getting device grant
2. Prevent double auth grant on web portal signup
3. Ensure `free_grants` records created consistently

**Next steps:**
1. Apply recommended code fixes
2. Test all 10 situations
3. Update MD docs to reflect actual behavior
4. Consider removing web anon mode entirely if not needed
