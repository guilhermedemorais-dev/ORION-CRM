# PRD: Módulo PDV — Ponto de Venda
**ORION CRM | Versão 1.1 | Status: APPROVED FOR IMPLEMENTATION**
**Changelog v1.1:** Adicionado FR-PDV-007 (Integração Maquininha — Mercado Pago Point e Cielo LIO), novos endpoints, configuração em Ajustes, estados de polling e DoD correspondente.

---

## 1. Visão Geral

O PDV é a interface de balcão para vendas presenciais. Cada atendente acessa com suas próprias credenciais — o carrinho é isolado por sessão. O objetivo é velocidade: produto encontrado em < 3 segundos, venda finalizada em < 1 minuto.

---

## 2. Layout

Split view fixo — não colapsável:

```
┌─────────────────────────────┬──────────────────────────────┐
│  BUSCA + PRODUTOS (flex-1)  │  CARRINHO + PAGAMENTO (400px)│
│                             │                              │
│  [F2] Buscar produto...     │  Carrinho                    │
│  [Todos][Anel][Colar][...]  │  ─────────────────────────── │
│                             │  Item 1      1x  R$ 1.800    │
│  ┌──────┐ ┌──────┐          │  Item 2      2x  R$ 960      │
│  │ foto │ │ foto │          │  ─────────────────────────── │
│  │nome  │ │nome  │          │  Subtotal        R$ 2.760    │
│  │preço │ │preço │          │  Desconto        R$ 0,00     │
│  │estq  │ │estq  │          │  TOTAL           R$ 2.760    │
│  └──────┘ └──────┘          │                              │
│                             │  [Forma de pagamento]        │
│                             │  [Finalizar Venda]           │
└─────────────────────────────┴──────────────────────────────┘
```

---

## 3. Functional Requirements

### FR-PDV-001: Busca de Produto
- Campo com debounce 300ms → `GET /api/v1/products?q=texto&inStock=true`
- Atalho `F2` foca no campo de busca (sem clicar)
- Retorna: foto, código, nome, preço formatado, estoque disponível
- Produtos com `stock_quantity = 0`: card visível mas desabilitado (badge "Sem estoque", botão + desabilitado)
- Produtos com `stock_quantity = 1`: badge "Último"
- Filtro por categoria: pills acima do grid (Todos / Anel / Colar / Brinco / Pulseira / Outro)
- Grid responsivo: 2 colunas padrão, 3 colunas se largura > 1400px

### FR-PDV-002: Carrinho
- Adicionar item: clica no card ou no botão `+`
- Se item já está no carrinho: incrementa quantidade
- Controles [-][+] por item — mínimo 1, máximo = estoque disponível
- Remover item: botão × ou reduzir para 0
- Desconto: campo de valor (R$) OU percentual (%) — mutuamente exclusivos, toggle entre os dois
  - Desconto não pode ser maior que o subtotal
  - Desconto aplicado sobre o subtotal total, não por item
- Carrinho persiste no estado local da sessão (não no banco — apenas na finalização)
- Carrinho vazio: estado empty com instrução "Busque um produto para começar"

### FR-PDV-003: Formas de Pagamento

| Forma | Comportamento |
|-------|--------------|
| Dinheiro | Exibe campo "Valor recebido" → calcula e exibe troco em tempo real |
| PIX | Exibe chave PIX configurada em Ajustes + botão copiar |
| Débito (maquininha) | Dispara cobrança direto na maquininha se integração configurada, senão modo manual |
| Crédito (maquininha) | Idem Débito + campo de parcelas (1–12) |
| Link MP | Gera link via `POST /api/v1/mercadopago/preference` → exibe link + botão copiar + QR Code |

Apenas uma forma de pagamento por venda. Seleção via cards clicáveis (não select/dropdown).

**Comportamento dos cards Débito / Crédito:**
- Se `pdv.terminal_provider = none` → modo manual: atendente digita na maquininha, clica "Confirmar pagamento" no PDV
- Se `pdv.terminal_provider = mercadopago` ou `cielo` → modo integrado: exibe estado "Aguardando maquininha..." com spinner, botão "Cancelar cobrança"

### FR-PDV-004: Finalização
**Pré-condições validadas antes de habilitar botão "Finalizar":**
- Carrinho com ao menos 1 item
- Forma de pagamento selecionada
- Se Dinheiro: valor recebido >= total
- Se Link MP: link gerado (não apenas selecionado)
- Se Débito/Crédito modo integrado: pagamento confirmado via webhook (`terminal_payment_id` presente)

**Ao confirmar:**
1. `POST /api/v1/orders` com `type=PRONTA_ENTREGA`, `status=RETIRADO` (PDV = retirada imediata)
2. Baixa de estoque atômica (`SELECT FOR UPDATE`)
3. Cria entrada financeira vinculada ao pedido
4. Exibe modal de sucesso com resumo da venda
5. Limpa carrinho

**Se Link MP:** status fica `AGUARDANDO_PAGAMENTO` — não fecha como `RETIRADO` até webhook confirmar.

### FR-PDV-005: Modal de Confirmação / Recibo
Exibido após finalização bem-sucedida:
- Número do pedido gerado (ex: `OR-20260312-0089`)
- Lista de itens + quantidades + valores
- Forma de pagamento + troco (se dinheiro)
- Total
- Botão "Imprimir" → `window.print()` com CSS de impressão
- Botão "Nova Venda" → limpa e fecha modal

### FR-PDV-006: Indicador de Conexão
- Badge no canto superior direito do painel
- Verde + "Online" em condição normal
- Vermelho + "Sem conexão" quando `navigator.onLine = false`
- Ao perder conexão: botão "Finalizar" desabilitado + tooltip "Sem conexão com o servidor"
- Verificação via `window.addEventListener('online'/'offline')`

### FR-PDV-007: Integração com Maquininha (Mercado Pago Point e Cielo LIO)

#### 7.1 Configuração (módulo Ajustes → aba PDV)

Campo `terminal_provider` com três opções:

| Valor | Label |
|-------|-------|
| `none` | Nenhuma (manual) |
| `mercadopago` | Mercado Pago Point |
| `cielo` | Cielo LIO |

Quando `mercadopago`:
- Campo: **Device ID** — ID do terminal obtido via `GET /v1/point/integration-api/devices` após autenticar com o Access Token da conta MP
- Campo: **Access Token MP** (já existe em Ajustes → Integrações; apenas referenciar, não duplicar)

Quando `cielo`:
- Campo: **Merchant ID** (CNPJ/CPF do lojista cadastrado na Cielo)
- Campo: **Merchant Key** (chave de acesso da API LIO)
- Campo: **Terminal ID** (serial do equipamento LIO)

Todos os campos salvos em `settings` (tabela singleton existente), colunas:
```
pdv_terminal_provider  VARCHAR(20)  DEFAULT 'none'
pdv_mp_device_id       VARCHAR(100)
pdv_cielo_merchant_id  VARCHAR(50)
pdv_cielo_merchant_key VARCHAR(100)
pdv_cielo_terminal_id  VARCHAR(50)
```

---

#### 7.2 Fluxo — Mercado Pago Point

```
1. Atendente seleciona Débito ou Crédito
2. PDV → POST /api/v1/pdv/terminal/charge
   body: { provider: 'mercadopago', amount_cents, payment_type, installments? }

3. API → POST https://api.mercadopago.com/v1/orders
   body: {
     type: 'point',
     processing_mode: 'automatic',
     transactions: { payments: [{ amount, payment_method: { type, installments } }] },
     external_reference: orion_session_id,
     point_of_interaction: { device_id: pdv_mp_device_id }
   }

4. Terminal toca + exibe valor automaticamente
5. Cliente passa o cartão

6. MP → Webhook POST /api/v1/webhooks/mercadopago
   action: 'order.updated', data.status: 'processed'

7. API atualiza sessão PDV com terminal_payment_id

8. Frontend polling GET /api/v1/pdv/terminal/status/:session_id
   → ao receber status=approved: habilita botão "Finalizar"
   → ao receber status=rejected: exibe toast + volta ao seletor de pagamento

9. Atendente clica "Finalizar" → cria pedido normalmente com payment_method=CARTAO_DEBITO/CREDITO
```

**Cancelamento:** botão "Cancelar cobrança" → `DELETE /api/v1/pdv/terminal/charge/:session_id` → API chama `DELETE /v1/orders/:order_id` no MP.

**Timeout:** se em 3 minutos não houver resposta do terminal → cancela automaticamente + toast "Tempo esgotado. Tente novamente."

---

#### 7.3 Fluxo — Cielo LIO

```
1. Atendente seleciona Débito ou Crédito
2. PDV → POST /api/v1/pdv/terminal/charge
   body: { provider: 'cielo', amount_cents, payment_type, installments? }

3. API → POST https://api.cielo.com.br/order-management/v1/orders
   headers: { Merchant-Id, Merchant-Key }
   body: {
     number: orion_session_id,
     reference: order_reference,
     status: 'DRAFT',
     items: [{ sku, unit_price, quantity, unit_of_measure: 'EACH' }],
     transaction: { amount, transaction_type: PAYMENT, payment_fields: { primary_product_name } }
   }

4. API → PUT  .../orders/:lio_order_id/transactions/:transaction_id  (envia p/ terminal)

5. Terminal LIO exibe o pedido + aguarda confirmação do cliente

6. Cielo → Webhook POST /api/v1/webhooks/cielo
   status: 'PAID'

7. Mesmo fluxo a partir do passo 7 do MP (polling → habilita Finalizar)
```

**Cancelamento:** `DELETE /api/v1/pdv/terminal/charge/:session_id` → API chama `PUT .../orders/:id/transactions/:tid/cancel` na Cielo.

---

#### 7.4 Tabela de sessão PDV (nova migration)

```sql
CREATE TABLE pdv_terminal_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_ref     VARCHAR(50) UNIQUE NOT NULL,  -- orion_session_id
  provider        VARCHAR(20) NOT NULL,          -- mercadopago | cielo
  external_id     VARCHAR(100),                  -- order_id do MP ou LIO
  amount_cents    INTEGER NOT NULL,
  payment_type    VARCHAR(20) NOT NULL,           -- DEBITO | CREDITO
  installments    SMALLINT DEFAULT 1,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected | canceled | timeout
  terminal_payment_id VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 7.5 Novos endpoints de API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/pdv/terminal/charge` | Inicia cobrança no terminal (MP ou Cielo) |
| GET | `/api/v1/pdv/terminal/status/:session_id` | Polling de status (frontend chama a cada 3s) |
| DELETE | `/api/v1/pdv/terminal/charge/:session_id` | Cancela cobrança pendente |
| POST | `/api/v1/webhooks/cielo` | Receptor de webhook da Cielo (novo) |
| GET | `/api/v1/pdv/terminal/devices` | Lista devices MP disponíveis na conta |

---

#### 7.6 UI — Estado "Aguardando Maquininha"

Quando cobrança disparada, o painel direito exibe:

```
┌────────────────────────────────────┐
│  💳  Aguardando maquininha...      │
│                                    │
│  R$ 1.890,00  ·  Débito            │
│                                    │
│  [████████████░░░░]  1:47          │
│  Barra de progresso (timeout 3min) │
│                                    │
│  [Cancelar cobrança]               │
└────────────────────────────────────┘
```

- Botão "Finalizar" permanece **desabilitado** até `status = approved`
- Ao `approved`: toast "Pagamento confirmado ✓" + botão "Finalizar" habilita
- Ao `rejected`: toast "Pagamento recusado" + volta ao seletor de forma de pagamento
- Ao `timeout`: toast "Tempo esgotado" + cancela sessão + volta ao seletor

---

## 4. API Endpoints

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/api/v1/products?q=&category=&inStock=` | Busca produtos para o PDV | Existe |
| POST | `/api/v1/orders` | Criar pedido PDV | Existe |
| POST | `/api/v1/mercadopago/preference` | Gerar link de pagamento | Existe |
| POST | `/api/v1/webhooks/mercadopago` | Webhook MP — adicionar handler `order.updated` | Existe (atualizar) |
| POST | `/api/v1/pdv/terminal/charge` | Inicia cobrança no terminal (MP ou Cielo) | **NOVO** |
| GET | `/api/v1/pdv/terminal/status/:session_id` | Polling de status da sessão (frontend a cada 3s) | **NOVO** |
| DELETE | `/api/v1/pdv/terminal/charge/:session_id` | Cancela cobrança pendente | **NOVO** |
| POST | `/api/v1/webhooks/cielo` | Receptor de webhook da Cielo LIO | **NOVO** |
| GET | `/api/v1/pdv/terminal/devices` | Lista devices MP disponíveis na conta | **NOVO** |

---

## 5. Regras de Negócio

- **Estoque**: nunca permitir finalização com estoque < quantidade no carrinho. Revalidar no momento do POST (não apenas na adição ao carrinho).
- **Comissão**: calculada automaticamente no backend sobre `final_amount_cents` do pedido, usando `commission_rate` do atendente logado.
- **Desconto**: salvo em `orders.discount_cents`. Não pode ser negativo.
- **PDV não gera produção**: pedido PDV nunca cria `production_orders` — é pronta entrega sempre.
- **Audit log**: gerado automaticamente pelo middleware de auditoria existente.
- **Sessão de terminal**: uma sessão ativa por vez por atendente. Não permitir nova cobrança se já existe sessão `pending`.
- **Idempotência**: `POST /pdv/terminal/charge` usa `session_ref` como chave de idempotência para evitar dupla cobrança em retry.
- **Webhook segurança**: webhook da Cielo validado por IP whitelist (range Cielo) + `Merchant-Id` header. Webhook do MP já usa HMAC existente.
- **Reconciliação**: `terminal_payment_id` salvo em `orders.external_payment_id` para conciliação com extrato MP/Cielo.
- **Modo manual fallback**: se chamada ao terminal falhar (5xx ou timeout de rede), exibe opção "Processar manualmente" — atendente digita na maquininha e confirma no PDV.

---

## 6. Estados da UI

| Estado | Descrição |
|--------|-----------|
| Idle | Carrinho vazio, search vazio, aguardando interação |
| Buscando | Loading skeleton nos cards durante fetch |
| Sem resultado | Empty state com sugestão de limpar filtros |
| Carrinho ativo | Botão finalizar habilitado quando válido |
| Processando | Loading no botão Finalizar, inputs desabilitados |
| Sucesso | Modal de recibo |
| Erro de estoque | Toast "Estoque insuficiente para [produto]" — remove item do carrinho |
| Offline | Badge vermelho, Finalizar desabilitado |
| **Terminal: aguardando** | Spinner + barra de timeout 3min + botão "Cancelar cobrança" |
| **Terminal: aprovado** | Toast verde "Pagamento confirmado ✓" → habilita Finalizar |
| **Terminal: recusado** | Toast vermelho "Pagamento recusado" → volta ao seletor de pagamento |
| **Terminal: timeout** | Toast âmbar "Tempo esgotado" → cancela sessão → volta ao seletor |
| **Terminal: erro de rede** | Toast + botão "Processar manualmente" (fallback manual) |

---

## 7. Definition of Done

**PDV base:**
- [ ] Busca retorna em < 200ms (p99)
- [ ] Desconto não pode exceder subtotal — validado client e server
- [ ] Estoque revalidado no POST — nunca negativo
- [ ] `tsc --noEmit` limpo
- [ ] Testado em 1280px e 1440px de largura
- [ ] Atalho F2 funciona
- [ ] Recibo imprimível via `window.print()`
- [ ] Indicador de conexão funciona ao desligar rede

**Integração maquininha:**
- [ ] Migration `pdv_terminal_sessions` aplicada
- [ ] Colunas `pdv_terminal_*` adicionadas na tabela `settings`
- [ ] Ajustes → aba PDV: campos de configuração salvam corretamente
- [ ] `POST /pdv/terminal/charge` retorna sessão e dispara cobrança no terminal
- [ ] Polling `/pdv/terminal/status` retorna status atualizado
- [ ] Webhook MP `order.updated` atualiza `pdv_terminal_sessions.status`
- [ ] Webhook Cielo valida IP + `Merchant-Id` antes de processar
- [ ] Cancelamento funciona nos dois providers
- [ ] Timeout de 3 min cancela sessão automaticamente (BullMQ job delayed)
- [ ] Fallback manual funciona quando terminal não responde
- [ ] `orders.external_payment_id` salvo após aprovação
- [ ] Idempotência: segunda chamada com mesmo `session_ref` não cria nova cobrança
