-- PRD Estoque: novas colunas em products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS collection          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cost_price_cents    INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS size_info           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS stones              VARCHAR(200),
  ADD COLUMN IF NOT EXISTS photo_url           VARCHAR(500),
  ADD COLUMN IF NOT EXISTS pdv_enabled         BOOLEAN  DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_production BOOLEAN  DEFAULT false;

-- Novos tipos de movimentação
ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'ENTRADA_INICIAL';
ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'PERDA';
ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'DEVOLUCAO';
ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'VENDA_PDV';
ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'VENDA_PEDIDO';
ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'PRODUCAO_CONSUMO';

-- Notas em movimentações
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS notes TEXT;
