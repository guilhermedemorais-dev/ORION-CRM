-- Migration 036: Add login protection toggle
-- Allow admin to disable brute-force block on login

ALTER TABLE settings ADD COLUMN security_login_protection BOOLEAN NOT NULL DEFAULT false;
