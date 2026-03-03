-- Migration 001: Settings (singleton)
-- Instance configuration — branding, plan, status

CREATE TYPE plan_type AS ENUM ('starter', 'professional', 'enterprise');
CREATE TYPE instance_status AS ENUM ('active', 'suspended', 'decommissioned');

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL DEFAULT 'Minha Joalheria',
  logo_url VARCHAR(500),
  favicon_url VARCHAR(500),
  primary_color VARCHAR(7) NOT NULL DEFAULT '#C8A97A' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color VARCHAR(7) CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  cnpj VARCHAR(18),
  phone VARCHAR(20),
  address JSONB,
  instagram VARCHAR(100),
  whatsapp_greeting TEXT,
  email_from_name VARCHAR(255),
  plan plan_type NOT NULL DEFAULT 'starter',
  status instance_status NOT NULL DEFAULT 'active',
  operator_instance_id VARCHAR(255) UNIQUE,
  provisioned_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Singleton: always exactly 1 row
INSERT INTO settings (company_name, primary_color) VALUES ('Minha Joalheria', '#C8A97A');
