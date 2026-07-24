# TASK-043: Banco de Dados (Ajustes) — apagar sem CASCADE + importar/exportar

## Status visual
- Status visual: Em andamento
- Status Kanban: In Review
- Responsavel: Claude Code
- Issue criada / vinculada: #44
- Branch sugerida: `fix/db-admin-apagar-seguro`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: dev-workflow-standard (CTO) + security-standard
- Motivo da atribuicao: incidente de perda de dados em producao, correcao urgente
- Modo de handoff: Claude Code CLI
- Status da claim: done
- `locked_paths`:
  - `apps/api/src/routes/database-admin.routes.ts`
  - `apps/web/components/modules/settings/BancoDadosTab.tsx`
- Conflitos conhecidos: nenhum
- Milestone: Suporte / Administracao
- Labels sugeridas: `bug`, `high-priority`, `security`
- Pronto para GitHub Projects: sim

## Tipo
Bug + Feature

## Prioridade
P0

## Objetivo
Corrigir a aba Ajustes > Banco de Dados que apagava o banco inteiro ao "apagar
uma tabela" (TRUNCATE ... CASCADE arrastava todas as dependentes por FK), e
adicionar importacao/exportacao de dados por selecao.

## Specs obrigatorias
- Especificacao consolidada nesta task (incidente urgente; SDD retroativo).

## Docs obrigatorios
- `docs/product/ORION-CRM-PRD-v1.2.md`
- `CLAUDE.md` (regras absolutas: audit log, RBAC, sem secrets)

## Arquivos e modulos permitidos
- `apps/api/src/routes/database-admin.routes.ts`
- `apps/web/components/modules/settings/BancoDadosTab.tsx`

## Fora do escopo
- Alterar schema/migrations.
- Alterar o motor de auditoria (`entity_id` UUID) — bug pre-existente registrado a parte.

## Estado atual encontrado
- `DELETE /tables/:name` executava `TRUNCATE ... RESTART IDENTITY CASCADE`.
- Apagar `pipelines` cascateava 34 tabelas (leads, clientes, pedidos, financeiro,
  mensagens, ate `settings`), zerando o banco operacional com um clique.
- A lista de protecao (`users`, `settings`, `_migrations`) so valia no "apagar
  tudo"; individualmente dava para truncar `users`/`refresh_tokens` e perder o login.
- `audit_logs` nao era protegida (a prova de quem apagou se autodestruia).
- Nao havia importacao; exportacao era so "tudo", sem selecao.

## Resultado esperado
- Apagar tabela sem CASCADE; se houver dependentes, BLOQUEAR e listar.
- `users`, `settings`, `_migrations`, `audit_logs`, `refresh_tokens` protegidas em
  qualquer modo.
- Selecao por checkbox + previa do que sera apagado.
- Importar (.sql) e Exportar selecao, com round-trip fiel de tipos.

## Regras obrigatorias da implementacao
- Sem CASCADE em exclusao pela UI.
- Operacoes destrutivas so ROOT (mantido `requireRole(['ROOT'])`).
- "Apagar tudo" preserva as tabelas protegidas.

## Testes obrigatorios / Evidencias
Validado ao vivo no container com o codigo novo:
- `GET /tables` retorna `protected=true` para users/audit_logs/settings.
- `GET /tables/pipelines/dependents` retorna 34 dependentes.
- `DELETE /tables/pipelines` -> HTTP 409 HAS_DEPENDENTS (nao apaga); `leads` 3 -> 3.
- `DELETE /tables/users` -> HTTP 403 FORBIDDEN.
- `POST /truncate [pipelines]` -> HTTP 403 (dependencia protegida `settings`).
- Round-trip export-all -> import: HTTP 200, contagens identicas (leads 3,
  orders 6, order_items 5, pipelines 10).
- `tsc --noEmit` limpo (api e web).

## Criterios de aceite
- Impossivel apagar o banco inteiro apagando uma tabela pela UI. [OK]
- Login/config/auditoria nunca apagaveis pela tela. [OK]
- Import restaura dados exportados sem perda. [OK]

## Banco
Sem alteracao de schema. Descoberto: `settings` referencia `pipelines`/
`pipeline_stages` (FK), o que bloqueia TRUNCATE sem CASCADE — tratado no "apagar
tudo" via `DELETE` com `session_replication_role=replica`.

## API/Backend
`database-admin.routes.ts`: remove CASCADE; `getDependents` (CTE recursiva);
protecao unificada; `GET /tables/:name/dependents`; `POST /truncate` (conjunto
fechado); `POST /export` (selecao); `POST /import` (restaura .sql); export com
`col::text` (round-trip) ignorando colunas `GENERATED ALWAYS`.

## Frontend/UI
`BancoDadosTab.tsx`: checkbox por tabela + marcar todas; barra "Apagar/Exportar
selecionadas"; modal com previa exata (marcadas + dependentes); selo PROTEGIDA
sem opcao de apagar; botoes Importar (.sql) e Exportar selecionadas.

## Validacao
Backend: validado ao vivo (curl + psql). Frontend: `tsc` limpo + render conferido
em browser (aba Ajustes > Banco de Dados).

## Riscos/Lacunas
- Bug pre-existente: `audit()` grava `entity_id` nao-UUID (falha capturada e
  logada, nao bloqueia). Registrar TASK separada.
- Import assume dump gerado por esta mesma tela.

## Resultado da execucao
Concluido e validado ao vivo. Commit `4dc1a8f` na branch `fix/db-admin-apagar-seguro`.
Pendente: PR + review de security-standard/ui-ux-standard antes do merge.
