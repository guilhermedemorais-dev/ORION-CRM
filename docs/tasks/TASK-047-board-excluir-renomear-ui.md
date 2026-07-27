# TASK-047: Botoes excluir/renomear board na UI de configuracao do pipeline

## Status visual
- Status visual: A definir
- Status Kanban: Ready for Dev
- Responsavel: Claude Code
- Issue criada / vinculada: #49
- Branch sugerida: `feat/board-excluir-renomear-ui`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: ui-ux-standard
- Modo de handoff: Claude Code CLI
- Status da claim: unclaimed
- `locked_paths`:
  - `apps/web/components/modules/leads/LeadsPipelineClient.tsx`
  - `apps/web/components/modules/leads/PipelineRulesDialog.tsx` (se a config viver aqui)
- Conflitos conhecidos: nenhum
- Labels sugeridas: `feature`
- Pronto para GitHub Projects: sim

## Tipo
Feature / UI

## Prioridade
P2

## Objetivo
Adicionar, no modal de configuracao do pipeline, os botoes de EXCLUIR o board e
RENOMEAR o board. O backend ja existe.

## Estado atual encontrado
- Backend pronto: `pipelines.routes.ts` `DELETE /pipelines/:id` (linha 551) e rename
  via `PATCH/PUT /pipelines/:id`.
- UI: o "Excluir" existente em `LeadsPipelineClient:1744` e de etapa, nao do board.
  Nao ha botao de excluir/renomear o board no modal de config.

## Resultado esperado
- Botao "Renomear board" -> edita nome/slug via endpoint existente.
- Botao "Excluir board" -> confirmacao destrutiva -> DELETE, com tratamento de
  board com cards/pipeline padrao (bloquear ou avisar conforme o backend responder).
- Loading/empty/error states.

## Fora do escopo
- Novos endpoints (backend ja atende).

## Testes obrigatorios
- Renomear reflete na sidebar/lista.
- Excluir com confirmacao; erro claro se o backend recusar (ex.: pipeline padrao).
- `tsc --noEmit` limpo; render conferido em browser.

## Criterios de aceite
- ROOT/ADMIN consegue renomear e excluir board pela config, com confirmacao.

## Resultado da execucao
(a preencher)
