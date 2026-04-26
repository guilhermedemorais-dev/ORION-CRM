# ORION CRM

**Sistema operacional completo para joalherias** — CRM, pedidos, produção, PDV, estoque, financeiro, analytics e assistente IA, entregue como instância Docker isolada por cliente.

---

## O Problema que o ORION Resolve

Uma joalheria sem sistema perde dinheiro todo dia: leads chegam pelo WhatsApp e somem sem registro, atendimentos não têm histórico, pedidos personalizados são controlados em planilha, a produção não tem rastreio, o PDV é feito na mão e o dono não tem visão financeira real.

**ORION centraliza toda a operação em um único sistema**, com audit log imutável de cada ação.

---

## Módulos

### CRM & Vendas
- **Pipeline de Leads** — Kanban visual com arrastar e soltar, filtros por etapa e atendente, importação/exportação CSV, view lista para mobile
- **Gestão de Clientes** — Painel completo com histórico de pedidos, ordens de serviço, propostas, LTV e atendimento
- **Inbox WhatsApp** — Conversas em tempo real via Meta Cloud API, atribuição, encerramento e fila BullMQ para zero perda de mensagem

### Pedidos & Produção
- **Pedidos de Pronta Entrega** — Carrinho, confirmação, baixa automática de estoque e link de pagamento Mercado Pago
- **Pedidos Personalizados** — Upload de design, aprovação, ordens de produção com etapas e fotos de evidência
- **Fila de Produção** — Dashboard por ourives, avanço por etapa, rastreio de prazo e alerta de vencimento

### Operação
- **PDV (Ponto de Venda)** — Busca de produtos com debounce, carrinho, finalização de venda, cálculo de troco e recibo imprimível
- **Controle de Estoque** — Entradas e saídas com controle de concorrência, alerta de estoque mínimo e histórico de movimentações
- **Módulo Financeiro** — Entradas automáticas via webhook de pagamento, despesas manuais, comprovantes, comissões por atendente e relatórios por período

### Inteligência & Automação
- **Assistente IA** — Painel lateral com acesso contextualizado por role via Function Calling — cada usuário vê apenas os dados do seu escopo
- **Agenda Completa** — 6 visualizações estilo Google Calendar (Mês, Semana, Dia, 4 Dias, Agenda, Programação) com CRUD completo e integração com pipeline
- **Automações** — Canvas visual com Activepieces self-hosted (MIT), sem custo de plataforma externa

### Dashboard & Analytics
- **Dashboard Adaptativo por Role** — Admin vê visão geral, produção vê fila, financeiro vê fluxo de caixa
- **KPIs em Tempo Real** — Faturamento mensal, novos leads, pedidos em aberto, ticket médio
- **Analytics de Vendas** — Gráficos de faturamento, top clientes, aniversariantes com link WhatsApp pré-preenchido

### Configurações & Segurança
- **RBAC Completo** — 5 roles (ROOT, ADMIN, GERENTE, VENDEDOR, PRODUCAO) com permissões validadas em cada endpoint da API
- **Segurança Avançada** — Timeout de sessão configurável, restrição de login por horário, rate limiting e proteção contra força bruta
- **Webhooks** — Geração de chaves para integrações externas com validação HMAC
- **Branding por Instância** — Logo, nome da empresa e cor primária configuráveis por cliente

### Suporte
- **Módulo de Suporte** — Registro de bugs e sugestões com upload de arquivos, linha do tempo visual do desenvolvimento e gráfico de atividade anual

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 App Router + TypeScript strict |
| UI | shadcn/ui + Tailwind CSS 3.x |
| Backend | Node.js 20 + Express + TypeScript strict |
| Banco | PostgreSQL 16 |
| Cache / Fila | Redis + BullMQ |
| Automações | Activepieces self-hosted (MIT) |
| WhatsApp | Meta Cloud API (Graph API v19.0+) |
| Pagamentos | Mercado Pago |
| Containerização | Docker + Docker Compose |
| Proxy | NGINX alpine + Traefik (produção) |
| CI/CD | GitHub Actions + GHCR |

---

## Modelo de Entrega

**SaaS com instância Docker isolada por cliente** — cada cliente recebe seu próprio container com banco, cache e fila independentes. Sem multi-tenancy no código, sem interferência entre clientes.

O operador gerencia clientes, contratos e provisionamento via webhooks a partir de um painel central separado.

---

## Deploy Rápido (Desenvolvimento)

```bash
# 1. Clone o repositório
git clone https://github.com/guilhermedemorais-dev/ORION-CRM.git
cd ORION-CRM

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# 3. Suba o stack completo
docker compose up -d --build
```

**Acessos locais:**
- `http://localhost` — CRM + Landing pública
- `http://localhost/api/v1` — API REST
- `http://localhost/health` — Health check

**Credenciais de teste:**
```
Email:  admin.inbox@orion.local
Senha:  SenhaForte123!
```

> Para deploy em produção (VPS, SSL, Traefik), consulte [README-DEPLOY.md](README-DEPLOY.md).

---

## Variáveis de Ambiente

```env
# Banco
POSTGRES_USER=orion
POSTGRES_PASSWORD=
POSTGRES_DB=orion_db

# Auth
JWT_SECRET=

# WhatsApp (Meta Cloud API)
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=

# Mercado Pago
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=

# IA
OPENAI_API_KEY=

# App
NODE_ENV=production
ORION_COOKIE_SECURE=true
```

Todas as variáveis estão documentadas em `.env.example`.

---

## Arquitetura

```
[Browser] ──HTTPS──► NGINX
                       │
              ┌────────┴────────┐
              │                 │
           Next.js          Express API
           :3000              :4000
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                PostgreSQL    Redis      BullMQ
                  :5432       :6379      Workers
                                │
                          Activepieces
                             :8080
```

**Segurança:**
- JWT com refresh token rotativo e detecção de roubo de token
- Middleware de suspensão de conta roda antes da autenticação
- Audit log imutável em toda operação de escrita (INSERT/UPDATE/DELETE)
- Webhooks WhatsApp e Mercado Pago validados por HMAC antes de qualquer processamento
- Valores monetários sempre em inteiros (centavos) — nunca float
- Secrets nunca aparecem em código, logs ou respostas de erro

---

## Histórico de Versões

Veja o changelog completo em [docs/releases.md](docs/releases.md) — também disponível no módulo Suporte do sistema (aba Linha do Tempo).

---

## Licença

Proprietário — todos os direitos reservados.  
Para licenciamento comercial, entre em contato.

---

*ORION CRM — desenvolvido para joalherias que levam a sério cada peça e cada cliente.*
