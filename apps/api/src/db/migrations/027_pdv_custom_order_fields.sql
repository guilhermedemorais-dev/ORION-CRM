-- PRD-PDV-02/03: campos para pedido personalizado no PDV
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_custom_pickup        BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signal_amount_cents      INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount_cents   INTEGER  DEFAULT 0;
