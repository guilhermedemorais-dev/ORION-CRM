# Relatório Consolidado — Planejamento x Execução Real

**Data:** 14/08/2026
**Objetivo:** dar a qualquer agente (Codex, Claude Code) ou humano um mapa único
do que foi planejado desde maio, o que foi realmente entregue, onde cada coisa
está, e o que está desalinhado. Substitui a necessidade de reconstruir contexto.
**Método:** levantado de `git log --all`, branches locais e remotas, GitHub
Project #2, issues, PRs e arquivos de task. Nada aqui é estimativa — é estado
verificado do repositório em 14/08/2026.

**Documentos-base:**
- `docs/qa/reports/client-planning/2026-07-23/` — acordo de escopo e prazo com o cliente
- `docs/qa/reports/client-planning/2026-08-13/Atualizacao-Cronograma-Fluxo-2026-08-13.md`

---

## 1. Resumo executivo — leia isto primeiro

Três fatos que explicam a sensação de "está tudo perdido":

1. **Nada entra em `main` desde 24/07/2026.** O último merge foi o PR #46. São
   **21 dias** de trabalho fora da linha principal.
2. **~4.500 linhas de código e documentação vivem em 6 branches locais que nunca
   foram publicadas** (`git push` nunca rodou nelas). Não estão no GitHub. Não
   estão em nenhum backup remoto. Qualquer agente que clone o repositório **não
   as vê** — é exatamente por isso que o Codex se perde.
3. **O board não reflete a realidade.** Dois itens estão marcados `Done` e na
   verdade foram **cancelados**; quatro itens estão em `Discovery / SDD` e na
   verdade já foram **implementados** localmente.

O trabalho não se perdeu. Ele está fragmentado e invisível. O próximo passo
correto **não é escrever código novo** — é reconciliar.

---

## 2. Linha do tempo do que foi planejado

| Data | O que foi decidido | Onde está registrado |
|---|---|---|
| Mai/2026 | Pipeline modular, regras de handoff, permissões da ficha, fluxos com regra por etapa, módulo Pedidos, Produção | Commits em `main` (mig 048–058) |
| 23/06 | Specs da OS multi-peças | `docs/specs/production/` |
| 07/07 | Backend da proposta multi-peça (TASK-005) | `main` |
| 20/07 | Auditoria consolidada QA-01..21 | `docs/qa/QA-Auditoria-Consolidada-2026-07-20.md` |
| **23/07** | **Acordo de escopo e prazo com o cliente — Blocos A/B/C/D** | `client-planning/2026-07-23/` |
| 27/07 | Backlog TASK-045..053 (RBAC, estoque, permissões) | branches locais |
| 28/07 | Regra congelada: baixa de estoque só na aprovação | memória `project_regra_aprovacao_baixa_estoque` |
| **06/08** | **Correção da sequência do fluxo** (ver §3) | conversa + spec TASK-054 |
| 11/08 | TASK-054 implementada, PR #58 aberto | `feat/flow-stage-stock-action` |
| 13/08 | Planejamento de 23/07 preservado no repo + análise de estado | `client-planning/2026-08-13/` |

### 2.1 Cronograma acordado com o cliente (23/07 — segue válido)

| Bloco | Escopo | Prazo | Situação em 14/08 |
|---|---|---|---|
| **A** | Aprovação + Estoque + PDV + Permissões | 08/08/2026 | 🔴 **Vencido.** Parcialmente implementado, nada publicado |
| **B** | Financeiro completo (receber, pagar, crediário, caixa) | 22/08/2026 | 🔴 **8 dias restantes, 0% iniciado.** Sem task numerada |
| **C** | Cálculo automático de insumo + fechamento QA | 01/09/2026 | ⚪ Não iniciado, depende de A |
| **D** | Fiscal NF-e/NFC-e | +1 semana após certificado A1 | ⚪ Bloqueado pelo cliente |

Compromissos declarados ao cliente: **núcleo operacional em 22/08**, **software
completo em 01/09**.

---

## 3. Sequência operacional canônica (confirmada 06/08 e 14/08)

```text
ATENDIMENTO -> CAIXA -> ESTOQUE -> OS -> ENTREGA
```

- **Atendimento** — atendente levanta o que o cliente quer, faz a **cotação** e a
  **proposta**. A proposta é **documento** que o atendente imprime ou mostra na
  tela, **não é etapa de pipeline**. O atendente **não finaliza** a venda.
- **Caixa** — gerente/admin confere pedido e produto, **recebe o pagamento**.
  Peça pronta: entrega na hora. Personalizada: segue.
- **Estoque** — reserva os insumos e matérias-primas da peça personalizada.
- **OS** — ao finalizar a venda e reservar, o sistema **cria automaticamente a OS
  final** com todos os detalhes do produto, imagens e anexos do projeto. O
  ourives pega a OS para produzir.
- **Entrega**.

Regras associadas já fechadas: baixa efetiva na fabricação (backflush);
cancelamento pós-produção vira produto acabado (novo SKU, matéria-prima não
volta); custo oculto de quem não tem permissão; senha master para retirada
manual; margem de perda de ouro; sobra volta ao estoque.

---

## 4. Mapa completo: task → issue → onde está → estado real

Legenda: ✅ em `main` · 🟠 implementado mas **não publicado** · 🔵 planejado ·
❌ cancelado · ⚠️ board desalinhado

| Task | Issue | Board diz | Estado REAL | Onde está o código |
|---|---|---|---|---|
| TASK-001 | #8 | Done | ✅ Entregue | `main` |
| TASK-002 | #9 | In Review | ✅ Código em `main` (10/07) — falta validação runtime | `main` |
| TASK-003 | #10 | Discovery | 🔵 Governança de agentes, não iniciada | — |
| TASK-004 | #11 | Done | ✅ Entregue | `main` |
| TASK-005 | #12 | In Review | ✅ Código em `main` (07/07) — marcado "A TESTAR", **nunca validado em runtime** | `main` |
| TASK-006 | #13 | Done | ✅ Entregue | `main` |
| TASK-042 | #42 | In Review | ✅ Código em `main` (16/07) | `main` |
| TASK-043 | #44 | Done | ✅ PR #46 merged 24/07 | `main` |
| TASK-044 | #45 | Done | ✅ PR #46 merged 24/07 | `main` |
| TASK-045 | #47 | ⚠️ **Done** | ❌ **CANCELADA** — GERENTE já existia | — |
| TASK-046 | #48 | ⚠️ Discovery | 🟠 **Implementada** — `order.approve` ADMIN/GERENTE | `feat/pedido-aprovacao-rbac` |
| TASK-047 | #49 | ⚠️ Discovery | 🟠 **Implementada** — renomear/excluir board | `feat/board-excluir-renomear` |
| TASK-048 | #50 | ⚠️ **Done** | ❌ **CANCELADA** (decisão: Chatwoot). Não há disparo em `main` | — |
| TASK-049 | #51 | Discovery | 🟠 **Auditoria concluída** — achado: ~10 toggles de módulo são cosméticos | `audit/permissoes-usuarios` |
| TASK-050 | #52 | ⚠️ Discovery | 🟠 **Implementada** — custo/margem sob `product.cost.view` | `feat/produto-custo-margem-rbac` |
| TASK-051 | #53 | ⚠️ Discovery | 🟠 **Implementada** — categoria derivada de `category_id` + mig 062 | `fix/estoque-categoria` |
| TASK-052 | #54 | Discovery | 🔵 Decidido (1:1 + crop + carrossel), **não implementado** | — |
| TASK-053 | #56 | Discovery | 🔵 1ª tentativa **falhou**; precisa debug em `next dev` | — |
| TASK-054 | #57 | In Review | 🟡 **PR #58 aberto** — única branch publicada | `feat/flow-stage-stock-action` |

**Issues sem task numerada** (Discovery / SDD): #15–#24 (P0/P1 do QA),
#28–#40 (SDDs de módulo), #55 (toggles cosméticos), #25–#27, #41, #43 (backlog).

---

## 5. Estado das branches — o problema central

| Branch | Publicada? | Commits | Arquivos de código | Último commit | Conteúdo |
|---|---|---|---|---|---|
| `feat/board-excluir-renomear` | 🔴 **NÃO** | 15 | 8 | **13/08** | **Contém todas as outras** — é a ponta da pilha |
| `feat/pedido-aprovacao-rbac` | 🔴 NÃO | 11 | 7 | 27/07 | Subconjunto da anterior |
| `feat/produto-custo-margem-rbac` | 🔴 NÃO | 10 | 6 | 27/07 | Subconjunto |
| `audit/permissoes-usuarios` | 🔴 NÃO | 9 | 2 | 27/07 | Subconjunto |
| `fix/estoque-categoria` | 🔴 NÃO | 8 | 2 | 27/07 | Subconjunto |
| `docs/backlog-pipeline-rbac` | 🔴 NÃO | 5 | 0 | 27/07 | Subconjunto, só docs |
| `feat/flow-stage-stock-action` | ✅ SIM | 5 | 8 | 11/08 | PR #58 — **linha separada**, sai de `main` |

**Descoberta que simplifica tudo:** as 6 branches locais **não são paralelas, são
empilhadas**. `feat/board-excluir-renomear` contém o histórico das outras cinco.
Na prática há **duas** linhas de trabalho vivas:

1. `feat/board-excluir-renomear` — 24 arquivos, +1547 linhas, **local**
2. `feat/flow-stage-stock-action` — 11 arquivos, +1008 linhas, **PR #58**

As outras 4 branches podem ser apagadas depois de confirmada a pilha — são
marcadores intermediários redundantes.

### 5.1 Ordem das migrations

| Branch | Migration | Risco |
|---|---|---|
| `main` | até `061` | — |
| `feat/board-excluir-renomear` | `062_backfill_product_category_name.sql` | ⚠️ Se a `063` mergear primeiro, a `062` entra retroativa |
| `feat/flow-stage-stock-action` | `063_flow_stage_stock_action.sql` | Faz **DROP** de `pipeline_stage_settings` |

Não há colisão de número, mas **a ordem de merge importa**: publicar a `062`
antes da `063`.

---

## 6. Relatório por camada

### Banco

- `main` está em `061`. Duas migrations pendentes: `062` (local) e `063` (PR #58).
- A `063` **dropa** `pipeline_stage_settings` — confirmada vazia em produção
  (dump + painel, 06/08). Tem guard de vazio com `LOCK ... ACCESS EXCLUSIVE`
  antes do `count(*)`, correto.
- Runner é **forward-only**: não existe rollback pronto para a `063`.
- A `063` adiciona **7 colunas sem nenhum uso** (`sla_value`, `sla_unit`,
  `default_assignee_id`, `max_cards`, `checklist_default`,
  `required_fields_enter`, `required_fields_exit`) — troca uma tabela morta por
  colunas mortas.

### API/Backend

- Motor de fluxo (`flow_stage_rules` + `checkFlowRules`) existe e roda em `main`,
  mas avalia **somente** `payment_rule`.
- PR #58 persiste `stock_action` e `min_role_to_move`, mas **não executa nenhum
  dos dois**. É configuração sem comportamento.
- PR #58 amplia autorização: `POST`/`PATCH /flows` saiu de `ROOT`-only para
  `pipeline.configure` = **ADMIN + GERENTE**. Precisa de de-acordo explícito.
- Financeiro (contas a receber, a pagar, crediário, caixa, liquidação) **não tem
  nenhuma task numerada** — só existe como compromisso no relatório de 23/07.

### Frontend/UI

- TASK-046, 047, 050, 051 têm UI implementada em branch local, sem PR.
- PR #58 adiciona 2 dropdowns por etapa com aviso "(ainda não aplicada)" em três
  lugares — mitigação honesta, mas o campo continua sem efeito.
- Bug conhecido entrando: ADMIN acessa `/ajustes?tab=fluxo` e vê "Excluir fluxo",
  mas `DELETE /flows` é ROOT-only → **403 na cara do usuário**.
- TASK-052 (foto) e TASK-053 (hidratação) pendentes.

### Validação

- 🔴 **Não existe CI de teste.** O único workflow é `deploy.yml`. Nenhum PR roda
  typecheck ou teste automaticamente.
- O teste de integração da TASK-054 faz **skip silencioso** sem
  `TEST_API_URL` / `TEST_JWT_SECRET` / `TEST_DATABASE_URL`.
- TASK-002 e TASK-005 estão em `main` marcadas "A TESTAR" — **o fluxo de proposta
  multi-peça nunca foi validado em runtime real**.
- Núcleo PDV → estoque → financeiro: relatórios dizem que existe; **não há
  evidência de venda real validada ponta a ponta**.

### Riscos / Lacunas

| # | Risco | Gravidade |
|---|---|---|
| 1 | ~4.500 linhas em branches locais não publicadas — perda total se o disco falhar | 🔴 Crítico |
| 2 | Bloco B (financeiro) vence em 22/08 com 0% iniciado e sem task | 🔴 Crítico |
| 3 | Bloco A vencido em 08/08, nada publicado | 🔴 Crítico |
| 4 | Board mente sobre 6 itens — qualquer agente que confie nele erra | 🔴 Alto |
| 5 | `min_role_to_move` configurável mas não aplicado → falsa trava de permissão | 🟠 Alto |
| 6 | Sem CI: nada garante que `main` compila | 🟠 Alto |
| 7 | `feat/board-excluir-renomear` mistura pedidos, estoque, permissão, pipeline e docs num só branch | 🟠 Médio |
| 8 | TASK-002/005 em `main` sem validação runtime | 🟠 Médio |
| 9 | Ordem de merge 062 → 063 | 🟡 Médio |
| 10 | DROP sem migração compensatória escrita | 🟡 Médio |

---

## 7. O que fazer, em ordem

**Fase 0 — Parar de perder trabalho (hoje, ~30 min)**
1. `git push` de `feat/board-excluir-renomear` para o remoto. Só isso já tira o
   risco #1 da mesa. Não precisa de PR ainda — só existir no GitHub.

**Fase 1 — Reconciliar (1 dia)**
2. Corrigir o board: #47 e #50 → `Cancelled`/`Closed`; #48, #49, #51, #52, #53 →
   `In Review` (estão implementadas).
3. Fechar o PR #58 — aprovar com cortes ou segurar (ver §8).
4. Quebrar `feat/board-excluir-renomear` em PRs por issue: #48, #49, #52, #53 e
   um de docs. Publicar `062` antes da `063`.
5. Apagar as 4 branches redundantes depois de confirmada a pilha.

**Fase 2 — Destravar o prazo (a partir de amanhã)**
6. Escrever as specs e tasks numeradas do **Bloco B financeiro** — é o que vence
   em 22/08 e hoje não existe como execução governada.
7. Adicionar workflow de CI com typecheck + testes.
8. Validar TASK-002/005 em runtime e fechar o status.

**Fase 3 — Executar o fluxo**
9. Fatias do EPIC Make-to-Order na sequência ATENDIMENTO → CAIXA → ESTOQUE → OS →
   ENTREGA, sobre a fundação do PR #58.

---

## 8. Decisão pendente sobre o PR #58

Duas saídas, ambas legítimas:

- **(A) Merge da fatia de config** — antes, remover as 7 colunas sem uso e obter
  de-acordo por escrito sobre ADMIN/GERENTE ganharem `pipeline.configure`. A
  execução vira task própria com data curta.
- **(B) Segurar o PR** e juntar a execução (reserva/baixa + gate de papel) na
  mesma task, tornando-a fatia vertical de verdade. Mais correto, atrasa o
  Bloco A.

---

## 9. Declaração de validação

`NAO VALIDADO` em runtime real nesta análise: o levantamento é de repositório,
board e histórico git. Nenhum módulo foi exercitado em navegador ou API nesta
sessão. Os status de "implementado" refletem **código existente em branch**, não
funcionamento comprovado.
