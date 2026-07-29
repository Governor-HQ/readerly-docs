-- ============================================================================
-- Readerly v2 — Phase 4 schema additions (subscriptions payment methods)
-- ----------------------------------------------------------------------------
-- Run once in the Supabase SQL Editor. Idempotent: safe to re-run.
-- Adds the `settings` key/value store and the `manual_payments` review table.
-- These two blocks are also appended to the master schema.sql.
-- ============================================================================

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
