-- 034: Generic integration providers table (multi-instance)
-- Replaces per-field integration columns in settings with a proper relational model.
-- Each row is one configured instance of a third-party integration.

CREATE TABLE IF NOT EXISTS integration_providers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    provider_type   TEXT        NOT NULL,
    category        TEXT        NOT NULL
        CHECK (category IN ('payment', 'automation', 'ai', 'erp')),
    credentials     JSONB       NOT NULL DEFAULT '{}',
    config          JSONB       NOT NULL DEFAULT '{}',
    is_primary      BOOLEAN     NOT NULL DEFAULT false,
    active          BOOLEAN     NOT NULL DEFAULT true,
    status          TEXT        NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'connected', 'error')),
    last_tested_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one primary per category
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_providers_primary_per_category
    ON integration_providers (category, is_primary)
    WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_integration_providers_category
    ON integration_providers (category);

CREATE INDEX IF NOT EXISTS idx_integration_providers_type
    ON integration_providers (provider_type);
