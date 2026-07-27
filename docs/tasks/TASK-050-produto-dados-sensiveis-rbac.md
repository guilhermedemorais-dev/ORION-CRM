# TASK-050: Ocultar dados sensiveis de produto de vendedores/atendentes

## Status visual
- Status visual: A definir
- Status Kanban: Discovery / SDD (ambiguidade de campos pendente)
- Responsavel: Claude Code
- Issue criada / vinculada: #52
- Branch sugerida: `feat/produto-dados-sensiveis-rbac`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: security-standard (dados sensiveis + RBAC)
- Modo de handoff: Claude Code CLI
- Status da claim: unclaimed
- `locked_paths`:
  - `apps/api/src/middleware/permissions.ts` (nova chave)
  - `apps/api/src/routes/products.routes.ts` (nao retornar campos sensiveis)
  - `apps/web/components/modules/estoque/EstoqueClient.tsx` (esconder campos)
  - `apps/web/components/modules/settings/AjustesClient.tsx` (toggle no modal)
- Conflitos conhecidos: depende de T-049 (#51)
- Labels sugeridas: `feature`, `security`
- Pronto para GitHub Projects: sim

## Tipo
Feature / Security

## Prioridade
P1

## Objetivo
Restringir a visualizacao e edicao de dados sensiveis do produto (custo, margem,
especificacoes) a ADMIN/GERENTE. Vendedores/atendentes nao devem ver custo nem
valores sensiveis.

## Regras obrigatorias da implementacao
- Enforcement PRIMARIO no BACKEND: rotas de produto NAO retornam campos sensiveis
  (ex.: `cost_price_cents`, margem, specs) para quem nao tem a permissao. Esconder
  no frontend e complemento, nao a barreira.
- Permissao no modelo existente (`permissions.ts` + `custom_permissions`), com
  toggle no modal Editar Usuario. Default: ADMIN, GERENTE (e ROOT bypassa).

## Estado atual encontrado
- `products.routes.ts` retorna `cost_price_cents` (COALESCE) e demais campos a
  qualquer role com acesso ao estoque.
- Modal Editar Produto mostra Custo, Margem, Especificacoes para todos.

## Escopo definido (decisao do usuario — CORRIGIDO)
- SENSIVEL = APENAS dois campos: **Custo de Aquisicao** (`cost_price_cents`) e
  **Margem de Lucro** (derivada/exibida ao lado do custo).
- TODO O RESTO e visivel a todos: Preco de Venda, Estoque, Localizacao,
  Especificacoes, etc. NAO e a secao inteira.
- **Ver = Editar** (uma unica permissao).
- Papel: **SO ADMIN** ve/edita custo e margem. ROOT sempre pode (bypassa userCan).
  GERENTE, VENDEDOR, ATENDENTE, PRODUCAO, FINANCEIRO NAO veem custo/margem.
  (CONFIRMAR: usuario disse "so admin" — validar se GERENTE tambem fica de fora.)
- Como margem = f(custo, preco), esconder o custo esconde a margem junto (coerente).
- Escopo de aplicacao: modulo **Estoque** (lista/detalhe/edicao). NAO tocar no PDV/
  catalogo (preco de venda continua necessario pra vender).
- Enforcement no BACKEND: rotas de produto NAO retornam `cost_price_cents` para
  quem nao tem a permissao (nem em list nem em detail). Front esconde os 2 campos.

## Testes obrigatorios
- API: usuario sem permissao NAO recebe custo/margem/specs (nem em list nem em detail).
- API: ADMIN/GERENTE recebe tudo.
- UI: campos escondidos/bloqueados conforme permissao.
- Toggle por usuario sobrepoe o default.

## Criterios de aceite
- Vendedor nao ve custo/margem/especificacoes, nem pela tela nem pela API.
- ADMIN/GERENTE ve e edita normalmente; toggle por usuario funciona.

## Resultado da execucao
(a preencher)
