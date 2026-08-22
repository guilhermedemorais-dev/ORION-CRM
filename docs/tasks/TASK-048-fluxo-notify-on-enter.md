# TASK-048: Disparar notify_on_enter (WhatsApp) do Fluxo ao entrar na etapa

## Status visual
- Status visual: ❌ Cancelada (fora de escopo)
- Status Kanban: Done (cancelada)
- NOTA: cancelada — a comunicacao/notificacao com o cliente sera via Chatwoot
  integrado ao inbox (comunicacao direta), nao pelo notify_on_enter. Issue #50 fechada.
- Responsavel: Claude Code
- Issue criada / vinculada: #50
- Branch sugerida: `feat/fluxo-notify-on-enter`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: security-standard (integracao externa / WhatsApp)
- Modo de handoff: Claude Code CLI
- Status da claim: unclaimed
- `locked_paths`:
  - `apps/api/src/services/flow-rules.service.ts`
  - `apps/api/src/routes/orders.routes.ts`
- Conflitos conhecidos: nenhum
- Labels sugeridas: `feature`
- Pronto para GitHub Projects: sim

## Tipo
Feature

## Prioridade
P2

## Objetivo
Fazer a coluna `flow_stage_rules.notify_on_enter` realmente disparar uma
notificacao WhatsApp ao cliente quando o pedido entra na etapa.

## Estado atual encontrado
- `flow-rules.service.ts` avalia `payment_rule` e bloqueia transicao; le
  `payment_rule, stage_role` mas NAO dispara notificacao.
- `checkFlowRules` e chamado em `orders.routes.ts:1404` na mudanca de etapa.
- Webhook/worker WhatsApp existe (`workers/whatsappWebhook.worker.ts`); envio deve
  ser assincrono (BullMQ), nunca sincrono (regra do projeto).

## Resultado esperado
- Ao entrar numa etapa com `notify_on_enter = true`, enfileira envio de template/
  mensagem WhatsApp pro cliente do pedido, respeitando janela de 24h.

## Riscos/Lacunas (a resolver no SDD antes de codar)
- Qual conteudo/template da mensagem? (BLOQUEANTE)
- Fora da janela de 24h so template aprovado — confirmar template.
- Idempotencia: nao notificar duplicado em retry da mesma entrada de etapa.

## Fora do escopo
- Configurar o texto no builder (se nao existir campo, fica pra outra task).

## Testes obrigatorios
- Entrada em etapa com flag -> job enfileirado (mock do envio).
- Flag false -> nao enfileira.
- Retry nao duplica.

## Criterios de aceite
- notify_on_enter dispara notificacao assincrona e idempotente.

## Resultado da execucao
(a preencher)
