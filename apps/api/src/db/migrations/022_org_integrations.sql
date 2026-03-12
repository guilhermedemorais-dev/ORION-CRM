-- Migration 022: Org Integrations (aligned with PRD)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_provider') THEN
    CREATE TYPE integration_provider AS ENUM ('meta', 'n8n', 'mercadopago');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_status') THEN
    CREATE TYPE integration_status AS ENUM ('connected', 'error', 'pending');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS org_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  provider integration_provider NOT NULL,
  credentials BYTEA NOT NULL,
  status integration_status NOT NULL DEFAULT 'pending',
  last_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, provider)
);

DO $$
BEGIN
  IF to_regclass('public.settings_integrations') IS NOT NULL THEN
    INSERT INTO org_integrations (org_id, provider, credentials, status, last_check, created_at, updated_at)
    SELECT settings_id, provider, credentials, status, last_check, created_at, updated_at
    FROM settings_integrations
    ON CONFLICT (org_id, provider) DO NOTHING;

    DROP TABLE settings_integrations;
  END IF;
END $$;

