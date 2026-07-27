# TASK-051: Bug — categoria nao salva/exibe no cadastro de produto

## Status visual
- Status visual: 🟢 Concluída (aguardando validação final do usuário)
- Status Kanban: In Review
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
RCA confirmada: dois campos (`category` nome vs `category_id` FK); o form salvava
so o id e a exibicao (lista/detalhe, sem JOIN) usa o nome -> categoria "sumia".

Fix (products.routes.ts):
- Helper `resolveCategoryName(categoryId)`; no create e no update o nome `category`
  e derivado do `category_id` (fonte da verdade). Update: bloco combinado
  category/category_id (evita dupla atribuicao).
- Migration `062_backfill_product_category_name.sql`: sincroniza produtos ja
  cadastrados (id setado, nome nulo).

Verificado ao vivo (container local rebuild + migration aplicada no boot):
- API: criar produto so com category_id -> resposta `category='ouro 18k'`; lista exibe.
- UI (Playwright): + Adicionar Produto -> selecionar "ouro 18k" -> Cadastrar ->
  detalhe/lista mostram Categoria: ouro 18k. Produtos antigos passaram a exibir "ANEIS".
- `tsc --noEmit` limpo.

Observacao (fora do escopo, virar task): a pagina /estoque loga erros de
HIDRATACAO React (#418/#423/#425) — pre-existentes, nao quebram a tela.

