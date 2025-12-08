## User row / identity creation actions

- **Web anon initialize**  
  Browser has only an `anon_id` (no `auth_id`, no `device_id`) and calls `POST /api/user/initialize`. Creates a `users` row for web-only anonymous usage **with no free anon bonus** (no initial tokens granted).

- **Device anon initialize**  
  Desktop sends `anon_id` + `device_id` (no `auth_id`) to `POST /api/user/initialize`. Creates a `users` row tied to that device, used for anon desktop usage and device-based grants.

- **Web auth created via backend**  
  Web client calls `POST /api/users/create-account` with `anonId` (web anon), `email`, `password`, no `deviceId`. Creates a Supabase auth user and a `users` row for that auth (or reuses an unconfirmed row) without a device id.

- **Device auth created via backend**  
  Desktop calls `POST /api/users/create-account` with `anonId`, `email`, `password`, and `deviceId`. Creates a Supabase auth user and a `users` row for that auth/device (or reuses an unconfirmed row) used for device-based auth grants.

- **Auth created with no prior anon/device user**  
  First call to `/api/users/create-account` for a brand-new `anonId` (web or desktop) where no `users` row exists yet. A new `users` row is created from scratch and linked to the new Supabase auth user.

- **Typo email auth created (unconfirmed)**  
  `/api/users/create-account` is called with the wrong email; an unconfirmed `users` row is created. A later `/create-account` call with the corrected email for the same `anonId`/`deviceId` reuses that row and overwrites `email`/`auth_id` instead of creating a new row.

- **Login existing auth with anon (link)**  
  Desktop calls `POST /api/users/login` with `anonId`, `email`, `password`. Signs in the existing Supabase auth user and links an anon-only `users` row to `auth_id` (or creates a new row if none exists).

- **Supabase-only auth sign-up (web portal)**  
  Web portal calls `signUpWithEmail` (Supabase `auth.signUp`) to create a Supabase auth user. `AccountPage.handleAuthSubmit` then calls `POST /api/user/initialize` with the new auth user id so a `users` row is created and free tokens are granted for web-only signups.


## Action orders / scenarios to handle and test

- **1. Web anon → web auth create-account → email confirm → web auto-login**  
  Start as web anon, call `/api/users/create-account`, confirm email via `/api/email/confirm`, then hit the portal `Go to Account` button. Expect: one `users` row with anon + auth, bonus tokens granted once, auto-login session established in portal and stats loaded.

- **2. Device anon → device auth create-account → email confirm → desktop login**  
  Start as desktop anon, call `/api/users/create-account` with `deviceId`, confirm email, then log in from desktop using `/api/users/login`. Expect: one device-tied `users` row, auth bonus granted once, `/api/user/tokens` returns correct balances for desktop.

- **3. Device anon → typo email create-account → corrected email create-account (same device) → email confirm**  
  From one `deviceId`, create account with bad email, then call `/api/users/create-account` again with a corrected email. Expect: the same unconfirmed `users` row is reused (email/auth fields overwritten), and confirmation grants tokens to that single row.

- **4. Device anon → first auth grant → second auth create-account on same device**  
  Confirm one auth account for a device (recording a device/auth grant), then create a second auth account from the same device. Expect: confirmation of the second account does **not** grant another auth bonus (device already used for auth grant).

- **5. Web-only Supabase sign-up → backend initialize → email confirm → web login**  
  Use portal `signUpWithEmail` to create a Supabase auth user, let `handleAuthSubmit` call `/api/user/initialize`, then confirm email and log in on the web. Expect: a `users` row exists for the auth id before confirmation and receives auth bonus on confirm.

- **6. Existing web anon → later web auth create-account (reusing anon row)**  
  Use the app as web anon long enough to accumulate usage, then create an auth account via `/api/users/create-account` with the same `anonId`. Expect: the existing anon `users` row is linked to `auth_id` (no token loss or split pools).

- **7. Existing desktop anon → later device auth create-account (reusing anon row)**  
  Use desktop anon with a given `deviceId`, then create an auth account from that same device. Expect: primary anon row for that `anonId`/device is reused and linked to `auth_id`, preserving prior anon tokens.

- **8. Auth login from a different anon (linking vs new row)**  
  Sign in an existing auth user using `/api/users/login` with a new `anonId`. Expect: either the prior auth-linked row is reused (updating anon_id) or a clearly separated new row is created according to the current `getOrCreateUser` rules (no crashes, consistent linking).

- **9. Email confirmation re-click / expired / tampered token**  
  Confirm email once successfully, then re-use the same link (already confirmed), or use an expired/tampered token. Expect: already-confirmed path returns `alreadyConfirmed: true` with no token change; invalid tokens are rejected with no DB mutation.

- **10. Portal auto-login vs manual login for the same account**  
  After confirmation, test both manual login in the portal and auto-login via `/auto-login?email=...&password=...`. Expect: both paths create the same Supabase session, hit `/api/user/tokens` with the same `authId`, and show identical token/subscription stats.