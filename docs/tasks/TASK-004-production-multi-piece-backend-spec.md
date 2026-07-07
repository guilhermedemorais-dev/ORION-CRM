# TASK-004: Especificar contrato de backend do multi-peca/proposta

## Status visual
- Status visual: A definir
- Status Kanban: Discovery / SDD
- Responsavel: sdd-spec-factory (executor de spec) / orquestrador (revisao)
- Issue criada / vinculada: `#11` - https://github.com/guilhermedemorais-dev/ORION-CRM/issues/11
- Branch sugerida: `docs/multi-piece-backend-spec`
- Milestone: Producao - OS multi-peca
- Labels sugeridas: `feature`, `needs-info`
- Pronto para GitHub Projects: sim

## Tipo
Docs (SDD)

## Prioridade
P1

## Objetivo
Produzir o contrato de backend aprovavel para a feature OS multi-peca com proposta,
destravando a TASK-002. Entregar `database.md` e `api.md` canonicos em
`docs/specs/production/os-multi-piece-proposal/`, suficientes para implementar o
backend (TASK-005) e religar o frontend (TASK-002) sem inventar payload.

## Specs obrigatorias (fonte)
- `docs/specs/production/os-multi-piece-proposal/module-spec.md`
- `docs/specs/production/os-multi-piece-proposal/page-spec.md`
- `docs/specs/production/os-multi-piece-proposal/validation-rules.md`

## Docs obrigatorios (referencia)
- `docs/modules/production/spec-os-attendance-integration.md`
- `docs/modules/production/spec-multi-piece-proposal-sales-flow.md`
- `docs/modules/production/spec-customer-material-custody.md`
- Schema atual: `apps/api/src/db/migrations/030_painel_cliente.sql` (service_orders),
  `051_service_order_materials.sql`, `035_proposal_attachments.sql`

## Decisoes fechadas (entrada desta task)
- **D1 (modelo de dados):** proposta multi-peca sera **entidade nova**, desacoplada de
  `service_orders`. Tabelas alvo: `proposals`, `proposal_pieces`, `proposal_piece_materials`.
- **D2 (escopo):** **minimo para destravar** o modal. Inclui pecas, materiais por peca
  (origem estoque proprio vs custodia do cliente), calculo de preco por peca, total
  consolidado e registro da proposta. Nao inclui versionamento, conversao Proposta->Venda,
  regra global de liberacao de producao (sinal 50%) nem politica de desconto por usuario.

## Fora do escopo
- Escrever migrations ou codigo (isso e a TASK-005).
- Alterar o modelo de `service_orders` / producao.
- Especificar proposta versionada, conversao para venda, regra de liberacao de producao
  e politica de desconto (proxima fase).
- Especificar a experiencia da aba `Propostas` apos o registro inicial.

## Estado atual encontrado
- `service_orders`: modelo de peca unica (`product_name`, `specs` JSONB, `total_cents`).
- `service_order_materials`: materiais ligados a OS, nao por peca; guarda snapshot de custo
  e de preco.
- Nao existe entidade de proposta estruturada (`proposal_attachments` guarda apenas anexos).

## Resultado esperado
- `database.md`: modelo das 3 tabelas novas (colunas, tipos, FKs, indices), dinheiro em
  centavos inteiro, origem do material (estoque vs custodia) explicita, rastreabilidade por peca.
- `api.md`: endpoints para montar projeto/pecas/materiais e registrar proposta; contrato de
  request/response; **respostas usadas pelo modal nao expoem custo/margem** (RN-06); preco como
  fonte de verdade do backend.
- Ambos coerentes com as validation-rules (RN-01..RN-11 aplicaveis a esta fase).

## Regras obrigatorias da implementacao (da spec)
- Dinheiro sempre em centavos, inteiro. Nunca FLOAT.
- Custo, margem, custo medio/unitario/total nunca na resposta consumida pelo modal tecnico.
- Custodia do cliente separada de estoque proprio, com auditoria (dado sensivel).
- Quantidade de material respeita unidade fixa do cadastro.
- Material obrigatorio para a peca entrar na proposta.

## Checklist de execucao
- [x] Leitura da task e specs
- [x] Redigir `database.md`
- [x] Redigir `api.md`
- [x] Validar coerencia com validation-rules e mockup
- [x] Atualizar o relatorio
- [ ] Handoff para revisao do orquestrador + gate de seguranca (entrega documental; sem teste de runtime)

## Prompt para o executor
Use esta task como contrato operacional. Voce e o sdd-spec-factory. Produza apenas
`database.md` e `api.md` em `docs/specs/production/os-multi-piece-proposal/`, no escopo
minimo (D2) e no modelo de entidade nova (D1). Nao escreva codigo nem migrations. Baseie-se
nas specs obrigatorias e no schema atual citado. Marque como decisao pendente qualquer ponto
que exija nova aprovacao humana.

## Condicoes de parada
- Se as specs-fonte se contradisserem em ponto bloqueante, parar e devolver ao orquestrador.
- Se o escopo minimo nao for suficiente para o modal funcionar, registrar a lacuna, nao ampliar sozinho.

## Testes obrigatorios
- N/A (entrega documental). Revisao por conferencia contra validation-rules e mockup.

## Evidencias esperadas no PR
- `database.md` e `api.md` novos, referenciando esta task e as specs-fonte.

## Criterios de aceite
- Contrato suficiente para TASK-005 (backend) e religacao da TASK-002 (frontend) sem inventar payload.
- Nenhuma resposta consumida pelo modal expoe custo/margem.
- Modelo de entidade nova, dinheiro em centavos, custodia separada.

## Banco
Especificar (nao implementar) as 3 tabelas novas.

## API/Backend
Especificar (nao implementar) os endpoints minimos do fluxo.

## Frontend/UI
N/A nesta task (definido na TASK-002 rescopada).

## Validacao
Conferencia documental contra validation-rules e mockup; gate de `security-standard`
sobre exposicao de custo e custodia.

## Riscos/Lacunas
- Calculo de preco por peca depende de regra de precificacao do estoque; se nao existir
  fonte clara, registrar como decisao pendente.
- Fronteira "registro da proposta" precisa ficar explicita para o frontend nao assumir
  comportamento da aba Propostas.

## Resultado da execucao

### Resumo
Contrato de backend da OS multi-peca especificado no escopo minimo, com entidade nova
desacoplada de `service_orders`. Entregue `database.md` (modelo das 3 tabelas) e `api.md`
(endpoints minimos, preco como fonte de verdade do backend, sem exposicao de custo).
Destrava a TASK-005 (implementacao) e a religacao da TASK-002 (frontend).

### Arquivos alterados
- `docs/specs/production/os-multi-piece-proposal/database.md` (novo)
- `docs/specs/production/os-multi-piece-proposal/api.md` (novo)

### Comandos executados
- Inspecao de schema real: `service_orders` (030), `service_order_materials` (051),
  `products` (050), ausencia de `customer_material_custody`. Nenhum comando de build (entrega documental).

### Resultado dos testes
- N/A (SDD documental). Conferencia manual contra `validation-rules.md` e o mockup: OK.

### Bloqueios
- Nenhum bloqueio para o proprio SDD. Registradas decisoes pendentes que NAO bloqueiam o
  escopo minimo: regra de precificacao do estoque, entrega de custodia, origem do credito do cliente.

### Observacoes
- Custodia do cliente depende do subsistema `customer_material_custody` (inexistente): marcada
  como dependencia, nao inventada. Decisoes fechadas: D1 (entidade nova), D2 (escopo minimo).
