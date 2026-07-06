# Regras de validacao: Governanca do bootstrap de agentes

## RN-01: Spec antes de task
Toda demanda nao trivial deve apontar para uma spec antes de gerar task
executavel.

## RN-02: Task antes de implementacao
Nenhum agente deve alterar codigo de produto sem task aprovada e escopo fechado.

## RN-03: Arquivos permitidos
Nesta rodada, os arquivos permitidos sao somente:
- `docs/specs/workflow/agent-bootstrap-governance/*`
- `docs/tasks/TASK-003-workflow-agent-bootstrap-governance-review.md`
- issue GitHub correspondente

## RN-04: Separacao obrigatoria de status
Todo reporte deve separar:
- Banco
- API/Backend
- Frontend/UI
- Validacao
- Riscos/Lacunas

## RN-05: Lacuna nao vira fato
Se GitHub Projects nao puder ser atualizado por ferramenta disponivel, a task
deve marcar isso como lacuna e orientar acao manual ou automacao posterior.

## RN-06: Sem expansao silenciosa de escopo
Se a revisao identificar necessidade de mudar PRD, modulo, API, schema, UI,
auth, permissao, pagamento, webhook ou integracao, deve parar e abrir nova
spec/task especifica.

## RN-07: Bootstrap curto
Qualquer ajuste futuro nos arquivos de agente deve manter o bootstrap curto e
delegar detalhes para `docs/`, evitando duplicacao de regras extensas.

## RN-08: Validacao minima
A revisao so pode ser marcada como concluida se registrar quais documentos
foram lidos, quais conflitos foram encontrados e quais pontos ficaram como
`NAO VALIDADO`.
