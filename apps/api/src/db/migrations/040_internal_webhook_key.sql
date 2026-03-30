-- Migration 040: internal webhook key for CRM → external automation tools
ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS internal_webhook_key TEXT DEFAULT NULL;