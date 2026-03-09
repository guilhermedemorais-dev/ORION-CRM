-- Migration 016: Pipeline upgrade foundation (DB only)

-- -------------------------------
-- Pipeline stages (admin-managed)
-- -------------------------------
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  position INTEGER NOT NULL,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pipeline_stage_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT chk_pipeline_stage_position CHECK (position > 0),
  CONSTRAINT chk_pipeline_stage_flags CHECK (NOT (is_won AND is_lost))
);

CREATE INDEX idx_pipeline_stages_position
  ON pipeline_stages (position);

-- --------------------------------
-- Pipeline custom field definitions
-- --------------------------------
CREATE TABLE pipeline_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  field_key VARCHAR(50) NOT NULL UNIQUE,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox')),
  options JSONB,
  required BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pipeline_custom_fields_position CHECK (position > 0)
);

CREATE INDEX idx_pipeline_custom_fields_position
  ON pipeline_custom_fields (position);

-- ------------------------
-- Lead operational entities
-- ------------------------
CREATE TABLE lead_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  due_date TIMESTAMPTZ,
  done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_tasks_lead
  ON lead_tasks (lead_id);

CREATE INDEX idx_lead_tasks_due_open
  ON lead_tasks (due_date)
  WHERE done = false;

CREATE INDEX idx_lead_tasks_lead_created
  ON lead_tasks (lead_id, created_at DESC);

CREATE TABLE lead_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_attachments_lead
  ON lead_attachments (lead_id);

CREATE INDEX idx_lead_attachments_lead_created
  ON lead_attachments (lead_id, created_at DESC);

CREATE TABLE lead_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'STAGE_CHANGED',
    'NOTE_ADDED',
    'TASK_CREATED',
    'TASK_DONE',
    'MESSAGE_SENT',
    'MESSAGE_RECEIVED',
    'ATTACHMENT_ADDED',
    'LEAD_CREATED',
    'LEAD_CONVERTED',
    'FIELD_UPDATED'
  )),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  metadata JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_timeline_lead_created
  ON lead_timeline (lead_id, created_at DESC);

CREATE INDEX idx_lead_timeline_type_created
  ON lead_timeline (type, created_at DESC);

-- -----------------------
-- Leads table enrichment
-- stage_id stays nullable in this phase for backward compatibility
-- -----------------------
ALTER TABLE leads
  ADD COLUMN stage_id UUID REFERENCES pipeline_stages(id),
  ADD COLUMN estimated_value INTEGER NOT NULL DEFAULT 0 CHECK (estimated_value >= 0),
  ADD COLUMN quick_note TEXT,
  ADD COLUMN custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN last_task_at TIMESTAMPTZ,
  ADD COLUMN open_tasks_count INTEGER NOT NULL DEFAULT 0 CHECK (open_tasks_count >= 0);

CREATE INDEX idx_leads_stage_id
  ON leads (stage_id);

-- ---------------------------------
-- Seed canonical default stages (PRD)
-- ---------------------------------
INSERT INTO pipeline_stages (name, color, position, is_won, is_lost)
VALUES
  ('Novo', '#F59E0B', 1, false, false),
  ('Qualificado', '#3B82F6', 2, false, false),
  ('Proposta Enviada', '#8B5CF6', 3, false, false),
  ('Negociação', '#EC4899', 4, false, false),
  ('Convertido', '#10B981', 5, true, false),
  ('Perdido', '#6B7280', 6, false, true);

-- -------------------------------------------------
-- Backfill leads.stage (legacy enum) -> leads.stage_id
-- -------------------------------------------------
UPDATE leads
SET stage_id = CASE stage
  WHEN 'NOVO' THEN (SELECT id FROM pipeline_stages WHERE name = 'Novo' LIMIT 1)
  WHEN 'QUALIFICADO' THEN (SELECT id FROM pipeline_stages WHERE name = 'Qualificado' LIMIT 1)
  WHEN 'PROPOSTA_ENVIADA' THEN (SELECT id FROM pipeline_stages WHERE name = 'Proposta Enviada' LIMIT 1)
  WHEN 'NEGOCIACAO' THEN (SELECT id FROM pipeline_stages WHERE name = 'Negociação' LIMIT 1)
  WHEN 'CONVERTIDO' THEN (SELECT id FROM pipeline_stages WHERE name = 'Convertido' LIMIT 1)
  WHEN 'PERDIDO' THEN (SELECT id FROM pipeline_stages WHERE name = 'Perdido' LIMIT 1)
END
WHERE stage_id IS NULL;

-- -------------------------------------------------------
-- Tasks summary sync helpers (open_tasks_count/last_task_at)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_lead_task_summary(p_lead_id UUID)
RETURNS VOID AS $$
DECLARE
  v_open_tasks_count INTEGER;
  v_last_task_at TIMESTAMPTZ;
BEGIN
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE done = false), 0)::INTEGER,
    MAX(CASE WHEN done = false THEN COALESCE(due_date, created_at) END)
  INTO v_open_tasks_count, v_last_task_at
  FROM lead_tasks
  WHERE lead_id = p_lead_id;

  UPDATE leads
  SET open_tasks_count = v_open_tasks_count,
      last_task_at = v_last_task_at
  WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_sync_lead_task_summary()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_lead_task_summary(NEW.lead_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.lead_id IS DISTINCT FROM OLD.lead_id THEN
      PERFORM refresh_lead_task_summary(OLD.lead_id);
      PERFORM refresh_lead_task_summary(NEW.lead_id);
    ELSE
      PERFORM refresh_lead_task_summary(NEW.lead_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_lead_task_summary(OLD.lead_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_tasks_sync_summary_trg
AFTER INSERT OR UPDATE OR DELETE ON lead_tasks
FOR EACH ROW
EXECUTE FUNCTION trg_sync_lead_task_summary();

-- Initial summary sync for any pre-existing task rows
UPDATE leads l
SET open_tasks_count = s.open_tasks_count,
    last_task_at = s.last_task_at
FROM (
  SELECT
    lead_id,
    COALESCE(COUNT(*) FILTER (WHERE done = false), 0)::INTEGER AS open_tasks_count,
    MAX(CASE WHEN done = false THEN COALESCE(due_date, created_at) END) AS last_task_at
  FROM lead_tasks
  GROUP BY lead_id
) s
WHERE l.id = s.lead_id;
