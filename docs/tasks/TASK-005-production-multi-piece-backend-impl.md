# TASK-005: Implementar backend do multi-peca/proposta

## Status visual
- Status visual: 🟡 Em andamento
- Status Kanban: In Progress
- Responsável: dev-implementation-standard / revisão orquestrador + security-standard
- Issue criada / vinculada: `#12` - https://github.com/guilhermedemorais-dev/ORION-CRM/issues/12
- Branch sugerida: `feat/os-multi-piece-spec-task-issues`
- Milestone: Producao - OS multi-peca
- Labels sugeridas: `feature`
- Pronto para GitHub Projects: sim

## Tipo
Feature (Banco + API/Backend)

## Prioridade
P1

## Objetivo
Implementar o contrato de backend especificado na TASK-004 para que `Gerar Proposta`
(TASK-002) persista de verdade e a proposta apareca na aba Propostas do cliente. Fecha a Fase 1.

## Specs obrigatorias
- `docs/specs/production/os-multi-piece-proposal/database.md`
- `docs/specs/production/os-multi-piece-proposal/api.md`

## Arquivos e modulos permitidos
- `apps/api/src/db/migrations/061_proposals_multi_piece.sql` (novo)
- `apps/api/src/routes/proposals.routes.ts` (novo)
- `apps/api/src/index.ts` (registro da rota)

## Fora do escopo
- Aba Propostas com editar/imprimir/PDF/WhatsApp/e-mail (Fase 2, nova spec).
- Conversao Proposta -> Venda, regra de liberacao de producao, desconto por usuario.
- Subsistema de custodia (`customer_material_custody`).

## Estado atual encontrado
- Nao existia entidade de proposta estruturada (so `proposal_attachments`).
- `service_orders` e OS unica; nao serve para multi-peca.

## Resultado esperado
- 3 tabelas novas: `proposals`, `proposal_pieces`, `proposal_piece_materials`.
- `POST /api/v1/proposals` cria proposta+pecas+materiais em transacao e registra.
- `GET /api/v1/proposals?customer_id=` lista para a aba; `GET /api/v1/proposals/:id` detalha.
- Preco calculado no backend (fonte de verdade), a partir do preco do produto do estoque.
- Nenhuma resposta expoe custo/margem.

## Regras obrigatorias da implementacao
- Dinheiro em centavos, inteiro. Parametrizar todas as queries (sem SQL concatenado).
- `authenticate` + `requireRole`; auditar criacao (`createAuditLog`).
- Material obrigatorio por peca para registrar (RN-04). Custodia separada do estoque (RN-07).

## Checklist de execucao
1. Leitura da task e specs
2. Migration 061
3. Rotas proposals + registro no index
4. Typecheck / validacao
5. Atualizacao do relatorio
6. Handoff para review (security-standard)

## Prompt para o executor
Use esta task como contrato. Implemente apenas o contrato da TASK-004 (database.md/api.md),
nos arquivos permitidos. Nao exponha custo. Preco e fonte de verdade do backend. Pare se
precisar sair do escopo.

## Condicoes de parada
- Se a regra de precificacao do estoque nao existir de forma clara, registrar como lacuna.

## Testes obrigatorios
- Migration aplica sem erro.
- POST cria proposta com 1 e N pecas; recusa peca sem material (4xx).
- Resposta nunca contem custo/margem.
- Totais: total = subtotal - credito (>= 0).

## Evidencias esperadas no PR
- Migration + rotas; saida de `tsc --noEmit` limpa; teste manual do POST/GET quando o app subir.

## Criterios de aceite
- `Gerar Proposta` persiste via `/api/internal/proposals`.
- Proposta listavel por cliente; sem custo em nenhuma resposta.

## Banco
3 tabelas novas (migration 061). Nao altera `service_orders`.

## API/Backend
Rotas `proposals.routes.ts` montadas em `/api/v1/proposals`.

## Frontend/UI
N/A (a aba Propostas consumir o GET fica como wiring final da Fase 1 / Fase 2).

## Validacao
Typecheck ok. Validacao runtime depende de aplicar a migration e subir a API. Gate de
`security-standard` sobre exposicao de custo e custodia.

## Riscos/Lacunas
- Preco usa `products.price_cents` direto; se houver regra de markup, ajustar em nova spec.
- Migration precisa ser aplicada no banco (runner de migrations do projeto).

## Resultado da execucao
- Migration `061_proposals_multi_piece.sql`, `proposals.routes.ts` e registro no `index.ts` criados.
- `npx tsc --noEmit` no `apps/api`: 0 erros.
- Pendente: aplicar migration em runtime, teste manual do endpoint, e wiring do
  `ClientPropostaTab` para exibir as propostas (fecha a Fase 1 ponta a ponta).
