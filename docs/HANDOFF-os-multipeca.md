# 🔄 HANDOFF — Feature OS multi-peça (ORION CRM)

> Documento de continuidade entre sessões (Claude Code / Cowork / Codex).
> Última atualização: 2026-07-07. Fonte de verdade viva = issues #9/#11/#12 no GitHub e `docs/tasks/`.

## Como continuar a partir daqui
1. Ler este arquivo.
2. Ler as issues no GitHub (corpo = task inteira): `gh issue view 9|11|12 -R guilhermedemorais-dev/ORION-CRM`.
3. Ler os cards em `docs/tasks/TASK-002/004/005-*.md` e as specs em `docs/specs/production/os-multi-piece-proposal/`.
4. Seguir o método do plugin `dev-workflow-standard` (ver seção Método).

## Método de trabalho (obrigatório)
```
demanda → specs (SDD) → task = plano completo → 🛑 board: Guilherme aprova ("pode executar")
   → implementação (TDD) → PR → review
```
- O **board do GitHub Projects (Project #2 "ORION - CRM")** é o controle do Guilherme.
- Tarefa nova derivada → planejar + spec + pôr no board e **PARAR** para aprovação humana.
- **Nunca marcar "Done".** Trabalho concluído por IA = **"🧪 A TESTAR (rodar localmente)"** → board **In Review**. Só o Guilherme fecha, após rodar/testar local.
- Marcar o **checklist** da task (`[x]` feito / `[ ]` + 🧪 A TESTAR pendente) e preencher **Resultado da execução** no padrão (Resumo · Arquivos alterados · Comandos · Resultado dos testes · Bloqueios · Observações), com `NÃO VALIDADO` no que não rodou.
- **Toda task = issue no GitHub**; corpo da issue = a task inteira.

## Estrutura das fases
Mockup (feito) → **TASK-002 Frontend** → precisa **TASK-005 Backend** (spec = TASK-004).
Fase 2 (aba Propostas: editar/imprimir/PDF/WhatsApp/e-mail) = **deferida, a planejar depois**.

## Estado atual (2026-07-07)
| Issue | Task | Board | Estado |
|---|---|---|---|
| #8 | TASK-001 spec consolidação | Done | spec |
| #9 | TASK-002 modal multi-peça (frontend) | **In Review 🧪** | `ServiceOrderModal.tsx` reescrito; `tsc` 0 erros |
| #11 | TASK-004 spec backend | Done | `database.md` + `api.md` |
| #12 | TASK-005 backend | **In Review 🧪** | migration 061 + rotas `/api/v1/proposals`; `tsc` 0 erros; NÃO validado runtime |
| #13 | TASK-006 wiring aba Propostas (frontend) | **Ready for Dev 🛑** | spec `frontend-proposta-tab.md` + task prontas; aguarda "pode executar" do Guilherme (decisões D1/D2/D3 na spec) |
| #10 | TASK-003 (governança da ferramenta) | fora do board | não é escopo do CRM |

Branch: `feat/os-multi-piece-spec-task-issues`. Commits LOCAIS (sem push):
`8c5e712` frontend · `03041ef` specs · `6856389` backend · docs (`7d82fbe`, `7a27585`).
**Push só quando o Guilherme mandar.**

## 🧪 A TESTAR pelo Guilherme (rodar local)
1. `apps/web` no ar → modal multi-peça: 1 e 2 peças, preço só-leitura, sem custo, custódia separada do estoque.
2. Aplicar migration `061_proposals_multi_piece.sql` no banco.
3. `Gerar Proposta` → persistência via `POST /api/internal/proposals`.

## Pendências / próximos passos
- **TASK-006 (#13)**: planejada e no board (Ready for Dev) — 🛑 aguarda "pode executar" + decisões D1/D2/D3 (ver `docs/specs/production/os-multi-piece-proposal/frontend-proposta-tab.md`). Fecha Fase 1.
- Gate `security-standard` (exposição de custo / custódia).
- Push da branch (quando autorizado).
- Planejar Fase 2 (aba Propostas completa) — só após aprovação no board.

## Decisões de arquitetura fechadas
- Proposta = **entidade nova** (`proposals` / `proposal_pieces` / `proposal_piece_materials`), desacoplada de `service_orders`. Escopo **mínimo**.
- Dinheiro em centavos; **backend é fonte de verdade do preço**; **custo/margem nunca na resposta** (RN-06); preço da peça só-leitura (RN-08); material obrigatório por peça (RN-04); custódia separada do estoque (RN-07).
- Custódia depende do subsistema `customer_material_custody` (inexistente) → marcada como dependência, não implementada.

## Infra / acesso
- `gh` CLI em `~/.local/bin/gh`, autenticado como `guilhermedemorais-dev` (escopos repo, read:org, project).
- Plugin dev-workflow: repo `~/Documents/Dev-workflow`; skills symlinkadas em `~/.claude/skills/`.
