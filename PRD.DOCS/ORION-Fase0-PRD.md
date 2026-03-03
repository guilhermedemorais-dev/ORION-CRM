# PRD: ORION Fase 0 — Presença Digital + Automação WhatsApp

> **Entrega completa em 6 dias.**
> WhatsApp via Evolution API self-hosted — se número banir, troca o número e sobe de novo.
> Esta base conecta diretamente ao ORION CRM Fase 1 sem retrabalho.

| Campo | Valor |
|-------|-------|
| Versão | 1.0.0 |
| Status | APPROVED — INICIAR IMEDIATAMENTE |
| Prazo | 6 dias corridos |
| Target AI Agent | Codex CLI / Antigravity / Claude Code |
| Stack | Next.js 14 + Tailwind + Evolution API + n8n + Google Sheets + Docker + NGINX |
| Repositório | orion-fase0 |

## Cronograma de 6 Dias

| Dia | Entrega |
|-----|---------|
| 1 | VPS + Docker + NGINX + SSL + Evolution API rodando + instância WA conectada |
| 2 | Landing page completa (todas as seções, responsiva, conteúdo real do cliente) |
| 3 | Formulário captação → n8n → Google Sheets funcionando |
| 4 | WF-A bot triagem + WF-B handoff + WF-C notificação interna — todos testados |
| 5 | WF-D notificação de status de pedido + testes E2E completos |
| 6 | Ajustes finais, go-live, entrega ao cliente |

---

## 1. Escopo

### ✅ Entrega Dia 6

1. Landing page com catálogo de joias e captação de leads
2. Formulário → Google Sheets (dashboard do dono)
3. Bot WhatsApp: triagem de lead novo + resposta automática
4. Handoff bot → atendente humano
5. Notificação interna para atendente (novo lead)
6. Notificação de status de pedido pro cliente
7. Infraestrutura: VPS + NGINX + SSL + Docker Compose

### ❌ Fora de Escopo (Fase 1)

- CRM completo com auth, pedidos, estoque, financeiro
- Painel administrativo próprio
- App mobile

---

## 2. Arquitetura

```
[Visitante] ──HTTPS──► [NGINX :443]
                              │
               ┌──────────────▼──────────────┐
               │      Next.js :3000           │
               │  Landing Page + API Routes   │
               └──────────────┬──────────────┘
                              │ POST /api/lead
                              ▼
               ┌──────────────────────────────┐
               │       n8n :5678              │
               │  WF-A / WF-B / WF-C / WF-D  │
               └──────┬───────────────────────┘
                      │                │
          ┌───────────▼──┐    ┌────────▼────────────┐
          │ Google Sheets│    │ Evolution API :8080  │
          │ (dashboard)  │    │ (WhatsApp)           │
          └──────────────┘    └─────────────────────┘

Containers Docker por instância de cliente:
  nginx          :80/:443   (público)
  next-app       :3000      (interno)
  n8n            :5678      (interno — acesso só via SSH tunnel)
  evolution-api  :8080      (interno — acesso só via SSH tunnel)
```

**Regra de rede**: n8n e Evolution API NUNCA expostos pelo NGINX.
Acesso de configuração apenas via `ssh -L 5678:localhost:5678 user@IP`.

---

## 3. Evolution API — Especificação

### 3.1 Setup da Instância

A Evolution API é self-hosted via Docker. Cada cliente tem sua própria instância com um número de WhatsApp vinculado.

**Configuração inicial** (executar via SSH após deploy):
```bash
# Criar instância
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "orion-cliente", "qrcode": true}'

# Conectar via QR Code — retorna base64 da imagem do QR
curl http://localhost:8080/instance/qrcode/orion-cliente \
  -H "apikey: ${EVOLUTION_API_KEY}"
# Escanear QR com o número do cliente
```

### 3.2 Webhook da Evolution API → n8n

Configurar no startup para enviar eventos ao n8n:
```bash
curl -X POST http://localhost:8080/webhook/set/orion-cliente \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://n8n:5678/webhook/whatsapp-inbound",
    "webhook_by_events": false,
    "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
  }'
```

### 3.3 Envio de Mensagem (n8n → Evolution API)

```bash
# Texto simples
POST http://evolution-api:8080/message/sendText/orion-cliente
Headers: apikey: ${EVOLUTION_API_KEY}
Body: {
  "number": "5511999999999",
  "options": { "delay": 1000 },
  "textMessage": { "text": "Mensagem aqui" }
}

# Imagem
POST http://evolution-api:8080/message/sendMedia/orion-cliente
Body: {
  "number": "5511999999999",
  "mediatype": "image",
  "mimetype": "image/jpeg",
  "caption": "Legenda",
  "media": "https://url-da-imagem.jpg"
}
```

### 3.4 Troca de Número (quando banir)

```bash
# 1. Desconectar instância atual
curl -X DELETE http://localhost:8080/instance/logout/orion-cliente \
  -H "apikey: ${EVOLUTION_API_KEY}"

# 2. Reconectar com novo QR Code
curl http://localhost:8080/instance/qrcode/orion-cliente \
  -H "apikey: ${EVOLUTION_API_KEY}"
# Escanear com novo número — leva 2 minutos. Zero reconfiguração.
```

Tempo de troca de número banido: **~2 minutos**. Todos os workflows continuam funcionando.

---

## 4. n8n — Workflows

### WF-A: Lead Novo por Formulário → Sheets + WhatsApp Boas-Vindas

**Trigger**: Webhook POST `/webhook/novo-lead` (chamado pelo Next.js)

```
[Webhook] 
  → [Validar X-Webhook-Secret]
  → [Formatar dados do lead]
  → [Google Sheets: Append Row na aba "Leads"]
  → [Evolution API: Enviar mensagem de boas-vindas ao lead]
  → [Notificar atendente] (via WF-C)
```

**Mensagem de boas-vindas** (configurável em variável no n8n):
```
Olá, {{nome}}! 💍

Recebemos seu interesse em {{interesse}}.

Em breve um de nossos atendentes especializados entrará em contato com você.

Enquanto isso, fique à vontade para explorar nosso catálogo completo:
{{SITE_URL}}/catalogo
```

---

### WF-B: Mensagem Recebida → Bot de Triagem

**Trigger**: Webhook POST `/webhook/whatsapp-inbound` (Evolution API envia aqui)

```
[Webhook Evolution]
  → [Ignorar se: mensagem própria / grupo / status]
  → [Buscar lead no Sheets por número]
  → [SE não existe] → [Criar linha no Sheets como NOVO] → [Mensagem de boas-vindas]
  → [SE status = "EM ATENDIMENTO"] → [Ignorar — atendente está no controle]
  → [SE status = "NOVO" ou "BOT"]
      → [Contar mensagens do bot (campo no Sheets)]
      → [SE contador <= 3] → [Responder com menu de opções]
      → [SE contador > 3] → [WF-C: Handoff humano]
```

**Menu de opções** (enviado na primeira interação):
```
Olá! 👋 Bem-vinda à {{EMPRESA}}!

Como posso te ajudar hoje?

1️⃣ Ver catálogo de joias
2️⃣ Encomendar joia personalizada  
3️⃣ Informações sobre materiais
4️⃣ Falar com atendente

Responda com o número da opção 😊
```

**Respostas por opção**:
- `1` → link do catálogo no site + "Qual categoria te interessa? Anéis, colares, brincos ou pulseiras?"
- `2` → "Adoramos joias personalizadas! Me conta um pouco sobre o que você tem em mente 💍"
- `3` → mensagem com materiais disponíveis (configurável)
- `4` → aciona WF-C imediatamente

---

### WF-C: Handoff Bot → Atendente Humano

**Trigger**: Chamado pelo WF-B OU quando lead digita "atendente", "humano", "pessoa"

```
[Trigger interno ou keyword]
  → [Atualizar Sheets: Status = "AGUARDANDO ATENDENTE"]
  → [Mensagem para o lead]:
     "Um momento! Estou chamando um de nossos atendentes especializados.
      Você será atendida em instantes 💛"
  → [Notificar número do atendente via WhatsApp]:
     "🔔 NOVO LEAD AGUARDANDO ATENDIMENTO
      Nome: {{nome}}
      Interesse: {{interesse}}
      Última mensagem: {{ultima_mensagem}}
      
      Número: {{telefone}}
      Responder: https://wa.me/{{telefone}}"
  → [Atualizar Sheets: Status = "NOTIFICADO"]
```

**Lógica de qual atendente notificar**: variável `ATENDENTE_WHATSAPP` no n8n (número fixo por ora). Quando houver múltiplos atendentes no CRM Fase 1, essa lógica migra.

---

### WF-D: Notificação de Status de Pedido

**Trigger**: Google Sheets — detectar mudança na coluna "Status Pedido"

> **Nota técnica**: n8n não tem trigger nativo de mudança em célula do Sheets. Usar: Schedule Trigger a cada 5 minutos + comparar com valor anterior salvo em variável estática do workflow.

```
[Schedule: a cada 5 min]
  → [Ler aba "Pedidos" do Sheets]
  → [Para cada linha com Status Pedido diferente do último status notificado]
      → [Buscar template de mensagem para o novo status]
      → [SE template existe] → [Enviar WhatsApp pro cliente]
      → [Atualizar coluna "Último Status Notificado" no Sheets]
```

**Templates de mensagem por status** (configurar como variáveis no n8n):

| Status | Mensagem |
|--------|----------|
| EM_PRODUCAO | "💍 Sua peça entrou em produção! Prazo estimado: {{prazo}}. Avisaremos quando estiver pronta!" |
| PRONTO | "✨ Sua joia está pronta! Entre em contato para combinar a retirada ou entrega." |
| ENVIADO | "🚚 Seu pedido foi enviado! Código de rastreio: {{tracking}}" |
| AGUARDANDO_PAGAMENTO | "💳 Seu pedido está aguardando pagamento. Link: {{link_pagamento}}" |

**Estrutura da aba "Pedidos" no Sheets**:

| Coluna | Descrição |
|--------|-----------|
| ID Pedido | Identificador único |
| Nome Cliente | |
| WhatsApp | E.164 |
| Descrição | O que foi pedido |
| Status Pedido | Editado pelo atendente |
| Prazo | Data estimada |
| Tracking | Código de rastreio |
| Link Pagamento | URL do MP ou PIX |
| Último Status Notificado | Preenchido pelo n8n — não editar |
| Data Criação | |

---

## 5. Landing Page

### 5.1 Estrutura de Seções

```
/ (página única — scroll)
├── Navbar          — logo + links âncora + botão WhatsApp
├── #hero           — headline + CTA + imagem principal
├── #catalogo       — grid de produtos + filtros por categoria
├── #sobre          — história da joalheria (2-3 parágrafos)
├── #depoimentos    — 3 depoimentos (estático)
├── #contato        — formulário de captação
└── Footer          — dados da empresa + redes sociais
└── WhatsAppFloat   — botão flutuante sempre visível
```

### 5.2 Fonte de Dados — Produtos

Arquivo estático TypeScript. Zero banco de dados. Build SSG.

```typescript
// content/produtos.ts
export interface Produto {
  id: string                    // "anel-solitario-ouro-18k"
  nome: string
  categoria: 'anel' | 'colar' | 'brinco' | 'pulseira' | 'outro'
  material: string              // "Ouro 18k com diamante"
  preco: number | null          // null = "Sob consulta"
  imagens: string[]             // ["/joias/anel-01.jpg", "/joias/anel-01b.jpg"]
  descricao: string
  disponivel: boolean
  destaque: boolean
}

export const produtos: Produto[] = [
  // preencher com dados reais do cliente
]
```

### 5.3 Config Centralizado

```typescript
// content/config.ts
export const config = {
  empresa: {
    nome: "Nome da Joalheria",
    descricao: "Joias artesanais...",
    whatsapp: "5511999999999",
    instagram: "@joalheria",
    email: "contato@joalheria.com.br",
    mensagemWhatsApp: "Olá! Vi o catálogo e tenho interesse.",
  },
  hero: {
    headline: "Joias que contam sua história",
    subheadline: "Peças únicas em ouro, prata e pedras preciosas",
    ctaPrimario: "Ver Catálogo",
    ctaSecundario: "Falar no WhatsApp",
    imagemFundo: "/hero/background.jpg",
  },
  seo: {
    title: "Nome da Joalheria | Joias Exclusivas",
    description: "...",       // 150-160 chars
    ogImage: "/og-image.jpg", // 1200x630px
  },
  cores: {
    primaria: "#C8A97A",      // dourado
    escura: "#1A1A1A",
    clara: "#FAF7F2",
    mutada: "#6B6B6B",
  }
}
```

### 5.4 Formulário de Captação

**Campos**:
| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| nome | text | Sim | 2-100 chars, trim |
| whatsapp | tel | Sim | celular BR: `^\(?\d{2}\)?\s?9\d{4}-?\d{4}$` |
| interesse | select | Sim | anel, colar, brinco, pulseira, personalizado, outro |
| produto_id | hidden | Não | preenchido se veio de card de produto |
| mensagem | textarea | Não | máx 500 chars |

**UX**:
- Validação em tempo real (onChange), não apenas no submit
- Loading state: botão disabled + spinner durante POST
- Sucesso: mensagem inline — sem redirect
- Erro de rede: exibe link direto para WhatsApp como fallback

**API Route** (`app/api/lead/route.ts`):
```typescript
// POST /api/lead
// 1. Validar body (server-side — não confiar só no client)
// 2. Sanitizar: trim, strip HTML
// 3. Formatar whatsapp → E.164: remover (, ), -, espaços → "+55" + número
// 4. POST para N8N_WEBHOOK_URL com header X-Webhook-Secret
// 5. SE n8n falhar: logar erro internamente, retornar 200 mesmo assim
//    (nunca punir usuário por falha de infra)
// 6. Log: {timestamp, nome, hash_whatsapp, interesse} — NUNCA plaintext do WA
```

**Rate limit**: 5 req/min por IP — implementar com Map em memória + TTL (sem Redis na Fase 0).

---

## 6. Google Sheets — Estrutura

### Aba: Leads

| Col | Campo | Editável pelo cliente? |
|-----|-------|------------------------|
| A | Data/Hora | Não (n8n preenche) |
| B | Nome | Não |
| C | WhatsApp | Não |
| D | Interesse | Não |
| E | Produto Visto | Não |
| F | Mensagem | Não |
| G | Status | **SIM** — NOVO / EM ATENDIMENTO / CONVERTIDO / PERDIDO |
| H | Atendente | **SIM** |
| I | Observações | **SIM** |

**Formatação condicional** (configurar via Sheets):
- NOVO → fundo amarelo
- EM ATENDIMENTO → fundo azul claro
- CONVERTIDO → fundo verde
- PERDIDO → fundo cinza

### Aba: Pedidos

Ver estrutura na Seção 4 (WF-D).

### Aba: Instruções

Texto simples explicando como o dono usa cada aba. O agente de IA deve gerar esse conteúdo.

---

## 7. Infrastructure

### docker-compose.yml

```yaml
version: '3.9'

services:
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    networks:
      - app_network
    depends_on:
      - next-app

  next-app:
    build:
      context: ./app
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    networks:
      - app_network

  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - GENERIC_TIMEZONE=America/Sao_Paulo
      - WEBHOOK_URL=http://n8n:5678/
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - app_network
    # SEM ports expostos — acesso via SSH tunnel

  evolution-api:
    image: atendai/evolution-api:latest
    restart: unless-stopped
    environment:
      - SERVER_TYPE=http
      - SERVER_PORT=8080
      - API_KEY=${EVOLUTION_API_KEY}
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}
      - QRCODE_LIMIT=30
      - WEBHOOK_GLOBAL_ENABLED=false
    volumes:
      - evolution_data:/evolution/instances
    networks:
      - app_network
    # SEM ports expostos — acesso via SSH tunnel

volumes:
  n8n_data:
  evolution_data:

networks:
  app_network:
    driver: bridge
```

### .env.example

```bash
# Next.js
N8N_WEBHOOK_URL=http://n8n:5678/webhook/novo-lead
N8N_WEBHOOK_SECRET=                    # gerar: openssl rand -hex 32

# n8n
N8N_USER=admin
N8N_PASSWORD=                          # senha forte

# Evolution API
EVOLUTION_API_KEY=                     # gerar: openssl rand -hex 32
EVOLUTION_INSTANCE_NAME=orion-cliente

# Conteúdo público (prefixo NEXT_PUBLIC_ exposto no browser)
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999
NEXT_PUBLIC_SITE_URL=https://dominio.com.br

# n8n — configurar diretamente no painel do n8n (não no .env)
# Google Sheets ID, credenciais OAuth, número do atendente
```

### Estrutura de Pastas

```
orion-fase0/
├── app/                            # Next.js 14
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Landing (todas as seções)
│   │   └── api/lead/route.ts
│   ├── components/
│   │   ├── sections/
│   │   │   ├── Hero.tsx
│   │   │   ├── Catalogo.tsx
│   │   │   ├── Sobre.tsx
│   │   │   ├── Depoimentos.tsx
│   │   │   └── Contato.tsx
│   │   ├── ui/
│   │   │   ├── ProdutoCard.tsx
│   │   │   ├── FormularioLead.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── FiltrosCatalogo.tsx
│   │   │   └── WhatsAppFloat.tsx
│   │   └── layout/
│   │       ├── Navbar.tsx
│   │       └── Footer.tsx
│   ├── content/
│   │   ├── config.ts
│   │   └── produtos.ts
│   ├── public/joias/               # imagens do cliente
│   ├── Dockerfile
│   ├── next.config.ts
│   └── tailwind.config.ts
├── nginx/nginx.conf
├── n8n/workflows/
│   ├── WF-A-novo-lead.json
│   ├── WF-B-bot-triagem.json
│   ├── WF-C-handoff.json
│   └── WF-D-status-pedido.json
├── docker-compose.yml
├── .env.example
└── README-DEPLOY.md
```

---

## 8. Performance — Metas

| Métrica | Meta | Como garantir |
|---------|------|---------------|
| LCP | < 2.5s | `priority=true` no hero, next/image |
| PageSpeed Mobile | > 85 | SSG, imagens WebP, next/font |
| Bundle JS inicial | < 150KB gz | Zero libs pesadas de UI |

**Proibido usar**: MUI, Chakra, AntD, fontes de CDN externo, imagens sem width/height.

---

## 9. Checklist de Entrega — Dia 6

### Infraestrutura
- [ ] Site abre em HTTPS no domínio do cliente
- [ ] HTTP redireciona para HTTPS
- [ ] n8n não acessível pela internet (curl https://dominio:5678 deve falhar)
- [ ] Evolution API não acessível pela internet

### Landing Page
- [ ] Todas as seções visíveis e responsivas (mobile + desktop)
- [ ] Catálogo exibe todos os produtos com fotos e preços
- [ ] Filtros por categoria funcionam sem reload
- [ ] Formulário valida campos (client + server)
- [ ] Lead enviado aparece no Google Sheets em < 10s
- [ ] Mensagem de sucesso exibida após envio do formulário
- [ ] Fallback WhatsApp exibido se n8n falhar
- [ ] Botão WhatsApp flutuante funciona em mobile

### WhatsApp / Automações
- [ ] Número conectado na Evolution API (QR escaneado)
- [ ] WF-A: formulário → Sheets + mensagem boas-vindas no WA do lead
- [ ] WF-B: mensagem nova recebida → bot responde com menu
- [ ] WF-C: "4" ou "atendente" → notifica atendente no WhatsApp
- [ ] WF-D: mudança de status no Sheets → WA pro cliente

### Entrega ao Cliente
- [ ] Acesso ao Google Sheets configurado para o email do dono
- [ ] Vídeo de 5 min mostrando como usar o Sheets (como atualizar status, etc.)
- [ ] README-DEPLOY.md com instrução de troca de número (para quando banir)

---

## 🤖 Instruções para o Agente de IA

### Contexto
Landing page de joalheria + automação WhatsApp completa via Evolution API + n8n. Fase 0 do ORION CRM — tudo deve ser construído sem retrabalho quando o CRM Fase 1 conectar. Google Sheets é o "banco de dados" temporário desta fase.

### Ordem de Implementação (siga exatamente — não reordenar)

**Bloco 1 — Infra (Dia 1)**
1. `docker-compose.yml` completo com todos os 4 serviços
2. `nginx/nginx.conf` com SSL, proxy para next-app, sem expor n8n/evolution
3. `.env.example` com todas as variáveis documentadas
4. `README-DEPLOY.md` com passo a passo de deploy + seção "Trocar número banido"

**Bloco 2 — Landing Page (Dia 2)**
5. Scaffold Next.js 14: `npx create-next-app@latest` com TypeScript + Tailwind + App Router
6. `tailwind.config.ts` com cores da marca e fontes
7. `app/layout.tsx` com next/font (Playfair Display + Inter) + metadata SEO
8. `content/config.ts` com todos os textos configuráveis
9. `content/produtos.ts` com interface tipada + 3 produtos placeholder
10. Componentes de layout: `Navbar.tsx` + `Footer.tsx`
11. `Hero.tsx` — next/image com priority=true, CTA buttons
12. `Catalogo.tsx` + `ProdutoCard.tsx` + `FiltrosCatalogo.tsx` + `Modal.tsx`
13. `Sobre.tsx` + `Depoimentos.tsx` (estático)
14. `FormularioLead.tsx` com validação client-side completa
15. `Contato.tsx` integrando o formulário
16. `WhatsAppFloat.tsx` — botão flutuante mobile-friendly
17. `app/page.tsx` montando todas as seções

**Bloco 3 — API + n8n (Dia 3)**
18. `app/api/lead/route.ts` com validação server-side + rate limit + chamada n8n
19. `Dockerfile` do Next.js (multi-stage build — builder + runner)
20. JSON do WF-A (novo lead → Sheets + WA boas-vindas)

**Bloco 4 — Workflows WhatsApp (Dia 4-5)**
21. JSON do WF-B (bot triagem com menu, contador de mensagens)
22. JSON do WF-C (handoff → notifica atendente)
23. JSON do WF-D (monitor Sheets → WA status pedido)

### Mandatórios
- [ ] Zero TypeScript `any` — tipar tudo
- [ ] Todos os textos de conteúdo em `content/config.ts` ou `content/produtos.ts` — nada hardcoded em componentes
- [ ] Imagens: sempre next/image com width + height definidos (evita CLS)
- [ ] Formulário: validar no servidor mesmo que já validou no cliente
- [ ] Logs: nunca logar WhatsApp ou email em plaintext — apenas hash SHA-256
- [ ] n8n workflows exportados como JSON importável (não screenshots)
- [ ] Evolution API: sempre verificar se instância está conectada antes de enviar mensagem — tratar erro CONNECTION_CLOSED com mensagem clara no log

### Gotchas Específicos desta Stack
- **Evolution API cold start**: leva ~15s para subir — adicionar `healthcheck` no docker-compose e `depends_on` com condition `service_healthy`
- **n8n Schedule Trigger** do WF-D: usar `Interval` de 5 minutos, não Cron — mais simples e suficiente
- **Google Sheets OAuth no n8n**: exige configurar credencial manualmente no painel do n8n após deploy — documentar isso claramente no README com prints das telas
- **Evolution API webhook**: configurar APÓS QR Code escaneado — se configurar antes, a instância não existe ainda e o webhook falha silenciosamente
- **Next.js + Docker**: usar `output: 'standalone'` no `next.config.ts` para reduzir tamanho da imagem de ~1GB para ~200MB

### Definition of Done
Uma tarefa está completa APENAS quando:
- [ ] Funciona conforme spec acima
- [ ] Sem erros no console (browser e terminal)
- [ ] `docker compose up -d` funciona do zero em máquina limpa com apenas o `.env`
- [ ] Responsivo em 375px (iPhone SE) e 1440px (desktop)
- [ ] README-DEPLOY.md atualizado se mudou algo de infra
