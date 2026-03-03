-- Migration 003: Leads + Customers

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE lead_stage AS ENUM ('NOVO', 'QUALIFICADO', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'CONVERTIDO', 'PERDIDO');
CREATE TYPE lead_source AS ENUM ('WHATSAPP', 'BALCAO', 'INDICACAO', 'OUTRO');

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  cpf VARCHAR(14) UNIQUE,
  birth_date DATE,
  address JSONB,
  assigned_to UUID REFERENCES users(id),
  lifetime_value_cents BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_value_cents >= 0),
  preferences JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_whatsapp ON customers (whatsapp_number);
CREATE INDEX idx_customers_cpf ON customers (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_customers_assigned ON customers (assigned_to);
CREATE INDEX idx_customers_name_search ON customers USING GIN (name gin_trgm_ops);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  stage lead_stage NOT NULL DEFAULT 'NOVO',
  assigned_to UUID REFERENCES users(id),
  source lead_source NOT NULL DEFAULT 'WHATSAPP',
  notes TEXT,
  converted_customer_id UUID REFERENCES customers(id),
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_whatsapp ON leads (whatsapp_number);
CREATE INDEX idx_leads_stage ON leads (stage);
CREATE INDEX idx_leads_assigned ON leads (assigned_to);
CREATE INDEX idx_leads_last_interaction ON leads (last_interaction_at);
