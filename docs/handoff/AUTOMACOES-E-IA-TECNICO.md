# Automações e IA, estado técnico atual

## Escopo e regra de leitura

Este documento descreve somente o que o commit de baseline `29c1639` expõe no
ORION. Não prova que uma instância n8n, um provedor LLM ou um workflow esteja
ativo. A migration 063 presente no diretório de trabalho não integra esta
leitura.

## Mapa operacional

```mermaid
flowchart LR
  W[Canal externo, por exemplo WhatsApp] --> N[n8n externo]
  N -->|Bearer de sistema| H[/api/v1/n8n/webhook/*/]
  H --> I[Inbox, Leads, Agenda e Pedidos]
  I --> R[PostgreSQL e Redis/BullMQ]
  A[ADMIN em Automações] --> O[/api/v1/automations]
  O -->|API key| N
  U[Usuário autenticado] --> C[/api/v1/assistant/chat]
  C --> L[Qwen compatível ou Anthropic]
  L --> T[Funções SQL permitidas por role]
```

`n8n` é uma dependência externa no baseline: `apps/api/src/services/n8n.service.ts`
usa `N8N_URL` e `N8N_API_KEY`, mas `docker-compose.yml` não declara seu
container. Logo, o diagrama descreve um contrato de integração, não uma
topologia homologada.

## Automações, builder e n8n

| Superfície | Implementação observada | Estado |
| --- | --- | --- |
| Tela | `apps/web/app/(crm)/automacoes/page.tsx`, catálogo e editor visual | PARCIAL, UI existe; não testada em navegador |
| API administrativa | `apps/api/src/routes/automations.routes.ts`, somente `ADMIN` | IMPLEMENTADO em código |
| Operações n8n | listar, obter, criar, atualizar, ativar/desativar, excluir e listar execuções | IMPLEMENTADO em código; NÃO VALIDADO contra n8n |
| Persistência local | `automation_flows` guarda espelho, status, definição JSON e contadores | IMPLEMENTADO; não é fonte de execução |
| Catálogo | 7 triggers, 8 ações e 4 controles em `automation-catalog.service.ts` | IMPLEMENTADO como catálogo curado, não como garantia de nó configurado |
| Workflows de sistema | `startup/system-workflows.ts` define WF-A a WF-D, todos inativos | NÃO PUBLICADOS pelo baseline, pois o seed está comentado em `index.ts` |

O CRUD recebe JSON de nós e conexões com validação Zod estrutural. Ele não
consulta o schema vivo do nó, não executa `validate_workflow`, não relê as
conexões após a escrita e não testa execução antes de ativar. Portanto, salvar
ou ativar pelo ORION não equivale a workflow válido em produção.

### Contrato REST com o n8n

O serviço usa a API REST do n8n com header `X-N8N-API-KEY`:

| Operação ORION | Chamado externo |
| --- | --- |
| Listar workflows | `GET /api/v1/workflows`, pagina até 20 lotes de 100 |
| Ler, criar, atualizar, excluir | `/api/v1/workflows/:id` e coleção |
| Alternar | `POST /api/v1/workflows/:id/activate` ou `/deactivate` |
| Execuções | `GET /api/v1/executions?workflowId=&limit=` |
| Teste em Ajustes | `GET {base_url}/healthz` |

O segredo para esse acesso deve existir somente no ambiente/armazenamento de
credenciais. O handoff não contém valores. Antes de operar uma instância, o
responsável deve validar no n8n o schema de cada nó, as conexões, credenciais,
tratamento de erro e uma execução controlada, pois isto não foi feito nesta
passada.

## Webhooks que o n8n pode chamar

Todos passam por `assertN8nAuthorized` em `apps/api/src/routes/n8n.routes.ts`.
Aceitam Bearer token de `webhook_keys` não revogado, chave legada em `settings`
ou `N8N_API_KEY` de ambiente.

| Endpoint | Efeito no ORION | Estado de negócio |
| --- | --- | --- |
| `POST /webhook/new-message` | cria/atualiza conversa e mensagem inbound automatizada; responde 202 | IMPLEMENTADO em código |
| `POST /webhook/order-status` | atualiza status do pedido, idempotente quando igual | IMPLEMENTADO em código |
| `GET /webhook/conversation-status` | expõe estado e contagem da conversa | IMPLEMENTADO em código |
| `POST /webhook/bot-reply` | registra mensagem outbound automatizada, não a envia ao canal | IMPLEMENTADO em código |
| `POST /webhook/update-lead` | upsert por telefone/pipeline, mapeia stage e anexa dados em `notes` | IMPLEMENTADO; formato de `notes` é frágil |
| `POST /webhook/handoff` | muda conversa BOT para AGUARDANDO_HUMANO e anexa resumo | IMPLEMENTADO em código |
| `GET /webhook/lead-context` | retorna lead, últimas 20 mensagens e próximo agendamento | IMPLEMENTADO em código |
| `GET /webhook/available-slots` | calcula até 3 slots pela agenda local | IMPLEMENTADO; não consulta Google Calendar |
| `POST /webhook/create-appointment` | upsert de lead, agenda, timeline e job de lembrete | IMPLEMENTADO em código; NÃO VALIDADO com Redis/n8n |

O fluxo de agenda calcula horários locais de 45 minutos, de segunda a sábado,
limita duas sobreposições e busca no máximo 14 dias quando solicitado. Essa é
uma regra de código atual, não uma decisão de negócio homologada. A criação
marca o lead como `QUALIFICADO` e tenta enfileirar lembrete 24h antes.

## Assistente interno e Copiloto IA

`POST /api/v1/assistant/chat` exige sessão autenticada, limita a 20 chamadas
por minuto e aceita uma mensagem ou até 20 mensagens de histórico. A seleção
efetiva é: configuração ativa compatível com Qwen, depois Anthropic de ambiente,
depois fallback por palavras-chave com consultas SQL. O serviço também exige ao
menos `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` no ambiente antes de começar;
isso conflita com a aparente prioridade do Qwen e precisa de teste de
configuração real.

As ferramentas disponíveis são somente leitura de leads, pedidos, produção,
financeiro, comissões, alertas de estoque, conversão e produtos, filtradas por
role no próprio serviço. Cada resposta registra em `assistant_logs` usuário,
role, ferramentas, estimativa de tokens e latência. Não há nesta passada prova
de que os filtros SQL e o RBAC resistam a todos os caminhos de prompt injection.

`/api/v1/ai-copilot/config` e `/skills` permitem a `ROOT` ou `ADMIN` gerir
provedor, URL, modelo, prompt e skills. Skills ativas são concatenadas ao
system prompt. A rota de gerar skill chama `${base_url}/chat/completions` e
espera JSON, mas apenas devolve a sugestão, não a persiste.

### Segurança da configuração IA

Apesar do nome `api_key_enc`, `ai_copilot.service.ts` grava o valor recebido sem
criptografá-lo, `getCopilotApiKeyRaw` o retorna bruto e `generateSkill` o envia
como Bearer. O comentário da migration 043 não é evidência de `pgcrypto` em
uso. Tratar como **segredo em texto no banco** até uma implementação auditada
de criptografia e rotação. O endpoint de leitura mascara o retorno, mas isso
não resolve o armazenamento.

## Divergências e pendências

1. O PRD ainda contém decisões Activepieces e Python AI, enquanto o código
   atual usa n8n e TypeScript, sem container Python nem n8n no Compose.
2. O endpoint `bot-reply` apenas grava no Inbox. A saída física ao WhatsApp
   depende de workflow/provedor externo não presente no repositório.
3. `available-slots` substitui uma integração de Google Calendar pela agenda
   local. Não declarar sincronização com Google Calendar como existente.
4. O contrato de webhook aceita três fontes de chave, inclusive legado. Definir
   data de remoção do legado, rotação, escopo por integração e auditoria de
   uso antes de homologar.
5. A UI administrativa pode ativar workflow sem validação nativa do n8n nem
   teste de efeitos colaterais. É uma lacuna operacional de alta prioridade.

## Evidências de código

- `apps/api/src/routes/automations.routes.ts`
- `apps/api/src/services/n8n.service.ts`
- `apps/api/src/routes/n8n.routes.ts`
- `apps/api/src/routes/assistant.routes.ts` e `services/assistant.service.ts`
- `apps/api/src/routes/ai-copilot.routes.ts` e `services/ai-copilot.service.ts`
- migrations 014, 015, 041 e 043

Integrações externas, envio real de mensagens, n8n, Redis/BullMQ, LLM e
permissões negativas permanecem **NÃO VALIDADOS**.
