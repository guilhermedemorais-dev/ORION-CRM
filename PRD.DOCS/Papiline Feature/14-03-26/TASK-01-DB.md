# TASK-01 — Banco de Dados (Migrations)

**Leia antes:** `apps/api/src/db/schema/` — identificar tabelas existentes antes de criar.
**Regra:** usar `ADD COLUMN IF NOT EXISTS` e `CREATE TABLE IF NOT EXISTS` em tudo.

---

## 1.1 Tabela `customers` — adicionar colunas

```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS
  -- identificação
  social_name        VARCHAR(100),
  rg                 VARCHAR(30),
  birth_date         DATE,
  gender             VARCHAR(20),
  -- contatos
  instagram          VARCHAR(100),
  phone_landline     VARCHAR(30),
  -- endereço
  zip_code           VARCHAR(10),
  city               VARCHAR(100),
  state              VARCHAR(2),
  address_full       VARCHAR(300),
  -- PJ
  cnpj               VARCHAR(20),
  company_name       VARCHAR(200),
  company_address    VARCHAR(300),
  -- preferências
  preferred_metal    VARCHAR(50),
  ring_size          VARCHAR(10),
  preferred_channel  VARCHAR(20) DEFAULT 'whatsapp',
  special_dates      TEXT,
  remarketing_notes  TEXT,
  -- origem
  origin             VARCHAR(20) DEFAULT 'MANUAL',
  -- MANUAL | PDV | WHATSAPP | LANDING | PIPELINE
  is_converted       BOOLEAN DEFAULT false,
  converted_at       TIMESTAMPTZ,
  ltv_cents          INTEGER DEFAULT 0,
  updated_at         TIMESTAMPTZ DEFAULT NOW();
```

---

## 1.2 Tabela `attendance_blocks` (nova)

```sql
CREATE TABLE IF NOT EXISTS attendance_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  lead_id       UUID REFERENCES leads(id),           -- se vier do pipeline
  title         VARCHAR(200) NOT NULL,
  block_type    VARCHAR(30) NOT NULL DEFAULT 'atendimento',
  -- atendimento | consulta_peca | ligacao | visita | email
  content       TEXT,                                 -- HTML/texto do editor
  status        VARCHAR(20) NOT NULL DEFAULT 'open',  -- open | done | ai
  priority      VARCHAR(20) DEFAULT 'normal',         -- normal | urgente
  channel       VARCHAR(20),                          -- whatsapp | presencial | email
  attachments   JSONB DEFAULT '[]',
  -- [{ name, url, type, size }]
  has_3d        BOOLEAN DEFAULT false,
  ai_render_id  UUID,                                 -- FK para ai_renders
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ab_customer ON attendance_blocks(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_lead ON attendance_blocks(lead_id);
```

---

## 1.3 Tabela `ai_renders` (nova)

```sql
CREATE TABLE IF NOT EXISTS ai_renders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_block_id UUID REFERENCES attendance_blocks(id),
  customer_id      UUID NOT NULL REFERENCES customers(id),
  -- parâmetros de geração
  piece_type       VARCHAR(50),
  metal            VARCHAR(50),
  stone            VARCHAR(100),
  band_style       VARCHAR(50),
  finish           VARCHAR(50),
  ring_size        VARCHAR(10),
  extra_details    TEXT,
  -- ajustes manuais
  band_thickness   DECIMAL(4,2),
  setting_height   DECIMAL(4,2),
  prong_count      INTEGER,
  band_profile     VARCHAR(30),
  -- resultado
  status           VARCHAR(20) DEFAULT 'pending',
  -- pending | generated | approved | rejected
  render_url_front VARCHAR(500),
  render_url_top   VARCHAR(500),
  render_url_side  VARCHAR(500),
  approved_at      TIMESTAMPTZ,
  approved_by      UUID REFERENCES users(id),
  -- nota: este é esboço visual — não arquivo de fabricação
  is_approved      BOOLEAN DEFAULT false,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 1.4 Tabela `service_orders` — verificar/criar

```sql
CREATE TABLE IF NOT EXISTS service_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     VARCHAR(30) NOT NULL UNIQUE,
  -- formato: OS-YYYYMMDD-XXXX
  customer_id      UUID NOT NULL REFERENCES customers(id),
  order_id         UUID REFERENCES orders(id),
  attendance_block_id UUID REFERENCES attendance_blocks(id),
  ai_render_id     UUID REFERENCES ai_renders(id),
  priority         VARCHAR(20) DEFAULT 'normal',    -- normal | alta | urgente
  -- produto
  product_name     VARCHAR(200) NOT NULL,
  -- specs de fabricação (vindas do bloco + ajuste manual)
  specs            JSONB NOT NULL DEFAULT '{}',
  -- { metal, stone, ring_size, band_thickness, setting_height,
  --   prong_count, band_profile, finish, engraving, weight_est,
  --   tolerance, notes }
  -- equipe
  designer_id      UUID REFERENCES users(id),       -- designer 3D
  jeweler_id       UUID REFERENCES users(id),       -- ourives
  -- datas
  due_date         DATE,
  -- etapas
  current_step     VARCHAR(50) DEFAULT 'design',
  -- design | 3d_modeling | material | casting | setting |
  -- polishing | qc | packaging | ready | delivered
  steps_done       TEXT[] DEFAULT '{}',
  -- arquivos do designer 3D
  file_stl_url     VARCHAR(500),
  file_3dm_url     VARCHAR(500),
  -- financeiro
  deposit_cents    INTEGER DEFAULT 0,
  total_cents      INTEGER DEFAULT 0,
  -- status geral
  status           VARCHAR(20) DEFAULT 'open',
  -- open | in_progress | ready | delivered | cancelled
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_so_customer ON service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_status   ON service_orders(status, due_date);
```

---

## 1.5 Tabela `deliveries` — verificar/criar

```sql
CREATE TABLE IF NOT EXISTS deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID REFERENCES orders(id),
  so_id         UUID REFERENCES service_orders(id),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  type          VARCHAR(20) DEFAULT 'store_pickup', -- store_pickup | shipping
  status        VARCHAR(30) DEFAULT 'pending',
  -- pending | in_production | ready | out_for_delivery | delivered | failed
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
```

---

## 1.6 Executar e confirmar

```bash
psql $DATABASE_URL -f migrations/20260314_painel_cliente.sql
psql $DATABASE_URL -c "\d customers" | grep -E "social_name|ring_size|origin"
psql $DATABASE_URL -c "\d attendance_blocks"
psql $DATABASE_URL -c "\d ai_renders"
psql $DATABASE_URL -c "\d service_orders"
```

## DoD
- [ ] Todas as tabelas criadas sem erro
- [ ] Índices criados
- [ ] `\d` confirma colunas esperadas
