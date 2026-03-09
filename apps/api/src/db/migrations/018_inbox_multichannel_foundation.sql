-- Migration 018: Inbox multichannel foundation

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'inbox_channel'
  ) THEN
    CREATE TYPE inbox_channel AS ENUM ('whatsapp', 'instagram', 'telegram', 'tiktok', 'messenger');
  END IF;
END $$;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel inbox_channel NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS contact_handle VARCHAR(100),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id),
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id),
  ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0);

UPDATE conversations
SET
  external_id = COALESCE(external_id, whatsapp_number, id::text),
  contact_phone = COALESCE(contact_phone, whatsapp_number),
  assigned_at = COALESCE(assigned_at, CASE WHEN assigned_to IS NOT NULL THEN updated_at ELSE NULL END);

UPDATE conversations c
SET
  contact_name = COALESCE(c.contact_name, l.name),
  pipeline_id = COALESCE(
    c.pipeline_id,
    l.pipeline_id,
    (SELECT id FROM pipelines WHERE slug = 'leads' LIMIT 1)
  ),
  stage_id = COALESCE(
    c.stage_id,
    l.stage_id,
    (
      SELECT ps.id
      FROM pipeline_stages ps
      INNER JOIN pipelines p ON p.id = ps.pipeline_id
      WHERE p.slug = 'leads'
      ORDER BY ps.position ASC
      LIMIT 1
    )
  )
FROM leads l
WHERE l.id = c.lead_id;

UPDATE conversations c
SET contact_name = COALESCE(c.contact_name, cu.name)
FROM customers cu
WHERE cu.id = c.customer_id;

UPDATE conversations
SET pipeline_id = (SELECT id FROM pipelines WHERE slug = 'leads' LIMIT 1)
WHERE pipeline_id IS NULL;

UPDATE conversations
SET stage_id = (
  SELECT ps.id
  FROM pipeline_stages ps
  INNER JOIN pipelines p ON p.id = ps.pipeline_id
  WHERE p.slug = 'leads'
  ORDER BY ps.position ASC
  LIMIT 1
)
WHERE stage_id IS NULL;

UPDATE conversations
SET external_id = COALESCE(external_id, whatsapp_number, id::text)
WHERE external_id IS NULL;

ALTER TABLE conversations
  ALTER COLUMN external_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_channel
  ON conversations (channel);

CREATE INDEX IF NOT EXISTS idx_conversations_external_id
  ON conversations (channel, external_id);

CREATE INDEX IF NOT EXISTS idx_conversations_unread_count
  ON conversations (unread_count)
  WHERE unread_count > 0;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_mime VARCHAR(100),
  ADD COLUMN IF NOT EXISTS media_size INTEGER,
  ADD COLUMN IF NOT EXISTS is_quick_reply BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(50),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quick_replies_category
  ON quick_replies (category);

CREATE INDEX IF NOT EXISTS idx_quick_replies_title
  ON quick_replies (title);

CREATE TABLE IF NOT EXISTS channel_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel inbox_channel NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO channel_integrations (channel, is_active)
VALUES
  ('whatsapp', true),
  ('instagram', false),
  ('telegram', false),
  ('tiktok', false),
  ('messenger', false)
ON CONFLICT (channel) DO NOTHING;
