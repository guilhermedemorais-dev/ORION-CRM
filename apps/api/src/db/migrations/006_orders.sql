-- Migration 006: Orders + Order Items + Custom Order Details

CREATE TYPE order_type AS ENUM ('PRONTA_ENTREGA', 'PERSONALIZADO');
CREATE TYPE order_status AS ENUM (
  'RASCUNHO',
  'AGUARDANDO_PAGAMENTO',
  'PAGO',
  'SEPARANDO',
  'ENVIADO',
  'RETIRADO',
  'CANCELADO',
  'AGUARDANDO_APROVACAO_DESIGN',
  'APROVADO',
  'EM_PRODUCAO',
  'CONTROLE_QUALIDADE'
);
CREATE TYPE delivery_type AS ENUM ('RETIRADA', 'ENTREGA');

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(20) UNIQUE NOT NULL,
  type order_type NOT NULL,
  status order_status NOT NULL DEFAULT 'RASCUNHO',
  customer_id UUID NOT NULL REFERENCES customers(id),
  assigned_to UUID NOT NULL REFERENCES users(id),
  total_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_amount_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  final_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (final_amount_cents >= 0),
  notes TEXT,
  delivery_type delivery_type NOT NULL DEFAULT 'RETIRADA',
  delivery_address JSONB,
  estimated_delivery_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_number ON orders (order_number);
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_assigned ON orders (assigned_to);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created ON orders (created_at DESC);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  total_price_cents INTEGER NOT NULL GENERATED ALWAYS AS (quantity * unit_price_cents) STORED
);

CREATE INDEX idx_order_items_order ON order_items (order_id);

CREATE TABLE custom_order_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES orders(id),
  design_description TEXT NOT NULL,
  design_images TEXT[] NOT NULL DEFAULT '{}',
  metal_type VARCHAR(100) NOT NULL,
  metal_weight_grams DECIMAL(8,3),
  stones JSONB,
  approved_at TIMESTAMPTZ,
  approved_by_customer BOOLEAN NOT NULL DEFAULT false,
  production_deadline TIMESTAMPTZ
);
