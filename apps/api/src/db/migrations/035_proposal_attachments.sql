-- Migration 035: Proposal Attachments
-- Tabela para armazenar anexos de propostas em PDF por cliente

CREATE TABLE IF NOT EXISTS proposal_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  filename      VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  file_size     INTEGER NOT NULL, -- bytes
  file_path     VARCHAR(500) NOT NULL, -- caminho relativo no storage
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_attachments_customer ON proposal_attachments(customer_id, created_at DESC);