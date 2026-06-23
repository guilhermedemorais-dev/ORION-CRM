# Backlog de Execução Crítica — Produção

Baseado em: [QA-Auditoria-Geral-Backend-Banco-Arquitetura.md](/home/guimp/Documentos/Orion-CRM/docs/qa/QA-Auditoria-Geral-Backend-Banco-Arquitetura.md)

## Prompt Inicial Obrigatório
Use este prompt no início de qualquer execução deste backlog.

```text
Você está trabalhando no projeto Orion CRM, que já está em produção.

Sua missão é executar APENAS a task indicada neste backlog.

Regras obrigatórias:
1. Leia primeiro apenas os arquivos explicitamente listados na task.
2. Não abra outros diretórios ou arquivos fora do escopo inicial sem justificar antes.
3. Não leia arquivos grandes desnecessários como package-lock, playwright-report, dist, logs, HTML gerado ou pastas irrelevantes.
4. Antes de editar, resuma em até 5 linhas:
   - o problema entendido
   - os arquivos que serão alterados
   - o resultado esperado
5. Preserve o comportamento existente fora do escopo.
6. Não refatore por estética.
7. Não renomeie arquivos, módulos ou rotas sem necessidade direta da task.
8. Se encontrar conflito de regra de negócio, pare e registre a dúvida objetivamente.
9. Sempre priorize correção funcional, estabilidade e compatibilidade com produção.
10. Sempre que possível, valide com teste local narrow e não com a suíte inteira.

Forma de trabalho:
- Passo 1: ler apenas os arquivos da task
- Passo 2: identificar a causa raiz
- Passo 3: aplicar a menor correção segura
- Passo 4: validar
- Passo 5: reportar o que mudou, risco residual e próximos passos

Formato esperado da resposta:
- Entendimento
- Arquivos lidos
- Causa raiz
- Alterações realizadas
- Validação executada
- Riscos residuais

Importante:
- Não leia o projeto inteiro.
- Siga literalmente o escopo da task.
- Se houver prompt curto sugerido na task, ele tem prioridade máxima.
- Não invente contexto que não esteja nos arquivos lidos.
```

## Índice de Execução por LLM
Use este índice para escolher rapidamente qual LLM deve pegar cada task.

| Task | Tema | LLM principal | LLM secundário | Motivo |
|---|---|---|---|---|
| `P0.1` | Inbox inbound + persistência | `Claude Code` | `Codex CLI` | fluxo crítico com backend + contrato + impacto em produção |
| `P0.2` | Histórico do cliente / WhatsApp | `Codex CLI` | `Claude Code` | correção bem delimitada em poucos arquivos |
| `P0.3` | RBAC do módulo de clientes | `Claude Code` | `Codex CLI` | exige análise de regra e impacto entre rotas |
| `P0.4` | XSS em atendimento | `Codex CLI` | `Claude Code` | patch técnico focado e verificável |
| `P0.5` | Rota quebrada do painel do cliente | `Codex CLI` | `Blackbox/Minimax` | ajuste pequeno de contrato/rota |
| `P1.1` | Filtro de usuários por papel | `Codex CLI` | `Claude Code` | escopo pequeno e objetivo |
| `P1.2` | Unificação de papéis | `Claude Code` | `Codex CLI` | impacto transversal em banco/backend/frontend |
| `P1.3` | Pipeline builder básico funcional | `Claude Code` | `Codex CLI` | fluxo maior com backend + actions + builder |
| `P1.4` | CRUD de stages no pipeline | `Codex CLI` | `Claude Code` | escopo médio, mais operacional que arquitetural |
| `P1.5` | Inbox RBAC para `ROOT` | `Codex CLI` | `Claude Code` | correção pontual em policy/service |
| `P2.1` | Feedback do cliente | `Blackbox/Minimax` | `Codex CLI` | esconder/ajustar UI ou fallback simples |
| `P2.2` | IA 3D parcial | `Blackbox/Minimax` | `Claude Code` | melhor tratar como UX/feature flag antes de backend profundo |
| `P2.3` | NF-e / comprovantes | `Blackbox/Minimax` | `Codex CLI` | ajuste imediato de UX/copy e alinhamento de expectativa |

## Índice Rápido por Ferramenta

### `Claude Code`
- `P0.1` Inbox inbound + persistência
- `P0.3` RBAC do módulo de clientes
- `P1.2` Unificação de papéis
- `P1.3` Pipeline builder básico funcional

### `Codex CLI`
- `P0.2` Histórico do cliente / WhatsApp
- `P0.4` XSS em atendimento
- `P0.5` Rota quebrada do painel do cliente
- `P1.1` Filtro de usuários por papel
- `P1.4` CRUD de stages
- `P1.5` Inbox RBAC para `ROOT`

### `Blackbox / Minimax`
- `P2.1` Feedback do cliente
- `P2.2` IA 3D parcial
- `P2.3` NF-e / comprovantes

## Objetivo
Este documento separa apenas as tasks que podem ser executadas agora para estabilizar produção, com foco em:
- inbox recebendo mensagem do WhatsApp
- mensagens persistidas e visíveis no histórico
- correções de contrato entre frontend e backend
- pipeline/builder operacional para criação e publicação básica
- organização por perfil de LLM para economizar tokens

## Regras de execução para economizar tokens
- Não pedir para o LLM “ler o projeto inteiro”.
- Sempre começar pelos arquivos listados em cada task.
- Só usar `rg` em diretórios/arquivos explicitamente citados na task.
- Rodar testes narrow, não suíte completa, sempre que possível.
- Não abrir `playwright-report/`, `package-lock.json`, `dist/`, logs grandes ou HTML gerado.
- Não refatorar fora do escopo da task.
- Antes de editar, resumir em 5 linhas o que foi entendido e confirmar os arquivos que serão alterados.

## Ordem recomendada de execução
1. Inbox inbound + persistência + histórico
2. RBAC e segurança do módulo de clientes
3. Contratos quebrados do painel do cliente
4. Pipeline builder básico funcional
5. Stubs visíveis em produção: feedback, IA 3D, NF-e/comprovantes

---

## Bloco P0 — Crítico de produção

### P0.1 — Inbox receber mensagem e persistir conversa/mensagem
- Prioridade: Crítica
- LLM recomendado: `Claude Code` para análise + `Codex CLI` para implementação
- Objetivo: garantir que a entrada de mensagem no fluxo atual crie/atualize `conversations` e persista em `messages`
- Ler apenas:
  - [apps/api/src/routes/n8n.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/n8n.routes.ts:114)
  - [apps/api/src/services/inbox.service.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/services/inbox.service.ts:600)
  - [apps/api/src/routes/inbox.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/inbox.routes.ts:422)
  - [apps/api/src/db/migrations/004_conversations_messages.sql](/home/guimp/Documentos/Orion-CRM/apps/api/src/db/migrations/004_conversations_messages.sql:1)
  - [apps/api/src/db/migrations/018_inbox_multichannel_foundation.sql](/home/guimp/Documentos/Orion-CRM/apps/api/src/db/migrations/018_inbox_multichannel_foundation.sql:14)
- Não ler:
  - frontend inteiro
  - módulos de pedidos/financeiro
- Entregáveis:
  - validar fluxo atual `POST /webhook/new-message`
  - confirmar idempotência por `meta_message_id`/`external_id`
  - corrigir eventuais falhas de atualização de `conversation`
  - adicionar teste de integração/API focado no webhook interno
- Critério de aceite:
  - uma mensagem inbound cria ou reaproveita a conversa correta
  - a mensagem fica persistida em `messages`
  - `unread_count` sobe
  - inbox lista a conversa e a thread mostra a mensagem
- Prompt curto sugerido:
```text
Trabalhe só nos arquivos n8n.routes.ts, inbox.service.ts, inbox.routes.ts e migrations 004/018. Objetivo: estabilizar o fluxo inbound do inbox via /webhook/new-message para garantir persistência de conversa e mensagem, idempotência e visibilidade na thread. Não leia o resto do projeto.
```

### P0.2 — Histórico do cliente mostrar mensagens reais do WhatsApp
- Prioridade: Crítica
- LLM recomendado: `Codex CLI`
- Objetivo: corrigir a aba de histórico e a aba WhatsApp do cliente
- Ler apenas:
  - [apps/api/src/routes/customers.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/customers.routes.ts:524)
  - [apps/web/app/(crm)/clientes/[id]/components/tabs/ClientHistoricoTab.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/clientes/[id]/components/tabs/ClientHistoricoTab.tsx:405)
  - [apps/api/src/db/migrations/004_conversations_messages.sql](/home/guimp/Documentos/Orion-CRM/apps/api/src/db/migrations/004_conversations_messages.sql:24)
  - [apps/api/src/db/migrations/018_inbox_multichannel_foundation.sql](/home/guimp/Documentos/Orion-CRM/apps/api/src/db/migrations/018_inbox_multichannel_foundation.sql:91)
- Entregáveis:
  - alinhar `type=all` vs `type=log`
  - reescrever query `type=whatsapp` no schema atual
  - remover `catch(() => ({ rows: [] }))`
  - padronizar resposta para o frontend
- Critério de aceite:
  - aba `Histórico` retorna eventos reais
  - aba `WhatsApp` retorna mensagens reais
  - erro de banco não é silenciosamente mascarado
- Prompt curto sugerido:
```text
Corrija apenas o contrato do histórico de cliente entre customers.routes.ts e ClientHistoricoTab.tsx. Ajuste type=all/log e reescreva a query de WhatsApp usando o schema atual de conversations/messages. Não leia outras áreas.
```

### P0.3 — RBAC do módulo de clientes
- Prioridade: Crítica
- LLM recomendado: `Claude Code`
- Objetivo: unificar regra de acesso para `ROOT`, `ADMIN`, `GERENTE` e `ATENDENTE`
- Ler apenas:
  - [apps/api/src/middleware/rbac.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/middleware/rbac.ts:1)
  - [apps/api/src/routes/customers.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/customers.routes.ts:45)
- Entregáveis:
  - definir helper único de escopo de cliente
  - aplicar a mesma regra em `/:id`, `/:id/full`, `/:id/orders`, `/:id/stats`, `/:id/history`, `/:id/feedback`, `PATCH /:id`
  - incluir casos de teste para `ROOT` e `ATENDENTE`
- Critério de aceite:
  - `ROOT` nunca perde acesso por verificação manual divergente
  - `ATENDENTE` não acessa cliente fora da própria carteira, salvo regra explicitamente decidida
- Observação:
  - se a regra de `GERENTE` ainda não estiver 100% definida, bloquear por menor privilégio e registrar pendência
- Prompt curto sugerido:
```text
Analise apenas rbac.ts e customers.routes.ts. Objetivo: unificar RBAC do módulo de clientes, preservando ROOT superuser e aplicando o mesmo escopo a todas as rotas do recurso customer. Não refatore outras áreas.
```

### P0.4 — Sanear HTML de atendimento e eliminar risco de XSS persistente
- Prioridade: Crítica
- LLM recomendado: `Codex CLI`
- Ler apenas:
  - [apps/api/src/routes/attendance.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/attendance.routes.ts:83)
  - [apps/web/app/(crm)/clientes/[id]/components/attendance/AttendancePopup.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/clientes/[id]/components/attendance/AttendancePopup.tsx:145)
  - [apps/web/app/(crm)/clientes/[id]/components/attendance/AttendanceBlock.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/clientes/[id]/components/attendance/AttendanceBlock.tsx:131)
- Entregáveis:
  - sanitização server-side de `content`
  - renderização segura do conteúdo
  - teste cobrindo payload com HTML/script perigoso
- Critério de aceite:
  - conteúdo perigoso não executa no cliente
  - formatação básica necessária continua funcionando

### P0.5 — Corrigir rota quebrada do painel do cliente
- Prioridade: Alta
- LLM recomendado: `Codex CLI`
- Ler apenas:
  - [apps/web/app/(crm)/clientes/[id]/components/ClientPanelShell.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/clientes/[id]/components/ClientPanelShell.tsx:40)
  - [apps/api/src/index.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/index.ts:113)
  - [apps/api/src/routes/attendance.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/attendance.routes.ts:30)
- Entregáveis:
  - corrigir consumo `/attendance-blocks` para a rota real ou criar alias backend
  - validar elegibilidade de entrega
- Critério de aceite:
  - o painel consegue ler blocos de atendimento sem cair no `catch`

---

## Bloco P1 — Alto impacto funcional

### P1.1 — Filtro de usuários por papel para menções e seleção operacional
- Prioridade: Alta
- LLM recomendado: `Codex CLI`
- Ler apenas:
  - [apps/web/app/(crm)/clientes/[id]/components/attendance/AttendancePopup.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/clientes/[id]/components/attendance/AttendancePopup.tsx:190)
  - [apps/api/src/routes/users.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/users.routes.ts:16)
  - [apps/api/src/types/entities.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/types/entities.ts:8)
- Entregáveis:
  - implementar `role` filter ou ajustar frontend para não depender dele
  - alinhar enum de papéis aceitos no endpoint
- Critério de aceite:
  - menções retornam lista previsível e coerente com os perfis ativos

### P1.2 — Unificar enum de papéis entre banco, backend e frontend
- Prioridade: Alta
- LLM recomendado: `Claude Code`
- Ler apenas:
  - [apps/api/src/db/migrations/002_users.sql](/home/guimp/Documentos/Orion-CRM/apps/api/src/db/migrations/002_users.sql:1)
  - [apps/api/src/db/migrations/030_painel_cliente.sql](/home/guimp/Documentos/Orion-CRM/apps/api/src/db/migrations/030_painel_cliente.sql:4)
  - [apps/api/src/db/migrations/038_user_roles_expansion.sql](/home/guimp/Documentos/Orion-CRM/apps/api/src/db/migrations/038_user_roles_expansion.sql:1)
  - [apps/api/src/types/entities.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/types/entities.ts:8)
  - [apps/api/src/routes/users.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/users.routes.ts:20)
  - [apps/web/components/modules/settings/AjustesClient.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/components/modules/settings/AjustesClient.tsx:56)
- Entregáveis:
  - fonte única de verdade para papéis
  - remoção de drift entre migrations e schemas
  - lista clara de papéis ativos
- Critério de aceite:
  - criar/editar/listar usuário usa o mesmo conjunto de roles em toda a stack

### P1.3 — Pipeline builder: criação, salvar flow e publicar sem quebrar
- Prioridade: Alta
- LLM recomendado: `Claude Code` para fluxo, `Codex CLI` para patch
- Ler apenas:
  - [apps/api/src/routes/pipelines.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/pipelines.routes.ts:302)
  - [apps/api/src/services/pipelines.service.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/services/pipelines.service.ts:14)
  - [apps/web/app/(crm)/pipeline/actions.ts](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/pipeline/actions.ts:8)
  - [apps/web/app/(crm)/pipeline/[slug]/builder/page.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/pipeline/[slug]/builder/page.tsx:31)
  - [apps/web/app/(crm)/pipeline/[slug]/builder/_components/BuilderCanvas.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/pipeline/[slug]/builder/_components/BuilderCanvas.tsx:438)
- Entregáveis:
  - criar pipeline novo
  - salvar `flow_json`
  - publicar pipeline com validação mínima correta
  - validar fluxo com pelo menos 1 stage
- Critério de aceite:
  - usuário cria pipeline e entra no builder
  - usuário salva builder sem erro
  - usuário publica pipeline com stages válidos
- Observação:
  - “conectar pipelines diferentes” não entra aqui; isso vai para o documento de planejamento

### P1.4 — Stage CRUD do pipeline visível e operacional no fluxo principal
- Prioridade: Alta
- LLM recomendado: `Codex CLI`
- Ler apenas:
  - [apps/api/src/routes/pipelines.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/pipelines.routes.ts:543)
  - [apps/web/app/(crm)/pipeline/[slug]/builder/_components/BuilderCanvas.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/pipeline/[slug]/builder/_components/BuilderCanvas.tsx:805)
- Entregáveis:
  - validar se o UI atual já expõe stage CRUD suficiente
  - se faltar, completar create/update/delete/reorder visível no builder ou página de apoio
- Critério de aceite:
  - usuário consegue manter etapas sem depender de intervenção manual no banco

### P1.5 — Inbox RBAC para `ROOT`
- Prioridade: Alta
- LLM recomendado: `Codex CLI`
- Ler apenas:
  - [apps/api/src/routes/inbox.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/inbox.routes.ts:186)
  - [apps/api/src/services/inbox.service.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/services/inbox.service.ts:214)
  - [apps/api/src/middleware/rbac.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/middleware/rbac.ts:5)
- Entregáveis:
  - remover divergência entre middleware e service
  - cobrir listagem, visualização, assign, handoff e close
- Critério de aceite:
  - `ROOT` se comporta como superusuário de forma consistente no inbox

---

## Bloco P2 — Remover feature “meio pronta” de produção

### P2.1 — Feedback do cliente
- Prioridade: Média
- LLM recomendado: `Blackbox/Minimax` para fallback de UI, `Codex CLI` para backend se decidir implementar
- Ler apenas:
  - [apps/api/src/routes/customers.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/customers.routes.ts:572)
  - [apps/web/app/(crm)/clientes/[id]/components/tabs/ClientHistoricoTab.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/clientes/[id]/components/tabs/ClientHistoricoTab.tsx:417)
- Opção A:
  - esconder aba até existir backend real
- Opção B:
  - implementar tabela + CRUD mínimo

### P2.2 — IA 3D
- Prioridade: Média
- LLM recomendado: `Blackbox/Minimax` para esconder/rotular UI, `Claude Code` se for aprofundar arquitetura
- Ler apenas:
  - [apps/web/app/(crm)/clientes/[id]/components/attendance/AI3DSection.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/clientes/[id]/components/attendance/AI3DSection.tsx:214)
  - [apps/api/src/routes/renders.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/renders.routes.ts:25)
- Recomendação:
  - em produção, esconder ou marcar explicitamente como “beta interno” até existir geração real

### P2.3 — NF-e e comprovantes
- Prioridade: Média
- LLM recomendado: `Blackbox/Minimax` para copy/UI, `Codex CLI` para ajuste de naming e estados
- Ler apenas:
  - [apps/api/src/routes/orders.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/orders.routes.ts:580)
  - [apps/web/app/(crm)/pedidos/actions.ts](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/pedidos/actions.ts:313)
  - [apps/web/components/modules/pdv/ReceiptModal.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/components/modules/pdv/ReceiptModal.tsx:368)
- Recomendação:
  - trocar wording de “emitir/enviar” para “solicitar/preparar” até a automação existir

---

## Pacotes de execução prontos por ferramenta

## Pacote A — Codex CLI
- P0.2 Histórico do cliente
- P0.4 XSS do atendimento
- P0.5 Rota quebrada do painel
- P1.1 Filtro de usuários
- P1.5 Inbox RBAC para ROOT

## Pacote B — Claude Code
- P0.1 Inbox inbound + persistência
- P0.3 RBAC do módulo de clientes
- P1.2 Unificação de papéis
- P1.3 Pipeline builder básico funcional

## Pacote C — Blackbox / Minimax
- P2.1 esconder ou ajustar feedback
- P2.2 esconder ou rotular IA 3D
- P2.3 ajustar copy/UX de NF-e e comprovantes
- smoke checklist visual do builder e do inbox

---

## Tasks que dependem de planejamento seu e não devem ser executadas ainda
- Conectar pipelines diferentes entre si
- Quebrar o monólito em microserviços
- Definir ownership de dados entre microserviços
- Definir CRUDs finais por contexto de domínio

Essas tasks foram movidas para:
- [QA-Planejamento-Microservicos-CRUDs.md](/home/guimp/Documentos/Orion-CRM/docs/qa/QA-Planejamento-Microservicos-CRUDs.md)

---

## Checklist de aceite final em produção
- Inbox recebe nova mensagem e a conversa aparece na lista
- Thread do inbox mostra a mensagem persistida
- Histórico do cliente mostra log e WhatsApp corretamente
- `ROOT` e `ADMIN` acessam clientes e inbox sem comportamento divergente
- `ATENDENTE` respeita escopo de carteira
- Pipeline novo pode ser criado, salvo e publicado
- Nenhuma tela crítica de produção depende de stub silencioso
