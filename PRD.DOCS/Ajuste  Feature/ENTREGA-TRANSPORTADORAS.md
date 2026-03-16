# ORION — Feature: Entregas com Transportadoras Configuráveis

> Módulo de despacho e rastreio em tempo real de joias de alto valor.
> Arquitetura: multi-carrier plugável, configurada pelo lojista no painel de Ajustes.
> Status: **PLANEJADO** | Prioridade: Alta

---

## 1. Visão Geral

O lojista cadastra as transportadoras que usa (ou passa a usar) diretamente no painel **Ajustes → Logística**. Cada transportadora tem suas próprias credenciais de API, modalidades e regras de seguro. O atendente, na hora de despachar, vê apenas as opções ativas e escolhe a que faz sentido para o pedido.

Nenhuma transportadora é fixa no código. Todas passam pelo mesmo adaptador genérico (`ICarrierAdapter`).

---

## 2. Regra de Negócio — Botão "+ Nova Entrega"

Habilitado **apenas quando**:
- `pipeline_status` do atendimento vinculado = `'ENTREGA'` (passou pela etapa de fabricação/OS)

Estados do botão:

| Condição | Estado | Tooltip |
|---|---|---|
| OS não concluída | Desabilitado (cinza) | "Disponível após conclusão da fabricação" |
| OS concluída + entrega já ativa | Desabilitado | "Entrega já em andamento" |
| OS concluída + sem entrega ativa | **Habilitado** (teal) | — |
| Nenhuma transportadora configurada | Desabilitado (amarelo) | "Configure uma transportadora em Ajustes → Logística" |

---

## 3. Configuração de Transportadoras — Ajustes → Logística

### 3.1 Tela de Configuração (`/ajustes/logistica`)

O lojista vê um painel com:

```
┌─────────────────────────────────────────────────────────┐
│  Logística & Transportadoras               + Adicionar   │
├─────────────────────────────────────────────────────────┤
│  [Logo] Jadlog           Ativo  ●    [Configurar] [···]  │
│  [Logo] Correios         Ativo  ●    [Configurar] [···]  │
│  [Logo] Loggi            Inativo ○   [Configurar] [···]  │
│  [Logo] Personalizada    Ativo  ●    [Configurar] [···]  │
└─────────────────────────────────────────────────────────┘
```

Ao clicar em **+ Adicionar**, o lojista escolhe:
- Uma transportadora pré-integrada (Jadlog, Correios, Loggi, TNT, FedEx, Rapiddo)
- **"Personalizada"** — insere manualmente: nome, URL base da API, headers de autenticação, mapeamento de campos

### 3.2 Campos por Transportadora

Cada registro na tabela `carriers_config`:

```
id               UUID PK
name             TEXT          — "Jadlog", "Minha Transportadora", etc.
slug             TEXT UNIQUE   — "jadlog", "correios", "custom_abc"
logo_url         TEXT          — upload ou URL
adapter_type     TEXT          — "jadlog" | "correios" | "loggi" | "tnt" | "generic_rest"
credentials      JSONB         — { api_key, contract_number, password, ... } — criptografado
base_url         TEXT          — sobrescreve URL padrão (útil para sandbox/prod)
default_service  TEXT          — "EXPRESSO", "ECONOMICO", etc.
insurance_pct    NUMERIC(5,2)  — % do valor declarado cobrado como seguro (ex: 0.5%)
min_insurance_cents INTEGER    — seguro mínimo em centavos
active           BOOLEAN       — aparece ou não no modal de despacho
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

### 3.3 Transportadoras Pré-Integradas (adapters prontos)

| Slug | Nome | Especialidade | Suporte webhook |
|---|---|---|---|
| `jadlog` | Jadlog | E-commerce nacional, seguro opcional | ✅ |
| `correios` | Correios SEDEX | Joias certificadas | ❌ (polling) |
| `loggi` | Loggi | Capitais, rastreio excelente | ✅ |
| `tnt` | TNT / FedEx | Alto valor B2B | ✅ |
| `rapiddo` | Rapiddo | Motoboy SP com seguro | ✅ |
| `generic_rest` | Personalizada | Qualquer API REST | Config manual |

---

## 4. Fluxo Completo de Despacho

```
Atendimento/OS → pipeline_status = 'ENTREGA'
        ↓
Botão "+ Nova Entrega" habilitado
        ↓
Modal abre — pré-preenchido com:
  • Dados do cliente (nome, CPF, endereço, telefone)
  • Pedido/OS (número, valor declarado)
  • Lista de transportadoras ATIVAS configuradas pelo lojista

Usuário escolhe:
  □ Modalidade: Retirada na loja | Envio
  □ Transportadora (somente as ativas)
  □ Serviço da transportadora (Expresso, Econômico...)
  □ Data/hora de coleta agendada
  □ Valor declarado (editável, pré-preenchido)
  □ Observações (ex: "embrulho presente", "frágil")
        ↓
Clique "Despachar"
  → POST /api/internal/deliveries
    → cria registro local
    → adapter.createShipment() → carrier API
    → recebe: tracking_code, label_url, estimated_delivery
        ↓
Aba Entrega exibe:
  • Badge da transportadora escolhida
  • Código de rastreio (clicável)
  • Botão "Baixar Etiqueta" (PDF)
  • Timeline com eventos reais
  • Estimativa de entrega
```

---

## 5. Arquitetura Backend

### 5.1 Adapter Pattern

```typescript
// src/services/carriers/ICarrierAdapter.ts
interface ShipmentInput {
  sender: { name: string; address: AddressData; phone: string }
  recipient: { name: string; cpf: string; address: AddressData; phone: string }
  package: { weight_grams: number; dimensions_cm: [number,number,number] }
  declared_value_cents: number
  service: string
  scheduled_pickup_at?: string
  notes?: string
}

interface ShipmentResult {
  carrier_order_id: string
  tracking_code: string
  label_url: string
  estimated_delivery_at: string
  freight_cents: number
  insurance_cents: number
}

interface TrackingEvent {
  timestamp: string
  status: string          // 'POSTED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED'
  description: string
  location: string | null
}

interface ICarrierAdapter {
  createShipment(input: ShipmentInput, credentials: Record<string, string>): Promise<ShipmentResult>
  getTracking(trackingCode: string, credentials: Record<string, string>): Promise<TrackingEvent[]>
  cancelShipment(carrierId: string, credentials: Record<string, string>): Promise<void>
  getQuote?(input: ShipmentInput, credentials: Record<string, string>): Promise<{ freight_cents: number; estimated_days: number }>
}
```

### 5.2 Registry de Adapters

```typescript
// src/services/carriers/registry.ts
const ADAPTERS: Record<string, ICarrierAdapter> = {
  jadlog:       new JadlogAdapter(),
  correios:     new CorreiosAdapter(),
  loggi:        new LoggiAdapter(),
  tnt:          new TntAdapter(),
  rapiddo:      new RapiddoAdapter(),
  generic_rest: new GenericRestAdapter(),  // usa base_url + headers do config
}

export function getAdapter(adapterType: string): ICarrierAdapter {
  return ADAPTERS[adapterType] ?? ADAPTERS['generic_rest']
}
```

### 5.3 Endpoints

```
# Configuração (admin only)
GET    /api/internal/settings/carriers             → lista carriers configuradas
POST   /api/internal/settings/carriers             → adiciona nova carrier
PUT    /api/internal/settings/carriers/:id         → edita config/credenciais
PATCH  /api/internal/settings/carriers/:id/toggle  → ativa/desativa
DELETE /api/internal/settings/carriers/:id         → remove

# Operação
GET    /api/internal/deliveries/carriers           → carriers ativas (para o modal)
POST   /api/internal/deliveries                    → cria + despacha
GET    /api/internal/deliveries/:id/tracking       → eventos de rastreio atualizados
DELETE /api/internal/deliveries/:id                → cancelar despacho (se ainda não postado)

# Webhook recebimento
POST   /webhooks/carriers/:slug                    → recebe push de status da transportadora
```

### 5.4 Worker BullMQ — `sync-tracking`

```
Dispara: a cada 2 horas
Escopo: todos os deliveries com status != 'ENTREGUE' e != 'CANCELADO'

Para cada delivery:
  1. Busca config da carrier + credentials
  2. adapter.getTracking(tracking_code, credentials)
  3. Compara com tracking_events atual
  4. Se houve novo evento:
     → Atualiza tracking_events + status na tabela
     → Envia WhatsApp ao cliente se status = 'OUT_FOR_DELIVERY' ou 'DELIVERED'
```

---

## 6. Migration SQL

```sql
-- Tabela de configuração de transportadoras
CREATE TABLE carriers_config (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  logo_url         TEXT,
  adapter_type     TEXT NOT NULL DEFAULT 'generic_rest',
  credentials      JSONB NOT NULL DEFAULT '{}',  -- armazenar criptografado (AES-256)
  base_url         TEXT,
  default_service  TEXT,
  insurance_pct    NUMERIC(5,2) DEFAULT 0,
  min_insurance_cents INTEGER DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colunas adicionais na tabela deliveries existente
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS carrier_config_id UUID REFERENCES carriers_config(id);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS carrier_order_id  TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS label_url         TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS estimated_at      TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS tracking_events   JSONB NOT NULL DEFAULT '[]';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS insurance_cents   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS freight_cents     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS declared_value_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS service           TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pickup_scheduled_at TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMPTZ;
```

---

## 7. Frontend — Componentes

### 7.1 `/ajustes/logistica` — Página de configuração

- **CarrierList**: lista cards das carriers configuradas com toggle ativo/inativo
- **AddCarrierModal**: step 1 = escolher adapter pré-integrado ou "Personalizada" / step 2 = preencher credenciais + configurações
- **CarrierConfigDrawer**: editar carrier existente, testar conexão ("Verificar credenciais")
- Credenciais mascaradas (tipo password) após salvas

### 7.2 `NovaEntregaModal.tsx` — Modal de despacho

- Busca `GET /api/internal/deliveries/carriers` para listar opções ativas
- Se nenhuma configurada → estado especial com link para `/ajustes/logistica`
- Pré-preenchimento automático com dados do cliente e pedido
- Select de transportadora com logo + nome
- Select de serviço dinâmico (varia por carrier)
- DateTimePicker para coleta agendada
- Campo valor declarado editável
- Resumo de custo (frete + seguro estimado) quando carrier suportar `getQuote`
- Botão "Despachar" → loading → exibe tracking_code gerado

### 7.3 `ClientEntregaTab.tsx` — melhorias

- Receber `hasEligibleDelivery: boolean` (OS concluída) + `hasActiveDelivery: boolean`
- Lógica de habilitação do botão no componente pai (`ClientPanelShell`)
- `DeliveryTimeline` expandida com eventos reais + badge da transportadora

---

## 8. Ordem de Implementação

```
1. Migration SQL (carriers_config + colunas em deliveries)
2. CRUD de carriers_config no backend (settings/carriers endpoints)
3. ICarrierAdapter interface + GenericRestAdapter (funciona para qualquer API configurada)
4. Página /ajustes/logistica no frontend
5. NovaEntregaModal + habilitação condicional do botão
6. Adapter específico da primeira transportadora escolhida pelo lojista
7. Worker BullMQ sync-tracking
8. Webhook endpoint para carriers que suportam push
9. Timeline com eventos reais + WhatsApp notification
```

---

## 9. Critérios de Aceite

- [ ] Lojista cadastra transportadora em Ajustes sem mexer em código
- [ ] Credenciais armazenadas criptografadas (AES-256), nunca retornadas na API
- [ ] Botão desabilitado com mensagem clara quando OS não concluída
- [ ] Modal abre pré-preenchido com dados do cliente/pedido
- [ ] Despacho cria shipment na carrier e retorna tracking_code
- [ ] Etiqueta PDF disponível para download
- [ ] Timeline exibe eventos reais sincronizados
- [ ] WhatsApp enviado ao cliente em "Saiu para entrega" e "Entregue"
- [ ] Cancelamento disponível se status = preparação (ainda não postado)
- [ ] Funciona com qualquer carrier via `generic_rest` mesmo sem adapter dedicado
