# FRONTEND SPEC: Aba Propostas da ficha do cliente — wiring das propostas persistidas

> Spec de frontend (contrato, nao PR). Deriva de `module-spec.md`, `page-spec.md`,
> `api.md` (TASK-004) e do backend implementado na TASK-005 (issue #12).
> Fecha a Fase 1: a proposta gerada no modal multi-peca aparece na aba `Propostas`.

## Status
Rascunho (aguarda aprovacao humana antes de virar codigo na TASK-006)

## Contexto verificado (fonte: repo)
- Backend pronto: `GET /api/v1/proposals?customer_id=<uuid>` lista propostas do
  cliente (sem custo/margem), montado em `apps/api/src/index.ts:126`.
  Response: `{ "data": [{ id, proposal_number, title, status, subtotal_cents,
  customer_credit_cents, total_cents, due_date, created_at }] }`.
- O web fala com a API via proxy `apps/web/app/api/internal/[...path]/route.ts`
  (`/api/internal/*` -> `ORION_API_URL` = `/api/v1/*`, com sessao). Logo o fetch
  do frontend e `GET /api/internal/proposals?customer_id=...`.
- A aba atual `apps/web/app/(crm)/clientes/[id]/components/tabs/ClientPropostaTab.tsx`
  e um drive de PDFs anexados (`proposal_attachments`), com skeleton/empty/error
  ja implementados no padrao visual da ficha (paleta escura propria da ficha).
- Statuses possiveis da proposta nesta fase: `draft`, `registered` (migration 061).

## Escopo (minimo)
Exibir na aba `Propostas` a lista read-only das propostas persistidas do cliente.
Nenhuma acao sobre a proposta nesta fase (abrir detalhe, enviar, imprimir, PDF,
WhatsApp, e-mail, finalizar venda = Fase 2 deferida, conforme `page-spec.md`).

## Frontend/UI
- Arquivo unico: `ClientPropostaTab.tsx`. Zero componentes/arquivos novos fora dele.
- Duas secoes na aba (decisao pendente D1 abaixo; recomendacao = coexistir):
  1. **Propostas** — lista das propostas persistidas (esta spec).
  2. **Arquivos anexados** — o drive de PDFs existente, preservado sem mudanca.
- Card de proposta (read-only, sem clique — decisao D2):
  - `proposal_number` + `title` (fallback "Proposta sem titulo").
  - Badge de status: `registered` -> "Registrada" (dourado `#C8A97A`),
    `draft` -> "Rascunho" (neutro). Mapa `STATUS_LABEL` local, mesmo padrao de
    `ClientEntregaTab.tsx`.
  - `total_cents` formatado com o formatador de moeda existente em
    `apps/web/lib/utils.ts` (centavos -> BRL). Exibir credito
    (`customer_credit_cents`) apenas se > 0, como linha secundaria.
  - `created_at` formatado com o padrao de data ja usado no arquivo (`fmtDate`).
  - `due_date` (se presente) como "Prazo: dd/mm".
- Estados obrigatorios da secao Propostas: skeleton no load, empty state
  ("Nenhuma proposta gerada" + dica de que propostas nascem no modal de
  Atendimento), error state com "Tentar novamente". Reutilizar os padroes
  visuais ja presentes no arquivo.
- Nao exibir nenhum campo de custo/margem (RN-06) — o endpoint ja nao os envia;
  o frontend nao deve computa-los nem deriva-los.

## Banco
N/A — nenhuma mudanca. Consome tabelas da migration 061 via API.

## API/Backend
N/A — nenhuma mudanca. Consome `GET /api/internal/proposals?customer_id=...`
(TASK-005). Se o contrato precisar mudar, parar e abrir nova task.

## Testes
- `npx tsc --noEmit` limpo no `apps/web`.
- Validacao manual (runtime): cliente com 0 propostas (empty), com 1+ propostas
  (lista com numero/status/total corretos), erro de rede (error state + retry).
- Verificar que o drive de PDFs continua funcionando inalterado.

## Seguranca
- Endpoint ja exige sessao (proxy) + `requireRole` no backend. Sem novo risco.
- Nenhum dado sensivel novo no cliente; nada de custo/margem na UI.

## Observabilidade/logs
N/A — leitura simples; erros tratados via estado de UI. Sem log novo.

## Decisoes pendentes (decidir na aprovacao da task)
- **D1**: lista de propostas **coexiste** com o drive de PDFs (recomendado) ou o
  substitui?
- **D2**: card 100% read-only (recomendado) ou clicavel abrindo detalhe
  (`GET /proposals/:id`)? Detalhe esta deferido para Fase 2 na `page-spec.md`.
- **D3**: seguir o padrao `fetch+useEffect` ja usado no arquivo (recomendado,
  diff minimo) ou migrar a aba para react-query (regra geral do CLAUDE.md)?
  Se ficar o padrao atual, registrar como tech-debt da ficha.

## Riscos
- HIPOTESE: coluna `due_date` (DATE do Postgres) pode voltar como timestamp ISO
  — usar corte `slice(0, 10)` na formatacao (gotcha ja conhecido do projeto).
- Se `data` vier vazio por RBAC/erro silencioso, a UI mostra empty state — ok,
  mas o teste manual deve cobrir um cliente que sabidamente tem proposta.

## Criterios de aceite
- Proposta gerada pelo modal multi-peca aparece na aba `Propostas` do cliente
  com numero, titulo, status, total e data.
- Nenhum custo/margem renderizado; nenhuma acao de Fase 2 exposta.
- Loading/empty/error presentes; drive de PDFs preservado.
- `tsc --noEmit` limpo.
