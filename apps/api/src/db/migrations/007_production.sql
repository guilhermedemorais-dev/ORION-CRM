-- Migration 007: Production Orders + Steps

CREATE TYPE production_status AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'REPROVADA');

CREATE TABLE production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES orders(id),
  assigned_to UUID REFERENCES users(id),
  current_step VARCHAR(100) NOT NULL DEFAULT 'SOLDA',
  status production_status NOT NULL DEFAULT 'PENDENTE',
  deadline TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_orders_order ON production_orders (order_id);
CREATE INDEX idx_production_orders_assigned ON production_orders (assigned_to);
CREATE INDEX idx_production_orders_status ON production_orders (status);

CREATE TABLE production_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id),
  step_name VARCHAR(100) NOT NULL,
  completed_by UUID NOT NULL REFERENCES users(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_images TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  approved BOOLEAN NOT NULL DEFAULT true,
  rejection_reason TEXT
);

CREATE INDEX idx_production_steps_order ON production_steps (production_order_id);
