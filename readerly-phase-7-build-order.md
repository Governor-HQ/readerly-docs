# Readerly v2 — Phase 7 Build Order

**Goal:** Readerly Market — physical books, buyable and sellable. A user can list a book for sale (pending your approval, same pattern as digital books), buy any approved physical book, check out with a tiered delivery fee, pay via the existing manual-payment flow, and you can track what's owed to each seller.

**Scope discipline:** Reuse existing patterns aggressively — this project has now built the "submit → pending → admin approves/rejects" shape three times (digital books, subscriptions, and now this) and the signed-upload-URL shape twice. Don't reinvent either. No Paystack-for-orders yet — that arrives free once Phase 8 adds real keys, same mechanism already written for subscriptions.

**Prerequisite:** Phase 6 and 6.5 both merged to `main`, both repos.

**New policy for this phase:** real money and schema changes are involved, so this stays on the branch-first, review-before-merge discipline — same as every payment/auth phase before it.

---

## Part 0 — verify before building

The original schema design always intended `books` to serve both digital and physical from one table (`format` column). Confirm what actually exists right now rather than assuming — check whether `format`, `price_kobo`, `stock`, and `condition` are already present on `books`. Add whatever's missing using the standing workflow (run it yourself, report table state before/after, never destructive without asking).

**New tables needed, if not already present:**

```sql
CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  buyer_id         INTEGER NOT NULL REFERENCES users(id),
  subtotal_kobo    INTEGER NOT NULL,
  delivery_kobo    INTEGER NOT NULL,
  total_kobo       INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  delivery_name    TEXT NOT NULL,
  delivery_phone   TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_zone    TEXT NOT NULL,
  cancellation_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  book_id         INTEGER NOT NULL REFERENCES books(id),
  seller_id       INTEGER REFERENCES users(id),
  title_snapshot  TEXT NOT NULL,
  price_kobo      INTEGER NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  commission_kobo INTEGER NOT NULL DEFAULT 0,
  payout_kobo     INTEGER NOT NULL DEFAULT 0,
  payout_status   TEXT NOT NULL DEFAULT 'unpaid'
);

CREATE TABLE IF NOT EXISTS delivery_zones (
  id       SERIAL PRIMARY KEY,
  code     TEXT UNIQUE NOT NULL,
  label    TEXT NOT NULL,
  fee_kobo INTEGER NOT NULL
);
INSERT INTO delivery_zones (code, label, fee_kobo) VALUES
  ('ENUGU', 'Enugu State / Pickup', 50000),
  ('SOUTH_EAST', 'South-East Nigeria', 150000),
  ('NATIONWIDE', 'Rest of Nigeria', 300000)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);
```

Add a `settings` row for `commission_percent` (default `15`) so it's admin-editable, same philosophy as the payment toggles.

---

## Design decisions (already made — do not deviate)

- **Cart is client-side only (localStorage)**, exactly like v1. It becomes a real order only at checkout.
- **Checkout always recomputes price and delivery fee server-side** from the real `books` and `delivery_zones` tables — never trust a client-supplied price or fee, same principle as every money-touching route in this project so far.
- **Stock is checked (not decremented) at order creation**, and only actually decremented when the order's payment is approved — an unpaid pending order shouldn't permanently lock inventory that might never get paid for.
- **Physical order payment reuses `manual_payments`**, generalized with the new nullable `order_id` column. The same admin review queue handles both subscription and order payments — approving an order-linked one marks the order `'paid'`, decrements stock, and writes the `payments` ledger row with `purpose = 'order'`.
- **Seller book submissions reuse the exact publish-gate pattern from Phase 2** — required fields checked before approval, `rejection_reason` (sitting unused on `books` since Phase 0) finally gets used.
- **Out-of-stock books stay visible with a disabled buy button and a clear badge**, never silently hidden — same honesty pattern as every "coming soon" and unavailable state built so far.
- **`admin-market.html` is a new, separate admin page**, not an extension of the working `admin-books.html` — lower risk, and exactly the case the Phase 6 shared admin nav was built to make trivial.
- **`home.html` gains exactly one new card, "Marketplace,"** linking to `market.html`. `my-listings.html` and `my-orders.html` are reached from within the marketplace/account pages, not given their own home cards — keeps the dashboard from bloating.

---

## The Claude Code prompt

---

Phase 7 of Readerly v2: the physical marketplace. Re-read sections 2, 5, 6, 7, and 9 of `readerly-v2-product-definition.md`. This reuses three patterns already built elsewhere in this codebase — the pending/approved/rejected submission flow, the signed-upload-URL mechanism, and the manual-payment-proof-and-admin-approval flow. Reuse them, don't reinvent.

Verify Part 0's schema state before building anything, using the standing workflow. Housekeeping as every phase: reconcile sections 6, 7, and 9 against what's actually built at the end, including recording the real commission percentage and delivery fees as currently seeded.

### Part 1 — `readerly-api`

**Seller submission & listing management**
- `POST /api/books/submit` — any logged-in user. Body: title, author, description, price, condition, stock, category ids. Creates a `books` row, `format = 'PHYSICAL'`, `seller_id = user.id`, `status = 'pending'`.
- `GET /api/my/listings` — the caller's own submissions with status.
- Cover upload reuses the existing signed-upload-URL pattern, scoped to the submitting user, same shape as the Phase 4 payment-proof upload route.

**Public market**
- `GET /api/books` (existing route) — extend to accept `format` filtering; a physical/market view filters `format IN ('PHYSICAL','BOTH')` and `status = 'approved'`, still never returning `file_url`, now also never returning `seller_id`'s owner details beyond what's needed to display a listing.

**Orders**
- `GET /api/delivery-zones` — any logged-in user.
- `POST /api/orders` — any logged-in user. Body: cart items (book id + quantity), delivery zone, delivery details. Server re-checks stock, recomputes subtotal from real prices, adds the real zone fee, computes `commission_kobo` per item from the current `commission_percent` setting, creates `orders` + `order_items`, `status = 'pending'`.
- `GET /api/my/orders` — the caller's own order history.
- `POST /api/orders/[id]/upload-url` and `POST /api/orders/[id]/submit-payment` — mirror the existing subscription manual-payment upload/submit routes, but tagged with `order_id` instead of being subscription-only.

**Admin**
- `GET /api/admin/pending-listings`, `POST /api/admin/listings/[id]/approve`, `POST /api/admin/listings/[id]/reject` — same shape as the Phase 2 book publish/reject routes.
- Extend the existing manual-payments admin approve route: if the payment record has an `order_id`, branch to order-approval logic (mark order `'paid'`, decrement stock per item, write the ledger row with `purpose = 'order'`) instead of `activateSubscription`.
- `GET /api/admin/orders`, `POST /api/admin/orders/[id]/status` — view all orders, update status (processing/shipped/delivered), record a cancellation reason.
- `GET /api/admin/payouts` — per-seller totals of unpaid `payout_kobo` across all `order_items`. `POST /api/admin/payouts/[sellerId]/mark-paid` — flips the relevant `order_items.payout_status` to `'paid'`.

All routes: same conventions as every prior phase — `nodejs`/`force-dynamic`, parameterized SQL, CORS, no raw errors leaked, admin routes gated by `requireAdmin`.

### Part 2 — `readerly-frontend`

- **`sell.html`** — locked. The listing submission form (title, author, description, price, condition, stock, categories, cover upload).
- **`my-listings.html`** — locked. The seller's own submissions and their statuses, including rejection reasons.
- **`market.html`** — locked. Same structural pattern as `library.html` — search, category filters — but for physical books, showing price and an out-of-stock badge where relevant. Links to `sell.html` and `my-listings.html`.
- **`cart.html`** — locked. The localStorage cart, quantity adjustment, proceed to checkout.
- **`checkout.html`** — locked. Delivery zone selection (fee shown live), delivery details form, then the same proof-upload-and-submit flow already built for subscriptions.
- **`my-orders.html`** — locked. Order history with status.
- **`admin-market.html`** — admin-gated, added to the shared nav. Pending listings review (approve/reject) plus a simple catalog management view for physical books.
- **`admin-orders.html`** — admin-gated, added to the shared nav. All orders, status updates, and the payouts view (per-seller unpaid totals, mark-paid action).
- **`home.html`** — add one "Marketplace" card linking to `market.html`.
- Reuse existing CSS components (`.card`, `.btn-primary`, badges, loading/error states from Phase 6) rather than inventing new patterns.

When finished, summarise what was built, confirm exactly which schema pieces already existed versus were newly added, and list anything unsure about. Push to a new branch, not `main` — tell me the branch name.

---

## Verification

- [ ] Submitting a listing creates a pending, invisible-to-buyers row
- [ ] Approving makes it appear on `market.html`; rejecting shows the reason on `my-listings.html`
- [ ] Cart persists across a page reload (localStorage)
- [ ] Checkout total is computed server-side — tampering with a client-side price does nothing
- [ ] Stock is checked at order creation, not decremented until payment approval
- [ ] Approving an order's payment proof marks it paid, decrements stock, and creates a ledger row with `purpose = 'order'`
- [ ] The same admin payment-review queue correctly handles both subscription and order proofs without confusing them
- [ ] Payouts view correctly totals unpaid commission per seller; mark-paid updates the right rows
- [ ] Out-of-stock books show a disabled, clearly-labeled state, never disappear
- [ ] No console errors, mobile pass on the new pages

## Bring back to me

The branch name, plus the order-creation route and the extended manual-payment approve route — the two places real money and stock counts are computed.
