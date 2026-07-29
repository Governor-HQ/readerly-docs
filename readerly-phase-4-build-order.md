# Readerly v2 — Phase 4 Build Order

**Goal:** Working subscriptions. A user can pay by bank transfer (reviewed and approved by you) or by Paystack (card, once real keys exist), and either path activates the exact same subscription. You can toggle each payment method on or off from the admin panel, at any time, without a redeploy.

**Scope discipline:** No reader yet — Phase 5 is what an active subscription actually unlocks. This phase is entirely "can a person become a paying subscriber."

**Prerequisite:** Phase 3 complete, reviewed, pushed.

**Honesty flag for this phase specifically:** `PAYSTACK_SECRET_KEY` and `PAYSTACK_PLAN_CODE` don't have real values yet — that's deliberately deferred to Phase 8, alongside rotating every secret exposed during development. Every Paystack code path will be written correctly against Paystack's documented API and tested everywhere it's possible to test *without* a live account (missing-key handling, signature-verification logic). But the actual "redirect to Paystack, pay with a card, webhook arrives" round trip cannot be proven today. The end-of-phase report must clearly separate what was verified from what's written-but-unproven — no blurring the two.

---

## Part A — Your manual tasks

**A1. Create the `payment-proofs` storage bucket.** Same pattern as `book-files` in Phase 2: Supabase → Storage → New bucket → name `payment-proofs` → **private**. Set a reasonable file-size limit (5MB is plenty for a screenshot).

**A2. Decide your manual payment bank details** — account name, account number, bank name — but don't send them to me or type them anywhere but the admin panel once it exists.

---

## Design decisions (already made — do not deviate)

- **New table: `settings`** — simple key/value, no schema migration needed to add a new toggle later. Seeded with `paystack_enabled = 'false'` and `manual_payment_enabled = 'false'` — both off by default. Nothing is customer-facing until you deliberately switch it on with real bank details filled in.
- **New table: `manual_payments`** — one row per user's bank-transfer submission: a link to their uploaded proof, the claimed amount, and a status (`pending_review` / `approved` / `rejected`). This is structurally the same shape as the seller-book approval workflow from the original spec — submit, sit pending, admin decides. Same pattern, different content.
- **One shared `activateSubscription(userId)` function**, in `lib/subscriptions.js`, called by both the Paystack webhook and the manual-approval endpoint. It upserts the user's `subscriptions` row, sets `status = 'active'`, and computes the new `current_period_end`.
- **Early renewal extends from the existing end date, not from "now."** If someone pays a week before their current period lapses, the new month is added on top of what's left — `new_end = GREATEST(current_period_end, NOW()) + 1 month`. Nobody loses paid-for time by renewing early.
- **Cancelling doesn't cut access off immediately.** They paid for the period, they keep it until it actually ends. Cancelling sets `cancelled_at`, and for Paystack also calls Paystack's own cancel endpoint to stop future auto-billing — but `current_period_end` is what actually gates access, checked lazily on read (see below), not flipped the moment someone clicks cancel.
- **Lazy expiry, same pattern as Alibaba's booking expiry — no cron job.** Whenever a subscription's status is read (`GET /api/subscription`, or the access-check helper used elsewhere), if `current_period_end` has already passed and status still says `active`, flip it to `inactive` as a side effect of that read, then return the current truth. No background worker needed, ever.
- **Manual approval also writes a row into the existing `payments` table**, using a reference like `MANUAL-{manual_payments.id}`, so you get one unified financial ledger across both payment methods — while `manual_payments` keeps the review-specific fields (the proof, the admin note) that don't belong in the general ledger table.
- **`GET /api/settings/public` never reveals bank details unless manual payment is actually turned on.** No reason to expose them if the method isn't active.
- **Paystack's webhook signature must be verified against its real, current documented mechanism** — the header name and hashing algorithm. Don't build this from memory; check Paystack's current docs before writing it, and tell me exactly what was used and where it was confirmed. Getting this wrong doesn't just fail loudly, it fails as *silent, fake security* — a verification step that never actually verifies anything.
- **No new Paystack env vars are needed.** `PAYSTACK_SECRET_KEY` and `PAYSTACK_PLAN_CODE` were already placeholders in `.env.example` since Phase 0. Confirm this is still accurate against Paystack's current API rather than assuming.
- **`account.html` was listed in the original spec back in section 6 as a Phase 1 page, but Phase 1's actual build order never built it — a gap in the original planning.** Phase 4 builds it now, since "see your subscription, cancel it" needs a home.
- **Every future Claude Code prompt, starting with this one, ends by reconciling sections 6 and 7 of `readerly-v2-product-definition.md` against what was actually built that phase.** The document has drifted from reality twice already (the `admin.html` role, the missing `account.html`) — this closes that gap going forward instead of catching it after the fact each time.

---

## Database additions

A new file, `schema-phase4-additions.sql`, at the top level — safe to run once in Supabase SQL Editor:

```sql
-- Settings: simple key/value store so admin can toggle things without a redeploy.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO settings (key, value) VALUES
  ('paystack_enabled', 'false'),
  ('manual_payment_enabled', 'false'),
  ('manual_bank_name', ''),
  ('manual_account_number', ''),
  ('manual_account_name', ''),
  ('manual_instructions', '')
ON CONFLICT (key) DO NOTHING;

-- Manual payment submissions: a user's proof-of-transfer, pending admin review.
CREATE TABLE IF NOT EXISTS manual_payments (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  proof_url    TEXT NOT NULL,
  amount_kobo  INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending_review',
  admin_note   TEXT,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_manual_payments_status ON manual_payments(status);
CREATE INDEX IF NOT EXISTS idx_manual_payments_user ON manual_payments(user_id);
```

Also append these same two `CREATE TABLE` blocks to the bottom of the master `schema.sql`, so that file stays a complete picture of the whole database for anyone reading it fresh — even though the thing you actually *run* is the small additions file.

---

## The Claude Code prompt

---

Phase 4 of Readerly v2: subscriptions, with two toggleable payment methods. Re-read `readerly-v2-product-definition.md` section 5.5 (subscriptions table), section 8 (money), section 9, and section 11 before starting. Also look at `readerly-api/README.md`'s notes on the Alibaba Logistics lazy-expiry pattern if present, or ask Governor to describe it if not — this phase reuses that exact no-cron approach for subscription expiry.

Build only what is listed below. No reader, no library-gating by subscription status yet — that's Phase 5. If something is ambiguous, ask rather than deciding yourself.

**Housekeeping, every phase from now on:** at the end, compare sections 6 and 7 of `readerly-v2-product-definition.md` against what you actually built this phase, and correct any page or endpoint descriptions that no longer match reality — the same way `admin.html`'s row was fixed in Phase 2.

### Part 0 — Database

Create `schema-phase4-additions.sql` at the top level with the two `CREATE TABLE` blocks given above (settings + manual_payments, both idempotent with `IF NOT EXISTS`/`ON CONFLICT`). Append the same two blocks to the bottom of `schema.sql`. Tell me to run the additions file in Supabase before continuing to test anything that depends on these tables.

### Part 1 — `readerly-api`

**`lib/settings.js`**
- `getSetting(key)` — reads one value from `settings`.
- `getAllSettings()` — reads all rows into a plain object.
- `getPublicSettings()` — returns only `paystack_enabled` and `manual_payment_enabled`, plus the three `manual_*` bank fields **only if** `manual_payment_enabled === 'true'`.
- `setSettings(updates)` — admin-only caller's responsibility to gate; this just upserts a batch of key/value pairs in a transaction.

**`lib/subscriptions.js`**
- `activateSubscription(userId)` — the one shared activation function described above: upsert `subscriptions` for `userId`, `status = 'active'`, `current_period_start` and `current_period_end` computed per the early-renewal rule (extend from the later of "now" or the existing `current_period_end", by one month).
- `getSubscriptionStatus(userId)` — reads the row; if `current_period_end` has passed and `status` is still `'active'`, updates it to `'inactive'` as part of this same call (the lazy-expiry check), then returns the current, accurate state. Returns a clean "no subscription yet" shape if no row exists.
- `hasActiveAccess(userId)` — a small boolean helper wrapping `getSubscriptionStatus`, for Phase 5 to use later when gating the reader.

**Admin settings routes**
- `app/api/admin/settings/route.js` — `GET` (admin-only, all settings) and `PUT` (admin-only, body is a partial object of updates, calls `setSettings`).

**Admin manual-payments review routes**
- `app/api/admin/manual-payments/route.js` — `GET`, admin-only, optional `?status=` filter, joined with the user's name/email.
- `app/api/admin/manual-payments/[id]/proof-url/route.js` — `GET`, admin-only, mints a short-lived signed **read** URL (same Supabase signed-URL mechanism researched in Phase 2, this time for reading rather than uploading — confirm the correct method against the installed library rather than assuming) for that submission's proof image in the private `payment-proofs` bucket.
- `app/api/admin/manual-payments/[id]/approve/route.js` — `POST`, admin-only. Sets `status = 'approved'`, `reviewed_at = NOW()`, calls `activateSubscription(userId)`, and inserts a `payments` row (`reference = 'MANUAL-' + id`, `purpose = 'subscription'`, `status = 'success'`, `paid_at = NOW()`).
- `app/api/admin/manual-payments/[id]/reject/route.js` — `POST`, admin-only, body `{ note }`. Sets `status = 'rejected'`, stores `admin_note`, `reviewed_at = NOW()`.

**User-facing subscription routes**
- `app/api/settings/public/route.js` — `GET`, any logged-in user (`getUserFromRequest`), returns `getPublicSettings()`.
- `app/api/subscription/route.js` — `GET`, any logged-in user, returns their own `getSubscriptionStatus(user.id)`.
- `app/api/subscription/manual/upload-url/route.js` — `POST`, any logged-in user. Mints a signed upload URL for the private `payment-proofs` bucket, path `proofs/{userId}/{timestamp}.{ext}` (validate `ext` against an image allowlist same as covers in Phase 2). Reuse the exact signed-upload-URL pattern from `app/api/admin/upload-url/route.js` — this is the first time a non-admin user gets to mint an upload URL, so it needs its own route, but the underlying mechanism is identical.
- `app/api/subscription/manual/submit/route.js` — `POST`, any logged-in user, body `{ proofPath, amountKobo }`. Creates a `manual_payments` row, `status = 'pending_review'`.
- `app/api/subscription/initialize/route.js` — `POST`, any logged-in user. If `paystack_enabled` is false, return 400 with a clear message. Otherwise call Paystack's transaction-initialize endpoint (verify the exact current request shape against Paystack's docs — don't assume from memory) with `PAYSTACK_SECRET_KEY` and `PAYSTACK_PLAN_CODE`, passing the user's email and a generated reference, and return the `authorization_url` for the frontend to redirect to. If `PAYSTACK_SECRET_KEY` is missing, fail gracefully with a clear 500 server-log message, never a crash.
- `app/api/subscription/cancel/route.js` — `POST`, any logged-in user. Sets `cancelled_at = NOW()`. If the user has a `paystack_sub_code` and `paystack_email_token` on their subscription row, also call Paystack's subscription-disable endpoint (verify the exact required fields against current docs). Does not change `current_period_end` or immediately revoke access.
- `app/api/webhooks/paystack/route.js` — `POST`, **not user-authenticated** — Paystack calls this directly. Verify the request's signature header against a fresh HMAC computed with `PAYSTACK_SECRET_KEY` over the raw request body, using whatever algorithm and header name Paystack's current documentation specifies — confirm this precisely, it is the single most important line of code in this phase. Reject with 401 immediately if the signature doesn't match, before parsing or trusting anything else in the payload. On a verified `charge.success` event, call `activateSubscription` for the matching user (matched by email or your own reference scheme) and store `paystack_sub_code`/`paystack_email_token` if present in the payload. On `subscription.disable`, mark the subscription cancelled locally.

All routes: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, parameterized SQL, CORS + `OPTIONS` (except the webhook route, which Paystack calls directly and doesn't need CORS since it's not a browser request), no raw errors leaked.

### Part 2 — `readerly-frontend`

**`subscribe.html`** — locked. On load, fetches `GET /api/subscription` (if already active, show status and a cancel option instead of the subscribe flow) and `GET /api/settings/public` (determines which method(s) to show). If both are enabled, let the user pick; if only one, show only that one; if neither, show a clear "Subscriptions are temporarily unavailable" state rather than a broken or empty page.
- **Paystack path:** a "Subscribe with Paystack" button that calls `/api/subscription/initialize` and redirects the browser to the returned `authorization_url`.
- **Manual path:** clearly displayed bank details (from the public settings response), a file upload control for the payment screenshot (using the signed-upload-URL flow, same mechanic as the admin book uploads in Phase 2), an amount field, and a submit button that calls `/api/subscription/manual/submit`. After submitting, show "Your payment is under review — we'll activate your subscription within 24 hours" rather than redirecting away.

**`account.html`** — locked, newly built (filling the Phase 1 gap). Shows the user's name and email (read-only for now), and a subscription status section: active with the renewal/expiry date, not subscribed with a link to `subscribe.html`, pending manual review, or rejected with the admin's note and a way to try again. A cancel button when active, calling `/api/subscription/cancel`, with a clear "you'll keep access until {date}" message rather than implying instant loss of access.

**`admin-subscribers.html`** — admin-gated, newly built. Two sections on one page: a settings form (the two toggles, plus the three bank-detail fields, save button calling `PUT /api/admin/settings`) and the manual-payments review queue (pending submissions, each with a "View proof" link/button that fetches a signed read URL and opens it, plus Approve/Reject buttons; Reject prompts for an optional note).

**`home.html`** — one small edit: the "Account" card's badge changes from Coming Soon to a real link to `account.html`. Leave "My Library" and "My Reading" as Coming Soon — those depend on the reader, which is Phase 5.

Style everything with the existing tokens and component classes (`.card`, `.btn-primary`, `.alert-error`, `.alert-success`, form styles) — add only what's genuinely new, like a payment-method selector and a status badge for manual payment review states.

When finished, summarise what you built. Be explicit and honest about exactly which parts were verified today and which parts (specifically anything requiring a real Paystack transaction or a real webhook delivery) remain untested pending real credentials in Phase 8. List anything you were unsure about.

---

## Verification

**Fully verifiable today**

- [ ] `schema-phase4-additions.sql` runs cleanly; `settings` has 6 seeded rows, both toggles `false`
- [ ] `GET /api/settings/public` with both toggles off shows neither method as available, and never leaks bank details
- [ ] Turning `manual_payment_enabled` on via admin settings makes it appear on `subscribe.html`, bank details included
- [ ] Manual flow end to end: upload a real image as proof, submit, appears in the admin review queue as pending
- [ ] Admin can open the proof image via the signed read URL
- [ ] Approving calls `activateSubscription` — confirm in Supabase that `subscriptions.status` is now `active` with a sensible `current_period_end`, and a matching `MANUAL-` row appears in `payments`
- [ ] Rejecting stores the note, and it's visible on the user's `account.html`
- [ ] `account.html` correctly reflects each state: none, active, pending review, rejected
- [ ] Cancelling sets `cancelled_at` but access (per `GET /api/subscription`) continues until `current_period_end`
- [ ] Manually setting a test subscription's `current_period_end` to a past date in Supabase, then calling `GET /api/subscription`, flips it to `inactive` on that read — proving the lazy-expiry logic actually runs
- [ ] Renewing manual payment before an existing period lapses extends from the old end date, not from "now" — verify the math on a test row
- [ ] `POST /api/subscription/initialize` with `paystack_enabled` false → clean 400, not a crash
- [ ] `POST /api/subscription/initialize` with `paystack_enabled` true but no `PAYSTACK_SECRET_KEY` set → clean 500, logged server-side, nothing raw leaked
- [ ] The webhook route rejects a request with a deliberately wrong signature (construct one using a fake secret) — proves the check is real, not a no-op
- [ ] The webhook route accepts a request with a correctly computed signature (computable via pure crypto, no live Paystack call needed) — proves the verification logic is correct in both directions

**Not verifiable until Phase 8's real Paystack keys**

- [ ] A real `transaction/initialize` call actually returning a working `authorization_url`
- [ ] A real hosted checkout → real webhook delivery → real activation, end to end
- [ ] A real `subscription/disable` call actually cancelling a live Paystack subscription

---

## Bring back to me

1. `lib/settings.js` and `lib/subscriptions.js`
2. `app/api/webhooks/paystack/route.js` — this is the one I'll scrutinise hardest
3. `app/api/admin/manual-payments/[id]/approve/route.js`
4. Exactly which verification items passed and which are still pending real keys
5. Which method it used to confirm Paystack's webhook signature contract, and where
