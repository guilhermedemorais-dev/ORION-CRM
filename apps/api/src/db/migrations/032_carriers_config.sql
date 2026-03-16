-- Migration 032: Transportadoras configuráveis + colunas de despacho em deliveries

-- ── 1. Tabela de configuração de transportadoras ──────────────────────────────
CREATE TABLE IF NOT EXISTS carriers_config (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  logo_url             TEXT,
  adapter_type         TEXT NOT NULL DEFAULT 'generic_rest',
  credentials          JSONB NOT NULL DEFAULT '{}',
  base_url             TEXT,
  default_service      TEXT,
  insurance_pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
  min_insurance_cents  INTEGER NOT NULL DEFAULT 0,
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carriers_active ON carriers_config(active) WHERE active = true;

-- ── 2. Colunas adicionais na tabela deliveries ─────────────────────────────────
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS carrier_config_id    UUID REFERENCES carriers_config(id);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS carrier_order_id     TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS label_url            TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS estimated_at         TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS tracking_events      JSONB NOT NULL DEFAULT '[]';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS insurance_cents      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS freight_cents        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS declared_value_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS service              TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pickup_scheduled_at  TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ;
