# TASK-045: Criar papel GERENTE (RBAC)

## Status visual
- Status visual: 🟢 Cancelada (ja implementado)
- Status Kanban: Done
- Responsavel: Claude Code
- Issue criada / vinculada: #47 (fechada — GERENTE ja existe via migration 038)
- NOTA: GERENTE ja existe no enum (038_user_roles_expansion), no tipo UserRole, na
  matriz permissions.ts e no modal Editar Usuario. Nada a implementar.
- Branch sugerida: `feat/rbac-gerente`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: security-standard
- Modo de handoff: Claude Code CLI
- Status da claim: unclaimed
- `locked_paths`:
  - `apps/api/src/db/migrations/` (nova migration)
  - `apps/api/src/middleware/rbac.ts`
  - `apps/api/src/lib/permissions.ts`
- Conflitos conhecidos: T-046 depende desta (usa o papel)
- Labels sugeridas: `feature`, `security`
- Pronto para GitHub Projects: sim

## Tipo
Feature / Security / Infra

## Prioridade
P1

## Objetivo
Adicionar o papel GERENTE ao sistema, base para restringir aprovacao de pedidos
(T-046). O PRD do builder ja preve MANAGER; o enum atual so tem ADMIN, ATENDENTE,
PRODUCAO, FINANCEIRO.

## Specs obrigatorias
- Inline nesta task + builder-prd-v2.md secao 10 (Permissoes: ROOT/ADMIN/MANAGER/USER).

## Arquivos e modulos permitidos
- `apps/api/src/db/migrations/062_user_role_gerente.sql` (novo)
- `apps/api/src/middleware/rbac.ts`
- `apps/api/src/lib/permissions.ts`

## Fora do escopo
- Alterar transicoes de pedido (isso e T-046).
- Telas de gestao de usuarios (apenas garantir que GERENTE seja selecionavel).

## Estado atual encontrado
- `002_users.sql`: `CREATE TYPE user_role AS ENUM ('ADMIN','ATENDENTE','PRODUCAO','FINANCEIRO')` (+ ROOT usado no codigo).
- Rotas usam `requireRole([...])` com esses valores.

## Resultado esperado
- `ALTER TYPE user_role ADD VALUE 'GERENTE'` (idempotente / seguro).
- GERENTE reconhecido no RBAC e no mapa de permissoes com um conjunto operacional
  (equivalente a ADMIN nas operacoes, EXCETO admin-only: usuarios, settings,
  banco de dados, faturamento). **Conjunto exato a confirmar no gate de aprovacao.**

## Contrato de seguranca
- GERENTE NAO pode: gerir usuarios, editar settings, acessar banco de dados admin.
- GERENTE PODE: operar pedidos/producao, aprovar pedidos (habilita T-046).
- Revisar todas as rotas admin-only para NAO vazarem pro GERENTE.

## Testes obrigatorios
- Migration aplica e enum passa a aceitar GERENTE.
- RBAC: rota permitida a GERENTE responde 200; rota admin-only responde 403.
- `tsc --noEmit` limpo.

## Criterios de aceite
- GERENTE existe, e selecionavel e tem escopo operacional sem privilegio admin.

## Riscos/Lacunas
- `ALTER TYPE ... ADD VALUE` nao roda dentro de transacao em algumas versoes; a
  migration deve tratar isso (ADD VALUE IF NOT EXISTS, fora de bloco transacional).
- Definicao exata das permissoes do GERENTE = decisao no gate.

## Resultado da execucao
(a preencher)
