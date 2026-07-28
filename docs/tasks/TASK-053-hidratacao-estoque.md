# TASK-053: Corrigir erros de hidratacao React no Estoque

## Status visual
- Status visual: A definir
- Status Kanban: Ready for Dev
- Responsavel: Claude Code
- Issue criada / vinculada: #56
- Branch sugerida: `fix/estoque-hidratacao`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: ui-ux-standard
- Modo de handoff: Claude Code CLI
- Status da claim: unclaimed
- `locked_paths`:
  - `apps/web/components/modules/estoque/EstoqueClient.tsx`
- Conflitos conhecidos: nenhum
- Labels sugeridas: `bug`
- Pronto para GitHub Projects: sim

## Tipo
Bug

## Prioridade
P2

## Objetivo
Eliminar os erros de hidratacao (#418/#423/#425) na tela /estoque.

## Estado atual encontrado
- `fmtCurrency` usa `Intl.NumberFormat('pt-BR', BRL)` (linha ~42) e `fmtDate` usa
  `Intl.DateTimeFormat('pt-BR', ...)` (linha ~45), aplicados no render inicial
  (KPIs, tabela, detalhe). ICU do Node vs navegador gera strings levemente
  diferentes (ex.: no-break space em 'R$ 1.250,00') -> mismatch SSR/cliente.

## Resultado esperado
- Formatacao consistente SSR<->cliente (normalizar no-break space, ou formatar
  so apos mount, ou util deterministica compartilhada). Sem erros de hidratacao
  no console ao abrir /estoque.

## Testes obrigatorios
- Abrir /estoque: console sem #418/#423/#425.
- Valores e datas exibidos corretos.
- `tsc --noEmit` limpo.

## Criterios de aceite
- Zero erro de hidratacao no /estoque; formatacao intacta.

## Resultado da execucao
(a preencher)
