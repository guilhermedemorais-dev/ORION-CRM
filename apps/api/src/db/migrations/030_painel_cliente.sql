-- Migration 030: Painel do Cliente — tabelas e colunas novas
-- Todas as operações usam IF NOT EXISTS / IF NOT EXISTS para ser idempotente

-- ── 1. Novos roles ────────────────────────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MESTRE';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DESIGNER_3D';

-- ── 2. Coluna custom_permissions em users ─────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{}';

-- ── 3. Colunas extras em customers ───────────────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS social_name        VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS rg                 VARCHAR(30);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender             VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS instagram          VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_landline     VARCHAR(30);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code           VARCHAR(10);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city               VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state              VARCHAR(2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_full       VARCHAR(300);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cnpj               VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name       VARCHAR(200);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_address    VARCHAR(300);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_metal    VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ring_size          VARCHAR(10);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_channel  VARCHAR(20) DEFAULT 'whatsapp';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS special_dates      TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS remarketing_notes  TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS origin             VARCHAR(20) DEFAULT 'MANUAL';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_converted       BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS converted_at       TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ltv_cents          INTEGER DEFAULT 0;

-- ── 4. Tabela attendance_blocks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  lead_id       UUID REFERENCES leads(id),
  title         VARCHAR(200) NOT NULL,
  block_type    VARCHAR(30) NOT NULL DEFAULT 'atendimento',
  content       TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'open',
  priority      VARCHAR(20) DEFAULT 'normal',
  channel       VARCHAR(20),
  attachments   JSONB DEFAULT '[]',
  has_3d        BOOLEAN DEFAULT false,
  ai_render_id  UUID,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ab_customer ON attendance_blocks(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_lead     ON attendance_blocks(lead_id);

-- ── 5. Tabela ai_renders ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_renders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_block_id   UUID REFERENCES attendance_blocks(id),
  customer_id           UUID NOT NULL REFERENCES customers(id),
  piece_type            VARCHAR(50),
  metal                 VARCHAR(50),
  stone                 VARCHAR(100),
  band_style            VARCHAR(50),
  finish                VARCHAR(50),
  ring_size             VARCHAR(10),
  extra_details         TEXT,
  band_thickness        DECIMAL(4,2),
  setting_height        DECIMAL(4,2),
  prong_count           INTEGER,
  band_profile          VARCHAR(30),
  status                VARCHAR(20) DEFAULT 'pending',
  render_url_front      VARCHAR(500),
  render_url_top        VARCHAR(500),
  render_url_side       VARCHAR(500),
  approved_at           TIMESTAMPTZ,
  approved_by           UUID REFERENCES users(id),
  is_approved           BOOLEAN DEFAULT false,
  created_by            UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Tabela service_orders ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          VARCHAR(30) NOT NULL UNIQUE,
  customer_id           UUID NOT NULL REFERENCES customers(id),
  order_id              UUID REFERENCES orders(id),
  attendance_block_id   UUID REFERENCES attendance_blocks(id),
  ai_render_id          UUID REFERENCES ai_renders(id),
  priority              VARCHAR(20) DEFAULT 'normal',
  product_name          VARCHAR(200) NOT NULL,
  specs                 JSONB NOT NULL DEFAULT '{}',
  designer_id           UUID REFERENCES users(id),
  jeweler_id            UUID REFERENCES users(id),
  due_date              DATE,
  current_step          VARCHAR(50) DEFAULT 'design',
  steps_done            TEXT[] DEFAULT '{}',
  file_stl_url          VARCHAR(500),
  file_3dm_url          VARCHAR(500),
  deposit_cents         INTEGER DEFAULT 0,
  total_cents           INTEGER DEFAULT 0,
  status                VARCHAR(20) DEFAULT 'open',
  created_by            UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_so_customer ON service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_status   ON service_orders(status, due_date);

-- ── 7. Tabela deliveries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID REFERENCES orders(id),
  so_id         UUID REFERENCES service_orders(id),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  type          VARCHAR(20) DEFAULT 'store_pickup',
  status        VARCHAR(30) DEFAULT 'pending',
  tracking_code VARCHAR(100),
  address       TEXT,
  scheduled_at  DATE,
  delivered_at  TIMESTAMPTZ,
  balance_cents INTEGER DEFAULT 0,
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
