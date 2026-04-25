-- Migration 044: System Tickets (Chamados)
-- Creates the table to track internal support tickets, bugs, and suggestions.

CREATE TYPE ticket_type AS ENUM ('BUG', 'SUGGESTION', 'OTHER');
CREATE TYPE ticket_status AS ENUM ('OPEN', 'EVALUATING', 'RESOLVED', 'REJECTED');

CREATE TABLE system_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type ticket_type NOT NULL DEFAULT 'BUG',
    status ticket_status NOT NULL DEFAULT 'OPEN',
    attachments JSONB DEFAULT '[]'::jsonb, -- Store an array of file URLs or paths
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_tickets_user_id ON system_tickets(user_id);
CREATE INDEX idx_system_tickets_status ON system_tickets(status);

