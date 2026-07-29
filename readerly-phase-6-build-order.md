# Readerly v2 — Phase 6 Build Order

**Goal:** Close the last known security gap (rate limiting) and make the whole product feel finished — no flash-of-empty-content, no silent failures, nothing broken on a small screen.

**Scope discipline:** No new features, no Phase 7 (physical marketplace), no Phase 8 (secret rotation, real Paystack keys, the final full security re-audit). This phase touches only what already exists, plus the one deliberately-deferred build item — rate limiting — that was always meant to land before launch, not during the audit.

**Prerequisite:** Phase 5 complete, reviewed, pushed.

**No new pages this phase.** Every change here is either a new small piece of infrastructure (rate limiting) or an edit to something that already exists.

---

## Design decisions (already made — do not deviate)

- **Rate limiting is built on Postgres, not a new service.** A new `rate_limits` table simply records that an attempt happened, tagged by IP and/or email. This is the "shared store" that was missing since Phase 1 — every Vercel instance can now see the same counts, because they're all reading the same database, not separate in-memory counters.
- **Three endpoints get protected: `/api/auth/login`, `/api/auth/register`, `/api/admin/login`.** Nothing else this phase — this matches exactly what section 11 names, no broader scope.
- **Login and admin-login: 5 failed attempts within 15 minutes, checked both by IP and (for user login only) by the submitted email — either threshold being hit blocks the request.** Only *failed* attempts count. A legitimate user who mistypes their password twice and then succeeds shouldn't be penalized further — the check happens before the credential comparison (so an already-blocked request never even reaches bcrypt or the timing-safe comparison), and a row is only written *after* a genuine failure, not before.
- **Register: 5 attempts within 60 minutes, checked by IP only, counting every attempt regardless of outcome.** Registration doesn't have a meaningful "guessing" target the way login does — the abuse pattern here is volume itself (mass account creation), so every attempt counts, and a row is written before the request proceeds.
- **A blocked request returns 429 with a clear, honest message** — not a vague error, something like "Too many attempts. Please try again in a few minutes." The frontend on `login.html`, `register.html`, and `admin.html` needs to specifically handle a 429 and show that message rather than falling through to a generic error.
- **The requester's IP must be read from Vercel's forwarded-header convention** — confirm the correct current way to read it in a Next.js route (don't assume from memory), since Vercel sits in front of the app as a proxy.
- **Old `rate_limits` rows aren't actively cleaned up this phase.** At current traffic this table will grow slowly and isn't a real problem yet; a proper cleanup (or just periodically pruning rows older than a day) can be added later without urgency. Noting this honestly rather than pretending it's fully solved.
- **A consistent loading-state rule, everywhere:** every page that fetches data on load must default to a visible loading indicator, never to its own empty-state message, until the first fetch has actually resolved. Only after a fetch completes and genuinely confirms there's nothing there should an empty state ever be shown. Audit every page that fetches on load for this — `library.html`, `my-reading.html`, `book.html`, `reader.html`, `account.html`, `admin-books.html`, `admin-subscribers.html` — and fix any that currently risk a flash of the wrong state.
- **A consistent error-state rule:** any fetch that genuinely fails (network error, unexpected 500, anything `js/api.js`'s wrapper throws that isn't one of the specific expected cases like 401/403/404 already handled) should show a clear message using the existing `.alert-error` styling, with a "Try again" action where it's simple to wire one up, rather than leaving the page silently blank or stuck on a spinner forever.
- **Update section 11 of `readerly-v2-product-definition.md`** to mark "Rate limiting on auth endpoints" as done, referencing this phase — the checklist should reflect current reality, not linger as a permanent unknown.
- **Standing workflow from Phase 4 applies again**: run the new table's schema yourself via the existing DB connection, report the table list and row count before and after, never a destructive change without asking first.
- **Housekeeping, as every phase:** reconcile sections 6 and 7 against what's actually built — this phase shouldn't change either meaningfully since no pages or endpoints are added, but confirm rather than skip the check.

---

## Schema addition

```sql
CREATE TABLE IF NOT EXISTS rate_limits (
  id         SERIAL PRIMARY KEY,
  key        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_time ON rate_limits(key, created_at);
```

`key` will hold values like `login:email:someone@example.com`, `login:ip:1.2.3.4`, `register:ip:1.2.3.4`, `admin-login:ip:1.2.3.4` — one row per attempt, counted within a rolling window by querying `created_at`.

---

## The Claude Code prompt

---

Phase 6 of Readerly v2: rate limiting and launch polish. Re-read section 11 of `readerly-v2-product-definition.md` before starting.

Build only what is listed below. No new pages, no Phase 7, no Phase 8 work. If something is ambiguous, ask rather than deciding yourself.

**Schema first**, using the standing workflow: run the `rate_limits` table creation yourself via the existing DB connection (it's idempotent, safe to run), reporting the table list and row counts before and after.

**Housekeeping, as every phase:** at the end, reconcile sections 6 and 7 against reality (confirm nothing drifted, even though no new pages/endpoints are added this phase), and update section 11 to mark rate limiting as done, with a short note on where it's implemented.

### Part 1 — `readerly-api`

**`lib/rateLimit.js`**
- `recordAttempt(key)` — inserts one row with the given key.
- `countAttempts(key, windowMinutes)` — counts rows for that exact key within the last `windowMinutes`.
- `checkAndBlock(keys, { windowMinutes, maxAttempts })` — takes an array of keys (so a single call can check both an IP-based and an email-based key at once), returns `true` if **any** of them are at or over the threshold within the window.
- `getRequestIp(request)` — confirm and use the correct current method for reading the real client IP in a Next.js API route behind Vercel's proxy (research this against Next.js's current documentation rather than assuming from memory, and tell me what was used and where confirmed).

**`app/api/auth/login/route.js`** — edit the existing route.
- Before the existing timing-equalized credential check, call `checkAndBlock` with both `login:ip:{ip}` and `login:email:{normalizedEmail}` (5 attempts / 15 minutes). If blocked, return 429 `{ ok: false, error: "Too many attempts. Please try again in a few minutes." }` immediately — don't touch bcrypt or the dummy-hash comparison at all in this case.
- If the credential check fails (either branch — unknown email or wrong password), call `recordAttempt` for both `login:ip:{ip}` and `login:email:{normalizedEmail}` before returning the existing 401.
- On success, record nothing.

**`app/api/auth/register/route.js`** — edit the existing route.
- Before validation, call `checkAndBlock` with `register:ip:{ip}` (5 attempts / 60 minutes). If blocked, 429 with the same message.
- If not blocked, call `recordAttempt` for `register:ip:{ip}` immediately (regardless of what happens next in the request), then continue with the existing logic unchanged.

**`app/api/admin/login/route.js`** — edit the existing route.
- Same shape as user login but IP-only (no email concept here): check `admin-login:ip:{ip}` (5 attempts / 15 minutes) before the password comparison; record an attempt only on a failed password check, not on success.

All edits keep the existing CORS, error-shape, and timing-safe-comparison behavior already in these files exactly as it is — this phase only adds the rate-limit gate around what's already there.

### Part 2 — `readerly-frontend`

**Loading-state audit.** Go through `library.html`, `my-reading.html`, `book.html`, `reader.html`, `account.html`, `admin-books.html`, `admin-subscribers.html`. For each, confirm the page's default rendered state (before its first fetch resolves) is a loading indicator, not an empty-state message or a blank content area that could look broken. Add a shared `.loading-state` style to `css/main.css` (simple, centered, using existing tokens) if one doesn't already exist, and use it consistently. Fix any page where an empty-state message could currently flash before real data arrives.

**Error-state audit.** Same set of pages — confirm each one catches a genuine fetch failure (not just the specific expected error codes already handled) and shows a clear message via the existing `.alert-error` style, with a "Try again" button re-running the failed fetch where that's straightforward to add.

**429 handling on `login.html`, `register.html`, `admin.html`.** Each should specifically detect a 429 response and show "Too many attempts. Please try again in a few minutes." rather than a generic error.

**Mobile pass.** Walk every page at a small viewport width and check: touch targets are comfortably sized, no page has unintended horizontal scroll, the reader's navigation and zoom controls are reachable and usable on a small screen, and the two admin pages — while not primarily used on mobile — aren't visibly broken if opened there.

When finished, summarise what you built and fixed, confirm the IP-reading method and where it was verified, and list anything you were unsure about. Do not deploy.

---

## Verification

**Rate limiting**
- [ ] 5 wrong-password attempts against a real account, then a 6th (even with the correct password) → 429, not a login
- [ ] Waiting past the 15-minute window (or manually clearing test rows) allows login again
- [ ] A successful login after 2–3 failures still works and doesn't itself get blocked
- [ ] The same protection independently verified for `admin.html`
- [ ] Register blocked after 5 rapid attempts from the same session/IP within the hour
- [ ] 429 responses show the friendly message on all three pages, not a raw error
- [ ] `rate_limits` table genuinely has rows after test attempts — confirm in Supabase directly, don't just trust the API response

**Polish**
- [ ] Reloading `library.html` with network throttled (DevTools) shows a loading state first, never a flash of "no books"
- [ ] Same check on at least two other data-fetching pages
- [ ] Deliberately breaking a fetch (e.g. temporarily wrong API URL) shows a clear error state with a working "Try again," not a silently blank page
- [ ] Full mobile walkthrough at a small viewport — no horizontal scroll anywhere, reader controls usable, nothing visibly broken

---

## Bring back to me

1. `lib/rateLimit.js`
2. The edited `app/api/auth/login/route.js` and `app/api/admin/login/route.js`
3. Which method was used to read the client IP, and where confirmed
4. A list of exactly which pages got loading/error-state fixes and what was wrong before
