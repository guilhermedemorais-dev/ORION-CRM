# PRD: Módulo Estoque — Catálogo & Controle de Inventário
**ORION CRM | Versão 1.0 | Status: APPROVED FOR IMPLEMENTATION**

---

## 1. Visão Geral

O módulo Estoque é o catálogo interno da ORIN JOIAS. Centraliza o cadastro de produtos, controle de quantidade, alertas de reposição e histórico de movimentações auditável. É a fonte de verdade para o PDV, Pedidos e Produção.

**Princípio:** toda alteração de estoque é rastreada — nenhuma quantidade muda sem gerar um registro de movimentação com responsável e motivo.

---

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ TOPBAR: Catálogo > Estoque                                       │
├──────────────────────────────────────────────────────────────────┤
│ KPI ROW: [Ativos] [Crítico] [Sem Estoque] [Valor em Estoque]    │
├──────────────────────────────────────────────────────────────────┤
│ TOOLBAR: [Search] [Categoria ▾] [Status ▾] | [CSV] [+ Produto]  │
├──────────────────────────────────────────────────────────────────┤
│ TABLE: checkbox | foto+nome+código | SKU | cat | qtd | mín |    │
│        metal | peso | preço | status | atualizado               │
│ [paginação]                                                      │
└──────────────────────────────────────────────────────────────────┘

Ao clicar em linha → painel lateral desliza da direita (360px)
Ao clicar "+ Produto" → modal centralizado 720px
```

---

## 3. Functional Requirements

### FR-EST-001: KPI Cards

Quatro cards no topo, dados em tempo real via `GET /api/v1/products/stats`:

| Card | Métrica | Cor da barra superior |
|------|---------|----------------------|
| Produtos Ativos | COUNT onde `is_active = true` | Verde |
| Estoque Crítico | COUNT onde `stock_quantity <= min_stock AND stock_quantity > 0` | Âmbar |
| Sem Estoque | COUNT onde `stock_quantity = 0` | Vermelho |
| Valor em Estoque | SUM(`cost_price_cents * stock_quantity`) | Azul |

---

### FR-EST-002: Toolbar e Filtros

- **Search:** debounce 300ms → filtra por `name` ILIKE ou `internal_code` ILIKE
- **Categoria:** select → `GET /api/v1/products?category=Anel`
- **Status:** select → `in_stock` / `critical` / `out_of_stock`
- **Exportar CSV:** `GET /api/v1/products/export` → download de `estoque.csv`
- **Importar CSV:** upload de arquivo → `POST /api/v1/products/import` → upsert por `internal_code`
- **+ Adicionar Produto:** abre modal de cadastro

---

### FR-EST-003: Tabela de Produtos

**Colunas:**

| Coluna | Campo | Observação |
|--------|-------|------------|
| ☐ | checkbox | Seleção múltipla para ações em massa |
| Produto | `name` + `internal_code` + thumb | Foto em miniatura 38×38px |
| SKU / Código | `internal_code` | |
| Categoria | `category` | Badge azul |
| Estoque | `stock_quantity` | Colorido: verde OK, âmbar crítico, vermelho zero |
| Mínimo | `min_stock` | |
| Metal | `metal` | |
| Peso | `weight_grams` | Formatado em `g` |
| Preço | `price_cents` | Playfair Display, gold |
| Status | derivado de qtd vs mínimo | Badge |
| Atualizado | `updated_at` | Data curta |

**Comportamento:**
- Clique em linha → abre painel lateral de detalhes (não navega para nova página)
- Clique em checkbox → seleciona linha sem abrir painel
- Ordenação por coluna (clique no header) — lado servidor via `?sort=name&dir=asc`
- Paginação: 20 itens por página, `?page=1&limit=20`
- Linha selecionada: highlight dourado `rgba(200,169,122,0.08)` + borda esquerda gold

**Bulk actions (barra flutuante ao selecionar ≥1 item):**
- Exportar seleção → CSV apenas dos selecionados
- Ajustar estoque → modal de ajuste em lote (campo delta + motivo)
- Excluir → soft delete com confirmação (`is_active = false`)

---

### FR-EST-004: Painel Lateral de Detalhes

Slide-in da direita (360px), `transform: translateX` animado. Não bloqueia a tabela.

**Conteúdo:**
- Foto grande (aspect-ratio 1.6, fallback emoji)
- Todos os campos em pares label/valor
- Histórico recente: últimas 5 movimentações de estoque (data, tipo, delta, responsável)
- Botão **Editar** → abre modal de cadastro pré-preenchido
- Botão **Ajustar Estoque** → abre modal de ajuste

**API:** `GET /api/v1/products/:id` + `GET /api/v1/products/:id/movements?limit=5`

---

### FR-EST-005: Modal de Cadastro / Edição

Modal centralizado 720px, scroll interno, fecha com ESC ou clique no overlay.

**Seções:**

#### 5.1 Foto do Produto
- Área de drag-and-drop + clique para upload
- Preview imediato antes de salvar
- Aceita PNG, JPG, WEBP — máx. 5MB
- Upload via `POST /api/v1/products/:id/photo` (multer + magic bytes)
- Armazenado em `/uploads/products/{id}/`
- Thumbnail gerado automaticamente em 200×200px (sharp)

#### 5.2 Identificação
| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| Código Interno | text | ✅ | Único — validado via `GET /api/v1/products/check-code?code=X` |
| Nome do Produto | text | ✅ | Max 120 chars |
| Categoria | select | ✅ | Anel / Colar / Brinco / Pulseira / Outro |
| Coleção | text | ❌ | Livre |
| Descrição Interna | textarea | ❌ | Não exibida ao cliente |

#### 5.3 Precificação
| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| Preço de Venda | número | ✅ | Salvo em `price_cents` (INTEGER) |
| Custo de Aquisição | número | ❌ | Salvo em `cost_price_cents` |
| Margem Estimada | calculado | — | `(preço - custo) / preço * 100` — exibido em tempo real, não salvo |

#### 5.4 Estoque
| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| Estoque Inicial | número | ✅ | Cria movimentação `ENTRADA_INICIAL` |
| Estoque Mínimo | número | ❌ | Default 5 |
| Localização | text | ❌ | Ex: "Vitrine A3" |

- Preview de status atualiza em tempo real conforme usuário digita (sem salvar)

#### 5.5 Especificações
| Campo | Tipo |
|-------|------|
| Metal / Material | select (Ouro 18k / 14k / Prata 925 / Aço / Ouro Rosé / Outro) |
| Peso (g) | decimal |
| Tamanho / Medida | text |
| Pedras / Cravação | text |

#### 5.6 Flags
| Flag | Campo | Default |
|------|-------|---------|
| Produto ativo | `is_active` | true |
| Disponível no PDV | `pdv_enabled` | true |
| Requer produção | `requires_production` | false |

**Validação:**
- Código único verificado ao sair do campo (blur), não apenas no submit
- Preço de venda > 0
- Estoque inicial >= 0
- Formulário não submete com erros pendentes

**Submit:**
- Novo: `POST /api/v1/products`
- Edição: `PATCH /api/v1/products/:id`
- Foto: upload separado após criação/edição do produto base

---

### FR-EST-006: Modal de Ajuste de Estoque

Modal menor (480px). Usado tanto para ajuste individual quanto em lote.

**Campos:**
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Tipo | select (Entrada / Saída / Ajuste / Perda / Devolução) | ✅ |
| Quantidade | número (delta, não absoluto) | ✅ |
| Motivo | text | ✅ |
| Observação | textarea | ❌ |

**Regras:**
- Saída / Perda nunca podem resultar em `stock_quantity < 0`
- Ajuste pode definir valor absoluto (toggle "definir quantidade exata")
- Cria registro em `stock_movements` com `created_by = user_id`

**API:** `POST /api/v1/products/:id/movements`

---

## 4. Estrutura de Banco de Dados

### Tabela: `products` (revisão das colunas)

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS
  internal_code      VARCHAR(50)  UNIQUE NOT NULL,
  category           VARCHAR(30),
  collection         VARCHAR(100),
  description        TEXT,
  price_cents        INTEGER      NOT NULL DEFAULT 0,
  cost_price_cents   INTEGER      DEFAULT 0,
  min_stock          INTEGER      DEFAULT 5,
  stock_quantity     INTEGER      NOT NULL DEFAULT 0,
  location           VARCHAR(100),
  metal              VARCHAR(50),
  weight_grams       DECIMAL(8,2),
  size_info          VARCHAR(100),
  stones             VARCHAR(200),
  photo_url          VARCHAR(500),
  is_active          BOOLEAN      DEFAULT true,
  pdv_enabled        BOOLEAN      DEFAULT true,
  requires_production BOOLEAN     DEFAULT false,
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW();
```

### Tabela: `stock_movements` (nova migration)

```sql
CREATE TABLE stock_movements (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type         VARCHAR(30)  NOT NULL,
  -- ENTRADA_INICIAL | ENTRADA | SAIDA | AJUSTE | PERDA | DEVOLUCAO
  -- VENDA_PDV | VENDA_PEDIDO | PRODUCAO_CONSUMO
  delta        INTEGER      NOT NULL,  -- positivo = entrada, negativo = saída
  qty_before   INTEGER      NOT NULL,
  qty_after    INTEGER      NOT NULL,
  reason       VARCHAR(200) NOT NULL,
  notes        TEXT,
  order_id     UUID         REFERENCES orders(id),      -- se originou de venda
  created_by   UUID         NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at DESC);
```

---

## 5. API Endpoints

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/api/v1/products` | Lista paginada com filtros | Existe — revisar colunas |
| GET | `/api/v1/products/stats` | KPI cards | **NOVO** |
| GET | `/api/v1/products/:id` | Detalhe completo | Existe |
| POST | `/api/v1/products` | Criar produto | Existe — adicionar campos novos |
| PATCH | `/api/v1/products/:id` | Editar produto | Existe |
| DELETE | `/api/v1/products/:id` | Soft delete (`is_active = false`) | Existe |
| POST | `/api/v1/products/:id/photo` | Upload de foto (multer) | **NOVO** |
| GET | `/api/v1/products/check-code` | Validar unicidade de código | **NOVO** |
| GET | `/api/v1/products/export` | Export CSV | **NOVO** |
| POST | `/api/v1/products/import` | Import CSV (upsert) | **NOVO** |
| GET | `/api/v1/products/:id/movements` | Histórico de movimentações | **NOVO** |
| POST | `/api/v1/products/:id/movements` | Registrar ajuste manual | **NOVO** |

---

## 6. Regras de Negócio

- **Imutabilidade de movimentações:** `stock_movements` nunca é deletado — apenas inserido. Estoque atual é sempre `SUM(delta)` ou o campo `stock_quantity` (mantido sincronizado via trigger ou lógica de service).
- **`stock_quantity` como cache:** campo `products.stock_quantity` é atualizado atomicamente via `SELECT FOR UPDATE` sempre que uma movimentação é criada. Nunca atualizar diretamente sem criar movimentação.
- **Movimentações automáticas:** vendas no PDV (`VENDA_PDV`), pedidos aprovados (`VENDA_PEDIDO`) e consumo de produção (`PRODUCAO_CONSUMO`) geram movimentações automaticamente — o atendente nunca baixa estoque manualmente nesses casos.
- **Alerta de reposição:** ao salvar movimentação que resulte em `qty_after <= min_stock`, criar notificação in-app para usuários com role `ADMIN` ou `GERENTE`.
- **`pdv_enabled`:** produtos com `pdv_enabled = false` não aparecem no grid do PDV mesmo que `is_active = true`.
- **Import CSV:** upsert por `internal_code`. Colunas obrigatórias no CSV: `internal_code`, `name`, `price_cents`, `stock_quantity`. Demais opcionais. Erros de linha retornados em array — não abortar import inteiro por linha inválida.
- **Audit log:** todas as operações passam pelo middleware de auditoria existente.

---

## 7. Estados da UI

| Estado | Descrição |
|--------|-----------|
| Loading | Skeleton nas linhas da tabela durante fetch |
| Empty (sem produtos) | Ilustração + botão "+ Adicionar Produto" |
| Empty (sem resultados) | "Nenhum produto encontrado para este filtro" + link limpar filtros |
| Painel fechado | Tabela ocupa 100% da largura |
| Painel aberto | Tabela mantém largura — painel sobrepõe (fixed) |
| Modal aberto | Overlay blur, foco preso no modal (trap focus) |
| Bulk seleção | Barra flutuante animada no rodapé |
| Salvando | Botão "Cadastrar Produto" → spinner + desabilitado |
| Erro de validação | Borda vermelha + mensagem inline abaixo do campo |
| Sucesso cadastro | Toast "Produto cadastrado" + linha aparece no topo da tabela |

---

## 8. Definition of Done

- [ ] Migration `stock_movements` aplicada
- [ ] Colunas novas em `products` aplicadas
- [ ] `GET /products` retorna todas as colunas novas com paginação e filtros
- [ ] `GET /products/stats` retorna os 4 KPIs corretamente
- [ ] Cadastro cria movimentação `ENTRADA_INICIAL` automaticamente
- [ ] Upload de foto: magic bytes validados, thumbnail 200×200 gerado via sharp
- [ ] Código único validado no blur (sem submit falso)
- [ ] Margem calculada em tempo real no frontend (sem request)
- [ ] Preview de status de estoque atualiza em tempo real
- [ ] Painel lateral abre/fecha com animação suave
- [ ] ESC fecha modal e painel
- [ ] Bulk delete faz soft delete, não hard delete
- [ ] Export CSV inclui todos os campos visíveis na tabela
- [ ] Import CSV: erros por linha retornados sem abortar o lote
- [ ] Movimentações de venda PDV baixam estoque automaticamente
- [ ] Notificação gerada quando `qty_after <= min_stock`
- [ ] `tsc --noEmit` limpo
- [ ] Testado em 1280px e 1440px
