-- Migration 045: payments indexes for dashboard and listing queries

CREATE INDEX IF NOT EXISTS idx_payments_status_created_at
    ON payments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_created_at
    ON payments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_order_created_at
    ON payments (order_id, created_at DESC);
