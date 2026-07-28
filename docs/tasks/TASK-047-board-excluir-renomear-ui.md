# TASK-047: Botoes excluir/renomear board na UI de configuracao do pipeline

## Status visual
- Status visual: 🟢 Concluída (aguardando validação final do usuário)
- Status Kanban: In Review
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
Frontend (LeadsPipelineClient.tsx): botoes "Renomear" e "Excluir board" no header
do modal Configuracao do pipeline, com modal de renomear (input) e confirmacao de
exclusao. Renomear -> PUT /pipelines/:id { name } + reload. Excluir -> DELETE
/pipelines/:id -> redireciona /dashboard. Erros do backend (padrao/nao-vazio)
exibidos via setErrorMessage. Backend ja existia.

Verificado ao vivo (rebuild web, Playwright):
- Botoes aparecem no header da config (print).
- Renomear board "teste" -> "teste renomeado": PUT ok, DB atualizado (restaurado depois).
- Excluir board vazio "teste-3": DELETE ok, DB count=0, redirect /dashboard.
- `tsc --noEmit` limpo.

Nota: board de teste "teste-3" (vazio) foi removido na verificacao (descartavel).

