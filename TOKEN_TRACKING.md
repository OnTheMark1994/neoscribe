# Token Tracking Design

This document describes the **new token tracking model** for ScribeFold across API server, desktop app, and web portal. It is the source of truth for how token balances are represented and updated.

---

## 1. User Token Fields (Database Schema)

All fields live on the `users` table.

### 1.1 Identity & Subscription

- `id`: Primary key.
- `auth_id`: Supabase Auth user ID.
- `anon_id`: Anonymous user ID (may appear on multiple rows).
- `email`, `password`: Auth credentials.
- `name`, `bio`: Profile metadata.
- `tier_id`: **Tier ID** (numeric or string) that maps to `subscription_tiers` JSON in `server.js`.
- `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`: Stripe linkage.
- `subscription_end_date`: For display only.

### 1.2 Token-Balance Fields (Authoritative)

- `tokens_monthly`
  - **Meaning**: Current monthly allowance balance.
  - Source of truth for the remaining tokens from the subscription tier.
  - Increased via Stripe webhooks (new subscription and renewals) based on tier.
  - Decreased as tokens are used.
  - On renewal, it is updated using: `tokens_monthly = max(tokens_monthly, tierLimit)`.
    - Never reduced by renewal.

- `tokens_added`
  - **Meaning**: Long-lived, carry-over bucket for extra tokens (top‑ups, bonuses, manual grants).
  - Increased when the user buys more tokens or receives a bonus.
  - Never reset by month; only decreased when monthly allowance is exhausted.

- `tokens_used`
  - **Meaning**: Tokens used **in the current billing period (this month)**.
  - Incremented by every AI request.
  - Reset to `0` when Stripe signals a successful renewal (via webhook).

- `tokens_used_all_time`
  - **Meaning**: Lifetime total tokens used.
  - Incremented by every AI request.
  - Never reset.

### 1.3 Deprecated/Unused Fields

These columns remain in the DB for now but **must not be referenced** by new code:

- `token_limit` (no longer used; tier JSON defines limits).
- `reset_date` (legacy; unused).
- `billing_cycle_day` (to be removed from DB; **must not** appear in code).

---

## 2. Subscription Tiers and Limits

Subscription tiers are defined in `server.js` as `subscription_tiers` JSON (already present). Each tier supplies at least:

- `tier_id`: Stable ID stored in the user `tier_id` field.
- `token_limit`: Monthly allowance for that tier (e.g., 10,000, 5,000, etc.).

We **do not** store `token_limit` on the user row anymore; we always look up the tier in `subscription_tiers`.

---

## 3. Stripe Webhook Behavior (Monthly Logic)

All logic below refers to the **user row** with the relevant `auth_id` (or `anon_id` when applicable) and their `tier_id`.

Let:

- `tierLimit` = monthly token allowance for the user's current tier, from `subscription_tiers[tier_id].token_limit`.
- `currentMonthly` = `tokens_monthly`.

### 3.1 New Subscription (user starts a plan)

On webhook for **subscription created**:

- Set:
  - `tokens_monthly = max(currentMonthly, tierLimit)`.
    - In practice, `currentMonthly` is usually `0`, so they effectively get `tierLimit`.
  - `tokens_used = 0` (new billing period).
  - `tokens_used_all_time` unchanged.
  - `tokens_added` unchanged.

Rationale: if a user somehow had a higher `tokens_monthly` already (edge case), we do **not** lower it.

### 3.2 Renewal (same or changed tier)

On webhook for **subscription renewal** (including upgrades/downgrades):

- Compute `tierLimit` for the **current** `tier_id`.
- Update:
  - `tokens_monthly = max(tokens_monthly, tierLimit)`.
    - If they have less than the tier limit, they are topped up to the tier limit.
    - If they have more (carry-over edge case), keep the higher value.
  - `tokens_used = 0` (month usage resets).
  - `tokens_used_all_time` unchanged.
  - `tokens_added` unchanged.

#### Example: Downgrade Edge Case

- Start with tier 10k:
  - `tokens_monthly = 0`.
  - Subscribe: `tokens_monthly = max(0, 10k) = 10k`.
  - Use all 10k: `tokens_monthly = 0`.
  - Renew at 10k: `tokens_monthly = max(0, 10k) = 10k`.
- Change tier to 5k before next billing:
  - At billing time, if `tokens_monthly = 10k`:
    - `tokens_monthly = max(10k, 5k) = 10k` (they keep 10k).
  - Use 8k: `tokens_monthly = 2k`.
  - Next billing at 5k tier:
    - `tokens_monthly = max(2k, 5k) = 5k`.

### 3.3 One-Time Purchases / Bonuses

- Any non-recurring purchases or bonuses:
  - Directly **increase** `tokens_added`.
  - Do **not** touch `tokens_monthly`.

Later we may add a separate `token_logs` table to audit these events, but that is **not required now**.

---

## 4. Per-Request Token Usage Algorithm

This logic runs on each AI API call (e.g. DeepSeek endpoint) after token cost `N` is computed.

Let:

- `monthly = max(tokens_monthly, 0)`
- `added = max(tokens_added, 0)`
- `N` = tokens required for this request.
- `totalAvailable = monthly + added`

### 4.1 Eligibility Check

- If `totalAvailable <= 0`:
  - **Block the request**.
  - Return the appropriate "out of tokens" message (different for anon vs auth). Existing messaging logic in `server.js` still applies.
- If `totalAvailable > 0`:
  - **Allow the request**, even if `N` is much larger than `totalAvailable` (e.g. 1 token left and request uses 100k).

### 4.2 Deduction Order

When the request is allowed:

1. **Use monthly allowance first**:

   ```text
   useFromMonthly = min(N, monthly)
   remaining = N - useFromMonthly
   tokens_monthly = monthly - useFromMonthly
   ```

2. **Then use from added**:

   ```text
   useFromAdded = min(remaining, added)
   tokens_added = added - useFromAdded
   ```

3. **No negative balances**:

   - We never set `tokens_monthly` or `tokens_added` below 0.
   - In the extreme case where `N > monthly + added`, we simply bring both to 0.

4. **Usage counters**:

   - `tokens_used += N`
   - `tokens_used_all_time += N`

These counters are conceptual usage metrics and may exceed the exact number of tokens actually removed from the buckets when `N` is larger than `totalAvailable`, but that is acceptable and keeps accounting simple.

#### Additional Worked Examples (X monthly, Y added)

Assume the user starts with:

- `tokens_monthly = X`
- `tokens_added = Y`

##### Example A: Request within monthly allowance only

- Start:
  - `tokens_monthly = 10,000`
  - `tokens_added = 5,000`
  - Request cost: `N = 4,000` (less than monthly)

- Step 1: monthly
  - `useFromMonthly = min(4,000, 10,000) = 4,000`
  - `remaining = 4,000 - 4,000 = 0`
  - `tokens_monthly = 10,000 - 4,000 = 6,000`

- Step 2: added
  - `remaining = 0`, so `useFromAdded = 0`, `tokens_added = 5,000`

- Counters
  - `tokens_used += 4,000`
  - `tokens_used_all_time += 4,000`

Result:

- `tokens_monthly = 6,000`
- `tokens_added = 5,000`

##### Example B: Request more than monthly, less than monthly + added

- Start:
  - `tokens_monthly = 5,000`
  - `tokens_added = 5,000`
  - Request cost: `N = 8,000` (more than monthly, less than total 10,000)

- Step 1: monthly
  - `useFromMonthly = min(8,000, 5,000) = 5,000`
  - `remaining = 8,000 - 5,000 = 3,000`
  - `tokens_monthly = 0`

- Step 2: added
  - `useFromAdded = min(3,000, 5,000) = 3,000`
  - `tokens_added = 5,000 - 3,000 = 2,000`

- Counters
  - `tokens_used += 8,000`
  - `tokens_used_all_time += 8,000`

Result:

- `tokens_monthly = 0`
- `tokens_added = 2,000`

##### Example C: Request more than monthly + added

- Start:
  - `tokens_monthly = 10,000`
  - `tokens_added = 5,000`
  - Request cost: `N = 20,000` (more than total 15,000)

- Step 1: monthly
  - `useFromMonthly = min(20,000, 10,000) = 10,000`
  - `remaining = 20,000 - 10,000 = 10,000`
  - `tokens_monthly = 0`

- Step 2: added
  - `useFromAdded = min(10,000, 5,000) = 5,000`
  - `tokens_added = 5,000 - 5,000 = 0`

- Counters
  - `tokens_used += 20,000`
  - `tokens_used_all_time += 20,000`

Result:

- `tokens_monthly = 0`
- `tokens_added = 0`

The request still succeeds because there was at least 1 token available at the start, but both buckets are fully depleted by the end.

#### Example: Partial Coverage (rollover into added)

- Start:
  - `tokens_monthly = 5,000`
  - `tokens_added = 5,000`
  - Request cost: `N = 8,000`

- Step 1: monthly
  - `useFromMonthly = min(8,000, 5,000) = 5,000`
  - `remaining = 8,000 - 5,000 = 3,000`
  - `tokens_monthly = 0`

- Step 2: added
  - `useFromAdded = min(3,000, 5,000) = 3,000`
  - `tokens_added = 5,000 - 3,000 = 2,000`

- Counters
  - `tokens_used += 8,000`
  - `tokens_used_all_time += 8,000`

Result:

- `tokens_monthly = 0`
- `tokens_added = 2,000`
- Total spend = 8,000, using buckets in the correct order.

#### Example: One Token Left, Huge Request

- Start:
  - `tokens_monthly = 1`
  - `tokens_added = 0`
  - `N = 100,000`

- `totalAvailable = 1` → request is **allowed**.

- Step 1: monthly
  - `useFromMonthly = min(100,000, 1) = 1`
  - `remaining = 99,999`
  - `tokens_monthly = 0`

- Step 2: added
  - `added = 0`, so `useFromAdded = 0`, `tokens_added = 0`

- Counters
  - `tokens_used += 100,000`
  - `tokens_used_all_time += 100,000`

Result:

- Balances are both `0`, but the large request still went through because there was **at least 1 token** before we started.

---

## 5. Monthly Reset and Billing

On each successful billing cycle (Stripe renewal webhook):

- `tokens_used = 0` (reset monthly usage).
- `tokens_monthly = max(tokens_monthly, tierLimit)` (never reduce, only top-up).
- `tokens_added` unchanged.
- `tokens_used_all_time` unchanged.

Edge cases:

- **User has very high `tokens_monthly` from a prior tier**:
  - If they downgrade, we do not cut their current monthly balance; it remains above current tier limit until they spend it.
- **User cancels subscription**:
  - Future behavior can be:
    - Keep remaining `tokens_monthly` until they are spent, then only use `tokens_added`.
    - Or immediately zero `tokens_monthly` on cancel.
  - Exact cancel behavior should be defined when implementing cancel webhooks.

---

## 6. Out-of-Tokens Messaging

Existing messaging logic in `server.js` remains valid:

- If `totalAvailable <= 0` before a request:
  - Short-circuit the request and return the existing friendly message based on:
    - Anon vs auth user.
    - Context (e.g., suggest creating account or managing subscription).

Only the internal **balance calculation and update** changes; the messaging entry points do not need conceptual changes.

---

## 7. Developer Test Endpoints (Web Portal)

We will add a **Developer** tab in the web portal top navigation. For now, it is always visible (we may later restrict it to specific users/roles).

### 7.1 Developer Tab/Page

- New top-level nav item: e.g. `Developer`.
- New page with a set of buttons that simulate Stripe webhook scenarios for the **currently signed-in user**.
- Examples of buttons:
  - "Simulate subscription created"
  - "Simulate subscription renewed"
  - "Simulate subscription upgraded/downgraded"
  - "Simulate subscription canceled"

### 7.2 Dev-Only HTTP Endpoints

For each scenario, we will create dev-only endpoints, for example:

- `POST /api/dev/stripe/simulate-subscription-created`
- `POST /api/dev/stripe/simulate-subscription-renewed`
- `POST /api/dev/stripe/simulate-subscription-canceled`

Properties:

- They **bypass Stripe signature validation** and any strict webhook validations.
- Each endpoint will **directly call the same internal business-logic functions** used by real Stripe webhook routes.
  - Webhook logic should be factored into reusable functions (e.g., `applySubscriptionCreated`, `applySubscriptionRenewed`) that accept a user/context and perform token updates.
  - Real Stripe webhook handlers and `/api/dev/stripe/*` endpoints both call these functions.
- The web portal will call these dev endpoints on behalf of the signed-in user to:
  - Adjust `tokens_monthly`, `tokens_used`, `tokens_added` according to the logic in sections above.
  - Allow rapid testing of all token scenarios without needing live Stripe events.

Later we can:

- Gate this tab and endpoints behind `developerMode` or a specific user role/flag.
- Add a `token_logs` table to persist a full audit of all token changes.

---

## 8. Implementation Notes / Migration Checklist

When implementing this design:

1. **Server (`server.js`)**
   - Remove all usages of `token_limit`, `reset_date`, and `billing_cycle_day` fields from queries and updates.
   - Rename the user `subscription_type` column to `tier_id` in the database and update all code references accordingly (no remaining uses of `subscription_type`).
   - Refactor token accounting to use `tokens_monthly`, `tokens_added`, `tokens_used`, `tokens_used_all_time` per this spec.
   - Factor Stripe webhook token logic into reusable functions that can be called from both real webhook routes and `/api/dev/stripe/*` endpoints.
   - Ensure `/api/user/tokens/` returns the correct fields for the new model.

2. **Desktop & Web Clients**
   - Update token displays (e.g., Settings, AISidebar, web dashboard) to:
     - Use the new semantics of `tokens_monthly` and `tokens_added`.
     - Keep labels accurate (e.g., `Tokens Added` for `tokens_added`).
   - Continue to use `normalizeUserTokenData` (or equivalent) to map backend fields to UI.

3. **Developer Tab**
   - Add the Developer page and buttons in the web portal.
   - Create dev-only endpoints that reuse webhook handlers.

4. **Future Work (not part of this immediate change)**
   - Add a `token_logs` table with entries for:
     - Subscription events (new, renewals, upgrades/downgrades, cancels).
     - One-time purchases/bonuses.
     - Per-request deductions.
   - Lock down developer endpoints and UI to specific users/environments.

## 9. Test Cases and Scenarios

This section defines scenarios for validating the new token tracking system. Each scenario includes:

- **ID** – stable identifier.
- **Preconditions** – starting DB state and user state.
- **User actions** – what the user does across desktop app, web portal, and API.
- **Expected backend state** – how token fields should change.
- **Expected UI / display** – how tokens should appear in all user-facing surfaces.

### 9.1 General User Flows

#### GF-1: Anonymous desktop user – first launch and free tokens

- **Preconditions**
  - No `users` row yet for this device's `anon_id`.
  - Desktop app starts in anonymous mode (no `auth_id`).
- **User actions**
  1. Launch desktop app and open AI sidebar.
  2. Trigger first AI request.
- **Expected backend state**
  - `getOrCreateUser` creates a user row with:
    - `tokens_monthly = 0`.
    - `tokens_added = NEW_ANON_TOKENS`.
    - `tokens_used = 0`.
    - `tokens_used_all_time = 0`.
    - `tier_id = null` (no subscription).
  - After the first successful AI request costing `N` tokens:
    - `tokens_monthly` remains `0`.
    - `tokens_added` decreases by `min(N, NEW_ANON_TOKENS)`.
    - `tokens_used += N`.
    - `tokens_used_all_time += N`.
- **Expected UI / display**
  - **Desktop AISidebar**
    - "Available tokens" shows `tokens_added` (since `tokens_monthly = 0`).
  - **Desktop Settings → Account tab → Token Usage**
    - "Tokens Remaining This Month" matches `availableTokens = tokens_monthly + tokens_added`.
    - "Monthly Balance" shows `0`.
    - "Tokens Added" shows remaining bonus.
  - **Web Portal Account page** (if user later logs in with same auth)
    - After linking account, `/api/user/tokens/` shows same balances when queried with `authId`.

#### GF-2: Anonymous user creates auth account (desktop) – bonus tokens preserved

- **Preconditions**
  - Existing anon user row with some `tokens_added` remaining and no `auth_id`.
- **User actions**
  1. In desktop Settings → Account, create an account (email/password).
  2. Desktop calls `/api/users/create-account`.
- **Expected backend state**
  - Existing anon user row is updated with `auth_id` and bonus `tokens_added` preserved.
  - No change to `tokens_monthly`.
- **Expected UI / display**
  - **Desktop Settings / AISidebar**
    - Available tokens remain the same across the transition from anon to auth.
    - No sudden gain/loss of tokens.

#### GF-3: Auth user purchases subscription (web) – initial monthly allowance

- **Preconditions**
  - User has `auth_id` and possibly some `tokens_added` from bonuses.
  - `tier_id = null` and `tokens_monthly = 0`.
- **User actions**
  1. Sign in to web portal `/account`.
  2. Choose a plan and click "Subscribe" (Stripe Payment Link).
  3. Complete checkout; Stripe webhook `customer.subscription.created` fires.
- **Expected backend state**
  - `handleSubscriptionUpdate` (new subscription case):
    - `tier_id` set to the plan's `tier_id`.
    - Look up tier in `subscription_tiers` to get `tierLimit`.
    - `tokens_monthly = max(currentTokensMonthly, tierLimit)` (typically `tierLimit`).
    - `tokens_used = 0`.
    - `tokens_added` unchanged.
- **Expected UI / display**
  - **Web Portal Account → Account details**
    - "Current Plan" shows the correct tier name and `subscription_status` = `active`.
  - **Web Portal Account → Usage stats**
    - "Available Tokens" ≈ `tokens_monthly + tokens_added`.
    - "Monthly Balance" ≈ `tokens_monthly`.
  - **Desktop AISidebar / Settings** (after a token refresh or restart)
    - Same balances shown as on the web.

#### GF-4: Auth user uses AI within monthly allowance

- **Preconditions**
  - `tier_id` set.
  - `tokens_monthly = tierLimit`.
  - `tokens_added` may be `0`.
- **User actions**
  1. Make several AI requests from desktop app.
- **Expected backend state**
  - For each request costing `N_i`:
    - `tokens_monthly` decreases by `min(N_i, current tokens_monthly)`.
    - `tokens_added` unchanged if `tokens_monthly` was sufficient.
    - `tokens_used += N_i`.
    - `tokens_used_all_time += N_i`.
- **Expected UI / display**
  - **Desktop AISidebar**
    - Available tokens decreases smoothly as `tokens_monthly` is spent.
  - **Desktop Settings / Web Account Usage stats**
    - "Tokens Used This Month" matches the sum of all `N_i`.
    - "Tokens Used All Time" increases monotonically.

#### GF-5: Auth user exhausts monthly and rolls into added tokens

- **Preconditions**
  - `tokens_monthly = M > 0`.
  - `tokens_added = A > 0`.
- **User actions**
  1. Make a request with cost `N` such that `N > M` and `N ≤ M + A`.
- **Expected backend state**
  - `tokens_monthly` goes to `0`.
  - `tokens_added` decreases by `N - M`.
  - `tokens_used += N`, `tokens_used_all_time += N`.
- **Expected UI / display**
  - Available tokens reflects `tokens_added` only until renewal.
  - "Monthly Balance" shows `0` while "Tokens Added" shows remaining.

#### GF-6: One-time token purchase (web) – tokens_added increase

- **Preconditions**
  - User has an active subscription or is at least `auth_id`-linked.
- **User actions**
  1. From web `/account`, choose a one-time pack size.
  2. Complete checkout (future Stripe events) or call `/api/user/add-tokens` (legacy/dev).
- **Expected backend state**
  - `tokens_added` increases by the configured pack amount.
  - `tokens_monthly` unchanged.
- **Expected UI / display**
  - **Web Account / Desktop Settings / AISidebar**
    - Available tokens increases by the purchased amount.
    - "Tokens Added" reflects the new total.

#### GF-7: Monthly renewal – same tier

- **Preconditions**
  - Active subscription with `tier_id` and `tierLimit`.
  - End of billing period; some `tokens_monthly` and `tokens_added` remaining.
- **User actions**
  1. Subscription renews; Stripe sends `invoice.payment_succeeded` / renewal webhook.
- **Expected backend state**
  - `handleSubscriptionRenewal`:
    - `tokens_used = 0`.
    - `tokens_monthly = max(previous tokens_monthly, tierLimit)`.
    - `tokens_added` unchanged.
- **Expected UI / display**
  - "Tokens Used This Month" resets to `0`.
  - "Available Tokens" and "Monthly Balance" reflect `max(previous balance, tierLimit)`.

#### GF-8: Downgrade effective on renewal

- **Preconditions**
  - User upgrades to a higher tier for a period, accumulates a large `tokens_monthly`.
  - Tier is changed in Stripe to a lower plan for the next billing cycle.
- **User actions**
  1. At renewal, Stripe sends renewal webhook with the new lower tier.
- **Expected backend state**
  - `tier_id` updated to new lower tier.
  - `tokens_monthly = max(current tokens_monthly, new tierLimit)`.
  - If `current tokens_monthly` < `new tierLimit`, top up to `new tierLimit`.
- **Expected UI / display**
  - No sudden loss of `tokens_monthly` at downgrade time; effect shows after user spends down and then hits lower tier renewals.

#### GF-9: User cancels subscription

- **Preconditions**
  - Active subscription with some `tokens_monthly` and/or `tokens_added`.
- **User actions**
  1. User cancels via Stripe Customer Portal.
  2. Stripe sends `customer.subscription.deleted` webhook.
- **Expected backend state (current implementation)**
  - `handleSubscriptionCancellation`:
    - `tier_id = null`.
    - `subscription_status = 'canceled'`.
    - `tokens_monthly = 0`.
    - `tokens_added` preserved.
- **Expected UI / display**
  - "Current Plan" shows no active subscription.
  - "Monthly Balance" = `0`.
  - "Available Tokens" reflects only `tokens_added`.

#### GF-10: Out-of-tokens request is blocked

- **Preconditions**
  - `tokens_monthly = 0`, `tokens_added = 0`.
- **User actions**
  1. User attempts an AI request from desktop app.
- **Expected backend state**
  - `updateUserTokens` sees `totalAvailable = 0` and returns an error.
  - No changes to token fields.
- **Expected UI / display**
  - AI request fails with the appropriate "out of tokens" message.
  - "Available Tokens" shows `0` everywhere.

### 9.2 Edge Cases

#### EC-1: Very large single request with small remaining balance

- **Preconditions**
  - `tokens_monthly = 1`, `tokens_added = 0`.
- **User actions**
  1. Make a request costing `N = 100,000` tokens.
- **Expected behavior**
  - Request is allowed (since `totalAvailable = 1 > 0`).
  - `tokens_monthly` and `tokens_added` both become `0`.
  - `tokens_used` / `tokens_used_all_time` increase by `100,000`.
  - Next request is blocked.

#### EC-2: Negative or null fields from DB

- **Preconditions**
  - DB returns `null` or negative values for any token field (e.g., due to manual edits).
- **Expected behavior**
  - Server coercion and `max(…, 0)` ensure we never treat negative balances as available tokens.
  - UI should never show negative values; at worst it shows `0` or `n/a`.

#### EC-3: User with very high tokens_monthly downgrades multiple times

- **Preconditions**
  - User once had a very high tier, leaving `tokens_monthly` far above any current tier.
- **Expected behavior**
  - Renewals never reduce `tokens_monthly` (always `max(tokens_monthly, tierLimit)`).
  - User keeps the higher balance until they spend it.

#### EC-4: Subscription canceled and later re-subscribed

- **Preconditions**
  - Subscription canceled, `tokens_monthly = 0`, `tokens_added` may be > 0`.
- **User actions**
  1. Later, user purchases a new subscription (possibly a different tier).
- **Expected behavior**
  - New subscription behaves like GF-3 (new subscription), topping up `tokens_monthly` via `max(current, tierLimit)`.
  - `tokens_added` from pre-cancel time is still available.

#### EC-5: Manual Stripe Sync from web portal

- **Preconditions**
  - User clicks "Sync Stripe" on web Account page.
- **Expected behavior**
  - `/api/stripe/sync` updates tier and subscription metadata without incorrectly refilling `tokens_monthly` beyond what webhooks would have done.
  - After sync, web Account and desktop both show consistent balances.

#### EC-6: Developer simulation endpoints

- **Preconditions**
  - Signed-in user navigates to `/dev` in web portal.
- **User actions**
  1. Click simulated "subscription created", "renewed", "canceled" buttons.
  2. Optionally set custom `tokens_monthly`, `tokens_added`, `tokens_used`.
- **Expected behavior**
  - Dev endpoints call the same business logic as real webhooks, updating token fields as described in Sections 3–5.
  - Developer page shows updated user JSON reflecting token fields.

#### EC-7: Multiple rows for same anon_id/auth_id

- **Preconditions**
  - Historical data may contain multiple user rows for the same `anon_id` or `auth_id`.
- **Expected behavior**
  - Queries that use `.single()` must be safe; any endpoints using `.eq` without `.single()` should gracefully pick a consistent row (typically the first) and not crash.

#### EC-8: UI fallback when new fields are missing

- **Preconditions**
  - Older rows missing `tokens_monthly` or `tokens_added` (null in DB).
- **Expected behavior**
  - Normalization functions default missing values to `0`.
  - Displays show `0` / `n/a` but never error.

#### EC-9: Web and desktop out-of-sync caches

- **Preconditions**
  - User uses AI, then quickly opens Account pages without a full refresh.
- **Expected behavior**
  - Manual refresh buttons (e.g., web Account refresh icon, desktop refresh) call `/api/user/tokens/` to resync from backend.
  - Within one refresh, both UIs show the same balances.

#### EC-10: High-concurrency token use (rare)

- **Preconditions**
  - User somehow makes overlapping AI requests (e.g., via multiple desktop instances).
- **Expected behavior**
  - Supabase updates should be atomic enough that token fields remain consistent.
  - In worst case, some small over-consumption is acceptable, but balances should never go negative.
