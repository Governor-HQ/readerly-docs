# Readerly v2 — Phase 1 Build Order

**Goal:** A working account system. Users can register, log in, stay logged in for 30 days, and log out. Public pages are reachable by anyone; locked pages redirect logged-out visitors to login.

**Scope discipline:** No books, no library, no subscriptions, no admin panel, no payments. If Claude Code starts building those, stop it.

**Prerequisite:** Phase 0 complete — both projects deployed, `/api/health` returning `ok: true` from Netlify.

---

## What gets built

**In `readerly-api`:** `lib/auth.js`, plus three endpoints — register, login, me.

**In `readerly-frontend`:** a real landing page, login and register pages, a shared auth script that guards locked pages, a basic logged-in home page, and expanded CSS with reusable components.

---

## Design decisions (already made — do not deviate)

- **JWT in `localStorage`**, sent as `Authorization: Bearer <token>`. Same as Alibaba. Not cookies — which is also why CORS doesn't need credentials.
- **Token lifetime: 30 days.**
- **Email is the unique identifier**, stored lowercase and trimmed so `Gov@x.com` and `gov@x.com` are the same account.
- **Login failures never reveal whether the email exists.** Always the same message: "Invalid email or password." Revealing it lets attackers enumerate your users.
- **Everyone registers as `role = 'user'`.** There is no way to become admin through the API. You promote yourself later with one SQL statement in Supabase.
- **Rate limiting is deliberately deferred to Phase 6.** In-memory limits are useless on serverless (each instance has its own memory), so it needs a proper shared store. Noted, not forgotten.

---

## The Claude Code prompt

Paste this as one message:

---

Phase 1 of Readerly v2: authentication and the login gate. `readerly-v2-product-definition.md` is the source of truth — re-read section 6 (pages), section 7 (auth endpoints), section 4 (design tokens), and section 11 (security checklist) before starting.

Build only what is listed below. No books, library, subscriptions, admin panel, or payments. If something is ambiguous, ask me instead of deciding for yourself.

### Part 1 — `readerly-api`

**`lib/auth.js`** — shared auth helpers:
- `hashPassword(plain)` and `verifyPassword(plain, hash)` using bcryptjs with a cost factor of 10.
- `signToken(payload)` — signs with `JWT_SECRET`, expires in 30 days. Throw if `JWT_SECRET` is missing; never use a fallback value.
- `verifyToken(token)` — returns the decoded payload, or `null` if invalid or expired. Never throw to the caller.
- `getUserFromRequest(request)` — reads the `Authorization` header, extracts a Bearer token, verifies it, then loads the user from the database by id and returns `{ id, name, email, role, phone, created_at }`. Returns `null` if the header is missing, the token is invalid, or the user no longer exists. **Never** select or return `password_hash`.
- `isValidEmail(str)` — a simple, sane regex check.

**`app/api/auth/register/route.js`** — `POST`
- Body: `{ name, email, password, phone? }`
- Validate: name non-empty after trimming; email present and valid; password at least 8 characters. On failure return 400 with a clear message naming the specific problem.
- Normalise email to lowercase and trimmed.
- Hash the password, insert the user with `role = 'user'`.
- If the email already exists (Postgres error code `23505`), return 409 with "An account with this email already exists."
- On success return 201 with `{ ok: true, token, user }` where `user` excludes `password_hash`.
- Export `OPTIONS` returning `preflight()`, and include `corsHeaders()` on every response.

**`app/api/auth/login/route.js`** — `POST`
- Body: `{ email, password }`
- Look up by normalised email, compare the password with bcrypt.
- If the user doesn't exist **or** the password is wrong, return 401 with exactly "Invalid email or password" in both cases — the responses must be indistinguishable.
- On success return 200 with `{ ok: true, token, user }`.
- CORS handled the same way.

**`app/api/auth/me/route.js`** — `GET`
- Uses `getUserFromRequest`. If it returns null, respond 401 `{ ok: false, error: "Not authenticated" }`.
- Otherwise 200 `{ ok: true, user }`.
- CORS handled the same way.

All three routes: `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`. All SQL parameterized through `lib/db.js`. Log real errors with `console.error`; never send raw database errors to the client.

### Part 2 — `readerly-frontend`

**`js/auth.js`** — shared, loaded by every page:
- `saveSession(token, user)` — stores both in `localStorage` under clear keys.
- `getToken()`, `getUser()`, `clearSession()`.
- `logout()` — clears the session and redirects to `index.html`.
- `requireAuth()` — for locked pages. If there's no token, redirect to `login.html` immediately. If there is one, call `GET /api/auth/me` to confirm it's still valid; if the API says no, clear the session and redirect. Only reveal the page once verification succeeds.
- `redirectIfAuthed()` — for login and register pages. If a valid session exists, send the user to `home.html` so logged-in users don't see login forms.
- Prevent the flash of protected content: locked pages should start hidden (e.g. `<body class="auth-pending">` with CSS hiding it) and only be revealed after `requireAuth()` resolves.

**`js/api.js`** — extend the existing wrapper only if needed so `apiPost` surfaces the server's error message rather than a generic one. Keep the existing Bearer-token behaviour.

**`css/main.css`** — extend with reusable components, still using the existing design tokens: `.btn-primary`, `.btn-secondary`, `.form-group`, `.input`, `.card`, `.alert-error`, `.alert-success`, a top navigation bar, and the `.auth-pending` rule. Mobile first, responsive. No new colours — use the tokens already defined.

**`index.html`** — the real landing page, replacing the Phase 0 test page. Public. Content: the Readerly wordmark, a headline and subheadline explaining Readerly (a curated Nigerian reading platform — unlimited access to a growing digital library for ₦2,000/month, with a physical bookstore coming later), three short benefit points, and clear "Create account" and "Sign in" buttons. Editorial and calm, generous whitespace, matching the design tokens. If the visitor already has a valid session, show a "Go to your dashboard" link instead of the sign-in buttons.

**`login.html`** — public. Email and password fields, submit button, link to register. Calls `POST /api/auth/login`, saves the session, redirects to `home.html`. Shows inline errors. Disables the button while the request is in flight. Calls `redirectIfAuthed()` on load.

**`register.html`** — public. Name, email, password, optional phone. Client-side validation mirroring the server rules (password minimum 8 characters, valid email) with helpful inline messages — but understand the server is the real authority. Calls `POST /api/auth/register`, saves the session, redirects to `home.html`. Calls `redirectIfAuthed()` on load.

**`home.html`** — **locked**. Calls `requireAuth()` before rendering. Shows a top nav with the Readerly wordmark and a logout button, a greeting using the user's first name, and placeholder cards for the sections coming in later phases (My Library, Browse Books, My Reading, Account) marked "Coming soon". This is the logged-in dashboard from section 6 of the spec, deliberately minimal for now.

**Security requirement:** never insert user-supplied values into the DOM with `innerHTML`. Use `textContent` or escape properly. The user's own name is user-supplied and must be treated as untrusted.

When finished, summarise what you created and list anything you were unsure about. Do not deploy.

---

## Verification

Test locally first — serve the frontend and run the API — then after deploying.

**Registration**
- [ ] Valid details create an account and land on `home.html` with the correct name shown
- [ ] Registering the same email twice returns "An account with this email already exists"
- [ ] A 7-character password is rejected
- [ ] A malformed email is rejected
- [ ] In Supabase, the new row has a bcrypt hash in `password_hash` (starts with `$2`), never the plain password

**Login**
- [ ] Correct credentials succeed
- [ ] Wrong password and unknown email produce the identical message
- [ ] After login, `localStorage` holds a token

**The gate**
- [ ] Opening `home.html` while logged out redirects to `login.html`
- [ ] No flash of dashboard content before the redirect
- [ ] Deleting the token in DevTools and reloading `home.html` redirects
- [ ] Corrupting the token and reloading redirects (proves the server verifies, not just presence)
- [ ] Visiting `login.html` while logged in redirects to `home.html`
- [ ] Logout returns to the landing page and `home.html` is locked again

**Everything else**
- [ ] `index.html`, `login.html`, `register.html` all load fine logged out
- [ ] Mobile layout works
- [ ] No CORS errors in the console
- [ ] `password_hash` never appears in any API response

---

## After it works

Promote yourself to admin. In Supabase → SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

Nothing uses `role` yet, but Phase 2 builds the admin panel and it will.

---

## Bring back to me

1. `lib/auth.js` and all three route files
2. `js/auth.js`
3. The live Netlify URL so I can test the gate myself
4. Anything that behaved unexpectedly
