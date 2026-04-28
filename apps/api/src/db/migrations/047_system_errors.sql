-- Migration 047: System Errors (debug log)
-- Captures runtime errors from API, Worker and Web for the in-app debug tab.

CREATE TABLE IF NOT EXISTS system_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(20) NOT NULL,            -- 'api' | 'worker' | 'web'
    severity VARCHAR(20) NOT NULL DEFAULT 'error', -- 'error' | 'fatal' | 'warn'
    request_id VARCHAR(64),
    user_id UUID,
    method VARCHAR(10),
    path TEXT,
    status_code INTEGER,
    message TEXT NOT NULL,
    stack TEXT,
    context JSONB
);

CREATE INDEX IF NOT EXISTS idx_system_errors_occurred_at ON system_errors (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_source ON system_errors (source);
