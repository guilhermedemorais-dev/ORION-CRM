# TASK-052: Foto de produto — tamanho/aspecto padrao + centralizacao + carrossel

## Status visual
- Status visual: A definir
- Status Kanban: Discovery / SDD (definir aspecto/limites)
- Responsavel: Claude Code
- Issue criada / vinculada: #54
- Branch sugerida: `feat/estoque-foto-padrao-carrossel`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: ui-ux-standard
- Modo de handoff: Claude Code CLI
- Status da claim: unclaimed
- `locked_paths`:
  - `apps/web/components/modules/estoque/EstoqueClient.tsx`
  - upload no backend (se precisar) — a confirmar
- Conflitos conhecidos: T-050/T-051 tocam o mesmo modal
- Labels sugeridas: `feature`
- Pronto para GitHub Projects: sim

## Tipo
Feature / UI

## Prioridade
P2

## Objetivo
Padronizar as fotos do produto (tamanho/aspecto + centralizacao) e permitir
multiplas fotos com carrossel — clientes enviam fotos de tamanho aleatorio que
saem desalinhadas.

## Estado atual encontrado
- Produto tem `images` e `photo_url`. Confirmar se ja suporta multiplas imagens no
  schema/rotas ou se so ha uma foto hoje.
- Upload deve validar por magic bytes (regra do projeto), nao por extensao.

## Resultado esperado
- Exibicao com aspecto padrao (ex.: quadrado 1:1), `object-fit: cover` centralizado
  (nada de foto esticada/deslocada).
- Suporte a varias fotos + carrossel (adicionar, remover, navegar, definir capa).

## Escopo definido (decisao do usuario)
- **Proporcao padrao: 1:1 (quadrado).**
- **Mini editor de corte/reposicionamento no upload** (cortar + reenquadrar antes
  de enviar). Reutilizar lib pronta como referencia (ex.: `react-easy-crop` ou
  `react-image-crop`) — avaliar licenca/peso; preferir a mais leve.
- Exibicao: `object-fit: cover` centralizado no card/detalhe.
- Multiplas fotos + carrossel (adicionar/remover/navegar, definir capa).
- A confirmar na implementacao: limite de fotos e se o schema/rotas ja suportam
  multiplas imagens (`images` vs `photo_url`) — estender se preciso.

## Testes obrigatorios
- Foto de proporcao aleatoria exibe centralizada, sem distorcao.
- Multiplas fotos navegam no carrossel; capa correta.
- Upload valida tipo por magic bytes.

## Criterios de aceite
- Fotos padronizadas/centralizadas e carrossel funcionando no cadastro de produto.

## Resultado da execucao
(a preencher)
