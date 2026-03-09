-- Migration 020: Track CRM sync state for public store orders

ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_orders_customer
  ON store_orders (customer_id);

CREATE INDEX IF NOT EXISTS idx_store_orders_crm_order
  ON store_orders (crm_order_id);

CREATE INDEX IF NOT EXISTS idx_store_orders_crm_payment
  ON store_orders (crm_payment_id);
