# Readerly v2 — Product Definition Document

**Owner:** Governor (@GovernorHQ_)
**Status:** Living document. Update it when a decision changes — never let code drift from this file.
**Purpose:** Single source of truth for the Readerly v2 build. Every Claude Code instruction is derived from this document, and every piece of output is reviewed against it.

---

## 1. What Readerly Is

Readerly is a Nigerian book platform with **two product lines sharing one account, one catalog, and one admin panel**:

1. **Readerly Digital** *(ships first)* — a subscription reading service. Users pay ₦2,000/month for unlimited access to a curated digital library, read in an in-browser reader that remembers where they stopped.
2. **Readerly Market** *(ships second)* — a marketplace for physical books. Users buy books; approved sellers list their own books; Readerly is always the middleman and handles fulfilment.

The two lines are built on the same foundation. A book row in the database has a `format` — `DIGITAL`, `PHYSICAL`, or `BOTH` — and the platform behaves accordingly.

### Why digital ships first
- No logistics, delivery, or stock management
- Recurring revenue instead of one-off transactions
- Can launch legally today using public-domain titles
- It's the harder technical build; do it while momentum is high

---

## 2. Content Rights Policy — NON-NEGOTIABLE

Readerly Digital may **only** host books where distribution rights are clear. Every digital book must record a `rights_basis`:

| `rights_basis` | Meaning | Examples |
|---|---|---|
| `PUBLIC_DOMAIN` | Copyright expired, free to distribute | Think and Grow Rich, The Richest Man in Babylon, As a Man Thinketh, Meditations, The Art of War, Siddhartha |
| `LICENSED` | Written agreement signed with author/publisher | Nigerian indie & self-published authors |
| `OWN_CONTENT` | Written/produced by Readerly | Future original guides |

**Never upload commercial copyrighted titles** (Atomic Habits, Ikigai, The 48 Laws of Power, etc.) without a signed licence. This is not caution — it is the difference between a business and a lawsuit, and payment processors drop platforms that receive infringement complaints.

Admin panel must **require** `rights_basis` before a digital book can be published. For `LICENSED`, store a reference to the agreement.

---

## 3. Architecture

Same pattern as Alibaba Logistics — two separate projects, communicating over HTTP with JSON.

```
┌──────────────────────┐        ┌───────────────────────┐       ┌──────────────────┐
│  readerly-frontend   │ fetch  │    readerly-api       │  SQL  │    Supabase      │
│  HTML / CSS / JS     │ ─────► │  Next.js API routes   │ ────► │  PostgreSQL      │
│  (Netlify)           │ ◄───── │  (Vercel)             │ ◄──── │  + Storage       │
└──────────────────────┘  JSON  └───────────────────────┘       └──────────────────┘
                                          │
                                    Paystack (payments + subscriptions)
```

### Stack
| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vanilla HTML / CSS / JS | No framework. Hosted on Netlify. |
| Backend | Next.js API routes (Node) | API only — no UI rendering. Hosted on Vercel. |
| Database | PostgreSQL on Supabase | Raw SQL via `pg`. **Session pooler, port 5432** (transaction pooler 6543 is IPv6-only and breaks on Vercel). |
| File storage | Supabase Storage | Private bucket for book PDFs; public bucket for cover images. |
| Auth | JWT (30-day) + bcrypt | Same approach as Alibaba. |
| Payments | Paystack | One-time charges + recurring Plans/Subscriptions. |

### Backend dependencies
`pg`, `bcryptjs`, `jsonwebtoken`, `@supabase/supabase-js` (storage signed URLs only — not for DB access).

### Environment variables (Vercel)
```
DATABASE_URL              # Supabase session pooler string, port 5432
JWT_SECRET                # long random string — NO hardcoded fallback in code
ADMIN_SECRET              # separate admin gate
PAYSTACK_SECRET_KEY
PAYSTACK_PLAN_CODE        # monthly ₦2,000 plan code from Paystack dashboard
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY # server-side only, never sent to frontend
FRONTEND_URL              # for CORS allowlist
```

---

## 4. Brand & Design

Carried forward from v1 — keep it consistent.

| Token | Value | Use |
|---|---|---|
| Background | `#FAF9F6` | Page background |
| Dark / brand | `#1A1A1A` | Text, primary buttons, dark sections |
| Cream | `#F5F0E8` | Text on dark surfaces |
| Accent green | `#25D366` | Confirm / pay actions |
| Muted | `#888888` | Secondary text |
| Border | `#E8E8E0` | Hairlines |

**Fonts:** Playfair Display (headings, editorial feel) · Inter (body).
**Tone:** calm, editorial, premium. Generous whitespace. Not loud.

---

## 5. Database Schema

Raw SQL for Supabase. Design covers both phases so nothing is rebuilt later. Tables marked **P2** are created but unused until Phase 2.

### 5.1 users
```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  phone         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
```

### 5.2 categories
```sql
CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);
```
Seed with the v1 categories: Mindset & Psychology, Productivity & Discipline, Money & Wealth, Career & Skills, Relationships & Social, Health & Energy, Spirituality & Purpose, Leadership & Influence, Resilience & Toughness, Communication & Persuasion.

### 5.3 books
The core table. Serves both product lines.
```sql
CREATE TABLE books (
  id               SERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  author           TEXT NOT NULL,
  description      TEXT NOT NULL,
  cover_url        TEXT NOT NULL,

  format           TEXT NOT NULL DEFAULT 'DIGITAL',  -- 'DIGITAL' | 'PHYSICAL' | 'BOTH'

  -- Digital fields
  file_url         TEXT,          -- path in private Supabase Storage bucket
  page_count       INTEGER,
  rights_basis     TEXT,          -- 'PUBLIC_DOMAIN' | 'LICENSED' | 'OWN_CONTENT'
  rights_note      TEXT,          -- licence reference / agreement detail

  -- Physical fields (P2)
  price_kobo       INTEGER,       -- store money in kobo, never decimals
  stock            INTEGER DEFAULT 0,
  condition        TEXT,          -- 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR'

  -- Seller submission workflow
  seller_id        INTEGER REFERENCES users(id),  -- NULL = added by admin
  status           TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  rejection_reason TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_format ON books(format);
CREATE INDEX idx_books_seller ON books(seller_id);
```

### 5.4 book_categories
```sql
CREATE TABLE book_categories (
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, category_id)
);
```

### 5.5 subscriptions
```sql
CREATE TABLE subscriptions (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id),
  status                TEXT NOT NULL DEFAULT 'inactive',
      -- 'active' | 'inactive' | 'cancelled' | 'past_due'
  plan_code             TEXT,
  paystack_sub_code     TEXT,
  paystack_email_token  TEXT,      -- needed to cancel via Paystack API
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_sub_user ON subscriptions(user_id);
CREATE INDEX idx_sub_status ON subscriptions(status);
```
**Access rule:** a user has digital access when `status = 'active'` AND `current_period_end > NOW()`. Check this server-side on every protected read — never trust the frontend.

### 5.6 reading_progress
```sql
CREATE TABLE reading_progress (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  book_id       INTEGER NOT NULL REFERENCES books(id),
  current_page  INTEGER NOT NULL DEFAULT 1,
  percent       NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);
CREATE INDEX idx_progress_user ON reading_progress(user_id);
```

### 5.7 payments
Covers both subscription charges and (P2) order payments.
```sql
CREATE TABLE payments (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  reference    TEXT UNIQUE NOT NULL,     -- Paystack reference
  amount_kobo  INTEGER NOT NULL,
  purpose      TEXT NOT NULL,            -- 'subscription' | 'order'
  order_id     INTEGER,                  -- P2, nullable
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'success' | 'failed'
  paid_at      TIMESTAMPTZ,
  raw_response JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_ref ON payments(reference);
```

### 5.8 orders — **P2**
```sql
CREATE TABLE orders (
  id               SERIAL PRIMARY KEY,
  buyer_id         INTEGER NOT NULL REFERENCES users(id),
  subtotal_kobo    INTEGER NOT NULL,
  delivery_kobo    INTEGER NOT NULL,
  total_kobo       INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
      -- 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  delivery_name    TEXT NOT NULL,
  delivery_phone   TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_zone    TEXT NOT NULL,        -- 'ENUGU' | 'SOUTH_EAST' | 'NATIONWIDE'
  cancellation_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.9 order_items — **P2**
Snapshot title and price so historical orders stay accurate when a book changes.
```sql
CREATE TABLE order_items (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  book_id        INTEGER NOT NULL REFERENCES books(id),
  seller_id      INTEGER REFERENCES users(id),
  title_snapshot TEXT NOT NULL,
  price_kobo     INTEGER NOT NULL,
  quantity       INTEGER NOT NULL DEFAULT 1,
  commission_kobo INTEGER NOT NULL DEFAULT 0,  -- Readerly's cut
  payout_kobo     INTEGER NOT NULL DEFAULT 0,  -- owed to seller
  payout_status   TEXT NOT NULL DEFAULT 'unpaid' -- 'unpaid' | 'paid'
);
```

### 5.10 delivery_zones — **P2**
```sql
CREATE TABLE delivery_zones (
  id        SERIAL PRIMARY KEY,
  code      TEXT UNIQUE NOT NULL,   -- 'ENUGU' | 'SOUTH_EAST' | 'NATIONWIDE'
  label     TEXT NOT NULL,
  fee_kobo  INTEGER NOT NULL
);
```
**Recommended tiers:** Enugu/pickup — lowest · South-East states — mid · Rest of Nigeria — highest. Fees editable from admin, not hardcoded.

---

## 6. Pages

Access rules mirror Alibaba: a public landing page, everything else gated.

### Public (logged-out allowed)
| Page | Purpose |
|---|---|
| `index.html` | Landing page. Sells Readerly. CTA → register. |
| `login.html` | Sign in |
| `register.html` | Create account |

### Locked (redirect to login if no valid JWT)
| Page | Purpose | Phase |
|---|---|---|
| `home.html` | Dashboard. Continue reading, subscription status, quick links | P1 |
| `library.html` | Browse digital library — search, categories | P1 |
| `book.html?id=` | Book detail. Read button (subscribers) or subscribe prompt | P1 |
| `reader.html?id=` | In-browser PDF reader (PDF.js). Subscriber-gated via a short-lived signed URL; resume, page nav (buttons/arrows/swipe), progress bar, zoom, light/dark themes, expired-session recovery | P1 |
| `subscribe.html` | Subscribe via Paystack and/or manual bank transfer (admin-toggleable); shows status + cancel if already active | P1 |
| `my-reading.html` | Books in progress + finished, with % | P1 |
| `account.html` | Profile (name/email, read-only) + subscription status & cancel (pending/rejected states shown) | P1 |
| `market.html` | Physical book catalog (physical/BOTH only) | P2 ✅ |
| `cart.html` | Cart review (localStorage cart via `js/cart.js`) | P2 ✅ |
| `checkout.html` | Delivery details + payment. Two-step: place order (server-computed totals) → then upload a bank-transfer proof, reusing the manual-payment flow | P2 ✅ |
| `sell.html` | Submit a book for approval (cover upload via signed URL) | P2 ✅ |
| `my-listings.html` | Seller's submissions + statuses (incl. rejection reason) | P2 ✅ |
| `my-orders.html` | Purchase history | P2 ✅ |

`home.html` also gained a **Marketplace** dashboard card linking to `market.html` (P2 ✅).

### Admin (gated by ADMIN_SECRET, separate from user JWT)
| Page | Purpose | Phase |
|---|---|---|
| `admin.html` | Admin login | P1 |
| `admin-books.html` | Add/edit/publish digital books, upload PDFs, set rights_basis | P1 |
| `admin-subscribers.html` | Payment settings (method toggles + bank details) and the manual-payment review queue (approve/reject with proof) | P1 |
| `admin-market.html` | Review seller submissions → approve/reject with reason, plus a physical-catalogue view. **Built as `admin-market.html`**, not `admin-pending.html`. | P2 ✅ |
| `admin-orders.html` | All orders, status updates, cancellation reasons — **and the seller-payouts section (balances owed / mark paid) is folded in here**, so no separate `admin-payouts.html` was built. | P2 ✅ |

---

## 7. API Endpoints

All under `readerly-api`. All SQL parameterized. All prices computed server-side.

### Auth
| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/register` | name, email, password → bcrypt hash, return JWT. Rate-limited (5/60min per IP) → 429 |
| POST | `/api/auth/login` | email, password → JWT (30d). Rate-limited (5/15min per IP and per email) → 429 |
| GET | `/api/auth/me` | JWT → user profile + subscription status |

Admin login (`/api/admin/login`) is likewise rate-limited (5/15min per IP) → 429.

### Library (P1)
| Method | Route | Notes |
|---|---|---|
| GET | `/api/books` | Approved books. Filters: `format`, `category`, `q` (search) |
| GET | `/api/books/[id]` | Single book. Never returns `file_url` directly |
| GET | `/api/books/[id]/read` | **Subscriber-only.** Book must be approved (else identical 404); verifies active subscription via `hasActiveAccess` (403 if not); returns a signed URL to the PDF (`book-files`, 3600s), never the raw path |

### Reading progress (P1)
| Method | Route | Notes |
|---|---|---|
| GET | `/api/progress` | All of the user's progress rows, joined with book title/author/cover |
| GET | `/api/progress/[bookId]` | Progress for one book; `{ progress: null }` when none (not a 404) |
| POST | `/api/progress` | Upsert `{ bookId, currentPage, totalPages }`. `percent` is computed server-side in SQL; `currentPage` is clamped to `totalPages` |

### Subscription (P1)
| Method | Route | Notes |
|---|---|---|
| GET | `/api/settings/public` | Public payment settings: method toggles; bank details only when manual is enabled |
| GET | `/api/subscription` | Current status + period end; also returns the user's latest manual payment (for `account.html` states) |
| POST | `/api/subscription/initialize` | Start a Paystack transaction (if enabled), return `authorization_url`. 400 if disabled; 500 (logged) if key missing |
| POST | `/api/subscription/manual/upload-url` | Signed upload URL for a payment-proof image (private `payment-proofs` bucket) |
| POST | `/api/subscription/manual/submit` | Submit a bank-transfer proof → `manual_payments` row, `pending_review` |
| POST | `/api/subscription/cancel` | Set `cancelled_at` (keep access to period end); disable on Paystack if codes present |
| POST | `/api/webhooks/paystack` | **Verify HMAC-SHA512 signature** (`x-paystack-signature`) over the raw body first. Handles `charge.success`, `subscription.create`, `subscription.disable` |

### Market (P2) — ✅ built
| Method | Route |
|---|---|
| POST | `/api/books/submit/cover-url` — signed upload URL for a listing cover (`book-covers`, path `listings/{userId}/…`) |
| POST | `/api/books/submit` — seller submission, saved as `pending`, `format='PHYSICAL'`, with `condition` + `price_kobo` + categories |
| GET | `/api/my/listings` — the seller's own submissions + statuses (+ rejection reason) |
| GET | `/api/delivery-zones` — zone `code` / `label` / `fee_kobo` |
| POST | `/api/orders` — create order; **all totals (subtotal, delivery, commission, payout) computed server-side**; stock re-checked; status `pending` (stock **not** decremented until payment is approved) |
| GET | `/api/my/orders` — buyer's purchase history + items |
| POST | `/api/orders/[id]/upload-url` — signed upload URL for the order's payment proof (`payment-proofs`, path `proofs/{userId}/…`); ownership-checked |
| POST | `/api/orders/[id]/submit-payment` — record a `manual_payments` row tagged with `order_id`, `pending_review`; ownership-checked |

> **Payment path changed vs. the original spec.** Instead of a Paystack `/api/payments/verify` endpoint, the marketplace **reuses the existing manual bank-transfer + admin-approval flow** (per the Phase 7 brief). The buyer uploads a transfer proof; an admin approves it, which flips the order to `paid`, decrements stock, and writes a `payments` ledger row (`purpose='order'`). `/api/payments/verify` was **not** built.

### Admin
| Method | Route |
|---|---|
| POST | `/api/admin/login` |
| GET/POST/PUT/DELETE | `/api/admin/books` |
| POST | `/api/admin/upload-url` — signed upload URL for PDF/cover |
| GET/PUT | `/api/admin/settings` — read/update payment settings (toggles + bank details) |
| GET | `/api/admin/manual-payments` — manual-payment review queue (optional `?status=`) |
| GET | `/api/admin/manual-payments/[id]/proof-url` — signed **read** URL for a proof image |
| POST | `/api/admin/manual-payments/[id]/approve` — **branches on `order_id`.** Subscription proof → `activateSubscription` + `MANUAL-` ledger row. Order proof (P2) → mark order `paid`, decrement stock per item, write a `purpose='order'` ledger row. Idempotent (409 if already approved). |
| POST | `/api/admin/manual-payments/[id]/reject` — reject with an optional note. The subscription review queue (`GET /api/admin/manual-payments`) excludes order payments (`WHERE order_id IS NULL`). |
| GET | `/api/admin/pending-listings` *(P2 ✅)* — physical `pending` books + seller + categories (built as `pending-listings`, not `pending`) |
| POST | `/api/admin/listings/[id]/approve` · `/api/admin/listings/[id]/reject` *(P2 ✅)* — reject stores a reason (built under `listings/[id]/…`, not bare `approve`/`reject`) |
| GET | `/api/admin/orders` *(P2 ✅)* — all orders + buyer + items + latest payment id/status |
| POST | `/api/admin/orders/[id]/status` *(P2 ✅)* — set `processing`\|`shipped`\|`delivered`\|`cancelled` (cancel stores a reason) |
| GET | `/api/admin/payouts` *(P2 ✅)* — per-seller unpaid balance owed (orders in paid/processing/shipped/delivered) |
| POST | `/api/admin/payouts/[sellerId]/mark-paid` *(P2 ✅)* — mark that seller's `order_items.payout_status` = `paid` |

---

## 8. The Reader — how it works

The single most important UX in Phase 1.

**Storage & delivery.** PDFs live in a **private** Supabase Storage bucket. The frontend never receives a permanent file URL. `GET /api/books/[id]/read` verifies the JWT, verifies the subscription is active, then returns a **signed URL valid for a short window** (e.g. 15 minutes). This is what stops non-subscribers sharing links.

**Rendering.** Use **PDF.js** (Mozilla) in `reader.html` to render pages to a canvas.

**Required behaviour**
- Page-by-page navigation: swipe on mobile, arrow keys and on-screen buttons on desktop
- Progress bar and "Page 34 of 210" indicator
- Save progress to `/api/progress` on page change — **debounced** (e.g. 2s) so you don't hammer the API
- On open, resume at `current_page` and show "Resume from page X" if progress exists
- Font-size / zoom control
- Light and dark reading themes
- Fully responsive; mobile is the primary target

**Deliberately out of scope for v1:** offline reading, highlights, notes, EPUB support. Note them as future work.

---

## 9. Money

### Digital subscription
- **₦2,000 / month**, recurring via Paystack Plans
- Access is granted only while `status = 'active'` and `current_period_end > NOW()`
- Webhook is the source of truth for renewals and failures — never grant access from a frontend callback alone

### Physical marketplace — P2 ✅
- Readerly takes a **percentage commission** on each sale. **As built and currently seeded: 10%**, stored configurably in `settings` under key `commission_percent` (read server-side at order time — not hardcoded). `commission_kobo = round(lineTotal × commission_percent / 100)`, `payout_kobo = lineTotal − commission_kobo`, per line.
- Buyer pays Readerly in full (manual bank transfer + admin approval); Readerly settles the seller afterwards.
- `order_items` records `commission_kobo`, `payout_kobo`, and `payout_status` per line so the admin payouts view can show exactly what is owed.
- Delivery is tiered by zone, fees editable from admin. **As currently seeded** (`delivery_zones`): Enugu (local / pickup) **₦1,500**, South-East states **₦2,500**, Nationwide **₦4,000**.

---

## 10. Build Phases

Ship in this order. Do not start a phase before the previous one works end to end.

**Phase 0 — Foundation**
Supabase project, run schema SQL, seed categories, `readerly-api` project skeleton with `pg` connection + CORS, `readerly-frontend` skeleton with shared CSS/JS, deploy both, confirm frontend can reach a health endpoint.

**Phase 1 — Auth & gate**
Register, login, JWT, `/api/auth/me`. Landing, login, register pages. The auth gate script that redirects logged-out users away from locked pages. Basic `home.html`.

**Phase 2 — Admin & content**
Admin login, admin books CRUD, PDF + cover upload to Supabase Storage, `rights_basis` enforced. Load the first public-domain titles.

**Phase 3 — Library browsing**
`/api/books` with search and category filters. `library.html`, `book.html`.

**Phase 4 — Subscription**
Paystack plan, initialize, webhook with signature verification, cancel. `subscribe.html`, subscription status on `home.html` and `account.html`.

**Phase 5 — The reader**
PDF.js reader, signed-URL access control, progress save/resume, themes. `reader.html`, `my-reading.html`.

**Phase 6 — Polish & launch**
Empty states, loading states, errors, mobile pass, security checklist (§11). **Launch Readerly Digital.**

**Phase 7+ — Readerly Market**
Physical catalog, cart, checkout, delivery zones, seller submission, admin approval, payouts.

**Phase 8 — Security Audit & Secret Rotation**
Rotate every credential that was ever exposed outside its intended environment during development (JWT_SECRET, ADMIN_SECRET, ADMIN_PASSWORD, database password, Supabase service role key). Re-verify the full security checklist in section 11 against the finished codebase. Confirm no .env.local or equivalent ever reached Git history on either repo. This is the last phase before public launch — nothing ships to real users before it's complete.

---

## 11. Security Checklist

Carried over from the Alibaba TODO list — build these in from the start rather than retrofitting.

- [ ] Escape all user-supplied text before inserting into the DOM (XSS)
- [ ] No hardcoded fallback secrets anywhere in code
- [ ] All SQL parameterized — no string concatenation
- [ ] All prices and totals computed server-side
- [ ] Ownership checks on every user-scoped endpoint (a user can only read their own orders/progress)
- [ ] Paystack webhook signature verified before processing
- [x] Rate limiting on auth endpoints — `lib/rateLimit.js` (DB-backed, `rate_limits` table) gates `/api/auth/login` (5/15min per IP + per email), `/api/auth/register` (5/60min per IP), and `/api/admin/login` (5/15min per IP); over the limit → 429 (Phase 6)
- [ ] CORS restricted to `FRONTEND_URL`
- [ ] Password policy: minimum 8 characters
- [ ] Admin token hardened and separate from user JWT
- [ ] Private bucket + short-lived signed URLs for book files
- [ ] Never return `file_url` from a public endpoint

---

## 12. Working Principles

For every Claude Code session on this project:

1. **Spec first.** Work only from this document. If something is undefined, stop and ask — do not improvise.
2. **One phase at a time.** Finish and verify a phase before starting the next.
3. **Surgical edits over rewrites.** Check what exists before regenerating a file.
4. **Diagnose before acting.** Read the error, find the cause, then fix.
5. **Complete deliverables.** Full working files, not fragments.
6. **Explain in plain terms.** Every piece of code should be explainable to the project owner.

---

## 13. Open Decisions

Resolve these before the phase that needs them:

| # | Decision | Needed by |
|---|---|---|
| 1 | Exact commission percentage for physical sales | Phase 7 |
| 2 | Delivery fee amounts per zone | Phase 7 |
| 3 | Annual subscription plan? (e.g. 2 months free) | Phase 4 |
| 4 | Free trial or free tier — a few free books? | Phase 4 |
| 5 | Final launch list of public-domain titles | Phase 2 |
| 6 | Custom domain — `readerly.com.ng` | Phase 6 |
| 7 | Email notifications (approval, receipts) — needs a mail service | Phase 7 |
