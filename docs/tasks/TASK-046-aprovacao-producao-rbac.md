# TASK-046: Restringir aprovacao->producao a ADMIN/GERENTE

## Status visual
- Status visual: A definir
- Status Kanban: Ready for Dev (bloqueada por T-045)
- Responsavel: Claude Code
- Issue criada / vinculada: #48
- Branch sugerida: `feat/aprovacao-producao-rbac`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: security-standard
- Modo de handoff: Claude Code CLI
- Status da claim: unclaimed
- `locked_paths`:
  - `apps/api/src/routes/orders.routes.ts`
- Conflitos conhecidos: depende de T-045 (papel GERENTE)
- Labels sugeridas: `feature`, `security`
- Pronto para GitHub Projects: sim

## Tipo
Security

## Prioridade
P1

## Objetivo
Garantir que so ADMIN/GERENTE (e ROOT) possam mover o pedido para APROVADO/
EM_PRODUCAO. Hoje `PATCH /orders/:id/status` aceita `['ADMIN','ATENDENTE','FINANCEIRO']`,
entao ATENDENTE consegue aprovar e enviar pra producao.

## Estado atual encontrado
- `orders.routes.ts:895` `requireRole(['ADMIN','ATENDENTE','FINANCEIRO'])` no `/:id/status`.
- State machine (linhas 249-259): `APROVADO -> EM_PRODUCAO`; aprovacao de PERSONALIZADO
  cria `production_orders` e marca `custom_order_details.approved_at`.

## Resultado esperado
- Transicoes para `APROVADO` e `EM_PRODUCAO` exigem role in `['ROOT','ADMIN','GERENTE']`.
- Demais transicoes mantem as roles atuais (nao regredir).
- Erro 403 claro quando role insuficiente.

## Fora do escopo
- Baixa de estoque (ja existe regra separada) — apenas confirmar que continua na aprovacao.

## Testes obrigatorios
- ATENDENTE tenta aprovar -> 403.
- ADMIN/GERENTE aprova -> 200 e cria production_order.
- Outras transicoes seguem funcionando.
- `tsc --noEmit` limpo.

## Criterios de aceite
- Impossivel ATENDENTE mover pedido para APROVADO/EM_PRODUCAO.

## Resultado da execucao
(a preencher)
