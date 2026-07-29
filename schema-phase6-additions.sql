-- ============================================================================
-- Readerly v2 — Phase 6 schema addition (rate limiting)
-- ----------------------------------------------------------------------------
-- Run once via the DB connection. Idempotent: safe to re-run.
-- One row per auth attempt; counted within a rolling window by created_at.
-- key examples: login:email:a@b.com, login:ip:1.2.3.4, register:ip:1.2.3.4,
--               admin-login:ip:1.2.3.4
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id         SERIAL PRIMARY KEY,
  key        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_time ON rate_limits(key, created_at);
