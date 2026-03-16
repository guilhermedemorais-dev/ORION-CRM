-- PRD-PDV-05: tabela de documentos fiscais (NF-e stub)
CREATE TABLE IF NOT EXISTS fiscal_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id),
  customer_id  UUID NOT NULL REFERENCES customers(id),
  type         VARCHAR(20) NOT NULL DEFAULT 'NFE',
  status       VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  -- PENDENTE | PROCESSANDO | EMITIDA | CANCELADA | ERRO
  nfe_key      VARCHAR(50),
  nfe_number   VARCHAR(20),
  pdf_url      VARCHAR(500),
  xml_url      VARCHAR(500),
  error_msg    TEXT,
  requested_by UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_order_id ON fiscal_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_customer_id ON fiscal_documents(customer_id);
