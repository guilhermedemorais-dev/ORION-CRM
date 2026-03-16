-- Migration 026: Receipt display settings on settings singleton
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS receipt_thanks_message  TEXT DEFAULT 'Obrigado pela preferência ✦',
  ADD COLUMN IF NOT EXISTS receipt_exchange_policy TEXT DEFAULT 'Troca em até 30 dias com este recibo.',
  ADD COLUMN IF NOT EXISTS receipt_warranty        TEXT DEFAULT 'Garantia de 1 ano contra defeito de fabricação.';
