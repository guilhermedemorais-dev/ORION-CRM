-- Migration 046: payment_method on financial_entries

ALTER TABLE financial_entries
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_financial_entries_payment_method
ON financial_entries (payment_method);

