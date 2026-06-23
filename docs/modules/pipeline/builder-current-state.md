# Pipeline Builder V2 - Estado Atual

Data: 2026-05-09
Responsavel: pipeline-backend-codex
Fonte de verdade: `PRD.DOCS/Build Pipeline/PRD-PIPELINE-BUILDER-V2.md`

## Resumo executivo

O pipeline atual ja tem backend canonico em `/api/v1/pipelines`, stages por pipeline, listagem de cards/leads por pipeline e movimentacao de card via `/api/v1/leads/:id/stage`.

O Builder V2 deve ser implementado como camada incremental de configuracao. Nao e seguro refazer o kanban nem duplicar `leads` para representar cards espelhados, porque o card atual e o proprio registro em `leads`, com `pipeline_id` e `stage_id` unicos, e `whatsapp_number` unico.

O caminho seguro inicial e:

1. Preservar o pipeline atual.
2. Adicionar configuracoes de stage e regras em tabelas novas.
3. Validar origem/destino contra pipelines/stages existentes.
4. Executar regras de forma idempotente quando o lead entra em uma stage.
5. Registrar logs de execucao sem abortar a movimentacao principal do lead.
6. Evitar criar lead duplicado para `CREATE_LINKED_CARD`/`MIRROR_CARD_TO_PIPELINE` ate existir modelo explicito de card multi-pipeline.

## Tabelas atuais relevantes

| Tabela | Papel atual | Campos relevantes | Observacoes |
| --- | --- | --- | --- |
| `settings` | Configuracao singleton da instancia | `id`, `company_name`, `status`, `plan` | Nao ha tabela `organizations`; em partes novas, o melhor escopo compativel e usar `settings.id` como `organization_id` tecnico. |
| `users` | Usuarios e roles | `id`, `role`, `status` | Roles iniciais foram expandidas por migration para `ROOT`, `GERENTE`, `VENDEDOR`. |
| `pipelines` | Pipelines canonicos | `id`, `name`, `slug`, `description`, `icon`, `is_active`, `is_default`, `flow_json`, `published_at`, `created_by` | `slug` e unico globalmente hoje, nao por organizacao. Nao possui `organization_id`. |
| `pipeline_stages` | Listas/etapas do kanban | `id`, `pipeline_id`, `name`, `color`, `position`, `is_won`, `is_lost` | Nao possui `is_initial`, settings/defaults, nem `updated_at`. |
| `leads` | Card operacional do kanban comercial | `id`, `pipeline_id`, `stage_id`, `stage`, `converted_customer_id`, `assigned_to`, `whatsapp_number` | O card atual e o lead. `whatsapp_number` e unico, entao duplicar lead para espelhar card quebra o modelo. |
| `customers` | Cliente convertido/operacional | `id`, `whatsapp_number`, `assigned_to`, `lifetime_value_cents` | Sem `organization_id`. |
| `orders` | Pedido do CRM/PDV | `id`, `customer_id`, `assigned_to`, `status` | Relaciona cliente, nao lead diretamente. |
| `production_orders` | Producao vinculada a pedido | `id`, `order_id`, `status`, `assigned_to` | Nao e card generico de pipeline. |
| `lead_timeline` | Historico do lead | `lead_id`, `type`, `metadata`, `created_by` | Ja registra `STAGE_CHANGED`. |
| `audit_logs` | Auditoria imutavel | `user_id`, `action`, `entity_type`, `entity_id`, `old_value`, `new_value`, `request_id` | Deve ser reaproveitada para CRUD de builder quando possivel. |

## Endpoints atuais de pipeline

| Metodo | Path | Uso atual | Permissao atual |
| --- | --- | --- | --- |
| `GET` | `/api/v1/pipelines` | Lista pipelines visiveis | Autenticado; inativos so para `ADMIN`/`ROOT` via filtro de servico |
| `GET` | `/api/v1/pipelines/slug/:slug` | Resolve pipeline por slug para paginas | Autenticado |
| `POST` | `/api/v1/pipelines` | Cria pipeline | `requireRole(['ADMIN'])`; `ROOT` bypassa |
| `GET` | `/api/v1/pipelines/:id` | Detalha pipeline | Autenticado |
| `PUT` | `/api/v1/pipelines/:id` | Edita nome/descricao/icone | `ADMIN` |
| `PATCH` | `/api/v1/pipelines/:id/toggle` | Ativa/desativa | `ADMIN` |
| `DELETE` | `/api/v1/pipelines/:id` | Remove pipeline vazio e nao default | `ADMIN` |
| `PUT` | `/api/v1/pipelines/:id/flow` | Salva canvas legado/avancado | `ADMIN` |
| `POST` | `/api/v1/pipelines/:id/publish` | Publica flow atual | `ADMIN` |
| `GET` | `/api/v1/pipelines/:id/stages` | Lista stages do pipeline | Autenticado |
| `POST` | `/api/v1/pipelines/:id/stages` | Cria stage | `ADMIN` |
| `PUT` | `/api/v1/pipelines/:id/stages/reorder` | Reordena stages | `ADMIN` |
| `PATCH` | `/api/v1/pipelines/:id/stages/:stageId` | Edita stage | `ADMIN` |
| `DELETE` | `/api/v1/pipelines/:id/stages/:stageId` | Remove stage sem leads e nao final | `ADMIN` |
| `GET` | `/api/v1/pipelines/:id/leads` | Lista cards/leads do pipeline | Autenticado |

Tambem existe rota legado-singular `/api/v1/pipeline/stages` focada no pipeline `leads`. Ela deve ser preservada por compatibilidade.

## Actions/frontend atuais

| Arquivo | Responsabilidade atual |
| --- | --- |
| `apps/web/app/(crm)/pipeline/[slug]/page.tsx` | Resolve pipeline por slug, carrega leads e stages, renderiza kanban atual. |
| `apps/web/app/(crm)/pipeline/actions.ts` | Server actions para criar pipeline, salvar flow, publicar e ativar/desativar. |
| `apps/web/app/(crm)/pipeline/[slug]/builder/page.tsx` | Abre builder atual por slug; `novo` cria pipeline antes do builder. |
| `apps/web/app/(crm)/pipeline/[slug]/builder/_components/BuilderCanvas.tsx` | Builder visual legado/avancado: canvas, stages, reorder, salvar/remover/criar stage por `/api/internal/pipelines/...`. |
| `apps/web/app/api/internal/[...path]/route.ts` | Proxy interno Next -> API, injeta Bearer token da sessao. |

## Fluxo atual de criacao/edicao de pipeline

1. A UI do builder em `/pipeline/novo/builder` envia `createPipelineAction`.
2. A action chama `POST /api/v1/pipelines`.
3. Backend normaliza slug com `normalizePipelineSlug`.
4. Backend insere em `pipelines` com `created_by`.
5. UI redireciona para `/pipeline/:slug/builder`.
6. Edicao atual de metadados e limitada: backend permite `PUT /pipelines/:id`, mas a tela atual foca em canvas e stages.
7. Ativar/desativar usa `PATCH /pipelines/:id/toggle`.
8. Publicacao usa `POST /pipelines/:id/publish`, que exige stages e flow com nodes.

## Fluxo atual de stages/listas

1. Builder atual carrega `GET /pipelines/:id/stages`.
2. Criacao usa `POST /pipelines/:id/stages`.
3. Edicao usa `PATCH /pipelines/:id/stages/:stageId`.
4. Reordenacao usa `PUT /pipelines/:id/stages/reorder`, com transacao simples atualizando cada `position`.
5. Remocao usa `DELETE /pipelines/:id/stages/:stageId`, bloqueando stages `is_won`/`is_lost` e stages com leads.

Lacunas atuais:

- Nao ha `is_initial`.
- Nao ha defaults/settings por stage.
- Nao ha validacao forte contra duplicidade de nome/posicao em todos os endpoints.
- `PUT /stages/reorder` nao valida se todos os stages enviados pertencem ao pipeline antes de confirmar.
- Apenas `ADMIN` configura; `GERENTE` tem permissao conceitual em `permissions.ts`, mas as rotas usam `requireRole(['ADMIN'])`.

## Fluxo atual de movimentacao de card

1. Card operacional = linha em `leads`.
2. A UI move lead chamando `PATCH /api/v1/leads/:id/stage`.
3. Payload aceita `stageId` ou enum legado `stage`.
4. Backend busca lead atual por `id`.
5. Backend valida acesso por responsavel: `ADMIN`, `ROOT`, `GERENTE` acessam; `ATENDENTE` apenas se for dono.
6. Com `stageId`, backend busca stage em `pipeline_stages` somente por `id`, sem validar que a stage pertence ao `currentLead.pipeline_id`.
7. Backend atualiza `leads.stage` e `leads.stage_id`.
8. Backend cria `lead_timeline` com `STAGE_CHANGED`.
9. Backend cria `audit_logs` com `UPDATE_STAGE`.
10. Backend retorna o lead atualizado.

Risco importante: como `stageId` nao e validado contra o pipeline atual do lead, uma stage de outro pipeline pode ser aplicada no lead sem mover `leads.pipeline_id`. A implementacao do executor do Builder V2 deve corrigir esse caminho para nao disparar regras inconsistentes.

## Permissoes atuais

| Camada | Estado atual |
| --- | --- |
| Autenticacao | JWT via `authenticate`; payload contem `id`, `email`, `role`, `name`. |
| Roles | `requireRole` da bypass para `ROOT`; rotas de pipeline usam majoritariamente `ADMIN`. |
| Permissoes granulares | `permissions.ts` possui `pipeline.configure` para `ADMIN` e `GERENTE`, mas nao e usado em `pipelines.routes.ts`. |
| Organizacao | Nao ha `organization_id` em pipelines, leads, customers, orders ou users. O app opera como single-tenant por instancia/settings. |

## Riscos de quebra

| Risco | Severidade | Mitigacao segura |
| --- | --- | --- |
| Duplicar lead para criar card espelhado | Alta | Nao duplicar `leads`; usar tabela tecnica de links/logs ate existir modelo de card multi-pipeline. |
| Stage de outro pipeline em `PATCH /leads/:id/stage` | Alta | Validar que `stage.pipeline_id = currentLead.pipeline_id` para movimento normal; executor de regra deve ser o unico caminho que move pipeline. |
| Criar regras com origem/destino invalidos | Alta | Validar pipeline/stage destino em transacao/servico antes de salvar regra. |
| Reexecutar regra e gerar duplicidade | Alta | Chave de idempotencia unica por regra + trigger + lead + stage. |
| Quebrar builder/canvas atual | Alta | Nao alterar frontend nem contrato atual de stages/flow. |
| Mudar escopo de organizacao em tabelas existentes | Alta | Nao adicionar `organization_id` em tabelas criticas nesta fase; adicionar apenas em tabelas novas usando `settings.id`. |
| Reordenar stages parcialmente | Media | Manter transacao e validar quantidade/pertencimento antes de atualizar em melhoria posterior. |

## Plano seguro para Builder V2 backend

1. Criar tabelas novas:
   - `pipeline_stage_settings`
   - `pipeline_automation_rules`
   - `pipeline_rule_executions`
   - `pipeline_card_links`
2. Usar `settings.id` como `organization_id` tecnico enquanto nao existir tabela `organizations`.
3. Adicionar endpoints de defaults e regras em `/api/v1/pipelines/:id/...` sem remover endpoints atuais.
4. Usar `requirePermission('pipeline.configure')` ou roles equivalentes para permitir `ROOT`, `ADMIN`, `GERENTE` nas rotas de configuracao.
5. Validar que source pipeline/stage e target pipeline/stage existem e pertencem aos pipelines informados.
6. Implementar simulacao de regra sem alterar dados.
7. Integrar executor ao movimento de lead com logs e idempotencia.
8. Para `MOVE_CARD_TO_PIPELINE`, mover `leads.pipeline_id` e `stage_id` de forma idempotente.
9. Para `CREATE_LINKED_CARD` e `MIRROR_CARD_TO_PIPELINE`, nesta fase segura criar apenas relacao tecnica em `pipeline_card_links` e log de execucao; nao duplicar `leads`.
10. Nao implementar frontend nesta etapa.

## Backend minimo necessario

| Necessidade PRD | Menor implementacao segura |
| --- | --- |
| Stage defaults | Persistir/retornar JSON e campos simples por `stage_id`. |
| Regras simples | CRUD de regras com `CARD_ENTERED_STAGE`, `MOVE_CARD_TO_PIPELINE`, `CREATE_LINKED_CARD`, `MIRROR_CARD_TO_PIPELINE`. |
| Isolamento organizacional | `organization_id` em tabelas novas, preenchido pelo singleton `settings.id`. |
| Permissoes | Rotas de builder com `pipeline.configure`. |
| Idempotencia | `idempotency_key` unica em `pipeline_rule_executions` e chave unica em `pipeline_card_links`. |
| Logs | `pipeline_rule_executions` para toda execucao/simulacao real; `audit_logs` para CRUD de regra/default quando houver `req`. |
| Preservar vinculos | Links armazenam `source_lead_id`, `target_lead_id`, `customer_id` e `order_id` quando disponiveis. |

## Bloqueio conhecido para fase futura

O kanban atual nao tem entidade `cards`. Portanto, um mesmo lead nao consegue aparecer como cards independentes em varios pipelines sem mudar o modelo de dados ou a query do kanban. O Builder V2 backend deve registrar regras e links agora, mas uma experiencia visual de card espelhado real precisa de decisao posterior: criar entidade `pipeline_cards` ou adaptar a leitura do kanban para links.
