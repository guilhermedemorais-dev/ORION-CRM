# TASK-051: Bug — categoria nao salva/exibe no cadastro de produto

## Status visual
- Status visual: A definir
- Status Kanban: Ready for Dev
- Responsavel: Claude Code
- Issue criada / vinculada: #53
- Branch sugerida: `fix/estoque-categoria`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: ui-ux-standard
- Modo de handoff: Claude Code CLI
- Status da claim: unclaimed
- `locked_paths`:
  - `apps/web/components/modules/estoque/EstoqueClient.tsx`
  - `apps/api/src/routes/products.routes.ts`
- Conflitos conhecidos: T-050/T-052 tocam o mesmo modal — coordenar ordem
- Labels sugeridas: `bug`
- Pronto para GitHub Projects: sim

## Tipo
Bug

## Prioridade
P1

## Objetivo
Ao selecionar a categoria no cadastro de produto, ela deve ser salva e exibida.

## Estado atual encontrado (diagnostico provavel)
- Dois campos: `category` (nome, texto legado) e `category_id` (FK product_categories).
- Form: `<select>` (EstoqueClient.tsx:226) seta SO `category_id`; `category` (nome)
  nao e atualizado no create -> fica vazio.
- Backend aceita e salva ambos, mas se a exibicao usa `category` (nome), o produto
  aparece "sem categoria".
- CONFIRMAR RCA: onde a lista/detalhe le a categoria (nome vs resolve por id).

## Resultado esperado
- Selecionar categoria persiste o vinculo e a exibicao mostra a categoria correta.
- Uma fonte de verdade: preferir `category_id` e derivar/resolver o nome; ou
  preencher os dois de forma consistente no save.

## Fora do escopo
- Refatorar todo o modulo de categorias.

## Testes obrigatorios
- Criar produto com categoria -> salva e aparece na lista/detalhe.
- Editar categoria de produto existente -> reflete.
- `tsc --noEmit` limpo; conferir em browser.

## Criterios de aceite
- Categoria selecionada entra e aparece corretamente.

## Resultado da execucao
(a preencher)
