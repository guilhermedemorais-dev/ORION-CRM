-- Migration 037: Add configurable session timeout
-- Allows admin to control how long sessions last before auto-logout

ALTER TABLE settings ADD COLUMN security_session_timeout_minutes INT NOT NULL DEFAULT 480;
