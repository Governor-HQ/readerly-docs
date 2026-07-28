-- ============================================================================
-- Readerly v2 — Database schema
-- ----------------------------------------------------------------------------
-- Source of truth: section 5 of readerly-v2-product-definition.md.
-- Covers BOTH phases: tables marked "P2" are created now but stay unused until
-- the Readerly Market phase, so nothing is rebuilt later.
--
-- Safe to run once, top to bottom, in the Supabase SQL editor.
-- Tables are created in dependency order (referenced tables first).
-- The category seed uses ON CONFLICT so re-running won't duplicate rows.
-- ============================================================================


-- 5.1 users -----------------------------------------------------------------
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


-- 5.2 categories ------------------------------------------------------------
CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);


-- 5.3 books -----------------------------------------------------------------
-- The core table. Serves both product lines (digital + physical).
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
  seller_id        INTEGER REFERENCES users(id),    -- NULL = added by admin
  status           TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  rejection_reason TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_format ON books(format);
CREATE INDEX idx_books_seller ON books(seller_id);


-- 5.4 book_categories -------------------------------------------------------
CREATE TABLE book_categories (
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, category_id)
);


-- 5.5 subscriptions ---------------------------------------------------------
-- Access rule: active digital access when status='active' AND
-- current_period_end > NOW(). Enforced server-side, never trusted from client.
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


-- 5.6 reading_progress ------------------------------------------------------
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


-- 5.7 payments --------------------------------------------------------------
-- Covers subscription charges and (P2) order payments.
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


-- 5.8 orders — P2 -----------------------------------------------------------
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


-- 5.9 order_items — P2 ------------------------------------------------------
-- Snapshot title and price so historical orders stay accurate when a book changes.
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


-- 5.10 delivery_zones — P2 --------------------------------------------------
CREATE TABLE delivery_zones (
  id        SERIAL PRIMARY KEY,
  code      TEXT UNIQUE NOT NULL,   -- 'ENUGU' | 'SOUTH_EAST' | 'NATIONWIDE'
  label     TEXT NOT NULL,
  fee_kobo  INTEGER NOT NULL
);


-- ============================================================================
-- Seed data — the ten v1 categories (section 5.2).
-- ON CONFLICT keeps this idempotent if the schema is re-run.
-- ============================================================================
INSERT INTO categories (name, slug) VALUES
  ('Mindset & Psychology',        'mindset-psychology'),
  ('Productivity & Discipline',   'productivity-discipline'),
  ('Money & Wealth',              'money-wealth'),
  ('Career & Skills',             'career-skills'),
  ('Relationships & Social',      'relationships-social'),
  ('Health & Energy',             'health-energy'),
  ('Spirituality & Purpose',      'spirituality-purpose'),
  ('Leadership & Influence',      'leadership-influence'),
  ('Resilience & Toughness',      'resilience-toughness'),
  ('Communication & Persuasion',  'communication-persuasion')
ON CONFLICT (slug) DO NOTHING;
