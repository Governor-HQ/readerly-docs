-- ============================================================================
-- Readerly v2 — Phase 9 schema additions (marketplace business model)
-- ----------------------------------------------------------------------------
-- Run once via the DB connection. Idempotent: safe to re-run.
-- Adds the two tables Phase 9 introduces; changes nothing existing.
--   1. merchant_profiles — a user becomes a seller by agreeing to terms. The
--      commission percentage is SNAPSHOTTED here at agreement time, so later
--      edits to settings.commission_percent never rewrite what a seller signed.
--   2. payout_requests   — a seller's withdrawal requests. Available balance is
--      computed live (paid payout_kobo − pending/paid requests), never stored.
-- ============================================================================

CREATE TABLE IF NOT EXISTS merchant_profiles (
  user_id                   INTEGER PRIMARY KEY REFERENCES users(id),
  full_name                 TEXT NOT NULL,
  bank_name                 TEXT NOT NULL,
  account_number            TEXT NOT NULL,
  account_name              TEXT NOT NULL,
  agreed_commission_percent NUMERIC(5,2) NOT NULL,
  agreed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
CREATE INDEX IF NOT EXISTS idx_payout_requests_seller ON payout_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
