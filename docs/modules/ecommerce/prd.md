# 17 — E-COMMERCE · LOJA PÚBLICA
**ORION CRM · PRD v2.0 · 08/03/2026**

---

## Visão Geral

Vitrine pública gerada a partir do estoque do ORION. Dois tipos de produto com fluxos de conversão distintos:

| Tipo | CTA | Fluxo |
|------|-----|-------|
| **Pronto** (`is_custom = false`) | "Comprar agora" | Checkout Mercado Pago (cartão/pix) |
| **Personalizado** (`is_custom = true`) | "Solicitar via WhatsApp" | AURORA (IA SDR no n8n) coleta, qualifica e cria lead no pipeline |

**Rota pública:** `/loja`
**Rota produto:** `/loja/produto/[slug]`
**Painel admin:** `/settings/loja`
**Acesso ao painel:** Mestre only

---

## Escopo v1 (deploy segunda)

```
✅ Página pública /loja sem login
✅ Banner hero editável
✅ Grade de produtos com paginação
✅ Página do produto /loja/produto/:slug
✅ Toggle is_custom por produto
✅ Fluxo PRONTO → Checkout Mercado Pago (cartão + pix)
✅ Fluxo PERSONALIZADO → WhatsApp → AURORA (n8n)
✅ Dois temas: Dark Luxury / Light Clean
✅ Logo, nome, slogan editáveis
✅ Categorias com CRUD e reorder
✅ Search + tray de filtros
✅ SEO básico por produto (meta + JSON-LD)
✅ Domínio customizado
✅ FAB WhatsApp fixo em toda a loja

❌ Page builder drag-and-drop → v2
❌ Wishlist / favoritos → v2
❌ Avaliações de produto → v2
❌ IA gerando descrições → v2
```

---

## Banco de Dados

```sql
-- CONFIGURAÇÃO DA LOJA
CREATE TABLE store_config (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL UNIQUE,
  is_active            BOOLEAN NOT NULL DEFAULT false,
  theme                VARCHAR(20) NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light')),
  accent_color         VARCHAR(7) NOT NULL DEFAULT '#BFA06A',
  logo_url             TEXT,
  store_name           VARCHAR(150),
  slogan               VARCHAR(255),
  custom_domain        VARCHAR(255),
  hero_image_url       TEXT,
  hero_title           VARCHAR(255),
  hero_subtitle        VARCHAR(255),
  hero_cta_label       VARCHAR(80) DEFAULT 'Ver Coleção',

  -- Fluxo personalizado → WA → AURORA
  wa_number            VARCHAR(30),
  wa_message_tpl       TEXT,
  pipeline_id          UUID REFERENCES pipelines(id),
  stage_id             UUID REFERENCES pipeline_stages(id),

  -- Fluxo pronto → Checkout
  mp_access_token      TEXT,
  mp_public_key        TEXT,
  checkout_success_url TEXT,
  checkout_failure_url TEXT,

  seo_title            VARCHAR(255),
  seo_description      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CATEGORIAS
CREATE TABLE store_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  description TEXT,
  image_url   TEXT,
  position    INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

-- PRODUTOS
CREATE TABLE store_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  stock_item_id   UUID REFERENCES stock_items(id) ON DELETE SET NULL,
  category_id     UUID REFERENCES store_categories(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL,
  description     TEXT,
  price           NUMERIC(12,2),
  price_from      NUMERIC(12,2),
  images          JSONB NOT NULL DEFAULT '[]',
  badge           VARCHAR(20) CHECK (badge IN ('novo','sale','hot', NULL)),
  is_custom       BOOLEAN NOT NULL DEFAULT false,   -- false=pronto, true=personalizado
  is_published    BOOLEAN NOT NULL DEFAULT false,
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  position        INT NOT NULL DEFAULT 0,
  wa_message_tpl  TEXT,                             -- override do template global (is_custom only)
  seo_title       VARCHAR(255),
  seo_description TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

-- PEDIDOS (gerados pelo checkout de produtos prontos)
CREATE TABLE store_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  product_id       UUID NOT NULL REFERENCES store_products(id),
  mp_preference_id TEXT,
  mp_payment_id    TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','refunded','cancelled')),
  customer_name    VARCHAR(255),
  customer_email   VARCHAR(255),
  customer_phone   VARCHAR(30),
  shipping_address JSONB,
  amount           NUMERIC(12,2) NOT NULL,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX idx_store_products_org  ON store_products(org_id, is_published);
CREATE INDEX idx_store_products_cat  ON store_products(category_id, position);
CREATE INDEX idx_store_orders_org    ON store_orders(org_id, created_at DESC);
CREATE INDEX idx_store_orders_mp     ON store_orders(mp_payment_id);
```

---

## Fluxos de Conversão

### Fluxo A — Produto Pronto (is_custom = false)

```
1. Cliente clica "Comprar agora"
2. Abre CheckoutForm na própria loja (dados + endereço)
3. Frontend POST /api/store/checkout/preference
4. API cria store_order (pending) + chama MP Preferences API
5. Redirect para hosted checkout do Mercado Pago
6. MP notifica via webhook POST /api/store/webhook/mercadopago
7. Se approved:
   - store_order.status = 'approved'
   - Cria pedido no módulo Pedidos do CRM
   - Decrementa stock_item.quantity
   - Dispara email de confirmação via n8n
   - Redireciona para checkout_success_url
```

### Fluxo B — Produto Personalizado (is_custom = true)

```
1. Cliente clica "Solicitar via WhatsApp"
2. Abre wa.me/[wa_number]?text=[template preenchido]
3. Mensagem chega no WA da joalheria
4. AURORA (n8n) intercepta:
   - Identifica origem da loja pelo padrão do template
   - Inicia qualificação: material, tamanho, prazo, orçamento
   - Cria lead no pipeline (store_config.pipeline_id / stage_id)
   - Cria conversa no Inbox vinculada ao lead
5. Atendente humano assume pelo Inbox após qualificação
```

### Template WA padrão

```
"Olá! Tenho interesse em uma peça personalizada.
Produto base: {{product_name}}
Link: {{product_url}}"
```

---

## CheckoutForm (produtos prontos)

```
Nome completo       [_________________________]
E-mail              [_________________________]
Telefone (WhatsApp) [_________________________]

── Endereço de entrega ──
CEP    [_____-___]  [Buscar]     ← autocomplete ViaCEP
Rua    [_________________________]
Nº [___]   Complemento [_________]
Bairro [__________]  Cidade [__________]  UF [__]

── Resumo ──
Anel Solitário Ouro Branco 18k
R$ 4.800,00

[ Ir para pagamento → ]
Powered by Mercado Pago
```

- CEP autocompleta via `https://viacep.com.br/ws/[cep]/json/`
- Validação client-side antes de criar preferência
- Botão desabilitado se campos inválidos

---

## API Endpoints

```
── PÚBLICOS ──
GET  /api/store/:orgSlug                      — config pública
GET  /api/store/:orgSlug/products             — lista (query: category, search, badge, is_custom, page)
GET  /api/store/:orgSlug/products/:slug       — detalhe
GET  /api/store/:orgSlug/categories           — categorias ativas
POST /api/store/checkout/preference           — cria preferência MP { productId, customer, address }
POST /api/store/webhook/mercadopago           — webhook MP (validar assinatura x-signature)

── ADMIN (Mestre only) ──
GET    /api/settings/store
PATCH  /api/settings/store
POST   /api/settings/store/logo
POST   /api/settings/store/hero-image

GET    /api/settings/store/categories
POST   /api/settings/store/categories
PATCH  /api/settings/store/categories/:id
DELETE /api/settings/store/categories/:id
PATCH  /api/settings/store/categories/reorder   — { ids: [] }

GET    /api/settings/store/products
POST   /api/settings/store/products
PATCH  /api/settings/store/products/:id
DELETE /api/settings/store/products/:id
PATCH  /api/settings/store/products/reorder     — { ids: [] }
POST   /api/settings/store/products/:id/images
DELETE /api/settings/store/products/:id/images/:idx

GET    /api/settings/store/orders
GET    /api/settings/store/orders/:id
```

---

## Componentes Frontend

```
/loja/
├── layout.tsx                      — tema + fontes + CSS vars
├── page.tsx
│   ├── HeroBanner.tsx
│   ├── CategoryTabs.tsx
│   ├── SearchBar.tsx + FilterTray.tsx   — inclui filtro Prontos/Personalizados
│   └── ProductGrid.tsx
│       └── ProductCard.tsx             — CTA dinâmico conforme is_custom
│
└── produto/[slug]/
    ├── page.tsx
    ├── ProductImages.tsx
    ├── ProductInfo.tsx
    ├── ProductCTA.tsx                  — renderiza botão correto
    ├── CheckoutForm.tsx                — form + ViaCEP (só se !is_custom)
    └── RelatedProducts.tsx

/settings/loja/
└── tabs/
    ├── IdentidadeTab.tsx
    ├── HeroTab.tsx
    ├── CategoriasTab.tsx
    ├── ProdutosTab.tsx + ProdutoForm.tsx   — inclui toggle is_custom
    ├── PagamentosTab.tsx               — tokens MP (masked) + URLs retorno
    ├── WhatsAppTab.tsx                 — número WA + template + pipeline alvo
    └── DominioTab.tsx
```

### ProductCTA — lógica

```tsx
{product.is_custom ? (
  <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(template)}`} target="_blank">
    💬 Solicitar via WhatsApp
  </a>
) : (
  <button onClick={openCheckoutForm} disabled={outOfStock}>
    🛒 {outOfStock ? 'Indisponível' : 'Comprar agora'}
  </button>
)}
```

---

## Regras de Negócio

```
ESTOQUE:
- is_custom=false + quantity=0 → botão "Indisponível" (desabilitado)
- is_custom=true + quantity=0  → botão WA continua ativo (feito sob encomenda)
- Após pagamento approved: decrementar stock_item.quantity em 1

WEBHOOK MP:
- Validar assinatura: header x-signature com MP_WEBHOOK_SECRET
- Idempotência: ignorar se mp_payment_id já existe em store_orders
- approved  → status='approved' + criar pedido CRM + decrementar estoque
- rejected  → status='rejected'
- refunded  → status='refunded' + restaurar estoque

AURORA — IDENTIFICAÇÃO:
- n8n filtra mensagens que batem com padrão do wa_message_tpl
- Campos coletados na qualificação viram lead_custom_fields no lead criado

DOMÍNIO CUSTOMIZADO:
- SELECT org_id FROM store_config WHERE custom_domain = req.hostname
- Job BullMQ verifica DNS a cada 1h
```

---

## SEO

```html
<title>{seo_title || product.name} · {store_name}</title>
<meta name="description" content="{seo_description || description[:160]}">
<meta property="og:image" content="{images[0]}">
<script type="application/ld+json">
{
  "@type": "Product",
  "name": "{name}",
  "image": "{images[0]}",
  "offers": {
    "@type": "Offer",
    "price": "{price}",
    "priceCurrency": "BRL",
    "availability": "{quantity > 0 ? 'InStock' : 'OutOfStock'}"
  }
}
</script>
```

---

## Dependências

```json
{ "mercadopago": "^2" }
```
ViaCEP via fetch nativo — `https://viacep.com.br/ws/[cep]/json/`

---

## Checkpoints

### CP1 — Banco + Config Admin
- [ ] Migrations: store_config, store_categories, store_products, store_orders
- [ ] GET/PATCH `/api/settings/store` + upload logo/hero
- [ ] CRUD categorias com reorder
- [ ] Seed: store_config criado ao criar nova org
⛔ STOP — typecheck + testar uploads

### CP2 — Gestão de Produtos
- [ ] CRUD produtos com upload até 8 imagens
- [ ] Toggle `is_published` + `is_custom` inline na lista
- [ ] Vinculação opcional a stock_item
- [ ] Sync indisponível: quantity=0 + !is_custom → bloquear CTA
⛔ STOP — criar produto pronto e personalizado, verificar CTAs diferentes na loja

### CP3 — Loja Pública (home)
- [ ] HeroBanner, CategoryTabs, SearchBar + FilterTray (inclui filtro is_custom)
- [ ] ProductGrid com CTA dinâmico por is_custom
- [ ] Tema dark/light + accent_color via CSS vars
- [ ] FAB WhatsApp fixo
⛔ STOP — mobile 320px + Lighthouse > 85

### CP4 — Página do Produto + Fluxo WA
- [ ] Galeria + info + specs + relacionados
- [ ] ProductCTA: is_custom → link wa.me com template preenchido
- [ ] SEO: generateMetadata + JSON-LD
⛔ STOP — testar link WA → mensagem chegando com template correto → AURORA responde

### CP5 — Checkout Mercado Pago
- [ ] CheckoutForm com autocomplete ViaCEP
- [ ] POST `/api/store/checkout/preference` → store_order + MP Preferences API
- [ ] Redirect para hosted checkout MP
- [ ] Webhook com validação de assinatura + idempotência
- [ ] approved → pedido no CRM + decrementa estoque + email via n8n
⛔ STOP — smoke test: comprar produto pronto → pagamento aprovado → pedido no CRM → estoque decrementado

### CP6 — Polimento + Domínio
- [ ] PagamentosTab: tokens MP masked + URLs de retorno
- [ ] Tab Domínio + job BullMQ de verificação DNS
- [ ] typecheck + lint + TODO cleanup
⛔ STOP — teste final ponta a ponta: produto personalizado → WA → AURORA → lead no pipeline
