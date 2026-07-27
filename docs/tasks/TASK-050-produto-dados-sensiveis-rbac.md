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

## Ambiguidade / Gate (BLOQUEANTE)
- Definir o CONJUNTO exato de campos sensiveis. Hipotese: `cost_price_cents`
  (Custo), Margem, e a secao Especificacoes (metal, peso, pedras, tamanho...).
  Preco de Venda e Estoque permanecem visiveis ao vendedor.
- "Ver" e "editar" usam a mesma permissao ou duas (view vs edit)?

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
