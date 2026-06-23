# Planejamento de Microserviços e CRUDs — Pendente de Definição Humana

## Prompt Base Universal Para Qualquer LLM
Use este bloco quando a tarefa for de planejamento e não de implementação direta.

```text
Você está trabalhando no projeto Orion CRM.

Sua missão é ajudar a planejar uma decisão de arquitetura, microserviço, boundary de domínio ou CRUD ainda não fechado.

Regras obrigatórias:
1. Não implementar código.
2. Não assumir regra de negócio que não esteja documentada.
3. Separar claramente:
   - fato observado no código
   - inferência técnica
   - decisão que depende do usuário
4. Ler apenas os arquivos citados na task.
5. Não abrir o projeto inteiro.
6. Não propor microserviço genérico sem definir:
   - dono do dado
   - fronteira do domínio
   - contratos de entrada e saída
   - riscos de migração
7. Quando faltar definição de negócio, marcar explicitamente:
   REGRA DE NEGÓCIO NÃO DOCUMENTADA — PRECISA DE CONFIRMAÇÃO HUMANA

Formato esperado da resposta:
- Contexto observado
- Decisões que já estão claras
- Decisões pendentes
- Opções de modelagem
- Trade-offs
- Recomendação pragmática
- Perguntas que precisam de resposta humana

Objetivo final:
Produzir um plano executável, com escopo pequeno, sem gastar tokens lendo arquivos irrelevantes e sem transformar dúvida de produto em decisão técnica automática.
```

## Objetivo
Este documento separa o que **não deve entrar agora como implementação direta por LLM** porque depende de decisão sua de domínio, fronteira de serviço, ownership de dados e fluxo operacional.

Use este arquivo para fechar planejamento antes de delegar implementação.

## Regra principal
Se a task mudar:
- fronteira de domínio
- dono do dado
- contrato entre serviços
- consistência transacional
- fluxo operacional entre times

então ela deve ser planejada primeiro aqui.

---

## Itens que precisam da sua definição antes de codar

### 1. Conectar pipelines diferentes entre si
Status:
- Não existe contrato explícito encontrado para transição entre pipelines diferentes.
- O builder atual persiste `flow_json` por pipeline e publica o próprio pipeline.

Evidências:
- [apps/api/src/routes/pipelines.routes.ts](/home/guimp/Documentos/Orion-CRM/apps/api/src/routes/pipelines.routes.ts:464)
- [apps/web/app/(crm)/pipeline/actions.ts](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/pipeline/actions.ts:63)
- [apps/web/app/(crm)/pipeline/[slug]/builder/_components/BuilderCanvas.tsx](/home/guimp/Documentos/Orion-CRM/apps/web/app/(crm)/pipeline/[slug]/builder/_components/BuilderCanvas.tsx:618)

Decisões que você precisa tomar:
- Um lead/cliente pode pertencer a mais de um pipeline ao mesmo tempo?
- A troca de pipeline é:
  - mover registro
  - clonar registro
  - criar vínculo entre pipelines
  - disparar automação
- A ligação entre pipelines ocorre:
  - manualmente pelo usuário
  - por stage final `is_won/is_lost`
  - por automação/n8n
- A mudança preserva histórico no mesmo registro ou cria outro?

CRUDs/ações que só podem ser desenhados depois:
- `POST /pipeline-links`
- `DELETE /pipeline-links/:id`
- `POST /leads/:id/move-pipeline`
- `POST /leads/:id/clone-to-pipeline`
- `GET /pipelines/:id/outbound-links`
- `GET /pipelines/:id/inbound-links`

### 2. Estratégia de microserviços
Status:
- O projeto hoje é monolítico em `apps/api`.
- Há módulos candidatos a separação, mas ainda sem boundary formal.

Candidatos de domínio observados no código:
- Inbox / WhatsApp / atendimento automatizado
- Leads / pipelines / stages
- Customers / painel / histórico / attendance blocks
- Orders / payments / fiscal
- Production / service orders / deliveries
- Settings / auth / users / permissions

Decisões que você precisa tomar:
- O objetivo da separação é:
  - escalar equipe
  - escalar throughput
  - reduzir acoplamento
  - isolar integrações externas
  - deploy independente
- Qual domínio precisa sair primeiro?
- Quem será dono do banco de cada serviço?
- Vai existir:
  - banco por serviço
  - schema por serviço
  - banco compartilhado temporário
- Comunicação entre serviços:
  - sync HTTP
  - fila/evento
  - ambos

### 3. CRUDs que dependem de modelagem final
Status:
- Há áreas com UI parcial ou rotas stub, mas sem definição funcional completa.

Precisa de definição humana:
- Feedback do cliente
- IA 3D real
- conexão entre pipelines
- emissão fiscal real
- anexos/fotos de atendimento como domínio persistente

---

## Template de decisão por microserviço

Copie e preencha um bloco por serviço candidato.

```md
## Serviço candidato: <nome>

### Objetivo
<por que separar?>

### Fronteira de domínio
<o que entra e o que fica fora>

### Dono do dado
<quais tabelas/entidades passam a ser owner desse serviço>

### Leitura externa permitida
<quais dados outros serviços podem consultar>

### Escrita externa permitida
<quem pode mandar comando para esse serviço>

### Eventos emitidos
- evento:
  payload:
  consumidores:

### Eventos consumidos
- evento:
  origem:
  ação interna:

### CRUDs mínimos
- criar:
- listar:
- detalhar:
- atualizar:
- remover/desativar:

### Fluxos críticos
- fluxo 1:
- fluxo 2:

### Dependências externas
- API:
- fila:
- storage:

### Migração
- fase 1:
- fase 2:
- fase 3:

### Riscos
- risco 1:
- risco 2:
```

---

## Proposta inicial de ordem de planejamento

### Fase A — Definir sem codar
1. Pipeline cross-linking
2. Domínio do inbox vs leads vs customers
3. Domínio de produção vs pedidos

### Fase B — Fechar CRUD mínimo por contexto
1. Pipelines e links
2. Feedback
3. Attendance attachments
4. Fiscal documents real workflow

### Fase C — Só depois pensar em separação física
1. Extrair contratos
2. Extrair eventos
3. Extrair storage ownership
4. Extrair deploy independente

---

## Sugestão de recorte pragmático de microserviços

### Serviço candidato 1 — Inbox
Entraria:
- conversations
- messages
- quick_replies
- channel_integrations
- webhooks inbound/outbound de atendimento

Não decidir sem você:
- se lead/customer link continua sendo write direto
- se handoff humano continua no mesmo serviço

### Serviço candidato 2 — Pipeline/CRM Core
Entraria:
- pipelines
- pipeline_stages
- leads
- movimentação de lead
- regras de publish

Não decidir sem você:
- cross-pipeline links
- regra de conversão lead -> customer

### Serviço candidato 3 — Customer Workspace
Entraria:
- customers
- attendance_blocks
- customer history aggregation
- painel do cliente

Não decidir sem você:
- se service_orders continuam aqui ou vão para produção

### Serviço candidato 4 — Orders/Fiscal
Entraria:
- orders
- order_items
- payments
- fiscal_documents

Não decidir sem você:
- envio de comprovante
- automação real de NF-e

### Serviço candidato 5 — Production
Entraria:
- production_orders
- service_orders
- deliveries

Não decidir sem você:
- se approvals de design ficam em pedidos, clientes ou produção

---

## Perguntas que você precisa responder antes da implementação
- Pipeline diferente significa transição de stage, troca de pipeline ou automação entre pipelines?
- Lead e customer continuarão no mesmo domínio ou serão separados?
- O inbox pode criar lead/customer automaticamente ou só sugerir?
- Service order pertence a pedido ou pertence ao atendimento do cliente?
- NF-e deve ser emitida dentro do sistema ou apenas solicitada para ERP externo?
- Anexo/foto do atendimento é só referência visual ou documento operacional oficial?

---

## Saída esperada depois que você preencher este documento
Quando estas decisões estiverem fechadas, o próximo passo ideal é gerar:
- um `Implementation Plan` por domínio
- um `ADR` por microserviço candidato
- um backlog de CRUDs/rotas/eventos por serviço
- prompts curtos por LLM com escopo de arquivos
