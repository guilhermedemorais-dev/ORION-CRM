# RBAC, autenticação e integrações, mapa técnico

**Baseline:** `29c1639`. Este é um inventário de controles existentes e riscos
evidenciados, não uma certificação de segurança.

## Autenticação e sessão

| Entrada | Controle observado | Persistência/efeito |
| --- | --- | --- |
| `POST /api/v1/auth/login` | Zod, comparação bcrypt, limitação de falhas e checagem de usuário ativo | grava hash SHA-256 do refresh token em `refresh_tokens`, atualiza `last_login_at`, cria audit log |
| `POST /api/v1/auth/refresh` | cookie httpOnly, `sameSite: strict`, rotação em transação, revogação de todos os tokens em reuso | marca token usado, cria novo token/hash e cookie restrito a `/api/v1/auth/refresh` |
| API autenticada | `authenticate` | requer `Authorization: Bearer`; JWT contém id, email, role e nome |

O bloqueio de login é armazenado em memória do processo. Em múltiplas réplicas
ou após reinício não há evidência de persistência/compartilhamento desse estado.

## RBAC efetivo

`requireRole` deixa `ROOT` passar por qualquer lista de roles. `userCan` em
`middleware/permissions.ts` aplica matriz e override de `custom_permissions`.
As abas da Ficha usam `userCan` no frontend, logo são **controle visual**; cada
endpoint sensível precisa manter seu middleware ou helper próprio.

| Área | Roles de referência no código | Observação |
| --- | --- | --- |
| Clientes | ADMIN, GERENTE, ATENDENTE; ROOT por bypass | escrita tem helper de dono de carteira/override |
| Financeiro | ROOT, ADMIN, FINANCEIRO | `financial.routes.ts` aplica `requireRole` na listagem |
| PDV | ADMIN, ATENDENTE | rotas de venda e link Mercado Pago |
| OS | ADMIN, GERENTE, ATENDENTE; PRODUCAO em etapa | separa criação e avanço de etapa |
| Ficha | chaves `ficha.*.view` | apenas filtro de aba até validação de cada endpoint |
| Integrações/configuração | ADMIN em matriz de permissões | confirmar por rota, não inferir da matriz |

### Inconsistências e riscos já documentados

- A auditoria existente em `docs/qa/reports/architecture/backend-database-audit.md`
  aponta políticas divergentes de ROOT e escopo de clientes/inbox. Esta passada
  não reclassifica esses achados sem teste de rota, mas os mantém como risco
  prioritário.
- `requirePermission` lê `custom_permissions` do objeto `req.user`; o JWT
  tipado em `authenticate` não inclui esse campo. Rotas que dependam desse
  middleware exigem validação específica de como o override é carregado.
- O PRD histórico lista menos roles que o código atual, que usa ROOT e GERENTE.

## Matriz role × módulo × ação

Legenda: `R` ROOT por bypass global de `requireRole`; `A` ADMIN; `G` GERENTE;
`T` ATENDENTE; `P` PRODUCAO; `F` FINANCEIRO. A coluna “Fonte” é o guard de
backend observado, não uma promessa de que a UI exponha a ação. `*` é a única
exceção conhecida ao bypass ROOT.

| Módulo e ação | Roles que o backend permite por guard/fonte | Fonte e efeito | Limite de segurança |
| --- | --- | --- | --- |
| Clientes, listar/detalhar/criar | R, A, T | `customers.routes.ts`, `requireRole([ADMIN, ATENDENTE])` | edição de cliente de outra carteira tem helper/permissão adicional. |
| Clientes, edição/histórico/foto/anexo | R, A, T, G | `customers.routes.ts` | não concluir escopo de outro cliente apenas pelo role. |
| Clientes, GDPR erasure | R, A | `customers.routes.ts` | operação destrutiva; não há prova de fluxo de retenção. |
| Leads, CRUD/tarefas/anexos | R, A, T; ganhar/perder inclui G em rotas específicas | `leads.routes.ts` | pipeline e ownership exigem teste de rota. |
| Pipeline legado, ler stages/campos | todos via `allRoles` em pontos de leitura | `pipeline.routes.ts` | não confundir leitura com configuração. |
| Pipeline legado, alterar stage/campo | R, A | `pipeline.routes.ts` | configuração de fluxo muda operação de leads. |
| Pipelines, CRUD/stages/defaults | R, A ou `pipeline.configure` em pontos finais | `pipelines.routes.ts` | `requirePermission` depende de `custom_permissions` estar carregado. |
| Atendimento, ler/patch bloco | R, A, T, G, P | `attendance.routes.ts` | HTML e transição de status têm riscos próprios. |
| Atendimento, criar bloco | R, A, T, G | `attendance.routes.ts` | não cria proposta/OS automaticamente. |
| Atendimento, apagar bloco | R, A, G | `attendance.routes.ts` | ação destrutiva. |
| OS, ler materiais/listar | R, A, T, G, P | `service-orders.routes.ts` | consulta não dá direito de alterar etapa. |
| OS, criar/material/labor | R, A, T, G | `service-orders.routes.ts` | material não executa baixa de estoque. |
| OS, avançar etapa | R, A, G, P | `service-orders.routes.ts` | produção não tem edição geral. |
| Pedidos, listar/detalhar | R, A, T, F, P | `orders.routes.ts` | dados financeiros podem ficar visíveis em payload; revisar. |
| Pedidos, criar/NF-e/recibo | R, A, T, com F em NF-e | `orders.routes.ts` | emissão/integração externa não homologada. |
| Pedidos, status/aprovação | R, A, T, F no guard; `order.approve` pode restringir mais | `orders.routes.ts`, `userCan` | role allowlist e permission helper coexistem. |
| Produção, listar/avançar/pausa | R, A, P | `production.routes.ts` | escopo por usuário de produção deve ser validado em DB real. |
| Produtos, lista/detalhe/movimentos | R, A, T, P | `products.routes.ts` | custo usa `product.cost.view`, não inferir que T/P podem ver custo. |
| Produtos, criar/editar/importar/ajustar/foto | R, A | `products.routes.ts` | ajuste altera estoque; requer auditoria/transação. |
| Financeiro, leitura e lançamentos | R, A, F | `financial.routes.ts` | GERENTE aparece na matriz `userCan`, mas não nessa route allowlist. |
| PDV, venda/link MP/cliente rápido | R, A, T | `pdv.routes.ts` | venda tem efeitos estoque/financeiro. |
| Inbox, conversa/mensagem/handoff | R, A, T | `inbox.routes.ts` | serviço também aplica escopo de responsável; validar negado. |
| Automação e store settings | R, A | `router.use(authenticate, requireRole([ADMIN]))` | n8n/loja têm efeitos externos e configuração sensível. |
| Integrações, providers, WhatsApp admin | R, A | routes de integrations/providers/whatsapp | segredos/configuração; não registrar valores em log ou docs. |
| Banco administrativo | R somente | `database-admin.routes.ts` | export/import/truncate são superfícies de alto impacto. |
| Analytics | R, A | `analytics.routes.ts` | números não foram reconciliados com fonte real. |
| Roadmap e system errors | R, com A em ação limitada de roadmap | rotas correspondentes | não confundir gestão interna com dados de negócio. |
| Base Técnica, docs/busca | **A somente*** | `support-technical.routes.ts`, `role === 'ADMIN'` | ROOT, T, G, P e F recebem 403; teste isolado confirmou ROOT. |

### Superfícies que exigem teste negativo antes de mudança

1. Toda rota que usa `requirePermission`: o JWT tipado não carrega
   comprovadamente `custom_permissions`, portanto o override pode divergir da
   UI.
2. Clientes, Inbox e Produção: o role pode liberar a rota, mas regras de dono,
   atribuição ou escopo podem negar dentro do handler/service.
3. Financeiro: há divergência direta entre `PERMISSIONS.financial.view`
   (inclui GERENTE) e a allowlist de `financial.routes.ts` (não inclui).
4. Base Técnica: não substituir `requireAdminOnly` por `requireRole`, pois isso
   reintroduziria o bypass ROOT contra o requisito explícito do handoff.

## Integrações reais encontradas

| Integração | Entrada/saída | Controle | Estado |
| --- | --- | --- | --- |
| Meta WhatsApp Cloud | `GET/POST /api/v1/webhooks/whatsapp`; Graph API v20 | token de verificação, HMAC SHA-256 com `META_APP_SECRET`, comparação timing-safe; job em fila | código existe; credenciais e execução real NÃO VALIDADAS |
| n8n | `n8n.routes.ts` e `N8nService` | API key em `X-N8N-API-KEY`; URL e chave em env | código existe; workflows/credenciais externos NÃO INCLUÍDOS/NÃO VALIDADOS |
| Mercado Pago | PDV cria preferência; rotas sob `/api/v1` usam serviço | Bearer access token; HMAC de webhook no serviço; payment idempotency no domínio | criação de preferência existente; callback real NÃO VALIDADO |
| Transportadoras | `deliveries.routes.ts` + registry de adapters | credenciais em `carriers_config`, chamada externa ao criar envio | falha externa é logada e a entrega ainda pode ser criada sem despacho |
| ViaCEP | `ClientFichaTab.tsx` | chamada browser-side por CEP | auxiliar, sem autenticação; disponibilidade não garantida |

### Inventário de contratos, credenciais e falhas

| Integração | Entrada → saída e arquivos | Autenticação/configuração sem valores | Retry, logs e estado real |
| --- | --- | --- | --- |
| Meta Cloud API | `GET/POST /api/v1/webhooks/whatsapp` → worker → `inbox-events`; envio por `meta-whatsapp.service.ts` | `META_API_TOKEN`, `META_PHONE_NUMBER_ID`, verify token e app secret; HMAC SHA-256 | webhook é aceito em fila; envio/Graph API usam timeout/erros controlados. Credencial e fluxo real **NÃO VALIDADOS**. |
| UazAPI | `whatsapp_providers` primário → `whatsapp-sender.service.ts` → `POST {base}/send/text` | provider `uazapi`, `base_url` e `credentials.api_key`; header `token` | timeout de 12s; 502 se rejeitado; retorna id ou fallback gerado. **IMPLEMENTADO EM CÓDIGO, NÃO HOMOLOGADO.** |
| Evolution API | settings admin/status/QR e provider primário → Evolution | env `EVOLUTION_URL/API_KEY/INSTANCE` ou provider; header `apikey` | status/QR têm timeout de 10s e disconnect tenta três endpoints. Envio usa `/message/sendText/:instance`. **NÃO VALIDADO.** |
| Meta como provider | provider primário → Graph v20 messages | `access_token` e `phone_number_id` no registro provider | timeout de 12s e 502 no erro; pode haver fallback Meta por env se nenhum provider ativo. **NÃO VALIDADO.** |
| Z-API e REST genérico | provider primário → endpoint de envio | Z-API usa instance/client/security tokens; REST usa URL, header e API key | timeout de 12s e 502 no erro. **IMPLEMENTADO EM CÓDIGO, NÃO HOMOLOGADO.** |
| Baileys e Twilio | tipos aceitos pela tela/configuração | credenciais são aceitas no registro | `sendWhatsAppMessage` devolve `501 WHATSAPP_PROVIDER_NOT_IMPLEMENTED`; não configurar como primário para envio. |
| n8n | ORION admin REST ↔ n8n; webhooks n8n → `/api/v1/n8n/webhook/*` | `N8N_URL`, `N8N_API_KEY`, `N8N_WEBHOOK_URL`; aceita key de `webhook_keys`, legado settings ou env nas entradas | serviço pagina/propaga erro; não há n8n no Compose, workflow/credencial/execução externa **NÃO INCLUÍDOS/NÃO VALIDADOS**. |
| Mercado Pago | PDV/loja criam preference; webhook busca pagamento e atualiza domínio | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`; Bearer e HMAC timing-safe | erros retornam indisponibilidade; idempotência no domínio de pagamento. Callback real **NÃO VALIDADO**. |
| LLM/Copilot | `/assistant/chat` e `/ai-copilot/*` → endpoint OpenAI-compatível/Anthropic | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`; config do copiloto inclui base URL/modelo/chave | rate limit 20/min em chat; logs em `assistant_logs`. `api_key_enc` está em texto no DB, risco crítico; execução **NÃO VALIDADA**. |
| Operador/Sophxy | `POST /api/v1/operator/webhook` provisiona/suspende/reativa/plano | `OPERATOR_WEBHOOK_SECRET`, HMAC `x-operator-signature` e idempotency UUID | rate limit 20/min; grava `operator_webhook_log`, inclusive falha. Não executar contra ambiente real nesta passada. |
| ViaCEP | browser Ficha → ViaCEP | sem segredo; CEP é dado de cliente | disponibilidade/privacidade dependem de terceiro; falha não deve bloquear edição manual. |
| SMTP | potencial envio de e-mail pela API | `SMTP_HOST/PORT/USER/PASS` no ambiente | configuração declarada em `env.ts`; não foi localizada execução/homologação suficiente para afirmar envio ativo. |
| Upload local/Nginx | rota multer → `UPLOAD_PATH` → volume `/app/uploads` → `/uploads/*` | sem credencial externa; validação de magic bytes em `lib/uploads.ts` | paths são resolvidos dentro da raiz; backups/retenção/restore do volume **NÃO VALIDADOS**. |

### Variáveis que devem existir somente no ambiente

`DATABASE_URL`, `REDIS_URL`, JWTs, segredo do operador, Meta, Evolution,
OpenAI/Anthropic, Mercado Pago, n8n e SMTP são definidos e validados em
`config/env.ts`. O manifesto e o snapshot podem conter `.env.example`, mas não
valores. Nenhum procedimento de handoff deve solicitar ou registrar esses
segredos em Markdown, ticket, log de terminal ou issue.

## Fluxo de WhatsApp

```mermaid
flowchart LR
  M[Meta Cloud API] -->|GET verify token| W[/webhooks/whatsapp]
  M -->|POST assinatura HMAC| W
  W --> Q[enqueueWhatsAppWebhookJob]
  Q --> P[parser Meta]
  P --> I[inbox/conversations/messages]
  N[n8n] -->|API key| A[/api/v1/n8n]
  A --> I
```

O worker e a persistência final devem ser confirmados contra
`whatsappWebhook.worker.ts` e `inbox-events.service.ts` antes de declarar a
cadeia entregue ponta a ponta.

## Contrato de segurança da Base Técnica

| Surface | Asset | Regra | Controle necessário | Evidência negativa exigida |
| --- | --- | --- | --- | --- |
| Página Base Técnica | arquitetura, endpoints, riscos | somente ADMIN, inclusive ROOT negado | guard frontend e endpoint backend com `authenticate` + `role === 'ADMIN'` | ROOT/ATENDENTE/GERENTE/FINANCEIRO recebem 403 e não recebem Markdown |
| Renderização Markdown | conteúdo de docs | arquivo permitido, sem path arbitrário | allowlist de documentos e sanitização/renderer seguro | tentativa de `../` e HTML perigoso bloqueada |
| Busca | índice documental | somente usuário autorizado | consulta backend com RBAC, sem expor caminho sensível | usuário sem role não infere conteúdo por busca |

**Estado:** spec, TASK-062, issue #62, testes negativos e aprovação desta
solicitação existem. A matriz HTTP do ZIP confirmou 401 sem token, 200 ADMIN,
403 ROOT e 404 para ID não permitido. Browser autenticado e produção continuam
**NÃO HOMOLOGADOS**.
