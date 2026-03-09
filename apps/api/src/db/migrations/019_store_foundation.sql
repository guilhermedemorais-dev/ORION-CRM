-- Migration 019: Public Store / E-commerce foundation

CREATE TYPE store_theme AS ENUM ('dark', 'light');
CREATE TYPE store_badge AS ENUM ('novo', 'sale', 'hot');
CREATE TYPE store_order_status AS ENUM ('pending', 'approved', 'rejected', 'refunded', 'cancelled');

CREATE TABLE store_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT false,
  theme store_theme NOT NULL DEFAULT 'dark',
  accent_color VARCHAR(7) NOT NULL DEFAULT '#BFA06A',
  logo_url TEXT,
  store_name VARCHAR(150),
  slogan VARCHAR(255),
  custom_domain VARCHAR(255),
  hero_image_url TEXT,
  hero_title VARCHAR(255),
  hero_subtitle VARCHAR(255),
  hero_cta_label VARCHAR(80) NOT NULL DEFAULT 'Ver Colecao',
  wa_number VARCHAR(30),
  wa_message_tpl TEXT,
  pipeline_id UUID REFERENCES pipelines(id),
  stage_id UUID REFERENCES pipeline_stages(id),
  mp_access_token TEXT,
  mp_public_key TEXT,
  checkout_success_url TEXT,
  checkout_failure_url TEXT,
  seo_title VARCHAR(255),
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE store_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  category_id UUID REFERENCES store_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  price_cents INTEGER CHECK (price_cents > 0),
  price_from_cents INTEGER CHECK (price_from_cents > 0),
  images JSONB NOT NULL DEFAULT '[]',
  badge store_badge,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  wa_message_tpl TEXT,
  seo_title VARCHAR(255),
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_product_id UUID NOT NULL REFERENCES store_products(id),
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  status store_order_status NOT NULL DEFAULT 'pending',
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(30),
  shipping_address JSONB,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_store_categories_position ON store_categories (position);
CREATE INDEX idx_store_products_category ON store_products (category_id, position);
CREATE INDEX idx_store_products_published ON store_products (is_published, is_featured, position);
CREATE INDEX idx_store_products_stock_product ON store_products (stock_product_id);
CREATE INDEX idx_store_orders_created ON store_orders (created_at DESC);
CREATE INDEX idx_store_orders_status ON store_orders (status);
CREATE INDEX idx_store_orders_preference ON store_orders (mp_preference_id);
CREATE INDEX idx_store_orders_payment ON store_orders (mp_payment_id);

INSERT INTO store_config (
  is_active,
  theme,
  accent_color,
  logo_url,
  store_name,
  slogan,
  hero_title,
  hero_subtitle,
  hero_cta_label,
  wa_message_tpl,
  seo_title,
  seo_description
)
SELECT
  false,
  'dark',
  COALESCE(primary_color, '#BFA06A'),
  logo_url,
  COALESCE(company_name, 'Minha Joalheria'),
  'Vitrine pública integrada ao ORION CRM.',
  'Coleção ORION',
  'Peças prontas e atendimento personalizado no mesmo stack.',
  'Ver Coleção',
  'Olá! Tenho interesse em uma peça personalizada.%0AProduto base: {{product_name}}%0ALink: {{product_url}}',
  COALESCE(company_name, 'Minha Joalheria'),
  'Loja pública gerada a partir do catálogo operacional do ORION.'
FROM settings
WHERE NOT EXISTS (
  SELECT 1 FROM store_config
);
