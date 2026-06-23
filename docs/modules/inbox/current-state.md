# INBOX_CURRENT_STATE.md

## Escopo deste diagnóstico

Fonte canônica: `PRD.DOCS/Inbo Feature/09-05-26/prd_refatoracao_inbox_whatsapp_crm (1).md`.

Este arquivo é o checkpoint obrigatório antes de qualquer alteração de produto no Inbox. O objetivo é registrar o estado atual do Inbox WhatsApp, suas conexões com CRM, riscos de quebra e uma rota segura de migração para a refatoração final.

Status deste checkpoint: documentação e análise estática. Nenhuma alteração funcional foi feita.

## Tabelas atuais relacionadas ao Inbox

### `conversations`

Origem principal: `apps/api/src/db/migrations/004_conversations_messages.sql` e `018_inbox_multichannel_foundation.sql`.

Campos atuais relevantes:

- `id`
- `channel` (`whatsapp`, `instagram`, `telegram`, `tiktok`, `messenger`)
- `external_id`
- `whatsapp_number`
- `contact_name`
- `contact_phone`
- `contact_handle`
- `lead_id`
- `customer_id`
- `pipeline_id`
- `stage_id`
- `status` (`BOT`, `AGUARDANDO_HUMANO`, `EM_ATENDIMENTO`, `ENCERRADA`)
- `assigned_to`
- `assigned_at`
- `last_message_at`
- `unread_count`
- `internal_note`
- `last_read_at`
- `last_read_by`
- `created_at`
- `updated_at`

Índices relevantes:

- `idx_conversations_whatsapp`
- `idx_conversations_status`
- `idx_conversations_assigned`
- `idx_conversations_channel`
- `idx_conversations_external_id`
- `idx_conversations_unread_count`

Observações:

- Existe vínculo com `leads`, `customers`, `pipelines`, `pipeline_stages` e `users`.
- Não há `org_id`/`organization_id` nesta tabela.
- Não há campos formais de SLA, prioridade, fila, time/equipe, tags normalizadas, reabertura, primeira resposta, resolução ou timestamps analíticos específicos.

### `messages`

Origem principal: `apps/api/src/db/migrations/004_conversations_messages.sql` e `018_inbox_multichannel_foundation.sql`.

Campos atuais relevantes:

- `id`
- `conversation_id`
- `meta_message_id`
- `external_id`
- `direction` (`INBOUND`, `OUTBOUND`)
- `type` (`TEXT`, `IMAGE`, `DOCUMENT`, `AUDIO`, `TEMPLATE`)
- `content`
- `media_url`
- `media_mime`
- `media_size`
- `sent_by`
- `status` (`SENT`, `DELIVERED`, `READ`, `FAILED`)
- `is_automated`
- `is_quick_reply`
- `created_at`

Índices relevantes:

- `idx_messages_conversation`
- `idx_messages_meta_id`
- `idx_messages_created`

Observações:

- `meta_message_id` é único e usado como idempotência de inbound.
- O frontend tipa `VIDEO`, `STICKER`, `LOCATION` e `IDENTIFICATION`, mas o enum do banco/backend atual não inclui esses tipos.
- Não há tabela separada de eventos de mensagem/status (`sent`, `delivered`, `read`, `failed`) nem histórico de mudanças de status.

### `quick_replies`

Origem: `apps/api/src/db/migrations/018_inbox_multichannel_foundation.sql`.

Campos:

- `id`
- `title`
- `body`
- `category`
- `created_by`
- `created_at`
- `updated_at`

Observações:

- Respostas rápidas existem no backend e são consumidas pelo composer do Inbox.
- Não há escopo por organização ou time.

### `channel_integrations`

Origem: `apps/api/src/db/migrations/018_inbox_multichannel_foundation.sql`.

Campos:

- `id`
- `channel`
- `is_active`
- `credentials`
- `webhook_url`
- `created_at`
- `updated_at`

Observações:

- Existe base multicanal, mas a fase atual do PRD exige foco somente em WhatsApp.
- `credentials` é `JSONB` e não há evidência de criptografia nesta tabela.
- Não há `org_id`; a configuração é global por canal.

### `whatsapp_providers`

Origem: `apps/api/src/db/migrations/033_whatsapp_providers.sql`.

Campos:

- `id`
- `name`
- `provider_type` (`evolution`, `uazapi`, `meta`, `baileys`, `zapi`, `twilio`, `generic_rest`)
- `credentials`
- `base_url`
- `instance_name`
- `is_primary`
- `active`
- `status`
- `connected_number`
- `connected_at`
- `created_at`
- `updated_at`

Observações:

- A UI de ajustes permite cadastrar UazAPI, Meta, Evolution e outros provedores.
- O runtime atual do envio no Inbox não usa esta tabela; ele chama diretamente `sendTextMessage` de `meta-whatsapp.service.ts`.
- `credentials` é `JSONB`; não há evidência de criptografia em repouso.
- Não há `org_id`; a configuração é global.

## Tabelas atuais de clientes/contatos

### `customers`

Origem: `apps/api/src/db/migrations/003_leads_customers.sql`.

Campos relevantes para Inbox:

- `id`
- `name`
- `whatsapp_number` único
- `email`
- `cpf`
- `assigned_to`
- `notes`
- `created_at`
- `updated_at`

Vínculo atual:

- `conversations.customer_id` referencia `customers.id`.
- `resolveConversationLinks` busca cliente por `customers.whatsapp_number`.
- Quando inbound não encontra cliente, o código atual cria lead, não customer.

Risco:

- O PRD exige criação automática de contato mínimo. O estado atual cria `lead` quando não há cliente nem lead. Isso precisa ser decidido/migrado sem quebrar o CRM comercial existente.

## Tabelas atuais de leads

### `leads`

Origem: `apps/api/src/db/migrations/003_leads_customers.sql`, `016_pipeline_upgrade.sql` e `017_pipelines_foundation.sql`.

Campos relevantes para Inbox:

- `id`
- `whatsapp_number` único
- `name`
- `email`
- `stage`
- `stage_id`
- `pipeline_id`
- `assigned_to`
- `source`
- `converted_customer_id`
- `last_interaction_at`
- `created_at`
- `updated_at`

Vínculo atual:

- `conversations.lead_id` referencia `leads.id`.
- Inbound procura lead por `whatsapp_number`.
- Se não encontra lead nem cliente, cria lead com `source = WHATSAPP`, `stage = NOVO`, pipeline padrão `leads` e primeira etapa.
- Se encontra lead, atualiza `last_interaction_at`, `updated_at` e preenche `name` quando possível.

## Tabelas atuais de pipeline

### `pipelines`

Origem: `apps/api/src/db/migrations/017_pipelines_foundation.sql`.

Campos relevantes:

- `id`
- `name`
- `slug`
- `description`
- `icon`
- `is_active`
- `is_default`
- `flow_json`
- `published_at`
- `created_by`
- `created_at`
- `updated_at`

### `pipeline_stages`

Origem: `apps/api/src/db/migrations/016_pipeline_upgrade.sql` e `017_pipelines_foundation.sql`.

Vínculo atual:

- `conversations.pipeline_id` referencia `pipelines.id`.
- `conversations.stage_id` referencia `pipeline_stages.id`.
- Para inbound novo, o contexto vem do lead criado ou encontrado.
- O frontend mostra pipeline/etapa no topo e painel lateral da conversa.

## Tabelas atuais de usuários e permissões

### `users`

Origem: `apps/api/src/db/migrations/002_users.sql` e `038_user_roles_expansion.sql`.

Papéis conhecidos:

- `ROOT`
- `ADMIN`
- `GERENTE`
- `VENDEDOR`
- `ATENDENTE`
- `PRODUCAO`
- `FINANCEIRO`

Permissões atuais do Inbox:

- Rotas principais do Inbox usam `authenticate` + `requireRole(['ADMIN', 'ATENDENTE'])`.
- `ROOT` passa pelo bypass global de `requireRole`.
- `ADMIN`/`ROOT` são superusuários no serviço para listar/acessar conversas.
- Atendente acessa conversas atribuídas a ele ou conversas livres em `AGUARDANDO_HUMANO`.

Riscos:

- Algumas funções de nota usam checagens manuais com `role = 'ADMIN'` e podem não tratar `ROOT` como superusuário.
- Não há isolamento explícito por organização no JWT (`req.user`) nem nas tabelas centrais de Inbox.

## Endpoints atuais do Inbox

Base montada em `apps/api/src/index.ts`:

- `/api/v1/inbox`
- `/api/v1/webhooks/whatsapp`
- `/api/v1/whatsapp`
- `/api/v1/whatsapp-providers`

### `/api/v1/inbox`

Arquivo: `apps/api/src/routes/inbox.routes.ts`.

Endpoints:

- `GET /stream`
  - SSE com eventos `conversation.created`, `conversation.updated`, `message.created`.
  - `ADMIN`, `ATENDENTE`.

- `GET /channels`
  - Lista `channel_integrations`.
  - `ADMIN`, `ATENDENTE`.

- `PATCH /channels/:channel`
  - Atualiza canal ativo e webhook URL.
  - `ADMIN`.

- `GET /quick-replies`
  - Lista mensagens prontas.
  - `ADMIN`, `ATENDENTE`.

- `POST /quick-replies`
  - Cria mensagem pronta.
  - `ADMIN`.

- `PUT /quick-replies/:id`
  - Atualiza mensagem pronta.
  - `ADMIN`.

- `DELETE /quick-replies/:id`
  - Remove mensagem pronta.
  - `ADMIN`.

- `GET /conversations`
  - Lista conversas com filtros `status`, `channel`, `q`, `assigned_to`, `page`, `limit`.
  - `ADMIN`, `ATENDENTE`.
  - Rate limit `inbox-list`.

- `GET /conversations/:id`
  - Busca thread com mensagens.
  - `ADMIN`, `ATENDENTE`.
  - Zera `unread_count`.

- `POST /conversations/:id/messages`
  - Envia texto/identificação/resposta rápida.
  - `ADMIN`, `ATENDENTE`.
  - Rate limit `inbox-send`.
  - Atualmente só envia se `conversation.channel === 'whatsapp'`.
  - Chama `sendTextMessage` da Meta Cloud API diretamente.

- `POST /conversations/:id/assign`
  - Assumir/atribuir conversa.
  - `ADMIN`, `ATENDENTE`.

- `POST /conversations/:id/handoff`
  - Devolver conversa para fila.
  - `ADMIN`, `ATENDENTE`.

- `POST /conversations/:id/close`
  - Encerrar conversa.
  - `ADMIN`, `ATENDENTE`.

- `POST /conversations/:id/resolve`
  - Alias de encerramento.
  - `ADMIN`, `ATENDENTE`.

- `GET /conversations/:id/note`
  - Busca nota interna.
  - `ADMIN`, `ATENDENTE`.

- `PATCH /conversations/:id/note`
  - Salva nota interna.
  - `ADMIN`, `ATENDENTE`.

- `POST /conversations/:id/read`
  - Marca conversa como lida.
  - `ADMIN`, `ATENDENTE`.

### `/api/v1/webhooks/whatsapp`

Arquivo: `apps/api/src/routes/whatsapp.routes.ts`.

Endpoints:

- `GET /`
  - Verificação do webhook Meta com `hub.verify_token` e `hub.challenge`.
  - Exige `META_WEBHOOK_VERIFY_TOKEN` e `META_APP_SECRET`.

- `POST /`
  - Recebe payload Meta.
  - Valida assinatura `X-Hub-Signature-256`.
  - Enfileira job BullMQ via `enqueueWhatsAppWebhookJob`.
  - Responde rápido com `{ status: 'received' }`.

### `/api/v1/whatsapp`

Arquivo: `apps/api/src/routes/whatsapp-admin.routes.ts`.

Endpoints:

- `GET /status`
  - Consulta status Evolution API por variáveis `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`.
  - `ADMIN`.

- `POST /reconnect`
  - Busca QR Code Evolution.
  - `ADMIN`.

- `POST /disconnect`
  - Desconecta instância Evolution.
  - `ADMIN`.

Observação:

- Estes endpoints usam configuração por `.env`, não `whatsapp_providers`.

### `/api/v1/whatsapp-providers`

Arquivo: `apps/api/src/routes/whatsapp-providers.routes.ts`.

Endpoints:

- `GET /`
- `POST /`
- `PUT /:id`
- `PATCH /:id/toggle`
- `PATCH /:id/set-primary`
- `DELETE /:id`

Permissão:

- Todos exigem `ADMIN` com bypass de `ROOT`.

Observação:

- CRUD existe, mas não há adapter runtime usando o provedor primário para inbound/outbound.

## Componentes frontend atuais

### Página e actions

- `apps/web/app/(crm)/inbox/page.tsx`
  - Server component.
  - Carrega conversas, canais, respostas rápidas e conversa selecionada.
  - Carrega atendentes via `/users` somente se usuário atual é `ADMIN`.

- `apps/web/app/(crm)/inbox/actions.ts`
  - Server actions:
    - `sendInboxMessageAction`
    - `assignConversationAction`
    - `closeConversationAction`
    - `handoffConversationAction`
    - `saveConversationNoteAction`
    - `markConversationReadAction`

### Componentes React

- `ConversationList.tsx`
  - Lista conversas.
  - Filtros client-side: todos, não lidos, meus, livre.
  - Filtros server-side por canal, status e busca via query string.

- `ConversationThread.tsx`
  - Header da conversa.
  - Banner de conversa livre/assumida.
  - Ações de assumir, transferir/devolver para fila e encerrar.
  - Lista de mensagens agrupadas por data.
  - Painel lateral com cliente, telefone, pipeline, etapa, atendente, mensagens, canal e nota interna.

- `InboxComposer.tsx`
  - Envio de texto.
  - Envio de identificação.
  - Respostas rápidas.
  - Anexo e áudio aparecem desabilitados.
  - Envio habilitado apenas para `whatsapp`.

- `MessageBubble.tsx`
  - Renderiza texto, imagem, documento, áudio e alguns tipos que o backend atual não suporta formalmente (`VIDEO`, `STICKER`, `LOCATION` no tipo frontend).

- `InboxRealtimeBridge.tsx`
  - Abre `EventSource` em `/api/internal/inbox/stream`.
  - Em eventos, chama `router.refresh()` com debounce de 250ms.

- `InboxEmptyState.tsx`
  - Estado vazio.

### Proxy interno do stream

- `apps/web/app/api/internal/inbox/stream/route.ts`
  - Usa sessão do Next para repassar token ao backend.
  - Faz proxy de SSE para `/api/v1/inbox/stream`.

## Fluxo atual de mensagem inbound

1. WhatsApp Meta envia webhook para `POST /api/v1/webhooks/whatsapp`.
2. Backend valida `META_WEBHOOK_VERIFY_TOKEN`/`META_APP_SECRET` e assinatura `X-Hub-Signature-256`.
3. Payload é enfileirado em BullMQ na fila `whatsapp-webhook`.
4. Worker `whatsappWebhook.worker.ts` processa o payload.
5. `parseWebhookPayload` transforma eventos Meta em `ParsedWhatsAppInboundEvent`.
6. Para cada evento:
   - `upsertConversationFromInbound` localiza/cria conversa.
   - `appendInboundMessage` insere mensagem com `ON CONFLICT (meta_message_id) DO NOTHING`.
   - `unread_count` é incrementado apenas quando uma mensagem nova foi inserida.
   - Eventos realtime são publicados via EventEmitter em memória.
7. Frontend recebe SSE e executa `router.refresh()`.

## Fluxo atual de mensagem outbound

1. Usuário submete `InboxComposer`.
2. `sendInboxMessageAction` chama `POST /api/v1/inbox/conversations/:id/messages`.
3. Backend valida permissão:
   - `ADMIN`/`ROOT` podem enviar.
   - `ATENDENTE` pode enviar se a conversa está atribuída a ele ou se está livre aguardando humano.
4. Se atendente responde conversa livre, o backend autoatribui a conversa.
5. Backend exige `conversation.channel === 'whatsapp'`.
6. Backend chama `sendTextMessage` em `meta-whatsapp.service.ts`.
7. Em sucesso:
   - Salva mensagem outbound com `status = SENT`.
   - Atualiza conversa para `EM_ATENDIMENTO`.
   - Publica evento realtime.
8. Em falha:
   - Salva mensagem outbound com `status = FAILED`.
   - Propaga erro para a UI.

Risco:

- Não há fila outbound.
- Não há provider adapter; o envio está acoplado à Meta.
- `whatsapp_providers` e UazAPI não dirigem o envio atual.
- Status `DELIVERED` e `READ` existem no enum, mas não há fluxo atual de atualização por webhook de status.

## Vínculo atual com cliente

Regra atual em `resolveConversationLinks`:

1. Busca `customers` por `whatsapp_number`.
2. Se encontra, vincula `conversation.customer_id`.
3. Se não encontra customer, busca `leads` por `whatsapp_number`.
4. Se não encontra customer nem lead, cria lead.

Riscos:

- O PRD pede contato mínimo/cliente sem duplicidade. O estado atual favorece lead novo, não customer.
- `whatsapp_number` é único tanto em `customers` quanto em `leads`, mas não há entidade `contacts` separada.
- Conversão lead -> customer precisa ser preservada antes de mudar a regra.

## Vínculo atual com lead

Regra atual:

- Lead é buscado por `whatsapp_number`.
- Lead novo é criado com:
  - `source = WHATSAPP`
  - `stage = NOVO`
  - `pipeline_id` do pipeline `leads`
  - `stage_id` da primeira etapa do pipeline
- Lead existente tem `last_interaction_at` atualizado.

Riscos:

- Se já existe customer sem lead, a conversa fica vinculada ao customer e pode não ter contexto de pipeline.
- Se existem fluxos comerciais dependentes de lead, a migração para contato/customer precisa preservar lead quando houver.

## Vínculo atual com pipeline

Regra atual:

- `conversations.pipeline_id` e `stage_id` podem ser preenchidos a partir do lead.
- Fallback histórico da migration tenta preencher pipeline `leads` e primeira etapa.
- Frontend mostra etapa/pipeline, mas não altera etapa a partir do Inbox.

Riscos:

- Pipeline é visual/contextual no Inbox atual; não há ações de mover etapa dentro da conversa.
- Qualquer refatoração precisa manter `pipeline_id`/`stage_id` e não depender apenas do lead.

## Permissões atuais

### Backend

- Autenticação por JWT em `authenticate`.
- RBAC por `requireRole`.
- `ROOT` tem bypass em `requireRole`.
- `ADMIN` e `ATENDENTE` acessam rotas de operação.
- `ADMIN` gerencia canais e quick replies.
- `whatsapp-providers` é `ADMIN`.

### Escopo de conversa

- `ROOT`/`ADMIN`: acesso amplo.
- `ATENDENTE`: conversa atribuída a ele ou conversa livre em `AGUARDANDO_HUMANO`.

Riscos:

- Não há `org_id` na autenticação nem filtros por organização nas tabelas centrais do Inbox.
- Regras manuais de nota interna não tratam todos os papéis da mesma forma que `isInboxSuperUser`.
- `GERENTE` e `VENDEDOR` existem no domínio, mas não têm papel claro no Inbox atual.

## Riscos de quebra

### P0/P1 para a refatoração

1. **Isolamento por organização ausente no modelo atual**
   - PRD exige isolamento por organização.
   - Tabelas centrais (`conversations`, `messages`, `customers`, `leads`, `pipelines`, `quick_replies`, `whatsapp_providers`) não têm `org_id` consistente.
   - Plano deve introduzir isolamento de forma migrável, sem quebrar o singleton atual.

2. **Provider runtime não usa `whatsapp_providers`**
   - UI aceita UazAPI, Meta, Evolution etc.
   - Outbound atual usa Meta via `.env`.
   - QR/status Evolution usa `.env`.
   - Necessário criar camada de adapter e provider resolver antes de prometer UazAPI no Inbox.

3. **Credenciais sensíveis em JSONB sem criptografia evidenciada**
   - PRD exige criptografar tokens sensíveis.
   - `channel_integrations.credentials` e `whatsapp_providers.credentials` precisam de criptografia/migração segura.

4. **Realtime em memória**
   - SSE usa `EventEmitter` local.
   - Em múltiplas instâncias, eventos não cruzam processos/containers.
   - PRD exige realtime confiável; usar Redis pub/sub ou outro backbone antes de escalar.

5. **Outbound sem fila**
   - Envio é síncrono na request.
   - PRD exige filas para inbound/outbound.
   - Precisa gravar mensagem/intent e processar por worker com idempotência.

6. **Status de mensagem incompleto**
   - Não há processamento de status WhatsApp.
   - `DELIVERED`/`READ` existem mas não são atualizados por webhook.

7. **SLA e analytics não existem como domínio**
   - Existem `assigned_at`, `last_message_at`, `unread_count`, mas não first response, resolved_at, breached_at, timers, regras ou snapshots.

8. **Tipos de mensagem divergentes**
   - Frontend prevê mais tipos que o banco/backend.
   - Migração de enum precisa ser planejada para anexos futuros.

9. **Contato mínimo vs lead automático**
   - PRD pede contato mínimo; código atual cria lead.
   - Precisa decisão de domínio: criar `contacts`, criar `customers` mínimos ou manter lead e adicionar contato.

10. **Worktree já está sujo**
    - `git status --short` indicou alterações preexistentes em `.codex`, `apps/api/package*`, permissões, rotas de clientes/usuários, Sidebar, Ajustes, `.claude/skills`, `.codex.empty.bak`, PRD e teste de clientes.
    - A refatoração deve evitar misturar estes arquivos sem revisão explícita.

## Plano de migração seguro

### Checkpoint 0 - Diagnóstico

Status: este arquivo.

Critérios:

- Mapa do estado atual criado.
- Riscos registrados.
- Nenhum código funcional alterado.

### Fase 1 - Banco e domínio

Objetivo:

- Criar domínio final do Inbox sem remover as tabelas atuais.

Direção segura:

1. Criar novas migrations aditivas.
2. Introduzir `org_id` de forma compatível com o singleton atual.
3. Criar/ajustar tabelas para:
   - canais WhatsApp por organização;
   - conversas com SLA;
   - mensagens;
   - message events/status;
   - assignments/handoffs;
   - internal notes normalizadas;
   - tags;
   - conversation tags;
   - webhook logs;
   - outbound jobs/logs;
   - analytics snapshots se necessário.
4. Preservar `conversations.id` e `messages.id` quando possível.
5. Não remover `lead_id`, `customer_id`, `pipeline_id`, `stage_id`, `assigned_to`.
6. Definir decisão de contato mínimo antes da migration:
   - opção A: customer mínimo;
   - opção B: contact dedicado;
   - opção C: lead + customer opcional.

Gate:

- Migration rollback-safe/aditiva.
- Testes de migration ou integração cobrindo backfill principal.
- Nenhum P0/P1 aberto.

### Fase 2 - Conversas e mensagens

Objetivo:

- Reorganizar serviços de domínio antes dos adapters externos.

Direção segura:

1. Extrair use cases de conversa/mensagem do `inbox.service.ts`.
2. Manter API antiga funcionando enquanto cria camada nova.
3. Garantir idempotência em inbound e outbound.
4. Persistir eventos e status de mensagem.
5. Preservar resposta atual da API para não quebrar UI.

Gate:

- Testes backend para listagem, thread, acesso por papel, assign, handoff, close, note e read.

### Fase 3 - Webhook inbound WhatsApp

Objetivo:

- Receber webhook real com adapter WhatsApp selecionável.

Direção segura:

1. Manter endpoint Meta existente.
2. Adicionar adapter UazAPI sem remover Meta.
3. Normalizar payloads em evento interno único.
4. Registrar webhook log com assinatura/idempotência.
5. Worker processa eventos normalizados.

Gate:

- Testes com payload real/fake Meta e UazAPI.
- Duplicidade não cria mensagem duplicada.

### Fase 4 - Envio outbound WhatsApp

Objetivo:

- Tirar envio síncrono da request e usar provider primário por organização.

Direção segura:

1. Criar resolver de provider ativo/primário.
2. Criar interface `WhatsAppProviderAdapter`.
3. Implementar `MetaWhatsAppAdapter` e `UazapiWhatsAppAdapter`.
4. Salvar mensagem outbound pendente.
5. Enfileirar envio BullMQ.
6. Worker atualiza status `SENT`/`FAILED`.
7. Manter resposta da API compatível ou documentar mudança.

Gate:

- Testes de sucesso/falha/idempotência.
- Tokens lidos de armazenamento criptografado.

### Fase 5 - Realtime

Objetivo:

- Realtime confiável para lista, thread e status.

Direção segura:

1. Trocar ou complementar EventEmitter local com Redis pub/sub.
2. Manter SSE atual se for suficiente para UI.
3. Incluir eventos de status de mensagem, assignment, SLA e unread.

Gate:

- Testes unitários do broadcaster.
- Smoke de SSE/proxy.

### Fase 6 - Multiatendimento

Objetivo:

- Evoluir de atribuição básica para operação de equipe.

Direção segura:

1. Formalizar fila livre.
2. Registrar assignment history.
3. Implementar transferência para atendente específico.
4. Definir regra para autoatribuição.
5. Preservar `assigned_to` atual como estado corrente.

Gate:

- Testes de corrida/conflito em assumir conversa.
- Permissões por papel.

### Fase 7 - SLA

Objetivo:

- Calcular primeira resposta, tempo de atendimento, resolução e violações.

Direção segura:

1. Definir políticas SLA por organização/canal.
2. Adicionar timestamps e jobs de monitoramento.
3. Não calcular SLA apenas no frontend.

Gate:

- Testes de cálculo com relógio controlado.

### Fase 8 - Analytics

Objetivo:

- Métricas operacionais confiáveis.

Direção segura:

1. Endpoints agregados por período, atendente, status, SLA e pipeline.
2. Consultas indexadas.
3. Não misturar analytics com renderização frontend.

Gate:

- Testes de agregação com fixtures.

### Fase 9 - Testes backend

Objetivo:

- Backend aprovado antes da UI.

Direção segura:

1. Corrigir runner se necessário.
2. Cobrir rotas, serviços, workers, adapters e permissões.
3. Cobrir integração com Redis/BullMQ quando viável.

Gate:

- `typecheck` backend.
- Testes backend passando.
- Sem P0/P1 aberto.

### Fase 10 - Frontend

Objetivo:

- Evoluir UI atual sem quebrar UX e vínculos CRM.

Direção segura:

1. Preservar `ConversationList`, `ConversationThread`, `InboxComposer` como ponto de partida.
2. Adicionar filtros e indicadores de SLA.
3. Melhorar multiatendimento, tags, notas, status e analytics.
4. Só consumir endpoints já testados.

Gate:

- Typecheck frontend.
- E2E de Inbox.
- Validação visual em desktop/mobile.

### Fase 11 - Homologação

Objetivo:

- Validar operação real com WhatsApp.

Direção segura:

1. Testar inbound real.
2. Testar outbound real.
3. Testar duplicidade de webhook.
4. Testar múltiplos atendentes.
5. Testar isolamento de organização quando implementado.
6. Testar SLA e analytics com massa controlada.

Gate:

- QA_STATUS = PASS.
- SECURITY_STATUS = PASS.
- Aprovação humana antes de aceite final.

## Decisões técnicas pendentes antes da Fase 1

1. Organização/tenant:
   - O CRM atual parece operar com `settings` singleton.
   - O PRD exige isolamento por organização.
   - É preciso decidir se será introduzido `organizations` formal ou se `settings.id` será tratado como `org_id` transitório.

2. Contato mínimo:
   - Decidir se inbound sem cadastro cria `customers`, `contacts` ou `leads`.
   - A decisão impacta vínculo com cliente, lead e pipeline.

3. Provider WhatsApp:
   - O usuário indicou UazAPI como API usada no n8n.
   - A arquitetura deve suportar UazAPI via adapter próprio e manter Meta/Evolution sem acoplamento.

4. Criptografia:
   - Definir mecanismo de criptografia de credenciais (`KMS`, chave em env, libsodium/node crypto) antes de persistir novos tokens.

5. Realtime:
   - Decidir se SSE permanece ou se WebSocket/Socket.IO entra agora.
   - Para múltiplas instâncias, qualquer opção precisa de Redis/backplane.

## Próximo passo recomendado

Não avançar para código de produto antes de aprovar as decisões pendentes acima. A próxima fase técnica deve começar por uma proposta de schema aditivo e contratos de domínio para WhatsApp-only, preservando as respostas atuais do Inbox enquanto o backend novo é testado.
