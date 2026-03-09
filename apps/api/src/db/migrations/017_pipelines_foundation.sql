-- Migration 017: Canonical pipelines foundation

CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(32) NOT NULL DEFAULT 'workflow',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  flow_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipelines_active ON pipelines (is_active);
CREATE INDEX idx_pipelines_default ON pipelines (is_default);

ALTER TABLE pipeline_stages
  ADD COLUMN pipeline_id UUID REFERENCES pipelines(id);

ALTER TABLE leads
  ADD COLUMN pipeline_id UUID REFERENCES pipelines(id);

INSERT INTO pipelines (name, slug, description, icon, is_active, is_default)
VALUES
  ('Leads', 'leads', 'Pipeline comercial principal do CRM.', 'users', true, true),
  ('Pedidos', 'pedidos', 'Pipeline operacional de pedidos.', 'shopping-bag', true, false),
  ('Produção', 'producao', 'Pipeline operacional da produção.', 'gem', true, false)
ON CONFLICT (slug) DO NOTHING;

UPDATE pipeline_stages
SET pipeline_id = (SELECT id FROM pipelines WHERE slug = 'leads' LIMIT 1)
WHERE pipeline_id IS NULL;

UPDATE leads
SET pipeline_id = (SELECT id FROM pipelines WHERE slug = 'leads' LIMIT 1)
WHERE pipeline_id IS NULL;

ALTER TABLE pipeline_stages
  ALTER COLUMN pipeline_id SET NOT NULL;

ALTER TABLE leads
  ALTER COLUMN pipeline_id SET NOT NULL;

CREATE INDEX idx_pipeline_stages_pipeline_position
  ON pipeline_stages (pipeline_id, position);

CREATE INDEX idx_leads_pipeline
  ON leads (pipeline_id, created_at DESC);

CREATE INDEX idx_leads_pipeline_stage
  ON leads (pipeline_id, stage_id);
