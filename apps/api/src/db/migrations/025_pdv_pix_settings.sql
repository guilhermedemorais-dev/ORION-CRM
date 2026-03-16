-- Migration 025: Add pix_key to settings for PDV display
ALTER TABLE settings ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255);
