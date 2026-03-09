-- Migration 013: Ajustes (notifications + user whatsapp)

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS notify_new_lead_whatsapp BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_order_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_production_delayed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS personal_whatsapp VARCHAR(25);
