-- Migration 012: Operator Webhook Log

CREATE TABLE operator_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  result VARCHAR(50) NOT NULL,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operator_webhook_idempotency ON operator_webhook_log (idempotency_key);
CREATE INDEX idx_operator_webhook_action ON operator_webhook_log (action);
