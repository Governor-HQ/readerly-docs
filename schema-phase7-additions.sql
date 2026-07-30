-- ============================================================================
-- Readerly v2 — Phase 7 schema additions (physical marketplace)
-- ----------------------------------------------------------------------------
-- Run once via the DB connection. Idempotent: safe to re-run.
-- The orders / order_items / delivery_zones tables already exist (created in
-- Phase 0 as P2 tables), and payments already has order_id + purpose. This file
-- only adds the pieces Phase 7 introduces:
--   1. manual_payments.order_id  — so a manual payment can be tagged to an order
--      (NULL = subscription payment, as before).
--   2. delivery_zones seed data  — the three tiers with their fees.
--   3. commission_percent setting — Readerly's cut on each physical sale.
-- ============================================================================

-- 1. Tag manual payments with an order (nullable; NULL keeps the subscription flow).
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_order ON manual_payments(order_id);

-- 2. Delivery zones (money in kobo). Tiers per section 5.10:
--    Enugu/pickup lowest · South-East mid · Nationwide highest.
--    Seeded placeholders — editable later from the DB.
INSERT INTO delivery_zones (code, label, fee_kobo) VALUES
  ('ENUGU',      'Enugu (local / pickup)', 150000),
  ('SOUTH_EAST', 'South-East states',      250000),
  ('NATIONWIDE', 'Nationwide',             400000)
ON CONFLICT (code) DO NOTHING;

-- 3. Commission percentage on physical sales (configurable, not hardcoded).
INSERT INTO settings (key, value) VALUES ('commission_percent', '10')
ON CONFLICT (key) DO NOTHING;
