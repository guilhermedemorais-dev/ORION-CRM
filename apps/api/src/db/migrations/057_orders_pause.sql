-- Migration 057: Pausar/Retomar pedidos
-- Pausa é uma sobreposição (não muda o status real). Quando retoma, volta de onde parou.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_orders_paused ON orders (paused_at) WHERE paused_at IS NOT NULL;
