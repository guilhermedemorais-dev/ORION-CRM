-- Migration 060: Pausar/Retomar ordens de produção
-- Mesma lógica de pedidos (057): pausa é uma sobreposição (overlay) — não altera o
-- status real da ordem. Ao retomar, a ordem volta de onde parou.

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_production_orders_paused
  ON production_orders (paused_at) WHERE paused_at IS NOT NULL;
