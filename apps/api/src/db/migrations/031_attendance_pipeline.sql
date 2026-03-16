-- Migration 031: Attendance Pipeline Status + OS Columns
-- Adds pipeline state machine + fabrication specs directly to attendance_blocks
-- so that an attendance note IS the service order (unified record)

ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS pipeline_status  VARCHAR(20) DEFAULT 'ATENDIMENTO';
-- ATENDIMENTO | PROPOSTA | PEDIDO | OS | ENTREGA

ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS product_name    VARCHAR(200);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS due_date        DATE;
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS metal           VARCHAR(50);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS stone           VARCHAR(100);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS ring_size       VARCHAR(10);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS weight_grams    DECIMAL(6,2);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS finish          VARCHAR(50);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS engraving       VARCHAR(100);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS prong_count     INTEGER;
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS band_thickness  DECIMAL(4,2);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS tech_notes      TEXT;
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS designer_id     UUID REFERENCES users(id);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS jeweler_id      UUID REFERENCES users(id);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS deposit_cents   INTEGER DEFAULT 0;
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS total_cents     INTEGER DEFAULT 0;
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS so_number       VARCHAR(30);
ALTER TABLE attendance_blocks ADD COLUMN IF NOT EXISTS so_approved_at  TIMESTAMPTZ;

-- Unique constraint on so_number (sparse — only blocks that reached OS have it)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ab_so_number ON attendance_blocks(so_number) WHERE so_number IS NOT NULL;

-- Index for pipeline_status filter
CREATE INDEX IF NOT EXISTS idx_ab_pipeline ON attendance_blocks(customer_id, pipeline_status);
