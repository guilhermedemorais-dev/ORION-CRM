# PRD Técnico Corrigido | Inbox WhatsApp V2 do CRM

## 1. Resumo executivo

Criar um novo módulo **Inbox WhatsApp V2** do CRM para se tornar um produto final de atendimento via **WhatsApp**, nativo, robusto, escalável e profundamente integrado ao domínio comercial do CRM.

Decisão arquitetural atual: **não fazer uma refatoração agressiva em cima do Inbox atual**. O Inbox existente deve continuar funcionando e receber apenas correções pontuais de UI, bugs e integrações necessárias para manter a operação enquanto o Inbox V2 é desenvolvido em paralelo.

O Inbox V2 deve nascer como módulo novo, com backend e frontend próprios, reaproveitando os vínculos de domínio do CRM e permitindo migração segura depois da homologação.

Rotas previstas:

- frontend: `/inbox-v2`;
- backend: `/api/v1/inbox-v2`;
- webhooks WhatsApp V2: `/api/v1/webhooks/whatsapp-v2` ou rota equivalente definida na fase de arquitetura.

Este projeto não é um MVP. É uma versão final inicial para operação real, com backend validado antes da refatoração visual, preservando todas as conexões existentes com:

- organização/empresa;
- usuários e permissões;
- clientes/contatos;
- leads;
- pipeline;
- etapas do funil;
- histórico comercial;
- tela atual do Inbox enquanto o V2 não estiver homologado.

O Inbox atual não deve ser removido durante o desenvolvimento. Ele funcionará como fallback operacional até o Inbox V2 passar por testes backend, testes de UI, homologação com WhatsApp real e aprovação humana.

O ChatbotX será usado somente como referência conceitual de produto e arquitetura, especialmente na separação entre inbox, integrações, worker, realtime e mensageria. Referência oficial: [https://github.com/ChatbotXIO/ChatbotX.git](https://github.com/ChatbotXIO/ChatbotX.git). Nenhum código, estrutura interna proprietária, nomenclatura sensível ou implementação licenciada será copiada.

---

## 2. Objetivo do produto

Construir o Inbox WhatsApp V2 do CRM como uma central profissional de atendimento WhatsApp com:

- recebimento de mensagens reais;
- envio de mensagens reais;
- múltiplos atendentes;
- fila de atendimento;
- atribuição e transferência;
- SLA avançado;
- analytics operacional;
- histórico completo;
- vínculo com cliente;
- vínculo com lead;
- vínculo com pipeline;
- notas internas;
- tags;
- status de conversa;
- status de mensagem;
- realtime;
- filas assíncronas;
- logs técnicos;
- auditoria;
- segurança;
- base preparada para IA e automações futuras.

O Inbox V2 deve funcionar como parte nativa do CRM, não como iframe, microproduto separado ou app externo.

O Inbox atual fica fora do escopo de evolução estrutural. Nele serão feitos apenas ajustes necessários para:

- corrigir bugs críticos de UI;
- manter integrações atuais operacionais;
- evitar bloqueio de atendimento antes da entrada do V2;
- preservar fallback em caso de incidente durante a implantação do V2.

---

## 3. Resultado esperado

Ao final do projeto, o CRM deve permitir que a equipe comercial e operacional atenda clientes pelo WhatsApp diretamente no **Inbox V2**, sem perder contexto comercial.

Cada conversa deve estar conectada ao cliente certo, ao lead certo quando existir, à etapa correta do pipeline e ao atendente responsável.

O sistema deve permitir medir:

- volume de conversas;
- tempo de primeira resposta;
- tempo de resolução;
- conversas por atendente;
- SLA cumprido;
- SLA violado;
- gargalos por etapa do pipeline;
- carga operacional da equipe.

---

## 4. Critérios de sucesso

O projeto será considerado bem-sucedido quando:

- o backend receber mensagens reais do WhatsApp;
- o backend enviar mensagens reais pelo WhatsApp;
- webhooks duplicados não criarem mensagens duplicadas;
- mensagens forem persistidas corretamente;
- conversas forem ligadas aos contatos corretos;
- contatos não forem duplicados indevidamente;
- leads e pipelines continuarem conectados;
- multiatendimento funcionar sem conflito;
- SLA for calculado corretamente;
- analytics retornarem métricas confiáveis;
- realtime atualizar lista e conversa ativa;
- logs registrarem falhas e eventos críticos;
- permissões impedirem acesso indevido;
- frontend atual consumir o novo backend sem quebrar a UX;
- Inbox atual permanecer disponível como fallback até a virada controlada para o V2;
- backend estiver testado antes da refatoração visual final.

---

## 5. Princípios de arquitetura

1. O CRM é a fonte de verdade para cliente, lead, pipeline, usuário e organização.
2. O Inbox é fonte de verdade apenas para conversa, mensagem, atendimento, SLA, tags, notas, logs e analytics do atendimento.
3. Backend vem antes do frontend.
4. Webhook deve responder rápido e processar pesado via fila.
5. Todo evento externo deve ser idempotente.
6. Toda conversa deve ser isolada por organização.
7. Toda rota deve validar autenticação e autorização.
8. Toda decisão de domínio deve estar expressa em serviços claros.
9. Toda integração externa deve passar por adapter próprio.
10. Nenhuma regra crítica deve existir apenas no frontend.
11. Analytics deve ser calculado no backend.
12. Realtime notifica estado, mas o banco continua sendo a fonte de verdade.
13. A tela atual deve ser preservada como fallback operacional, não como base obrigatória da nova UI.
14. O Inbox V2 deve ser desenvolvido em paralelo e só substituir o Inbox atual após homologação.

---

## 6. Escopo final

### 6.1 Incluído

- Inbox WhatsApp nativo dentro do CRM.
- Canal WhatsApp configurável por organização.
- Webhook de verificação do WhatsApp.
- Webhook de recebimento de mensagens.
- Recebimento de status de mensagens.
- Envio de mensagens de texto.
- Estrutura preparada para anexos.
- Conversas em tempo real.
- Lista de conversas.
- Busca de conversas.
- Filtros por status.
- Filtros por atendente.
- Filtros por não lidas.
- Filtros por SLA.
- Filtros por etapa do pipeline.
- Vínculo automático com contato.
- Vínculo com lead.
- Vínculo com pipeline.
- Criação automática de contato mínimo.
- Prevenção de duplicidade de contato.
- Multiatendimento avançado.
- Fila de conversas livres.
- Atribuição manual.
- Autoatribuição opcional.
- Transferência de conversa.
- Encerramento de conversa.
- Reabertura automática.
- Notas internas.
- Tags.
- SLA avançado.
- Analytics operacional.
- Logs de webhook.
- Logs de envio.
- Logs de erro.
- Permissões por perfil.
- Testes backend antes do frontend.
- Frontend adaptado ao design atual do CRM.

### 6.2 Fora desta fase

- Instagram.
- Messenger.
- Telegram.
- Email.
- Webchat.
- Campanhas em massa.
- Chatbot visual.
- IA respondendo automaticamente.
- MCP.
- App mobile separado.

A arquitetura deve permitir expansão futura, mas a entrega atual deve ser profunda em WhatsApp. Omnichannel raso agora seria só uma coleção elegante de problemas, esse buffet livre do desastre.

---

## 7. Diagnóstico obrigatório do Inbox atual

Antes de alterar código de produto, o agente/desenvolvedor deve gerar o arquivo:

```txt
INBOX_CURRENT_STATE.md
```

### 7.1 O diagnóstico deve mapear

- tabelas atuais relacionadas ao Inbox;
- tabelas atuais de clientes/contatos;
- tabelas atuais de leads;
- tabelas atuais de pipeline;
- tabelas atuais de usuários e permissões;
- endpoints atuais do Inbox;
- hooks/services frontend atuais;
- componentes React atuais;
- fluxo atual de busca de conversas;
- fluxo atual de busca de mensagens;
- fluxo atual de envio de mensagem;
- conexão atual com cliente;
- conexão atual com lead;
- conexão atual com pipeline;
- regras atuais de permissão;
- pontos frágeis;
- riscos de quebra;
- plano de migração seguro.

### 7.2 Regra de preservação

Nenhuma conexão existente entre Inbox, Cliente, Lead, Pipeline, Usuário e Organização pode ser removida sem substituição funcional equivalente ou superior.

Se a lateral direita do Inbox atual já mostra cliente, lead, etapa ou histórico comercial, isso deve continuar funcionando depois da refatoração.

---

## 8. Arquitetura alvo

```txt
CRM
├── Auth
├── Users
├── Roles / Permissions
├── Organizations
├── Contacts / Clients
├── Leads
├── Pipeline
├── Sales / Orders
└── Inbox WhatsApp
    ├── WhatsApp Channels
    ├── Conversations
    ├── Messages
    ├── Message Events
    ├── Assignments
    ├── Internal Notes
    ├── Tags
    ├── SLA
    ├── Webhooks
    ├── Queues
    ├── Workers
    ├── Realtime
    ├── Analytics
    ├── Logs
    └── Audit
```

---

## 9. Stack técnica recomendada

### 9.1 Backend

- Node.js.
- TypeScript.
- NestJS preferencialmente, ou Express modular se o CRM já estiver em Express.
- PostgreSQL.
- Prisma ou Drizzle, conforme stack atual.
- Redis.
- BullMQ.
- Socket.IO ou WebSocket.
- Zod, class-validator ou padrão atual de validação.
- S3/R2 para anexos, quando anexos forem ativados.
- Logs estruturados.
- Testes unitários e de integração.

### 9.2 Frontend

- React ou Next.js, conforme CRM atual.
- TanStack Query ou camada atual de fetching.
- Zustand, Redux ou estado atual do CRM.
- WebSocket client.
- Design system atual.
- Layout visual preservado.

---

## 10. Bounded contexts

### 10.1 CRM Core

Responsável por:

- organizações;
- usuários;
- permissões;
- clientes;
- contatos;
- leads;
- pipeline;
- vendas.

### 10.2 Inbox WhatsApp

Responsável por:

- canais WhatsApp;
- conversas;
- mensagens;
- eventos de mensagem;
- atribuições;
- notas internas;
- tags;
- SLA;
- analytics de atendimento;
- logs de webhook;
- workers e filas do Inbox.

### 10.3 Relação entre contextos

O Inbox não deve duplicar modelos centrais do CRM. Ele deve referenciar entidades do CRM por `organization_id`, `contact_id`, `lead_id`, `pipeline_id`, `pipeline_stage_id` e `user_id`.

---

## 11. Contratos de integração com CRM atual

### 11.1 Organização

Todo registro do Inbox deve conter `organization_id`.

Regras:

- nenhuma query do Inbox pode rodar sem filtro por organização;
- eventos realtime devem ser enviados somente para usuários da organização correta;
- analytics deve ser calculado por organização.

### 11.2 Usuário autenticado

Todas as rotas do Inbox devem receber contexto autenticado com:

```txt
user_id
organization_id
role/permissions
```

### 11.3 Contato/cliente

O Inbox deve resolver contato por ordem de prioridade:

```txt
1. whatsapp_external_contact_id, se existir
2. telefone normalizado E.164 dentro da organização
3. telefone secundário, se o CRM suportar
4. criação de contato mínimo
```

Contato mínimo deve conter:

```txt
organization_id
name nullable
phone
source = whatsapp
created_from = inbox
```

### 11.4 Lead

Após resolver contato, o Inbox deve procurar lead ativo relacionado ao contato.

Se existir lead ativo:

- vincular `lead_id` na conversa;
- vincular `pipeline_id` e `pipeline_stage_id`, quando disponíveis.

Se não existir lead:

- conversa pode existir sem lead;
- frontend deve permitir criar/vincular lead manualmente;
- regra futura pode criar lead automático, mas não é obrigatória nesta entrega.

### 11.5 Pipeline

A conversa pode ser vinculada a uma etapa do pipeline para permitir filtros e analytics.

O Inbox não deve mover etapa automaticamente sem regra explícita.

### 11.6 Compatibilidade temporária

Se houver endpoints antigos do Inbox, criar camada de compatibilidade temporária ou plano de migração para não quebrar frontend atual durante a transição.

---

## 12. Modelo de dados proposto

A nomenclatura pode ser adaptada ao padrão atual do CRM, mas o domínio deve ser preservado.

### 12.1 whatsapp\_channels

```txt
id
organization_id
name
provider
phone_number
phone_number_id
business_account_id
access_token_encrypted
webhook_verify_token_hash
status: active | inactive | error
last_sync_at
metadata jsonb
created_at
updated_at
```

### 12.2 inbox\_conversations

```txt
id
organization_id
whatsapp_channel_id
contact_id
lead_id nullable
pipeline_id nullable
pipeline_stage_id nullable
assigned_user_id nullable
status: open | pending | waiting_customer | waiting_agent | closed
priority: low | normal | high | urgent
source: whatsapp
customer_phone
customer_name nullable
last_message_id nullable
last_message_preview
last_message_at
unread_count
first_customer_message_at nullable
first_response_at nullable
closed_at nullable
closed_by_user_id nullable
reopened_at nullable
metadata jsonb
created_at
updated_at
```

### 12.3 inbox\_messages

```txt
id
organization_id
conversation_id
whatsapp_channel_id
contact_id
lead_id nullable
sender_type: customer | agent | system | automation | ai
sender_user_id nullable
external_message_id nullable
direction: inbound | outbound
type: text | image | audio | video | document | sticker | location | contact | template | system
body nullable
media_url nullable
media_mime_type nullable
media_file_name nullable
media_size nullable
status: pending | queued | sent | delivered | read | failed
error_code nullable
error_message nullable
raw_payload jsonb
sent_at nullable
delivered_at nullable
read_at nullable
failed_at nullable
created_at
updated_at
```

### 12.4 inbox\_message\_events

```txt
id
organization_id
message_id
conversation_id
event_type: received | queued | sent | delivered | read | failed
provider_event_id nullable
payload jsonb
created_at
```

### 12.5 inbox\_assignments

```txt
id
organization_id
conversation_id
assigned_user_id
assigned_by_user_id nullable
assignment_type: manual | auto | transfer
started_at
ended_at nullable
created_at
```

### 12.6 inbox\_internal\_notes

```txt
id
organization_id
conversation_id
user_id
body
created_at
updated_at
```

### 12.7 inbox\_tags

```txt
id
organization_id
name
color
created_at
updated_at
```

### 12.8 inbox\_conversation\_tags

```txt
conversation_id
tag_id
created_by_user_id
created_at
```

### 12.9 inbox\_sla\_policies

```txt
id
organization_id
name
is_default
first_response_limit_minutes
next_response_limit_minutes
resolution_limit_minutes
business_hours_enabled
business_hours_config jsonb
timezone
created_at
updated_at
```

### 12.10 inbox\_sla\_status

```txt
id
organization_id
conversation_id
sla_policy_id
first_response_due_at
next_response_due_at
resolution_due_at
first_response_status: pending | on_time | breached
next_response_status: pending | on_time | breached
resolution_status: pending | on_time | breached
breached_at nullable
created_at
updated_at
```

### 12.11 inbox\_webhook\_logs

```txt
id
organization_id
whatsapp_channel_id nullable
provider
event_type
provider_event_id nullable
status: received | processed | ignored | failed
payload jsonb
error_message nullable
created_at
processed_at nullable
```

### 12.12 inbox\_analytics\_daily

```txt
id
organization_id
date
total_conversations
new_conversations
closed_conversations
total_messages_inbound
total_messages_outbound
avg_first_response_seconds
avg_resolution_seconds
sla_first_response_breaches
sla_next_response_breaches
sla_resolution_breaches
messages_by_agent jsonb
conversations_by_stage jsonb
created_at
updated_at
```

---

## 13. Índices e constraints obrigatórios

### 13.1 Constraints

```txt
UNIQUE(whatsapp_channel_id, external_message_id) em inbox_messages quando external_message_id não for nulo
UNIQUE(organization_id, phone_number_id) em whatsapp_channels
UNIQUE(organization_id, conversation_id, tag_id) em inbox_conversation_tags
```

### 13.2 Índices

```txt
inbox_conversations(organization_id, status, last_message_at)
inbox_conversations(organization_id, assigned_user_id, status)
inbox_conversations(organization_id, contact_id)
inbox_conversations(organization_id, lead_id)
inbox_conversations(organization_id, pipeline_stage_id)
inbox_messages(organization_id, conversation_id, created_at)
inbox_messages(whatsapp_channel_id, external_message_id)
inbox_sla_status(organization_id, first_response_due_at)
inbox_sla_status(organization_id, resolution_due_at)
inbox_webhook_logs(organization_id, created_at)
```

---

## 14. Idempotência

### 14.1 Inbound

Todo webhook inbound deve ser idempotente.

Regras:

- `external_message_id` deve ser único por `whatsapp_channel_id`;
- se o mesmo webhook chegar mais de uma vez, o backend deve retornar sucesso sem recriar mensagem;
- logs podem registrar o webhook repetido como `ignored`;
- mensagem duplicada não deve alterar unread\_count duas vezes;
- mensagem duplicada não deve recalcular SLA indevidamente.

### 14.2 Status de mensagem

Eventos de status também devem ser idempotentes.

Regras:

- se status atual já é `read`, evento `delivered` atrasado não deve regredir status;
- ordem válida: `pending -> queued -> sent -> delivered -> read`;
- `failed` deve registrar erro, mas retry posterior pode gerar novo evento.

### 14.3 Outbound

Envio outbound deve evitar disparo duplicado.

Regras:

- mensagem criada como `pending` recebe job único;
- retry deve referenciar a mesma mensagem interna;
- envio duplicado só pode acontecer se usuário acionar retry manual ou política explícita permitir.

---

## 15. Máquinas de estado

### 15.1 Estado da conversa

Estados:

```txt
open
pending
waiting_customer
waiting_agent
closed
```

Transições permitidas:

```txt
open -> waiting_agent
open -> waiting_customer
open -> pending
open -> closed
pending -> waiting_agent
pending -> waiting_customer
pending -> closed
waiting_agent -> waiting_customer
waiting_customer -> waiting_agent
waiting_customer -> closed
waiting_agent -> closed
closed -> open, quando nova mensagem inbound chegar
closed -> open, quando usuário reabrir manualmente
```

Regras:

- mensagem inbound de cliente coloca conversa em `waiting_agent`, salvo regra contrária;
- mensagem outbound de atendente coloca conversa em `waiting_customer`;
- conversa fechada reabre automaticamente se cliente enviar nova mensagem;
- conversa fechada não deve aceitar resposta do atendente sem reabertura explícita ou automática.

### 15.2 Estado da mensagem

Estados:

```txt
pending
queued
sent
delivered
read
failed
```

Transições permitidas:

```txt
pending -> queued
queued -> sent
sent -> delivered
delivered -> read
queued -> failed
sent -> failed
failed -> queued, em retry
```

Regras:

- status não pode regredir;
- `read` é estado final positivo;
- `failed` exige `error_code` ou `error_message`.

---

## 16. Fluxo inbound WhatsApp

```txt
1. WhatsApp envia webhook.
2. Backend valida canal.
3. Backend registra webhook bruto.
4. Backend valida assinatura/token quando aplicável.
5. Normalizador converte payload externo em evento interno.
6. IdempotencyService verifica duplicidade.
7. ContactResolver procura contato por telefone normalizado.
8. Se contato existir, reutiliza.
9. Se contato não existir, cria contato mínimo.
10. LeadResolver verifica lead ativo associado.
11. ConversationService procura conversa aberta ou reabre conversa fechada conforme regra.
12. MessageService salva mensagem inbound.
13. ConversationService atualiza last_message, unread_count e status.
14. SLAService inicia/recalcula prazos.
15. AssignmentService aplica regra de fila.
16. AnalyticsService registra evento.
17. RealtimeGateway notifica frontend.
18. WebhookLogService marca evento como processed.
```

---

## 17. Fluxo outbound WhatsApp

```txt
1. Atendente envia mensagem pelo CRM.
2. Backend valida autenticação.
3. Backend valida permissão.
4. Backend valida organização.
5. Backend valida se usuário pode responder a conversa.
6. Backend valida se conversa está aberta ou reabre quando aplicável.
7. MessageService cria mensagem outbound com status pending.
8. OutboundQueue recebe job único.
9. RealtimeGateway notifica mensagem pending.
10. Worker processa job.
11. WhatsAppAdapter envia mensagem.
12. MessageService atualiza status para sent ou failed.
13. Webhook de status atualiza delivered/read.
14. ConversationService atualiza status para waiting_customer.
15. SLAService recalcula próxima resposta/resolução.
16. AnalyticsService registra evento.
17. RealtimeGateway atualiza frontend.
```

---

## 18. Contratos de API e DTOs

### 18.1 Conversas

#### GET /api/inbox/conversations

Query params:

```json
{
  "status": "open | pending | waiting_customer | waiting_agent | closed | all",
  "assignedUserId": "string | null",
  "sla": "all | breached | near_due | ok",
  "unreadOnly": "boolean",
  "pipelineStageId": "string | null",
  "search": "string | null",
  "page": "number",
  "limit": "number"
}
```

Response:

```json
{
  "items": [
    {
      "id": "string",
      "contactId": "string",
      "leadId": "string | null",
      "assignedUserId": "string | null",
      "status": "open",
      "priority": "normal",
      "customerName": "string | null",
      "customerPhone": "string",
      "lastMessagePreview": "string | null",
      "lastMessageAt": "datetime | null",
      "unreadCount": 0,
      "slaStatus": "ok | near_due | breached",
      "pipelineStageId": "string | null"
    }
  ],
  "page": 1,
  "limit": 30,
  "total": 0
}
```

#### GET /api/inbox/conversations/\:conversationId

Response:

```json
{
  "id": "string",
  "contact": {},
  "lead": {},
  "pipeline": {},
  "assignedUser": {},
  "status": "open",
  "priority": "normal",
  "sla": {},
  "tags": [],
  "metadata": {}
}
```

#### PATCH /api/inbox/conversations/\:conversationId/assign

Request:

```json
{
  "assignedUserId": "string"
}
```

Response:

```json
{
  "conversationId": "string",
  "assignedUserId": "string",
  "assignedAt": "datetime"
}
```

#### PATCH /api/inbox/conversations/\:conversationId/transfer

Request:

```json
{
  "toUserId": "string",
  "reason": "string | null"
}
```

#### PATCH /api/inbox/conversations/\:conversationId/close

Request:

```json
{
  "reason": "string | null"
}
```

#### PATCH /api/inbox/conversations/\:conversationId/reopen

Request:

```json
{
  "reason": "string | null"
}
```

### 18.2 Mensagens

#### GET /api/inbox/conversations/\:conversationId/messages

Query params:

```json
{
  "before": "datetime | null",
  "after": "datetime | null",
  "limit": 50
}
```

Response:

```json
{
  "items": [
    {
      "id": "string",
      "conversationId": "string",
      "senderType": "customer | agent | system | automation | ai",
      "senderUserId": "string | null",
      "direction": "inbound | outbound",
      "type": "text",
      "body": "string | null",
      "status": "sent",
      "createdAt": "datetime"
    }
  ]
}
```

#### POST /api/inbox/conversations/\:conversationId/messages

Request:

```json
{
  "type": "text",
  "body": "string",
  "replyToMessageId": "string | null"
}
```

Response:

```json
{
  "id": "string",
  "conversationId": "string",
  "status": "pending",
  "createdAt": "datetime"
}
```

### 18.3 WhatsApp webhooks

#### GET /api/inbox/whatsapp/webhook/\:channelId

Usado para verificação do webhook.

#### POST /api/inbox/whatsapp/webhook/\:channelId

Recebe eventos de mensagem e status.

Response esperado:

```json
{
  "received": true
}
```

### 18.4 SLA

#### GET /api/inbox/sla/policies

#### POST /api/inbox/sla/policies

Request:

```json
{
  "name": "string",
  "isDefault": true,
  "firstResponseLimitMinutes": 5,
  "nextResponseLimitMinutes": 10,
  "resolutionLimitMinutes": 1440,
  "businessHoursEnabled": true,
  "businessHoursConfig": {},
  "timezone": "America/Sao_Paulo"
}
```

### 18.5 Analytics

#### GET /api/inbox/analytics/overview

Query params:

```json
{
  "from": "date",
  "to": "date",
  "agentId": "string | null",
  "pipelineStageId": "string | null"
}
```

Response:

```json
{
  "totalConversations": 0,
  "newConversations": 0,
  "closedConversations": 0,
  "openConversations": 0,
  "avgFirstResponseSeconds": 0,
  "avgResolutionSeconds": 0,
  "slaBreachRate": 0,
  "totalInboundMessages": 0,
  "totalOutboundMessages": 0
}
```

---

## 19. Permissões

```txt
inbox.view_all
inbox.view_own
inbox.view_unassigned
inbox.send_message
inbox.assign_self
inbox.assign_others
inbox.transfer_conversation
inbox.close_conversation
inbox.reopen_conversation
inbox.manage_tags
inbox.manage_notes
inbox.manage_whatsapp_channels
inbox.view_sla
inbox.manage_sla
inbox.view_analytics
inbox.view_logs
```

### 19.1 Regras

- Admin pode ver todas as conversas da organização.
- Supervisor pode ver conversas da equipe, se houver equipe.
- Atendente pode ver conversas próprias e livres, conforme permissão.
- Conversa atribuída só pode ser respondida pelo responsável, admin ou supervisor autorizado.
- Usuário sem `inbox.send_message` não pode enviar mensagem.
- Usuário sem `inbox.view_analytics` não pode acessar analytics.
- Usuário sem `inbox.manage_sla` não pode alterar política de SLA.

---

## 20. Multiatendimento avançado

### 20.1 Funcionalidades

- Conversas livres.
- Conversas atribuídas.
- Conversas minhas.
- Conversas por atendente.
- Assumir conversa.
- Transferir conversa.
- Encerrar conversa.
- Reabrir conversa.
- Histórico de atribuições.
- Bloqueio lógico de concorrência.
- Distribuição automática opcional.

### 20.2 Regras

- Conversa livre pode ser assumida por atendente autorizado.
- Duas pessoas não podem assumir a mesma conversa ao mesmo tempo.
- Transferência deve encerrar assignment anterior e criar novo assignment.
- Encerramento deve registrar usuário e horário.
- Nova mensagem inbound reabre conversa encerrada.
- Histórico de assignment nunca deve ser apagado.

### 20.3 Concorrência

Ao assumir conversa, usar operação atômica no banco.

Regra lógica:

```txt
Atualizar assigned_user_id somente se assigned_user_id for null ou se usuário tiver permissão de transferência.
```

---

## 21. SLA avançado

### 21.1 Métricas

- Tempo até primeira resposta.
- Tempo médio entre respostas.
- Tempo até resolução.
- Conversas vencidas.
- Conversas próximas do vencimento.
- SLA por atendente.
- SLA por etapa do pipeline.
- SLA por prioridade.

### 21.2 Regras técnicas

- Toda nova conversa recebe política de SLA padrão da organização.
- A primeira mensagem inbound inicia prazo de primeira resposta.
- A primeira resposta humana outbound cumpre primeira resposta.
- Mensagem automática não conta como primeira resposta humana.
- Nota interna não conta como resposta ao cliente.
- Cada nova mensagem inbound inicia prazo de próxima resposta.
- Conversa encerrada dentro do prazo cumpre resolução.
- Conversa sem resposta dentro do prazo marca violação.
- SLA deve respeitar timezone da organização.
- SLA pode considerar horário comercial se configurado.
- Reabertura recalcula SLA conforme política ativa.

### 21.3 Estados visuais

```txt
ok
near_due
breached
resolved_on_time
resolved_late
```

---

## 22. Analytics

### 22.1 Indicadores

- Total de conversas.
- Novas conversas.
- Conversas abertas.
- Conversas encerradas.
- Conversas por atendente.
- Conversas por etapa do pipeline.
- Mensagens recebidas.
- Mensagens enviadas.
- Tempo médio de primeira resposta.
- Tempo médio de resolução.
- SLA cumprido.
- SLA violado.
- Taxa de conversas sem resposta.
- Taxa de reabertura.
- Horários de maior volume.
- Atendentes com maior carga.

### 22.2 Fórmulas

```txt
avg_first_response_seconds = média(first_response_at - first_customer_message_at)

avg_resolution_seconds = média(closed_at - created_at)

sla_first_response_breach_rate = conversas_com_primeira_resposta_vencida / conversas_com_sla_aplicável

sla_resolution_breach_rate = conversas_com_resolução_vencida / conversas_com_sla_aplicável

agent_load = conversas_abertas_atribuidas_por_atendente

reopen_rate = conversas_reabertas / conversas_encerradas

unanswered_rate = conversas_waiting_agent_sem_resposta / conversas_abertas
```

### 22.3 Regra crítica

Analytics deve ser calculado no backend por queries e/ou agregações. O frontend apenas exibe. Dashboard que calcula regra de negócio no navegador é planilha fantasiada de SaaS.

---

## 23. Realtime

### 23.1 Eventos

```txt
conversation.created
conversation.updated
conversation.assigned
conversation.transferred
conversation.closed
conversation.reopened
conversation.sla_updated
message.created
message.updated
message.status_changed
note.created
tag.attached
tag.removed
analytics.updated
```

### 23.2 Payload padrão

```json
{
  "event": "message.created",
  "organizationId": "org_id",
  "conversationId": "conversation_id",
  "payload": {}
}
```

### 23.3 Rooms/canais

```txt
organization:{organizationId}
conversation:{conversationId}
user:{userId}
```

Regras:

- usuário só entra em room da própria organização;
- eventos de conversa devem ir para usuários autorizados;
- reconnect do frontend deve refazer fetch do estado atual.

---

## 24. Workers e filas

### 24.1 Filas

```txt
inbox.inbound
inbox.outbound
inbox.status
inbox.sla
inbox.analytics
```

### 24.2 Jobs

```txt
processInboundWhatsAppMessage
sendOutboundWhatsAppMessage
processWhatsAppStatusUpdate
recalculateConversationSLA
aggregateInboxAnalytics
retryFailedOutboundMessage
```

### 24.3 Regras

- webhook não deve executar processamento pesado diretamente;
- job deve ser idempotente;
- retry deve ter limite;
- falhas permanentes devem gerar log e status failed;
- fila deve expor métricas operacionais.

---

## 25. Segurança e LGPD

### 25.1 Segurança

- Tokens do WhatsApp devem ser criptografados em repouso.
- Verify token deve ser armazenado como hash quando possível.
- Logs não devem gravar access\_token.
- Webhooks devem validar assinatura/token quando disponível.
- Todas as queries devem filtrar `organization_id`.
- Usuário não pode acessar conversa de outra organização.
- Mensagens devem ser sanitizadas.
- Permissões devem ser aplicadas em todas as rotas.
- Anexos devem ter validação de tipo e tamanho quando forem ativados.

### 25.2 Privacidade

- Telefone deve ser mascarado em logs técnicos quando possível.
- Exportações futuras devem ser auditadas.
- Acesso a conversa deve poder ser auditado.
- Política de retenção de mensagens deve ser definida pela empresa.
- Exclusão ou anonimização de contato deve considerar impactos legais e comerciais.

---

## 26. Observabilidade

### 26.1 Logs obrigatórios

- Webhook recebido.
- Webhook processado.
- Webhook ignorado por duplicidade.
- Webhook com erro.
- Mensagem inbound criada.
- Mensagem outbound criada.
- Envio para WhatsApp iniciado.
- Envio para WhatsApp concluído.
- Envio para WhatsApp falhou.
- SLA recalculado.
- SLA violado.
- Conversa atribuída.
- Conversa transferida.
- Conversa encerrada.

### 26.2 Severidade

```txt
P0: WhatsApp fora, envio e recebimento parados.
P1: Recebimento funcionando, envio falhando.
P2: Realtime falhando, mas banco correto.
P3: Analytics atrasado ou inconsistente.
P4: Erro visual sem perda operacional.
```

### 26.3 Métricas operacionais

- mensagens recebidas por minuto;
- mensagens enviadas por minuto;
- falhas de envio;
- tamanho da fila outbound;
- tempo médio de processamento de webhook;
- eventos duplicados ignorados;
- SLA vencidos por hora.

---

## 27. Migração de dados

### 27.1 Diagnóstico antes da migração

Mapear:

- tabelas antigas;
- contagem de conversas antigas;
- contagem de mensagens antigas;
- contatos vinculados;
- conversas sem contato;
- mensagens órfãs;
- leads vinculados;
- pipeline vinculado.

### 27.2 Estratégia

- Criar novas tabelas sem apagar antigas.
- Migrar dados em ambiente de staging.
- Validar contagens antes/depois.
- Criar tabela de mapping se necessário.
- Manter rollback documentado.
- Só trocar frontend depois de backend validado.

### 27.3 Validações

```txt
conversas_antigas = conversas_migradas + conversas_ignoradas_com_motivo
mensagens_antigas = mensagens_migradas + mensagens_ignoradas_com_motivo
nenhuma conversa migrada sem organization_id
nenhuma mensagem migrada sem conversation_id
nenhum contato duplicado sem regra explícita
```

---

## 28. Frontend

### 28.1 Regra principal

A tela atual deve ser preservada como fallback operacional. O frontend do Inbox V2 deve ser criado em paralelo, depois do backend V2 estar testado, mantendo o padrão visual do CRM e preservando os vínculos atuais com cliente, lead e pipeline.

### 28.2 Estrutura

```txt
Sidebar do CRM
├── Inbox atual disponível como fallback
├── Inbox V2 selecionado após homologação

Header
├── busca global
├── ações do usuário

Inbox V2
├── Coluna esquerda: lista/filtros
├── Coluna central: conversa
└── Coluna direita: cliente/pipeline/SLA/notas
```

### 28.3 Coluna esquerda

- Todos.
- Não lidos.
- Meus.
- Livres.
- SLA vencido.
- Aguardando cliente.
- Aguardando atendente.
- Busca por nome, telefone ou mensagem.
- Última mensagem.
- Horário.
- Atendente.
- Alerta de SLA.

### 28.4 Coluna central

- Nome do cliente.
- Telefone.
- Etapa do pipeline.
- Botão assumir.
- Botão transferir.
- Botão encerrar.
- Histórico de mensagens.
- Separador por data.
- Status de envio.
- Campo de resposta.
- Estados de envio.

### 28.5 Coluna direita

- Dados do cliente.
- Lead vinculado.
- Pipeline.
- Etapa.
- Responsável.
- SLA.
- Notas internas.
- Tags.
- Histórico comercial relevante.

### 28.6 Estados obrigatórios

- carregando conversas;
- sem conversas;
- conversa não selecionada;
- carregando mensagens;
- erro de envio;
- mensagem pendente;
- mensagem enviada;
- mensagem entregue;
- mensagem lida;
- conexão realtime perdida;
- SLA vencido;
- sem permissão.

---

## 29. Testes obrigatórios

### 29.1 Backend

- Criar conversa inbound.
- Reutilizar conversa existente.
- Criar contato novo.
- Reutilizar contato existente.
- Evitar duplicidade de contato.
- Evitar duplicidade de mensagem por webhook repetido.
- Enviar mensagem outbound.
- Atualizar status de mensagem.
- Ignorar status regressivo.
- Processar webhook duplicado sem duplicar mensagem.
- Atribuir conversa.
- Bloquear dupla atribuição conflitante.
- Transferir conversa.
- Encerrar conversa.
- Reabrir conversa.
- Calcular primeira resposta de SLA.
- Calcular próxima resposta de SLA.
- Marcar SLA vencido.
- Gerar analytics.
- Aplicar permissões.
- Isolar organização.

### 29.2 Frontend

- Renderizar lista.
- Abrir conversa.
- Enviar mensagem.
- Receber realtime.
- Exibir status.
- Exibir SLA.
- Assumir conversa.
- Transferir conversa.
- Encerrar conversa.
- Adicionar nota.
- Filtrar conversas.
- Exibir analytics.
- Exibir erro sem quebrar a tela.

---

## 30. Definition of Done

Uma fase só pode ser considerada pronta quando:

- migrations foram aplicadas em ambiente local/staging;
- testes automatizados passaram;
- permissões foram validadas;
- logs foram implementados;
- erros críticos foram tratados;
- documentação foi atualizada;
- fluxo manual foi homologado;
- rollback foi documentado quando houver alteração de banco;
- nenhum erro P0/P1 aberto permanece.

---

## 31. Plano de execução

### Etapa 1: Diagnóstico

Entregáveis:

- `INBOX_CURRENT_STATE.md`;
- mapa de tabelas;
- mapa de endpoints;
- mapa de componentes;
- riscos;
- plano de migração.

### Etapa 2: Banco e domínio

Entregáveis:

- migrations;
- models/entities;
- repositories;
- services base;
- constraints;
- índices.

### Etapa 3: Conversas e mensagens

Entregáveis:

- APIs de conversas;
- APIs de mensagens;
- vínculo com contato;
- vínculo com lead;
- vínculo com pipeline.

### Etapa 4: WhatsApp inbound

Entregáveis:

- webhook de verificação;
- webhook de eventos;
- normalizador;
- idempotência;
- logs;
- persistência inbound.

### Etapa 5: WhatsApp outbound

Entregáveis:

- endpoint de envio;
- fila outbound;
- adapter WhatsApp;
- status;
- retry;
- logs.

### Etapa 6: Realtime

Entregáveis:

- gateway;
- rooms;
- eventos;
- reconnect strategy.

### Etapa 7: Multiatendimento

Entregáveis:

- atribuição;
- autoatribuição opcional;
- transferência;
- encerramento;
- reabertura;
- bloqueio de concorrência;
- histórico.

### Etapa 8: SLA

Entregáveis:

- políticas;
- cálculo;
- status;
- alertas;
- filtros.

### Etapa 9: Analytics

Entregáveis:

- agregações;
- endpoints;
- métricas;
- validação de fórmulas.

### Etapa 10: Testes backend

Entregáveis:

- testes unitários;
- testes de integração;
- testes de webhook;
- testes de fila;
- testes de permissão;
- testes de SLA;
- testes de analytics.

### Etapa 11: Frontend

Entregáveis:

- criar tela `/inbox-v2` conectada aos novos endpoints;
- manter `/inbox` atual como fallback até a virada controlada;
- criar/adaptar lista;
- criar/adaptar conversa;
- criar/adaptar painel direito;
- exibir SLA;
- exibir analytics;
- tratar realtime;
- tratar estados de erro.

### Etapa 12: Homologação

Entregáveis:

- teste com WhatsApp real;
- teste com múltiplos atendentes;
- teste com SLA;
- teste com analytics;
- validação de performance;
- correção final.

---

## 32. Critérios de aceite final

- Inbox funciona dentro do CRM.
- WhatsApp envia mensagens.
- WhatsApp recebe mensagens.
- Webhook duplicado não duplica mensagens.
- Contatos não duplicam.
- Leads continuam conectados.
- Pipeline continua conectado.
- Multiatendimento funciona.
- SLA funciona.
- Analytics funciona.
- Realtime funciona.
- Logs funcionam.
- Permissões funcionam.
- Segurança mínima aplicada.
- Backend testado antes do frontend.
- UI preserva padrão visual atual.
- Nenhuma dependência direta do código ChatbotX.

---

## 33. Prompt para execução no agente de código

```md
# Tarefa: Inbox WhatsApp V2 do CRM

Você é um engenheiro sênior full-stack especializado em CRM, WhatsApp API, mensageria, PostgreSQL, Redis, BullMQ, WebSocket, SLA, analytics, segurança e arquitetura modular.

Objetivo:
Criar um novo módulo Inbox WhatsApp V2 do CRM para se tornar um produto final de atendimento WhatsApp, inspirado conceitualmente no ChatbotX, mas com implementação própria, domínio próprio e integração nativa com o CRM.

Decisão arquitetural:
- não fazer refatoração agressiva no Inbox atual;
- manter o Inbox atual como fallback operacional;
- corrigir no Inbox atual apenas bugs críticos de UI e integrações necessárias;
- desenvolver o Inbox V2 em paralelo, com backend e frontend próprios;
- usar `/inbox-v2` no frontend e `/api/v1/inbox-v2` no backend, salvo decisão técnica documentada.

Regras obrigatórias:
1. Não copiar código do ChatbotX.
2. Usar o ChatbotX apenas como referência conceitual.
3. Antes de alterar código, mapear o Inbox atual.
4. Preservar conexões existentes com cliente, lead, pipeline, usuário e organização.
5. Backend vem antes do frontend.
6. Testar backend antes de criar/refatorar interface.
7. Focar somente em WhatsApp nesta fase.
8. Produto final, não MVP.
9. Implementar multiatendimento avançado.
10. Implementar SLA avançado.
11. Implementar analytics.
12. Usar filas para inbound/outbound.
13. Usar realtime para mensagens e status.
14. Implementar idempotência.
15. Criptografar tokens sensíveis.
16. Garantir isolamento por organização.
17. Aplicar permissões em todas as rotas.
18. Documentar decisões técnicas.

Primeira entrega obrigatória:
Crie o arquivo `INBOX_CURRENT_STATE.md` documentando:
- tabelas atuais;
- endpoints atuais;
- componentes frontend;
- fluxo atual de mensagem;
- vínculo atual com cliente;
- vínculo atual com lead;
- vínculo atual com pipeline;
- permissões atuais;
- riscos de quebra;
- plano de migração seguro.

Depois implemente em fases:
1. Banco e domínio.
2. Conversas e mensagens.
3. Webhook inbound WhatsApp.
4. Envio outbound WhatsApp.
5. Realtime.
6. Multiatendimento.
7. SLA.
8. Analytics.
9. Testes backend.
10. Frontend.
11. Homologação.

Ao final de cada fase:
- documente o que foi feito;
- rode testes;
- registre riscos;
- indique próximos passos;
- não avance se houver P0/P1 aberto.
```

---

## 34. Checklist final de conformidade

```txt
[ ] Diagnóstico do Inbox atual feito antes de alterar código
[ ] Conexões com cliente preservadas
[ ] Conexões com lead preservadas
[ ] Conexões com pipeline preservadas
[ ] Backend implementado antes do frontend
[ ] Webhook inbound WhatsApp implementado
[ ] Outbound WhatsApp implementado
[ ] Idempotência implementada
[ ] Multiatendimento implementado
[ ] SLA implementado
[ ] Analytics implementado
[ ] Permissões implementadas
[ ] Logs implementados
[ ] Segurança aplicada
[ ] Testes backend passando
[ ] Frontend conectado depois do backend
[ ] Inbox atual preservado como fallback até homologação do V2
[ ] UI do Inbox V2 preservada no padrão do CRM
[ ] Nenhum código ChatbotX copiado
```

---

## 35. Recomendação final

Construir um Inbox WhatsApp V2 próprio, profundo e integrado ao CRM.

Não criar omnichannel agora. Não copiar ChatbotX. Não refatorar agressivamente o Inbox atual. Não criar frontend V2 antes do backend V2. Não quebrar vínculo com cliente, lead e pipeline. Não deixar regra crítica no navegador.

Fundação V2 primeiro. Interface V2 depois. O Inbox atual permanece como fallback até a homologação e virada controlada.
