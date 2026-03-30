-- 041_webhook_keys.sql
-- Multiple named API keys for webhook authentication (replaces single internal_webhook_key)

CREATE TABLE IF NOT EXISTS webhook_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    key_value    TEXT NOT NULL,
    key_prefix   TEXT NOT NULL,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_keys_active
    ON webhook_keys (revoked_at) WHERE revoked_at IS NULL;