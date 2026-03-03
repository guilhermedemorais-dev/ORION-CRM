-- Migration 008: Payments

CREATE TYPE payment_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  mp_payment_id VARCHAR(100) UNIQUE,
  mp_preference_id VARCHAR(100),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status payment_status NOT NULL DEFAULT 'PENDING',
  payment_method VARCHAR(100),
  paid_at TIMESTAMPTZ,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  webhook_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_mp_id ON payments (mp_payment_id) WHERE mp_payment_id IS NOT NULL;
CREATE INDEX idx_payments_idempotency ON payments (idempotency_key);
CREATE INDEX idx_payments_order ON payments (order_id);
