# 🟡 TASK-054: Consolidar config por etapa em flow_stage_rules + stock_action + matar pipeline_stage_settings

## Status
🟡 EM ANDAMENTO — implementacao concluida e commitada; PR #58 aberto e em review.
Aguardando o print do QA visual e o review final do orquestrador.

- Status Kanban: In Review — PR #58 aberto em 07/08/2026
- PR: https://github.com/guilhermedemorais-dev/ORION-CRM/pull/58
- Branch canonica: `feat/flow-stage-stock-action` (a implementacao foi feita no
  worktree `claude/distracted-meitner-9b9576` e commitada nessa branch)
- Historico do card: o item estava no board **sem Status** (invisivel nas colunas)
  e foi **fechado indevidamente** em 07/08/2026 21:23 UTC. Reaberto, relatorio
  publicado como comentario na issue #57 e Status corrigido.
- Status da claim: `claimed` — Claude Code, 07/08/2026
- Gate `minimal-implementation-gate`: `LIBERAR IMPLEMENTACAO` (07/08/2026)

## Tipo
Feature + Refactor (Banco + API + Frontend)

## Prioridade
P0 — fundacao do fluxo Make-to-Order (EPIC do fluxo Caixa -> Separacao -> Fabricacao).

## Estimativa
- Migracao (enum + colunas aditivas + guard + DROP): `0,5 dia`
- Backend `flows.routes.ts` (schema/insert/update/select) + remover endpoints mortos em `pipelines.routes.ts`: `0,5 a 1,0 dia`
- Frontend `FluxoTab.tsx` (2 dropdowns por etapa): `0,5 dia`
- Testes, typecheck, validacao e evidencias: `0,5 dia`
- Estimativa total: `2,0 a 2,5 dias uteis`

## Janela de entrega sugerida
- Melhor caso: `2,0 dias uteis`
- Faixa realista: `2 a 3 dias uteis`
- Considera que NAO havera execucao da baixa (reserva/backflush) nesta task — so config.

## Project fields
- `Status`: `In Review`
- `Type`: `Feature + Refactor`
- `Priority`: `P0`
- `Approval`: `Pending` (aceite final do humano; commit/PR ja autorizados em 07/08/2026)
- `Labels`: `feature`, `tech-debt`, `high-priority`

## Issue GitHub
Issue criada: `#57` — `https://github.com/guilhermedemorais-dev/ORION-CRM/issues/57`

## Branch sugerida
`feat/flow-stage-stock-action`

## PR
Obrigatorio. Nao aprovar sem: migracao com evidencia de `db:migrate`, typecheck limpo,
print do fluxo salvo com `stock_action`, e QA visual do `ui-ux-standard` nos dropdowns.

## Responsavel
- Execucao: `dev-implementation-standard` (Executor LLM: **Claude Code** — toca dinheiro/estoque/RBAC/schema/DROP, sensivel).
- Revisao/orquestracao: `dev-workflow-standard` (humano/orquestrador).
- Skills obrigatorias a acionar nesta task:
  - `minimal-implementation-gate` — ANTES de codar (revisao de escopo) e no PR (complexidade). Bloqueia implementacao ate `LIBERAR IMPLEMENTACAO`.
  - `security-standard` — OBRIGATORIO: mexe em autorizacao (`min_role_to_move`, `pipeline.configure`) e faz DROP de tabela em producao.
  - `ui-ux-standard` — OBRIGATORIO: ha UI (dropdowns novos no `FluxoTab.tsx`).

## Definition of Entry
- Spec de modulo aprovada em `docs/specs/estoque/baixa-estoque-manufatura/module-spec.md`.
- Arquitetura de referencia em `docs/architecture/pipeline-fluxo-baixa-estoque.md`.
- Issue #57 vinculada.
- Decisao de arquitetura batida: tabela canonica = `flow_stage_rules`; matar o fantasma.
- Confirmado (dump + painel de producao, 06/08/2026): `pipeline_stage_settings` = 0 registros.

## Definition of Exit
- `flow_stage_rules` com `stock_action` + `min_role_to_move` persistindo via `FluxoTab`.
- `pipeline_stage_settings` removida (migracao com guard) e 2 endpoints mortos apagados.
- Regras existentes intactas; `checkFlowRules` inalterado; `tsc --noEmit` limpo.
- Central de Ajuda atualizada (config de etapa ganhou "Acao de estoque" e "Quem pode mover").
- Evidencias no PR; QA de `ui-ux-standard` e `security-standard` anexados.

## Objetivo da task
Unificar a configuracao por etapa na tabela viva `flow_stage_rules`, adicionando a
**acao de estoque por etapa** (`stock_action`) e o **gate de papel** (`min_role_to_move`),
e **remover a tabela morta `pipeline_stage_settings`**. Esta task e SO a fundacao de
config — NAO executa a baixa (fatias seguintes do EPIC).

### Contexto no fluxo (o que esta config habilita — Atendimento -> Caixa -> Estoque -> OS -> Entrega)
Esta task cria os "encaixes" de config que as fatias seguintes vao usar para executar
o fluxo Make-to-Order. Sem eles, nao ha onde pendurar o comportamento:
- `stock_action = reservar` -> etapa de **CAIXA** (venda personalizada finalizada) reserva o insumo no estoque.
- `stock_action = baixar_peca` -> etapa de **CAIXA** (peca **pronta**, ao receber o pagamento) baixa a peca.
- `stock_action = baixar_insumo` -> etapa de **PRODUCAO/OS** (ourives clica "iniciar") faz o **backflush** do insumo reservado.
- `stock_action = retornar` -> **cancelamento/sobra** devolve ao estoque.
- `min_role_to_move` -> **atendente NAO move o pedido para a etapa de Caixa**; so ADMIN/GERENTE finalizam.
Obs: a regra "insumo reservado so ADMIN/GERENTE alteram" e a execucao da baixa NAO
entram aqui — sao fatias seguintes (reserva/backflush). Esta task so entrega a config.

## Specs obrigatorias
- `docs/specs/estoque/baixa-estoque-manufatura/module-spec.md` (contrato de banco §3.1, matriz UI §3.2)

## Docs obrigatorios
- `docs/architecture/pipeline-fluxo-baixa-estoque.md`

## Arquivos e modulos permitidos (`locked_paths`)
- `apps/api/src/db/migrations/063_flow_stage_stock_action.sql` (novo — confirmar nº livre)
- `apps/api/src/routes/flows.routes.ts`
- `apps/api/src/routes/pipelines.routes.ts`
- `apps/api/src/services/flow-rules.service.ts` (apenas tipos)
- `apps/api/src/types/entities.ts`
- `apps/web/components/modules/settings/FluxoTab.tsx`
- Central de Ajuda (arquivo/rota da ajuda de Fluxo — localizar antes de editar;
  resolvido para `apps/web/components/help/helpContent.tsx`)
- `apps/api/src/routes/flows.routes.integration.test.ts` (novo) — **excecao de
  escopo APROVADA pelo orquestrador humano em 07/08/2026**. Nao constava na lista
  original; foi adicionado para cumprir a secao "Testes obrigatorios" desta mesma
  task, que exige testes de contrato e RBAC negativo. Aprovacao registrada junto
  com a autorizacao de commit + PR.

## Fora do escopo
- Executar a `stock_action` na transicao (`checkFlowRules`, `orders.routes.ts:1425`) — fatia seguinte.
- Etapa de caixa/pagamento; backflush do ourives; pronta + cancelamento -> produto acabado; margem de perda; retorno de sobra.
- Wiring de sla/checklist/required_fields (carregados como schema-ready, sem UI).
- Alterar `pipeline_automation_rules` (handoff) ou o motor do pedido.

## Dependencias
- Nenhuma task anterior bloqueia. É a BASE das fatias seguintes do EPIC (TASK-055+).

## Estado atual encontrado
- `flow_stage_rules` (mig 058): colunas `flow_id, stage_id, stage_role, payment_rule, notify_on_enter`. Escrita no handler `POST /flows` e `PATCH /flows/:id` de `flows.routes.ts` (o PATCH deleta e reinsere as regras); leitura no `SELECT` que faz `LEFT JOIN flow_stage_rules`.
- `pipeline_stage_settings` (mig 048): 0 registros em producao; referenciada SO nos handlers `GET`/`PATCH /:id/stages/:stageId/defaults` de `pipelines.routes.ts`; sem frontend; nenhuma FK aponta pra ela.
- `FluxoTab.tsx`: edita hoje payment_rule/stage_role/notify_on_enter (POST/PATCH `/api/internal/flows`).
- Runner de migracao (`migrate.ts`) e **forward-only** — NAO existe "down". Rollback = nova migracao compensatoria.
- `npm test` (api) esta quebrado (script `nodejs`); rodar testes com `node --import tsx --test <arquivo>`.

## Resultado esperado
- Config por etapa unificada em `flow_stage_rules`, com `stock_action` (enum
  `none|reservar|baixar_insumo|baixar_peca|retornar`, default `none`) e
  `min_role_to_move` (validado contra `UserRole`).
- `pipeline_stage_settings` inexistente; endpoints mortos removidos; nada referencia.
- `FluxoTab` com 2 dropdowns novos por etapa.
- Nenhuma mudanca de comportamento no fluxo atual (default `none`; `checkFlowRules` intocado).

## Regras obrigatorias da implementacao
- Aditivo ANTES de destrutivo, tudo em transacao (colunas novas -> guard de vazio -> DROP).
- Migracao ABORTA se `pipeline_stage_settings` tiver linhas (guard). Nunca dropar cega.
- `min_role_to_move` validado contra o enum `UserRole` (nao string livre). Config atras de `pipeline.configure`.
- NAO alterar comportamento de `checkFlowRules` (so tipos). `stock_action` default `none`.
- Referenciar codigo por simbolo/handler (nao por numero de linha, que muda entre branches).
- Rollback documentado como migracao compensatoria (runner e forward-only).

## Passos de implementacao
1. Confirmar o proximo numero de migracao livre no branch (`ls apps/api/src/db/migrations | tail -1`).
2. Migracao: `CREATE TYPE flow_stock_action` + `ALTER TABLE flow_stage_rules ADD COLUMN ...` (ver spec §3.1) + bloco `DO $$` de guard de vazio + `DROP TABLE pipeline_stage_settings`.
3. `flows.routes.ts`: incluir `stock_action` + `min_role_to_move` no schema zod da regra, no INSERT/re-INSERT e no SELECT; ajustar o guard "pula regra se tudo none" pra considerar os dois campos novos.
4. `pipelines.routes.ts`: remover os handlers `GET`/`PATCH /:id/stages/:stageId/defaults`, o tipo `PipelineStageSettingsRow`, o `mapPipelineStageSettings` e o `stageDefaultsSchema`.
5. Tipos: adicionar `FlowStockAction` em `entities.ts`; ajustar tipos em `flow-rules.service.ts` (sem mudar logica).
6. `FluxoTab.tsx`: adicionar dropdown "Acao de estoque" e "Quem pode mover" por etapa; incluir no payload de salvar; estados loading/erro/sucesso.
7. Atualizar a Central de Ajuda da config de Fluxo com os 2 campos novos.
8. Validar (ver Validacao) e preencher o relatorio final.

## Checklist de execucao
- [x] Ler integralmente esta task + a spec de modulo + a arquitetura.
- [x] Confirmar Definition of Entry.
- [x] Passar pelo `minimal-implementation-gate` (LIBERAR IMPLEMENTACAO).
- [x] Migracao (aditivo -> guard -> DROP) aplicada com `db:migrate`.
      Guard testado em clone: aborta com 1 linha, rollback preserva o schema.
- [x] Backend: campos novos no flows.routes.ts; endpoints mortos removidos.
- [x] Frontend: dropdowns no FluxoTab.
- [x] Central de Ajuda atualizada.
- [x] Testes + typecheck limpos (`tsc --noEmit` nos 2 apps; integracao 1 pass/0 fail).
- [ ] QA do `ui-ux-standard` e do `security-standard` — **PARCIAL**:
      `security-standard` = PARTIAL (backend PASS; achado S7 corrigido; falta
      evidencia de UI). `ui-ux-standard` = U1/U2 `NAO VALIDADO` (print pendente,
      exige sessao ROOT), U3/U4 PASS.
- [x] Relatorio final preenchido; PR aberto vinculando task + spec + issue #57.
      Relatorio nesta task e publicado como comentario na issue #57;
      **PR #58 aberto** em 07/08/2026 na branch `feat/flow-stage-stock-action`.

## Prompt recomendado para IA executora
```text
Use Dev Workflow Standard (orquestrador) e Dev Implementation Standard (executor).
Antes de codar, passe pelo Minimal Implementation Gate. Como ha UI, acione
ui-ux-standard; como toca autorizacao e DROP de tabela, acione security-standard.

Execute somente esta task: TASK-054-estoque-flow-stage-stock-action.
Antes de agir:
1. Leia integralmente esta task e a spec obrigatoria.
2. Confirme o proximo numero de migracao livre.
3. Mapeie os arquivos permitidos (locked_paths) antes de editar.

Regras obrigatorias:
- Nao sair do escopo/locked_paths. Parar e devolver a lacuna se precisar.
- Aditivo antes de destrutivo; migracao com guard de vazio; nunca dropar cega.
- Nao alterar checkFlowRules (so tipos). stock_action default none.
- Referenciar codigo por simbolo, nao por numero de linha.

Fluxo: ler task/spec -> gate -> migracao -> backend -> frontend -> ajuda -> validar -> relatorio.
Ao final: atualize o status, escreva relatorio detalhado, liste arquivos alterados,
testes executados e riscos remanescentes.
```

## Testes obrigatorios
- Migracao aplica (up) com `npm run db:migrate`; guard aborta se houver linha em `pipeline_stage_settings` (testar inserindo 1 linha).
- POST/PATCH/GET de flows persistem e retornam `stock_action` + `min_role_to_move`; regras antigas (payment/stage_role/notify) seguem funcionando (nao-regressao).
- **RBAC negativo:** usuario sem `pipeline.configure` (ex.: ATENDENTE) recebe 403 ao configurar; `min_role_to_move` invalido (fora do enum `UserRole`) e rejeitado.
- Endpoints removidos respondem 404.
- `tsc --noEmit` limpo nos dois apps. (Rodar testes da api com `node --import tsx --test`, pois `npm test` esta quebrado.)

## Evidencias esperadas no PR
- Diff da migracao + saida de `npm run db:migrate`.
- JSON/print de um fluxo salvo com `stock_action` e `min_role_to_move` preenchidos.
- Print dos 2 dropdowns novos no FluxoTab (QA visual do ui-ux-standard).
- Confirmacao de que `pipeline_stage_settings` nao existe mais e endpoints -> 404.
- `tsc --noEmit` limpo. Referencia a esta task, a spec e a issue #57.

## Criterios de aceite
- `flow_stage_rules` persiste `stock_action` + `min_role_to_move` via painel FluxoTab.
- `pipeline_stage_settings` dropada (migracao com guard) + 2 endpoints mortos removidos; nada referencia.
- Regras existentes intactas; `checkFlowRules` inalterado; rollback documentado como migracao compensatoria.
- RBAC negativo coberto; Central de Ajuda atualizada.
- `security-standard`, `ui-ux-standard` e `minimal-implementation-gate` aprovados.

## Banco
Migracao nova (ver spec §3.1): enum `flow_stock_action`, colunas aditivas em `flow_stage_rules`, guard de vazio, DROP de `pipeline_stage_settings`. Forward-only (rollback = compensatoria).

## API/Backend
`flows.routes.ts` (schema/insert/update/select das regras) e `pipelines.routes.ts` (remover endpoints mortos). `flow-rules.service.ts` so tipos. Sem alterar `checkFlowRules`.

## Frontend/UI
`FluxoTab.tsx`: 2 dropdowns por etapa. QA visual obrigatorio (`ui-ux-standard`).

## Validacao
Manual + automatizada: `npm run typecheck` (api e web), `npm run db:migrate`, testes de contrato de flows, teste do guard, RBAC negativo. Evidencia visual dos dropdowns.

## Riscos/Lacunas
- Numero da migracao pode divergir entre branches — confirmar o livre antes.
- Se, no dia do deploy, `pipeline_stage_settings` tiver linhas (contra o esperado), o guard aborta -> escalar ao orquestrador (migrar antes de dropar).
- `min_role_to_move` deve usar a MESMA lista de `UserRole` do backend — divergencia gera gate quebrado.

## Template de relatorio final
### Resumo
Descreva objetivamente o que foi entregue.
### Arquivos alterados
- Liste os arquivos reais alterados.
### Testes executados
- Liste testes manuais e automatizados executados.
### Evidencias
- Liste capturas, prints e links do PR.
### Bloqueios ou riscos remanescentes
- Liste o que ficou pendente ou exige nova task.

## Resultado da execucao

### Resumo
Fundacao de config entregue. `flow_stage_rules` passou a ser a unica tabela de
config por etapa: ganhou `stock_action` (enum `flow_stock_action`, default `none`)
e `min_role_to_move` (validado contra o enum `UserRole`), mais as colunas
schema-ready herdadas do fantasma (§3.1 da spec). A `pipeline_stage_settings` foi
dropada com guard de vazio e os 2 endpoints mortos removidos. O `FluxoTab` ganhou
os dropdowns "Acao de estoque" e "Quem pode mover (papel minimo)". Nenhuma mudanca
de comportamento no fluxo atual: `checkFlowRules` teve so os tipos e o SELECT
ajustados (logica identica) e todas as regras existentes ficaram com `stock_action
= none`.

Mudanca de autorizacao (dentro do contrato, spec §7): `POST`/`PATCH /flows`
estavam `requireRole(['ROOT'])` e passaram para `requirePermission('pipeline.configure')`
(ADMIN/GERENTE; ROOT bypassa). Sem isso a matriz UI §3.2 ("quem ve: ADMIN/GERENTE")
era inexequivel. Pelo mesmo motivo, `GERENTE` foi incluido nos `GET` de flows, que
antes nem listavam para esse papel.

### Arquivos alterados
- `apps/api/src/db/migrations/063_flow_stage_stock_action.sql` (novo — 062 ja
  estava ocupado no branch `feat/board-excluir-renomear`)
- `apps/api/src/routes/flows.routes.ts`
- `apps/api/src/routes/pipelines.routes.ts`
- `apps/api/src/services/flow-rules.service.ts` (so tipos + colunas no SELECT)
- `apps/api/src/types/entities.ts` (`FlowStockAction`)
- `apps/web/components/modules/settings/FluxoTab.tsx`
- `apps/web/components/help/helpContent.tsx` (Central de Ajuda — secao "Fluxos")
- `apps/api/src/routes/flows.routes.integration.test.ts` (novo — **fora da lista
  literal de `locked_paths`**, adicionado para cumprir "Testes obrigatorios";
  segue o padrao de `customers.routes.integration.test.ts`)

### Testes executados
- **Migracao (clone descartavel do schema do banco de dev, nao no banco real):**
  - tabela vazia -> aplica; enum com 5 valores, `flow_stage_rules` de 8 -> 17
    colunas, `pipeline_stage_settings` removida.
  - tabela com 1 linha -> `RAISE EXCEPTION` e rollback: fantasma preservado e
    nenhuma coluna nova adicionada. Guard validado.
- **`npm run db:migrate` no banco de dev:** `063_flow_stage_stock_action.sql applied`
  (1 aplicada, 62 previamente aplicadas). Pos-migracao: fantasma removido,
  4 regras existentes preservadas, todas com `stock_action = none`.
- **Integracao contra a stack real** (imagem da API reconstruida com este codigo),
  `node --import tsx --test src/routes/flows.routes.integration.test.ts` -> 1 pass / 0 fail:
  - POST/PATCH/GET persistem e retornam `stock_action` + `min_role_to_move`;
  - nao-regressao de `payment_rule` / `stage_role` / `notify_on_enter`;
  - regra totalmente vazia nao vira linha; regra so com `stock_action` persiste;
  - RBAC negativo: ATENDENTE -> 403 no POST e no PATCH;
  - `min_role_to_move` fora do enum `UserRole` -> 400; `stock_action` invalido -> 400;
  - `GET`/`PATCH /pipelines/:id/stages/:stageId/defaults` -> 404.
- **Typecheck:** `tsc --noEmit` limpo na api e no web.
- **Regressao unitaria da api:** 8 de 9 arquivos passam (38 testes).
  `store-order-sync.service.test.ts` falha por validacao de ambiente
  (`META_API_TOKEN` vazio no `.env`) — falha **pre-existente e nao relacionada**;
  o arquivo e suas dependencias nao foram tocados por esta task.

### Evidencias
- Saidas de `db:migrate`, do guard e da suite de integracao registradas acima.
- Prints dos dropdowns no `FluxoTab`: **NAO VALIDADO** (ver QA de UI abaixo).

### Gate `security-standard` — Change Review, risco HIGH
Escopo revisado: `flows.routes.ts`, `pipelines.routes.ts`, migracao 063,
`flow-rules.service.ts`. Escopo excluido: execucao da `stock_action` (nao existe
ainda) e `pipeline_automation_rules` (intocado).

| # | Superficie | Controle exigido | Resultado |
|---|---|---|---|
| S1 | `POST`/`PATCH /flows` | authn + `pipeline.configure` | PASS — `authenticate` antes do `requirePermission`; negativo coberto por teste (ATENDENTE -> 403) |
| S2 | `min_role_to_move` | validado contra enum `UserRole`, sem string livre | PASS — `z.enum` com a mesma lista de `types/entities.ts`; invalido -> 400 (testado) |
| S3 | `stock_action` | enum fechado no zod e no Postgres | PASS — invalido -> 400 (testado); cast `::flow_stock_action` |
| S4 | SQL | sem concatenacao | PASS — 100% parametrizado |
| S5 | DROP de tabela | guard de vazio, nunca cega | PASS — `RAISE EXCEPTION` + rollback validado em clone |
| S6 | Endpoints removidos | sem rota orfa / referencia morta | PASS — 404 testado; nenhuma referencia restante no repo |
| S7 | Audit log de mudanca de autorizacao | rastreabilidade de `min_role_to_move` | **CORRIGIDO** — o audit registrava so `rules_count`; agora grava o resumo por etapa (`auditableRules`) |
| S8 | UI da config | so quem tem `pipeline.configure` ve/edita | **GAP — ver U2** |
| S9 | Logs/segredos | sem dado sensivel em log | PASS — nenhum log novo |

Ampliacao de acesso registrada e intencional: `POST`/`PATCH /flows` saiu de
`ROOT`-only para `pipeline.configure` (ADMIN/GERENTE; ROOT bypassa), conforme
spec §7. `DELETE /flows` continua `ROOT`-only (mais restritivo, mantido).

`SECURITY_STATUS`: **PARTIAL** — backend PASS; evidencia de UI pendente (S8/U2).

### Gate `ui-ux-standard` — matriz de interacao
| ID | Elemento | Condicao | Efeito esperado | Evidencia | Status |
|---|---|---|---|---|---|
| U1 | Dropdown "Acao de estoque" (por etapa) | quem configura fluxo | grava `stock_action` | persistencia validada via API (integracao) | **NAO VALIDADO** (visual) |
| U2 | Dropdown "Quem pode mover (papel minimo)" | idem | grava `min_role_to_move`; opcao "Qualquer papel" = `null` | idem | **NAO VALIDADO** (visual) |
| U3 | Erro ao salvar | falha na API | toast de erro + permanece no modal | reusa o `toast.push('error', ...)` ja existente do `handleSave` | PASS (estatico) |
| U4 | Nao autenticado em `/ajustes?tab=fluxo` | sem sessao | redirect para `/login` | Playwright: redirecionou para `http://localhost/login` | PASS |

Estilo: os 2 selects reusam exatamente as classes dos selects ja existentes
("Regra de pagamento" / "Conta como"), no mesmo grid `grid-cols-1 md:grid-cols-2`
(agora 2x2). Nenhum token novo foi introduzido.

**Gap U2/S8 (fora dos `locked_paths`) — DECIDIDO: vira task seguinte.**
O backend aceita ADMIN/GERENTE (spec §7); a UI entrega menos e de forma
inconsistente. Mapeamento correto (a primeira versao deste paragrafo dizia
"a UI so expoe a aba para ROOT" — **estava errado**, corrigido em 11/08/2026
apos apontamento no review do PR #58):
- `/ajustes` redireciona quem nao e ADMIN/ROOT -> **GERENTE nao chega**, apesar
  de ter `pipeline.configure`.
- `rootOnly: true` filtra apenas `visibleTabs`, isto e, o **botao** da aba. O
  renderizador faz `if (activeTab === 'fluxo') return <FluxoTab />` sem checar
  papel, e `initialTab` vem de `searchParams.tab`. Entao **ADMIN alcanca a aba
  por `/ajustes?tab=fluxo`** e consegue configurar (tem a permissao).
  `banco-dados` ja faz a checagem certa no renderizador; `fluxo` nao.
- **Defeito de UX:** o botao "Excluir fluxo" aparece para ADMIN, mas
  `DELETE /flows` e ROOT-only -> o clique sempre falha com 403.

Nao ha escalonamento de privilegio: quem renderiza a aba tem permissao de
backend para o que consegue salvar. Decisao do orquestrador (07/08/2026):
**nao ampliar o escopo desta task**; abrir fatia propria com `locked_paths`
proprios (`AjustesClient.tsx` + a rota `/ajustes` + `FluxoTab.tsx`) para expor a
aba por `pipeline.configure`, checar papel no renderizador e esconder a exclusao
de quem nao e ROOT.

### Correcoes vindas do review do PR #58 (Codex)
- **P1 — falsa garantia de autorizacao (procede).** A ajuda e a UI apresentavam
  "Quem pode mover" e "Acao de estoque" como controles ativos, mas `checkFlowRules`
  so avalia `payment_rule` e `PATCH /orders/:id/stage` segue aceitando ATENDENTE
  (`requireRole(['ROOT','ADMIN','ATENDENTE'])`). Um operador poderia configurar
  "so GERENTE move pro Caixa" e confiar num bloqueio inexistente. Corrigido: os
  dois campos passaram a ser rotulados "(ainda nao aplicado)" no `FluxoTab`, com
  aviso ambar explicito sob os dropdowns, e a Central de Ajuda agora diz que o
  valor apenas fica salvo. Falha do gate `security-standard` desta task: validei
  o controle novo isoladamente e nao verifiquei se ele era *aplicado*.
- **P2 — corrida no guard da migracao (procede).** `count(*)` pega so ACCESS
  SHARE, que nao bloqueia INSERT: em deploy rolling, uma instancia antiga da API
  podia inserir entre o count e o `DROP`, e a linha seria apagada em silencio.
  Corrigido com `LOCK TABLE pipeline_stage_settings IN ACCESS EXCLUSIVE MODE`
  antes do count, na mesma transacao. Revalidado em clones: vazio -> aplica e
  dropa; com 1 linha -> aborta e preserva.
  **Atencao no deploy:** a 063 ja consta aplicada no banco de dev, entao la o
  arquivo corrigido nao roda de novo. Producao, que ainda nao aplicou, recebe a
  versao com o LOCK.

### Review do CodeRabbit no PR #58 — itens recusados (com motivo)
- **FK `default_assignee_id` como `NOT VALID`:** recusado. A regra existe para
  tabelas grandes; aqui `flow_stage_rules` tem 4 linhas e `users` tem 12, e a
  coluna nasce toda NULL no mesmo `ALTER`. O scan e o `SHARE ROW EXCLUSIVE` duram
  milissegundos. Criar uma segunda migracao so para `VALIDATE CONSTRAINT` adiciona
  custo permanente sem beneficio mensuravel — contraria o `minimal-implementation-gate`.
- **Gatear os controles do `FluxoTab` por `pipeline.configure` no proprio componente:**
  recusado nesta task, mas **minha primeira justificativa estava factualmente errada**
  e fica registrada a correcao. Eu afirmei que "so ROOT alcanca o componente". Falso:
  a flag `rootOnly: true` filtra apenas `visibleTabs` (o botao da aba); o renderizador
  faz `if (activeTab === 'fluxo') return <FluxoTab />` **sem checar papel**, e
  `initialTab` vem de `searchParams.tab` validado so contra a lista de abas validas.
  Um ADMIN em `/ajustes?tab=fluxo` renderiza a aba normalmente — e funciona, porque
  ADMIN tem `pipeline.configure`. Nao ha escalonamento de privilegio (o backend
  autoriza), mas **ha um defeito de UX real**: o botao "Excluir fluxo" aparece para
  ADMIN e `DELETE /flows` e ROOT-only, entao o clique sempre falha com 403.
  Segue recusado *nesta task* por escopo: `FluxoTab` nao recebe o papel do usuario
  (nao tem prop de role) e passa-lo exige editar `AjustesClient.tsx`, fora dos
  `locked_paths`. Encaminhado para a fatia do gap U2/S8, que ja possui esse arquivo:
  expor a aba por `pipeline.configure`, checar papel tambem no renderizador (como
  `banco-dados` ja faz) e esconder a exclusao para quem nao e ROOT.

### Bloqueios ou riscos remanescentes
- **Print dos dropdowns pendente com o humano (decidido 07/08/2026):** a aba Fluxo
  exige sessao ROOT e nao ha credencial de QA nesta sessao (criar usuario ROOT
  temporario foi corretamente barrado por politica). O orquestrador humano vai
  conferir e printar em `Ajustes > Fluxo > editar fluxo` na stack local, que ja
  esta rodando com as imagens `api:task054` e `web:task054`. Anexar o print ao PR
  e trocar U1/U2 de `NAO VALIDADO` para `PASS`.
- **Gap U2/S8 encaminhado:** UI da aba Fluxo continua `rootOnly` enquanto o backend
  passou a aceitar ADMIN/GERENTE. Decidido virar task seguinte (TASK-055+), sem
  ampliar o escopo desta.
- A migracao 062 (`062_backfill_product_category_name.sql`) vive no branch
  `feat/board-excluir-renomear` e nao existe aqui; o runner e por nome e ignora
  ja aplicadas, entao 062 rodara normalmente no merge. Sem conflito de conteudo.
- No deploy de producao, se `pipeline_stage_settings` tiver ganho linhas, o guard
  aborta a migracao inteira -> escalar ao orquestrador antes de dropar.
- Rollback continua sendo migracao compensatoria (runner forward-only).
- A execucao da `stock_action` na transicao segue fora de escopo (proximas fatias).
