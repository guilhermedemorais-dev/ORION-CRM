# TASK-062: Base Técnica canônica no Suporte

## Status visual

- Status visual: 🟢 Implementada, não homologada
- Status Kanban: Em revisão de handoff
- Responsável: Codex
- Executor LLM: Codex
- Executor secundário/revisor: humano ou Claude Code
- Handoff mode: execução única, sem delegação concorrente
- Claim status: claimed
- Claim por: Codex Desktop local
- Claim em: 2026-08-22
- Issue criada/vinculada: [#62](https://github.com/guilhermedemorais-dev/ORION-CRM/issues/62)
- Branch sugerida: `feat/support-base-tecnica`
- Milestone: Suporte
- Labels sugeridas: `feature`, `documentation`, `security`
- Modelo/ambiente autorizado: Codex Desktop local em `/home/guimp/Documentos/Orion-CRM`
- Pronto para GitHub Projects: sim

## Objetivo

Implementar uma Base Técnica voltada a programadores no módulo Suporte. A fonte
canônica continua sendo Markdown allowlisted de `docs/handoff/`; a UI apenas
lê, busca e renderiza esse conteúdo. O acesso é exclusivamente `ADMIN`, tanto
na interface quanto na API, inclusive quando o role é `ROOT`.

## Spec obrigatória

- `docs/specs/support/base-tecnica/module-spec.md`

## Critério de sucesso

Um ADMIN abre, pesquisa e lê a documentação sanitizada; qualquer outro role,
inclusive ROOT, recebe 403 no backend e estado proibido no frontend. Nenhuma
consulta aceita path de filesystem nem persiste cópia da documentação no banco.

## Locked paths

- `apps/api/src/index.ts`
- `apps/api/src/routes/support-technical.routes.ts` (novo)
- `apps/api/src/services/support-technical.service.ts` (novo)
- `apps/api/src/routes/support-technical.routes.test.ts` (novo)
- `apps/web/app/(crm)/base-tecnica/page.tsx` (novo)
- `apps/web/app/(crm)/base-tecnica/BaseTecnicaClient.tsx` (novo)
- `apps/web/components/layout/Sidebar.tsx`
- `apps/web/app/api/internal/[...path]/route.ts` somente se a leitura exigir
  ajuste de proxy já existente
- `docs/handoff/README.md`
- `docs/handoff/VALIDACAO-CRUZADA-SEGUNDA-PASSADA.md`
- `docs/design/mockups/suporte/base-tecnica.html` (novo)

## Fora do escopo

- Banco, migration, tabela de índice ou cópia da documentação.
- Edição de Markdown pela interface.
- Leitura de tickets, uploads, logs, dumps ou caminhos fora da allowlist.
- Alterar RBAC global ou comportamento de `requireRole` fora deste endpoint.
- Indexação semântica, embeddings, IA ou integração externa.
- Refatorar Suporte/incidentes existente.

## Contrato de backend

| Endpoint | Auth | Entrada | Saída | Efeito |
| --- | --- | --- | --- | --- |
| `GET /api/v1/support/technical/docs` | JWT + guarda `role === ADMIN` | nenhum | índice allowlisted, sem conteúdo completo | leitura segura de metadados |
| `GET /api/v1/support/technical/docs/:id` | JWT + guarda `role === ADMIN` | id lógico fechado | título, metadados e Markdown | leitura de um arquivo allowlisted |
| `GET /api/v1/support/technical/search?q=` | JWT + guarda `role === ADMIN` | termo 2–100 chars, limite interno | hits com doc/id/trecho | busca server-side em allowlist |

O serviço deve definir um mapa fixo `id -> caminho relativo` e resolver apenas
esses arquivos abaixo de `docs/handoff`. Não pode aceitar path, extensão ou
glob do request. HTML bruto no Markdown deve ser desabilitado ou sanitizado.

## Interações e UI

| Interação | ADMIN | Demais roles | Estado de rede |
| --- | --- | --- | --- |
| Abrir rota | índice e primeiro documento | página 403 sem conteúdo | skeleton, erro com retry, vazio |
| Selecionar documento | requisita ID lógico | rota não é exibida e backend nega | 404/erro sem revelar path |
| Buscar | lista hits navegáveis | não executa busca | debounce simples, vazio e retry |

UI deve usar componentes do design system existente, ter `min-w-0` em áreas
flexíveis e não injetar HTML arbitrário.

## Segurança e testes obrigatórios

1. Guard específico, sem usar apenas `requireRole(['ADMIN'])`, porque ele dá
   bypass a ROOT.
2. Testar 401 sem sessão, 403 ROOT/ATENDENTE/GERENTE/FINANCEIRO e 200 ADMIN.
3. Testar IDs inválidos, tentativa de `..`, caminho absoluto, busca curta e
   busca sem resultado.
4. Confirmar que retorno não contém caminho absoluto, secrets, logs ou dados de
   cliente.
5. Validar frontend: loading, vazio, erro/retry e 403.

## Validação de execução

- `npm run typecheck --prefix apps/api`
- `npm run test --prefix apps/api -- support-technical.routes.test.ts` ou
  comando equivalente existente
- `npm run build --prefix apps/api`
- `npm run typecheck --prefix apps/web`
- `npm run build --prefix apps/web`
- teste HTTP autenticado para cada role, se ambiente seguro estiver disponível

## Contrato do executor IA

**Prompt obrigatório:** leia `AGENTS.md`, esta task e a spec inteira; confira
status/branch/locked paths e preserve todo WIP alheio. Implemente somente a
Base Técnica allowlisted. Pare se precisar de banco, pacote novo, path
arbitrário, acesso de ROOT, arquivo fora dos locks ou dado real. Execute os
testes obrigatórios e reporte Banco, API/Backend, Frontend/UI, Validação,
Riscos/Lacunas e arquivos alterados.

**Pode fazer:** adicionar rota/serviço/página/teste definidos, usar módulos já
instalados e atualizar documentos/task. **Não pode fazer:** mudar RBAC global,
introduzir dependência, criar migration, expor arquivo arbitrário, editar
tickets/incidentes ou deployar.

## Resultado dos gates

| Gate | Status | Evidência |
| --- | --- | --- |
| Ambiguity | PASS | IDs, papéis e fontes definidos na spec |
| Spec Completeness | PASS | contratos, riscos, aceite e exclusões presentes |
| UI Interaction | PASS | mockup e matriz na spec |
| Backend Contract | PASS | três endpoints e erros delimitados |
| Security Spec Contract | PASS | guard ADMIN estrito, allowlist e negativos definidos |
| Traceability | PASS | spec, TASK-062, issue #62 e handoff indexados |
| Minimal Implementation | EXCEÇÃO HUMANA | pedido explícito do usuário; sem dependência nova |

## Condições de parada

- Necessidade de expor caminho arbitrário, ticket, upload, secret ou log bruto.
- Necessidade de alterar schema/persistir cópia para viabilizar busca inicial.
- Necessidade de abrir acesso para ROOT ou outro role para contornar guard.
- Conflito com modificação de outro executor em qualquer locked path.

## Reporte obrigatório

Separar Banco, API/Backend, Frontend/UI, Validação e Riscos/Lacunas. Não marcar
homologado sem teste browser/API contra ambiente real.

## Resultado da execução

### Banco

Sem alteração de schema ou persistência de documentos.

### API/Backend

- Criados leitor allowlisted, busca server-side e rotas
  `/api/v1/support/technical/*`.
- A guarda específica permite somente `ADMIN`; `ROOT` é negado e não herda o
  bypass de `requireRole`.
- Teste cobre allowlist, query inválida, busca e negação de ROOT.

### Frontend/UI

- Criada rota `/base-tecnica`, índice, busca, renderer seguro limitado e estados
  loading, vazio, erro/retry e 403.
- Sidebar exibe Base Técnica apenas para `ADMIN`.
- Mockup criado em `docs/design/mockups/suporte/base-tecnica.html`.

### Validação

- `npm --prefix apps/api run typecheck`: passou.
- teste isolado `support-technical.routes.test.ts`: 3/3 passou.
- `npm --prefix apps/api run build`: passou.
- `npm --prefix apps/web run typecheck`: passou após correção localizada.
- `npm --prefix apps/web run build`: compilou com sucesso; aviso de
  `caniuse-lite` desatualizado.
- suíte API completa: falhou em teste preexistente de `store-order-sync` por
  variáveis obrigatórias ausentes; não é falha da Base Técnica.

### Riscos/Lacunas

- Browser autenticado, respostas HTTP reais por role e responsividade permanecem
  NÃO VALIDADOS nesta rodada.
- O renderer seguro cobre estrutura Markdown básica; tabelas são exibidas como
  texto pré-formatado, sem HTML bruto e sem dependência adicional.
- Nenhum commit, deploy ou snapshot foi criado.
