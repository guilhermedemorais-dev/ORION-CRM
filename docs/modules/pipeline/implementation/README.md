# PAINEL DO CLIENTE — ÍNDICE DE TASKS
**Deadline: domingo 15/03/2026 23:59**
**Referência visual obrigatória: `mockup-painel-completo.html`**
**Stack: Next.js 14 + Express + PostgreSQL + Prisma/Knex**

---

## ORDEM DE EXECUÇÃO

| # | Task | Arquivo | Depende de | Estimativa |
|---|------|---------|------------|------------|
| 01 | Banco de dados — migrations | TASK-01-DB.md | — | 30min |
| 02 | API — todos os endpoints | TASK-02-API.md | 01 | 2h |
| 03 | Layout shell — topbar, stage, sidebars, tabs | TASK-03-LAYOUT.md | 02 | 1h |
| 04 | Aba Ficha do Cliente | TASK-04-FICHA.md | 03 | 1h |
| 05 | Aba Atendimento + Popup + IA 3D | TASK-05-ATENDIMENTO.md | 03 | 2h |
| 06 | Aba Proposta | TASK-06-PROPOSTA.md | 03 | 45min |
| 07 | Aba Pedidos | TASK-07-PEDIDOS.md | 03 | 45min |
| 08 | Aba Ordem de Serviço | TASK-08-OS.md | 05,07 | 1h |
| 09 | Aba Entrega | TASK-09-ENTREGA.md | 07,08 | 45min |
| 10 | Aba Histórico | TASK-10-HISTORICO.md | 03 | 45min |
| 11 | Hierarquia de usuários | TASK-11-HIERARQUIA.md | 02 | 1h |

---

## REGRAS GLOBAIS (aplicar em todas as tasks)

```
Design tokens obrigatórios:
--gold: #C8A97A         --bg-0: #070708      --bg-2: #141417
--bg-3: #1A1A1E         --bg-4: #202026      --text: #F0EDE8
--label: #E8E4DE        --text-muted: #7A7774
--green: #3FB87A        --red: #E05252       --purple: #A78BFA
--amber: #F0A040        --blue: #5B9CF6      --teal: #2DD4BF

Fontes: Playfair Display (valores monetários, títulos) + DM Sans (corpo)
Labels de formulário: sempre --label (#E8E4DE) — nunca muted
Bordas inputs: --border-mid no normal, --gold-border no focus
```

```
Rota base do módulo: /crm/clientes/:id  (ou /crm/leads/:id — verificar rota existente)
Componentes em: apps/web/app/(crm)/clientes/[id]/
API em: apps/api/src/routes/
```

```
Após cada task: tsc --noEmit deve passar limpo
```

---

## COMANDO PARA CADA TASK

```bash
claude "leia PRD.DOCS/14-03-26/TASK-XX-NOME.md e PRD.DOCS/14-03-26/mockup-painel-completo.html — implemente exatamente. tsc --noEmit ao final."
```

---

## RESUMO DE ENTIDADES DO SISTEMA

```
lead/customer        → ficha do cliente (tabela canônica única)
attendance_blocks    → blocos de atendimento (nova tabela)
ai_renders           → modelos 3D gerados (nova tabela)
proposals            → já existe (PRD-PROPOSTAS.md)
orders               → já existe
service_orders (OS)  → já existe ou criar
deliveries           → já existe ou criar
fiscal_documents     → já existe (PRD-PDV-05)
```
