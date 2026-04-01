-- Migration 042: Appointments table for the Agenda module
-- Stores all scheduled appointments (visits, consultations, returns, deliveries)

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'AGENDADO',
    source VARCHAR(50) NOT NULL DEFAULT 'CRM',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
    ai_context JSONB,
    cancelled_at TIMESTAMPTZ,
    cancel_reason VARCHAR(500),
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_starts_at ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON appointments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
