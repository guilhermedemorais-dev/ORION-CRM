# TASK-050: Ocultar dados sensiveis de produto de vendedores/atendentes

## Status visual
- Status visual: 🟢 Concluída (aguardando validação final do usuário)
- Status Kanban: In Review
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
- **Ver = Editar** (uma unica permissao). Chave sugerida: `product.cost.view`.
- Default do papel: **SO ADMIN** (ROOT sempre bypassa). GERENTE, VENDEDOR,
  ATENDENTE, PRODUCAO, FINANCEIRO NAO veem por padrao.
- **Por usuario (custom_permissions):** expor um **toggle no modal Editar Usuario**
  ("Ver custo/margem de produto") para o dono liberar pra um gerente especifico
  quando quiser. O toggle sobrepoe o default (modelo userCan ja existente).
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
Nova permissao `product.cost.view` (permissions.ts, default ADMIN; ROOT bypassa).

Backend (products.routes.ts): helper `canViewProductCost(req)` (carrega
custom_permissions lazy + userCan). `mapProduct(row, canViewCost)` zera
cost_price_cents quando sem permissao — aplicado em lista, detalhe, create,
update e movimentacoes. `/products/stats.total_cost_cents` = null sem permissao.
Create/update ja sao ADMIN-only (requireRole) — escrita protegida. CSV export e
ADMIN-only (sem vazamento pra vendedor/atendente).

Frontend: canViewCost derivado de `stats.total_cost_cents !== null`. Escondidos
para quem nao tem: campos Custo/Margem no modal, card "Valor em Estoque",
linha "Custo" no detalhe. Toggle "Ver custo/margem de produto" adicionado ao
modal Editar Usuario (chave product.cost.view — enforcada de verdade, ao
contrario dos toggles de modulo cosmeticos).

Verificado ao vivo (rebuild api+web):
- API ROOT: total_cost_cents=0 e cost=0 (ve). ATENDENTE sem toggle: ambos null
  (nao ve). ATENDENTE COM toggle: total_cost_cents=0 (volta a ver).
- UI: toggle "Ver custo/margem de produto" aparece no modal (print), OFF p/ atendente.
- `tsc --noEmit` limpo (api + web).

Nao coberto (fora do escopo/decisao): os ~10 toggles de modulo cosmeticos (issue #55).

