-- Migration 062: sincroniza o nome denormalizado products.category a partir de
-- products.category_id (fonte da verdade). Produtos cadastrados antes do fix da
-- categoria ficaram com category_id preenchido mas category (nome) nulo, o que
-- fazia a categoria "sumir" da lista/detalhe (que exibem o nome).
UPDATE products p
SET category = pc.name,
    updated_at = NOW()
FROM product_categories pc
WHERE p.category_id = pc.id
  AND p.category IS DISTINCT FROM pc.name;
