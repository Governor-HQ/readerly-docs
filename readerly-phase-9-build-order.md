# Readerly v2 — Phase 9 Build Order

**Goal:** Fix the one real bug (cart), close the real business-model gap (sellers never see or agree to commission terms, admin has no first-party listing path, delivery fees aren't admin-editable), and address the batch of real-usage feedback in one consolidated pass. This is the last large numbered phase — after this, further fixes are backlog items, not more phases.

**Prerequisite:** Phase 8 complete (secrets rotated, Paystack proven live).

---

## Priority order — do these in this sequence, verify each before moving on

1. Cart bug (broken functionality, fix first, regardless of everything else)
2. Business model integrity (seller agreement, payout model, admin listings, delivery zones)
3. Visibility (admin history views, receipts)
4. UX consistency (back button, nav cleanup, copy-to-clipboard)
5. Content (landing page)

---

## 1. Cart bug

`js/cart.js`'s add/remove logic is broken — both actions currently just increment the count instead of adding a new item or actually removing one. Read the current implementation, find the actual defect (almost certainly the "add" and "remove" functions aren't correctly checking for an existing entry before mutating quantity, or one is calling the other's logic by mistake), fix it, and verify: adding a book already in the cart increases its quantity by exactly one; removing decreases it by exactly one and removes the line entirely at zero; the cart badge count always reflects the true total.

---

## 2. Business model integrity

### Schema additions

```sql
CREATE TABLE IF NOT EXISTS merchant_profiles (
  user_id                INTEGER PRIMARY KEY REFERENCES users(id),
  full_name              TEXT NOT NULL,
  bank_name               TEXT NOT NULL,
  account_number          TEXT NOT NULL,
  account_name            TEXT NOT NULL,
  agreed_commission_percent NUMERIC(5,2) NOT NULL,
  agreed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id           SERIAL PRIMARY KEY,
  seller_id    INTEGER NOT NULL REFERENCES users(id),
  amount_kobo  INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'rejected'
  admin_note   TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at      TIMESTAMPTZ
);
```

Run via the standing workflow — yourself, via the DB connection, before/after table state reported.

### Design decisions

- **`agreed_commission_percent` is a snapshot, taken at the moment a seller agrees, not a live reference to the current `settings.commission_percent`.** If you later change the platform-wide commission rate, existing sellers' historical agreement stays exactly what they actually signed up for — you can't retroactively change terms someone already agreed to just by editing a settings value.
- **A user cannot reach `sell.html` (or its API equivalent) without a `merchant_profiles` row existing first.** First attempt to list redirects to a new `become-a-seller.html` — a clear, honest page stating the current commission percentage, how payouts work (balance + withdrawal, not per-sale), and a form collecting full name, bank name, account number, account name, with an explicit "I agree" action before the row is created.
- **Payout balance is computed live, not stored as a running total** — `available_balance = SUM(order_items.payout_kobo for that seller, where the order is paid) − SUM(payout_requests.amount_kobo where status is 'pending' or 'paid')`. This avoids trying to reconcile which specific sale a given withdrawal "covers"; it's a real account-balance model, matching a normal marketplace payout experience.
- **A seller requests a withdrawal for any amount up to their current available balance** — the server rejects a request exceeding it. You then process it manually via your own bank, same as every other manual-payment step in this project, and mark it paid.
- **Admin-added physical books (`seller_id IS NULL`) skip commission and payout entirely.** `commission_kobo` and `payout_kobo` should simply be `0` for these — there's no seller to pay, so the full sale is your own revenue.
- **Admin gets a direct physical-listing path**, mirroring exactly how `admin-books.html` already lets you add digital books — fill the form, no approval step, immediately live.
- **Delivery zone fees become genuinely admin-editable** — a real form, not a database edit.

### API

- `POST /api/merchant/apply` — creates the `merchant_profiles` row, snapshotting the current commission rate.
- `GET /api/merchant/profile` — the caller's own profile, or a clean "not yet a merchant" shape.
- Extend `POST /api/books/submit` — 403 with a clear message if no `merchant_profiles` row exists for the caller yet.
- `GET /api/my/balance` — the caller's live-computed available balance.
- `POST /api/my/payout-requests` — creates a request, rejecting if the amount exceeds available balance.
- `GET /api/my/payout-requests` — the caller's own request history.
- `GET /api/admin/payout-requests`, `POST /api/admin/payout-requests/[id]/mark-paid`, `POST /api/admin/payout-requests/[id]/reject` — admin review.
- `POST /api/admin/books` (or extend the existing admin books-create route) to accept `format = 'PHYSICAL'` with `seller_id` left null, price/stock/condition included, immediately `approved`.
- `GET /api/delivery-zones` (existing) stays as-is for buyers. New: `PUT /api/admin/delivery-zones/[code]` — admin-only, updates `fee_kobo` and `label`.

### Frontend

- `become-a-seller.html` — the onboarding/agreement page described above.
- `sell.html` — if no merchant profile exists, redirect here first.
- `account.html` — add a section (for sellers) showing available balance, a "Request withdrawal" action, and their request history.
- `admin-market.html` — add a form for admin to directly create a physical listing, and a section for delivery zone editing (label + fee per zone).
- New admin page or a section within an existing one for reviewing payout requests (approve/reject).

---

## 3. Visibility — full history, not just pending

Every admin view that currently shows only the actionable subset gets a way to see the full record too — pending listings, pending manual payments, payout requests. Keep the pending queue exactly where it is for the actionable workflow; add a separate, filterable history view alongside it (a simple status filter is enough, no need for a separate page per status).

**Receipts** — `my-orders.html` and `account.html`'s subscription section should show, for every successful payment, its reference number, amount, and date — pulled from the existing `payments` table, which already has all of this. A simple on-page confirmation view is enough; no PDF generation needed for this pass.

---

## 4. UX consistency

- **A consistent back action on every locked page** — a small, always-present "← Back" link. Use `document.referrer` when it points within the site, falling back to a sensible default (e.g. `home.html`) when it doesn't (a bookmarked or directly-typed URL has no useful referrer).
- **Nav cleanup** — consolidate the growing set of inline action buttons that have accumulated on pages like `market.html` (Cart, Log out, Sell a book, My listings, all currently separate visible buttons) into a single, cleaner menu, consistent with the pattern already established for the site's main navigation.
- **Copy-to-clipboard on `checkout.html`** — a small icon/button next to the bank account number that copies it in one tap, using the standard Clipboard API.

---

## 5. Content

`index.html` still describes Readerly as purely a subscription reading platform — written back in Phase 1, before the marketplace existed. Rewrite it to honestly reflect both product lines: the digital subscription library and the physical marketplace, buying and selling.

---

## Verification

- [ ] Cart add/remove genuinely adds and removes, never just increments
- [ ] A user with no merchant profile is blocked from `sell.html` and redirected to onboarding
- [ ] The onboarding page clearly shows the commission rate and requires explicit agreement before the profile is created
- [ ] Changing `settings.commission_percent` afterward does not alter an already-agreed seller's snapshotted rate
- [ ] A seller's available balance is computed correctly and updates after a sale and after a withdrawal request
- [ ] A withdrawal request exceeding available balance is rejected
- [ ] Admin can directly create a physical listing with zero commission/payout implications
- [ ] Admin can edit a delivery zone's fee from the UI and it takes effect on the next order
- [ ] Every admin queue has a working history view alongside its pending view
- [ ] Receipts show real reference numbers pulled from the actual payments table
- [ ] Back button present and functional on every locked page
- [ ] Copy-to-clipboard works on checkout
- [ ] Landing page accurately describes both product lines

## Bring back to me

The merchant onboarding route, the balance-calculation query, and the admin physical-listing creation route — the three places this phase's actual business logic lives.
