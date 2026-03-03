-- Migration 005: Products (catalog/stock)

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  category VARCHAR(100),
  metal VARCHAR(50),
  weight_grams DECIMAL(8,3) CHECK (weight_grams > 0),
  images TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_code ON products (code);
CREATE INDEX idx_products_name_search ON products USING GIN (name gin_trgm_ops);
CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_stock_alert ON products (stock_quantity) WHERE stock_quantity <= minimum_stock AND is_active = true;
