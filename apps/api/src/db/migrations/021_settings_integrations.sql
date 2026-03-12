-- Migration 021: Settings Integrations (Meta / n8n / Mercado Pago)

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

CREATE TABLE IF NOT EXISTS settings_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  credentials BYTEA NOT NULL,
  status integration_status NOT NULL DEFAULT 'pending',
  last_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(settings_id, provider)
);
