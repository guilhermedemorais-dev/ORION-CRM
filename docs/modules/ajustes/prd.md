# 19 — AJUSTES (Settings)
**ORION CRM · PRD v1.0**
Rota: `/ajustes` · Role: ADMIN only

---

## 1. Visão Geral

Painel de configuração global do tenant ORION. Controla identidade da empresa, usuários/permissões, integração WhatsApp (Evolution API), preferências de notificações e gestão do plano/assinatura.

**Estrutura:**
```
/ajustes
  ?tab=empresa         (default)
  ?tab=usuarios
  ?tab=whatsapp
  ?tab=notificacoes
  ?tab=integracoes
  ?tab=fiscal
```

Tab ativa persiste em query string para compartilhamento de link direto.

---

## 2. Tab — Empresa

### 2.1 Identidade Visual
- **Logo**: upload PNG/SVG/JPG até 2MB. Preview inline. Armazenado em S3/R2, referenciado em `orgs.logo_url`.
- **Nome da empresa**: string obrigatória, refletida no topbar do CRM e na loja
- **CNPJ**: com máscara `XX.XXX.XXX/XXXX-XX`, validado via algoritmo
- **Telefone**: com máscara `(XX) XXXXX-XXXX`
- **Endereço**: rua, número, complemento, bairro, cidade, UF, CEP (busca ViaCEP)

### 2.2 Identidade Visual
- **Cor primária**: color picker usando `react-colorful`. Preview em tempo real no topbar e botões da página.
- **Preview ao vivo**: mini-simulação da sidebar + KpiCard com a cor selecionada.
- Salvo em `orgs.primary_color`. Aplicado via CSS custom property `--color-primary`.

### 2.3 API
```
GET  /api/v1/org/settings        → dados da org
PUT  /api/v1/org/settings        → atualiza campos
POST /api/v1/org/logo            → multipart upload
```

---

## 3. Tab — Usuários

### 3.1 Lista de Usuários
DataTable com colunas:
```
Avatar | Nome | E-mail | Role | Comissão | Status | Criado em | Ações
```

**Role badge:**
- `ADMIN` → dourado
- `ATENDENTE` → cinza

**Status toggle inline**: Ativo / Inativo (PATCH imediato)

**Ações por linha:**
- Editar → sheet lateral com form
- Desativar/Reativar
- Remover (confirm dialog, só se não tiver leads ativos)

### 3.2 Convidar Usuário
Dialog modal com campos:
- E-mail (obrigatório)
- Nome completo
- Role: ADMIN | ATENDENTE (radio)
- % Comissão sobre faturamento (só ATENDENTE, 0–30%)

Ao confirmar: cria registro `users` com `status=pending`, envia e-mail de convite via n8n webhook.

### 3.3 Editar Usuário
Sheet lateral (não modal) com:
- Nome, e-mail (somente leitura se já aceito)
- Role, % comissão
- Reset de senha → envia link via e-mail

### 3.4 API
```
GET    /api/v1/users              → lista todos da org
POST   /api/v1/users/invite       → convida novo usuário
PATCH  /api/v1/users/:id          → edita role/comissão/status
DELETE /api/v1/users/:id          → remove (soft delete)
```

---

## 4. Tab — WhatsApp

### 4.1 Status da Instância
Exibe status da instância Evolution API em tempo real via polling a cada 10s:

| Estado | Visual |
|--------|--------|
| `connected` | Badge verde "Conectado" + número ativo |
| `connecting` | Badge amarelo "Conectando..." + spinner |
| `disconnected` | Badge vermelho "Desconectado" + QR Code |
| `qrcode` | QR Code grande para escanear |

### 4.2 Estado Conectado
- Número ativo: `(XX) XXXXX-XXXX`
- Nome da conta WhatsApp
- Data/hora da última conexão
- Botão "Desconectar" (confirm dialog)
- Botão "Trocar número" → exibe QR novo

### 4.3 Estado Desconectado
- QR Code renderizado (base64 da Evolution API) — atualiza automaticamente a cada 30s
- Instruções passo a passo: Abrir WA → Dispositivos vinculados → Escanear QR
- Após conexão bem-sucedida: transição automática para estado conectado

### 4.4 API
```
GET  /api/v1/whatsapp/status     → estado atual + número + qrcode (se aplicável)
POST /api/v1/whatsapp/disconnect → desconecta instância
POST /api/v1/whatsapp/reconnect  → gera novo QR
```

Polling frontend: `useQuery` com `refetchInterval: 10000` no estado não-conectado.

---

## 5. Tab — Notificações

Preferências por usuário (cada atendente configura as suas). ADMIN pode ver e editar de todos.

### 5.1 Toggles — Notificações via WhatsApp Pessoal

| Toggle | Descrição |
|--------|-----------|
| Novo lead atribuído | Avisa quando um lead é atribuído a você |
| Pedido pago | Avisa quando pedido muda para `status=paid` |
| Produção atrasada | Avisa quando prazo de produção passa |
| Lead inativo (3 dias) | Avisa leads sem atividade há 3 dias |
| Meta atingida | Celebração quando meta mensal é alcançada |

### 5.2 Configuração do Número Pessoal
Campo: número WA pessoal do atendente (diferente do número da empresa). Armazenado em `users.wa_personal`.

### 5.3 Horário de silêncio
- Toggle "Silenciar notificações"
- Faixa de horário: das XX:00 às XX:00 (não envia nada nesse intervalo)

### 5.4 API
```
GET   /api/v1/notifications/preferences     → preferências do usuário logado
PATCH /api/v1/notifications/preferences     → atualiza
```

---

## 6. Tab — Integrações

Central de conexões externas do ORION. Cada integração tem um card com status de conexão, credenciais mascaradas e ações.

### 6.1 Meta Cloud API (WhatsApp Business + Instagram DM)
- **Token de acesso permanente** (masked, botão revelar)
- **Phone Number ID** — ID do número registrado na Meta
- **WhatsApp Business Account ID (WABA ID)**
- **Verify Token** — para validação do webhook (gerado automaticamente pelo ORION)
- **Webhook URL** — somente leitura, copiar para configurar no Meta Developer Console
- Status: `Conectado` / `Token inválido` / `Não configurado`
- Link: "Como obter o token" → docs.orion.io

### 6.2 n8n
- **Base URL** da instância n8n (ex: `https://n8n.meudominio.com`)
- **API Key** (masked)
- Status da conexão: health check em tempo real via `GET /healthz`
- Lista dos workflows ativos que o ORION conhece (ex: AURORA SDR, Notificações, Checkout Webhook)
- Botão "Testar conexão"

### 6.3 Mercado Pago
- **Access Token produção** (masked)
- **Public Key produção** (masked)
- **Access Token sandbox** (masked, toggle para ativar modo teste)
- Status: `Conectado` / `Credencial inválida`
- **Webhook URL** — somente leitura para configurar no painel MP → Notificações IPN
- Botão "Testar credencial" — faz uma chamada `/v1/payment_methods` e exibe resultado

### 6.4 API
```
GET   /api/v1/integrations              → status de todas as integrações
PATCH /api/v1/integrations/meta         → salva credenciais Meta
PATCH /api/v1/integrations/n8n          → salva credenciais n8n
PATCH /api/v1/integrations/mercadopago  → salva credenciais MP
POST  /api/v1/integrations/n8n/test     → health check n8n
POST  /api/v1/integrations/mp/test      → valida credenciais MP
```

Credenciais armazenadas encriptadas em `org_integrations` com `pgcrypto`.

```sql
CREATE TABLE IF NOT EXISTS org_integrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES orgs(id),
  provider    VARCHAR(50),  -- meta | n8n | mercadopago
  credentials JSONB,        -- encriptado com pgcrypto
  status      VARCHAR(20),  -- connected | error | pending
  last_check  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, provider)
);
```

---

## 7. Tab — Fiscal *(Feature Futura)*

Placeholder para emissão de nota fiscal. Integração via **Bling ERP**, que por sua vez roteia para marketplaces (Mercado Livre, Shopee, TikTok Shop, Amazon).

### 7.1 Estado Atual
Banner "Em breve" com descrição do que virá. Não bloqueia nenhuma funcionalidade atual.

### 7.2 Integração Bling
- **API Key Bling** (campo desabilitado, placeholder)
- **CNPJ emissor** (puxado automaticamente de `orgs.cnpj`)
- **Regime tributário**: Simples Nacional / Lucro Presumido / Lucro Real (select desabilitado)

### 7.3 Marketplaces via Bling
O Bling conecta automaticamente e sincroniza catálogo/pedidos com:
| Marketplace | Status futuro |
|-------------|---------------|
| Mercado Livre | Via Bling → integração nativa |
| Shopee | Via Bling → integração nativa |
| TikTok Shop | Via Bling → integração nativa |
| Amazon | Via Bling → integração nativa |

### 7.4 Configurações Fiscais (futuro)
- CFOP padrão por tipo de produto
- NCM por categoria de produto
- Série da NF-e
- Ambiente: Homologação / Produção

### 7.5 API (futura)
```
GET   /api/v1/fiscal/config       → configurações fiscais
PATCH /api/v1/fiscal/config       → salva configurações
POST  /api/v1/fiscal/nfe/:pedidoId → emite NF-e para um pedido
GET   /api/v1/fiscal/nfe          → histórico de notas emitidas
```

---

## 8. Schema SQL

```sql
-- Campos adicionados em tabelas existentes
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS
  primary_color  VARCHAR(7)  DEFAULT '#BFA06A',
  cnpj           VARCHAR(18),
  phone          VARCHAR(20),
  address        JSONB;

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  wa_personal        VARCHAR(20),
  notification_prefs JSONB DEFAULT '{}',
  commission_pct     NUMERIC(5,2) DEFAULT 0,
  status             VARCHAR(20)  DEFAULT 'active'; -- active | inactive | pending

-- Tabela de billing (se não existir)
CREATE TABLE IF NOT EXISTS billing_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES orgs(id),
  plan_name    VARCHAR(50),
  cycle        VARCHAR(10), -- monthly | annual
  stripe_sub_id VARCHAR(100),
  status       VARCHAR(20), -- active | past_due | trialing | canceled
  trial_ends_at TIMESTAMPTZ,
  next_billing  TIMESTAMPTZ,
  amount        NUMERIC(10,2),
  limits        JSONB, -- { users: 5, leads: 500, messages: 1000, storage_mb: 500 }
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

---

## 8. Checkpoints Codex

### CP1 — Estrutura + Tab Empresa
- Rota `/ajustes` com layout de tabs via query string
- Tab Empresa: form completo + upload logo + color picker `react-colorful` + preview ao vivo
- Endpoints org settings

### CP2 — Tab Usuários
- DataTable shadcn com colunas definidas
- Dialog convidar usuário + validação
- Sheet editar usuário
- Toggle status inline
- Endpoints users

### CP3 — Tab WhatsApp + Notificações
- Polling status Evolution API com estados visuais
- QR Code renderizado com auto-refresh
- Tab Notificações com toggles + número pessoal + horário silêncio
- Endpoints whatsapp + notifications

### CP4 — Tab Integrações + Fiscal
- Cards de integração: Meta, n8n, Mercado Pago com status em tempo real
- Campos masked + botão revelar + webhook URLs somente leitura
- Health check n8n + validação MP
- Tab Fiscal: placeholder "Em breve" + campos desabilitados (Bling, regime tributário, marketplaces)
- Encriptação pgcrypto para credenciais
- Typecheck + lint geral

---

## 9. Dependências

```json
{ "react-colorful": "^5" }
```
Resto: shadcn/ui (Dialog, Sheet, DataTable), react-day-picker (já no stack), react-query para polling.
