-- Migration 024: Internal notes on conversations + read tracking

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS internal_note TEXT,
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_read_by UUID REFERENCES users(id);
