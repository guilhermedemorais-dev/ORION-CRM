-- Migration 033: WhatsApp multi-provider support
-- Each row is a configurable WhatsApp/messaging provider instance

CREATE TABLE IF NOT EXISTS whatsapp_providers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    provider_type   TEXT        NOT NULL DEFAULT 'evolution',
    credentials     JSONB       NOT NULL DEFAULT '{}',
    base_url        TEXT,
    instance_name   TEXT,
    is_primary      BOOLEAN     NOT NULL DEFAULT false,
    active          BOOLEAN     NOT NULL DEFAULT true,
    status          TEXT        NOT NULL DEFAULT 'disconnected', -- disconnected | connecting | connected
    connected_number TEXT,
    connected_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one primary provider at a time (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_providers_primary
    ON whatsapp_providers (is_primary) WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_whatsapp_providers_active
    ON whatsapp_providers (active);
