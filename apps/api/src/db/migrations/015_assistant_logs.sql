-- Migration 015: Assistant usage logs

CREATE TABLE IF NOT EXISTS assistant_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  user_role VARCHAR(20) NOT NULL,
  functions_called TEXT[] NOT NULL DEFAULT '{}',
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_logs_user_created
  ON assistant_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_logs_created
  ON assistant_logs (created_at DESC);

