-- Migration 009: Stock Movements + Financial Entries

CREATE TYPE stock_movement_type AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');
CREATE TYPE financial_entry_type AS ENUM ('ENTRADA', 'SAIDA');

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product ON stock_movements (product_id);
CREATE INDEX idx_stock_movements_created ON stock_movements (created_at DESC);

CREATE TABLE financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type financial_entry_type NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents != 0),
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  payment_id UUID REFERENCES payments(id),
  commission_user_id UUID REFERENCES users(id),
  commission_amount_cents INTEGER CHECK (commission_amount_cents >= 0),
  competence_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  receipt_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_entries_type ON financial_entries (type);
CREATE INDEX idx_financial_entries_date ON financial_entries (competence_date);
CREATE INDEX idx_financial_entries_order ON financial_entries (order_id);
CREATE INDEX idx_financial_entries_created ON financial_entries (created_at DESC);
