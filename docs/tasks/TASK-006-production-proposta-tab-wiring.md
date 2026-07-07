# TASK-006: Wiring da aba Propostas — exibir propostas persistidas (fecha Fase 1)

## Status visual
- Status visual: A definir — 🛑 aguardando aprovacao humana ("pode executar")
- Status Kanban: Ready for Dev (task + spec + issue prontas; execucao bloqueada ate aprovacao)
- Responsável: dev-implementation-standard / revisão orquestrador + ui-ux-standard
- Issue criada / vinculada: `#13` - https://github.com/guilhermedemorais-dev/ORION-CRM/issues/13
- Branch sugerida: `feat/os-multi-piece-spec-task-issues` (mesma da Fase 1)
- Milestone: Producao - OS multi-peca
- Labels sugeridas: `feature`
- Pronto para GitHub Projects: sim

## Tipo
Feature (Frontend/UI apenas)

## Prioridade
P1

## Objetivo
Fechar a Fase 1 da feature OS multi-peca: a proposta gerada pelo modal de
Atendimento (TASK-002) e persistida pelo backend (TASK-005) deve aparecer na aba
`Propostas` da ficha do cliente, como lista read-only.

## Specs obrigatorias
- `docs/specs/production/os-multi-piece-proposal/frontend-proposta-tab.md`
- `docs/specs/production/os-multi-piece-proposal/page-spec.md` (limites de Fase 2)
- `docs/specs/production/os-multi-piece-proposal/api.md` (contrato de response)

## Docs obrigatorios
- `docs/HANDOFF-os-multipeca.md` (contexto da fase)

## Arquivos e modulos permitidos
- `apps/web/app/(crm)/clientes/[id]/components/tabs/ClientPropostaTab.tsx` (unico arquivo)

## Fora do escopo
- Abrir detalhe da proposta, enviar, imprimir, PDF, WhatsApp, e-mail, finalizar
  venda (Fase 2 deferida).
- Qualquer mudanca em Banco ou API/Backend.
- Refatorar o drive de PDFs existente ou migrar a aba para react-query (salvo
  decisao D3 em contrario na aprovacao).

## Estado atual encontrado
- `ClientPropostaTab.tsx` exibe apenas o drive de PDFs anexados
  (`/api/internal/customers/:id/proposals/attachments`).
- Backend `GET /api/v1/proposals?customer_id=` pronto (TASK-005, commit local
  `6856389`), acessivel no web via proxy `/api/internal/proposals?customer_id=`.

## Resultado esperado
- Aba `Propostas` com secao de propostas persistidas (numero, titulo, badge de
  status, total em BRL, credito se > 0, data) + drive de PDFs preservado.
- Estados loading/empty/error na nova secao.

## Regras obrigatorias da implementacao
- RN-06: nenhum custo/margem renderizado ou derivado no cliente.
- Dinheiro em centavos -> BRL via formatador existente em `apps/web/lib/utils.ts`.
- Seguir a paleta/padroes visuais ja presentes no arquivo (ficha do cliente).
- `flex-1` com `min-w-0`; truncamento de titulo longo.

## Checklist de execucao
1. [ ] Leitura da task e specs
2. [ ] Implementacao (secao Propostas no `ClientPropostaTab.tsx`)
3. [ ] Testes (`npx tsc --noEmit` no `apps/web`)
4. [ ] Validacao manual em runtime (0, 1+ propostas; erro; drive de PDFs intacto)
5. [ ] Atualizacao do relatorio (Resultado da execucao)
6. [ ] Handoff para review (ui-ux-standard + orquestrador)

## Prompt para o executor
Use esta task como contrato operacional. O SDD ja foi feito. Leia a task inteira
e as specs obrigatorias antes de codar. Edite somente
`ClientPropostaTab.tsx`. Nao toque em backend/banco. Nao implemente nenhuma acao
de Fase 2. Pare se o contrato do endpoint nao bater com a spec. Preencha o
Resultado da execucao e devolva para review com `NAO VALIDADO` no que nao rodou.

## Condicoes de parada
- Response do endpoint divergente do contrato da `api.md`.
- Necessidade de tocar em qualquer arquivo fora do permitido.
- Decisoes D1/D2/D3 respondidas de forma diferente do recomendado na spec.

## Testes obrigatorios
- `npx tsc --noEmit` limpo no `apps/web`.
- Manual: empty state (cliente sem proposta), lista (cliente com proposta gerada
  pelo modal), error state (API fora), drive de PDFs inalterado.

## Evidencias esperadas no PR
- Diff unico em `ClientPropostaTab.tsx`; saida limpa do typecheck; screenshot ou
  descricao da aba com proposta listada (ou `NAO VALIDADO` se runtime nao subiu).

## Criterios de aceite
- Proposta gerada no modal aparece na aba `Propostas` com numero, titulo,
  status, total e data. Sem custo/margem. Sem acoes de Fase 2.
- Loading/empty/error presentes. Drive de PDFs preservado.

## Banco
N/A — nenhuma mudanca (consome migration 061 via API).

## API/Backend
N/A — nenhuma mudanca (consome `GET /api/internal/proposals?customer_id=`).

## Frontend/UI
Unica camada tocada: `ClientPropostaTab.tsx` (secao de propostas + estados).

## Validacao
Typecheck + validacao manual em runtime local (Guilherme). Gate `ui-ux-standard`
na review. Gate `minimal-implementation-gate` (Minimal Implementation Gate)
antes de codar — Minimal Planning Review ja executado: `APROVAR PLANEJAMENTO`
com decisoes D1/D2/D3 pendentes registradas na spec.

## Riscos/Lacunas
- `due_date` DATE pode voltar como timestamp ISO (usar `slice(0,10)`).
- Decisoes D1 (coexistir com drive de PDFs), D2 (read-only) e D3 (fetch padrao
  do arquivo) assumidas pelo recomendado — confirmar na aprovacao.

## Resultado da execucao
(pendente — preencher na implementacao)
