# ORION CRM — Módulo de Automações (Builder n8n)

> O módulo de Automações do ORION é um canvas drag-and-drop que lê e escreve
> workflows diretamente no n8n via REST API. O n8n é o único container de automação.
> Não existe Activepieces. Não existe Python AI separado.

---

## ⚠️ ANTES DE QUALQUER COISA — DESCONTINUAR ENGINES ANTERIORES

O projeto pode conter referências a Activepieces e Python AI de versões anteriores do PRD.
**Remova tudo isso antes de implementar este módulo.**

### 1. Remover do docker-compose.yml

```yaml
# DELETAR estes services se existirem:
# activepieces:
# python-ai:
# activepieces_db: (postgres separado do Activepieces)
# activepieces_redis: (redis separado do Activepieces)
```

### 2. Remover variáveis de ambiente

```bash
# DELETAR do .env e .env.example se existirem:
# ACTIVEPIECES_API_KEY=
# ACTIVEPIECES_URL=
# PYTHON_AI_URL=
# PYTHON_AI_SECRET=
```

### 3. Remover código da ORION API

```bash
# DELETAR se existirem:
# apps/api/src/services/activepieces.service.ts
# apps/api/src/services/python-ai.service.ts
# apps/api/src/routes/activepieces.routes.ts
# apps/api/src/workers/activepieces*.ts
# apps/python-ai/  (pasta inteira se existir)
```

### 4. Remover referências no banco

```sql
-- Se a tabela automation_flows tiver coluna activepieces_id, remover:
ALTER TABLE automation_flows DROP COLUMN IF EXISTS activepieces_id;
ALTER TABLE automation_flows DROP COLUMN IF EXISTS activepieces_flow_id;
```

### 5. Verificar antes de prosseguir

```bash
# Buscar qualquer referência restante — deve retornar zero resultados
grep -r "activepieces" apps/ --include="*.ts" --include="*.json" --include="*.yml"
grep -r "python.ai" apps/ --include="*.ts" --include="*.json" --include="*.yml"
grep -r "python_ai" apps/ --include="*.ts" --include="*.json" --include="*.yml"
```

**Só prosseguir para a implementação do builder quando os greps retornarem zero resultados.**

---

---

## 1. Arquitetura Final (Decisão Canônica)

```
[ORION Frontend — /automacoes]
  Canvas React Flow
        ↓ ORION API proxy
[ORION API /api/v1/automations/*]
        ↓ n8n REST API (HTTP interno)
[n8n :5678 — container interno]
  ├── WF-A: novo-lead (sistema)
  ├── WF-B: bot-triagem (sistema)
  ├── WF-C: handoff (sistema)
  ├── WF-D: status-pedido (sistema)
  └── [fluxos criados pelo ADMIN]
        ↓ executa
[Evolution API] [ORION API] [Google Sheets] [HTTP externo]
```

**Regras:**
- n8n é o único engine de automação — zero Activepieces
- ORION não executa flows — só constrói e publica via n8n API
- ADMIN vê e edita TODOS os flows (sistema + customizados)
- n8n nunca é exposto pelo NGINX — sempre rede interna Docker

---

## 2. n8n REST API — Endpoints Usados

A n8n expõe REST API completa em `/api/v1/`. Autenticação via API Key.

```bash
# Variável de ambiente necessária
N8N_API_KEY=   # gerado no painel n8n: Settings → API → Create API Key
N8N_URL=http://n8n:5678
```

### Endpoints que o ORION usa

```typescript
// Listar todos os workflows
GET  ${N8N_URL}/api/v1/workflows
     → { data: Workflow[], nextCursor?: string }

// Buscar workflow específico
GET  ${N8N_URL}/api/v1/workflows/:id
     → Workflow

// Criar workflow
POST ${N8N_URL}/api/v1/workflows
     Body: WorkflowCreatePayload
     → Workflow (com id gerado)

// Atualizar workflow
PUT  ${N8N_URL}/api/v1/workflows/:id
     Body: WorkflowUpdatePayload
     → Workflow

// Deletar workflow
DELETE ${N8N_URL}/api/v1/workflows/:id
     → { success: true }

// Ativar workflow
POST ${N8N_URL}/api/v1/workflows/:id/activate
     → Workflow (active: true)

// Desativar workflow
POST ${N8N_URL}/api/v1/workflows/:id/deactivate
     → Workflow (active: false)

// Listar execuções de um workflow
GET  ${N8N_URL}/api/v1/executions?workflowId=:id&limit=20
     → { data: Execution[], nextCursor?: string }

// Buscar execução específica (com detalhes por nó)
GET  ${N8N_URL}/api/v1/executions/:id
     → Execution (com runData por nó)
```

### Estrutura de um Workflow n8n (JSON canônico)

```typescript
interface N8nWorkflow {
  id?: string                    // gerado pelo n8n
  name: string
  active: boolean
  nodes: N8nNode[]
  connections: N8nConnections    // mapa de conexões entre nós
  settings?: {
    executionOrder: 'v1'
    saveManualExecutions: boolean
    callerPolicy: 'workflowsFromSameOwner'
  }
  tags?: { name: string }[]
}

interface N8nNode {
  id: string                     // UUID único por nó no workflow
  name: string                   // nome exibido no canvas
  type: string                   // ex: 'n8n-nodes-base.webhook'
  typeVersion: number            // ex: 2
  position: [number, number]     // [x, y] no canvas
  parameters: Record<string, any> // configurações específicas do nó
  credentials?: Record<string, { id: string; name: string }>
}

// Conexões: { "NomeNóOrigem": { "main": [[{ node: "NomeNóDestino", type: "main", index: 0 }]] } }
type N8nConnections = Record<string, {
  main: Array<Array<{ node: string; type: string; index: number }>>
}>
```

---

## 3. Nós Disponíveis no Builder

O builder expõe um subset curado dos nós do n8n. O ADMIN não vê os 400+ nós — só os relevantes para joalheria.

### Triggers (nós de entrada — sempre o primeiro nó)

| Nome no builder | Tipo n8n | Parâmetros expostos |
|----------------|----------|---------------------|
| Nova Mensagem WhatsApp | `n8n-nodes-base.webhook` | path (auto), método POST |
| Lead Criado | `n8n-nodes-base.webhook` | path (auto), método POST |
| Stage de Lead Alterado | `n8n-nodes-base.webhook` | path (auto), stageDe, stagePara |
| Pedido Criado | `n8n-nodes-base.webhook` | path (auto) |
| Status de Pedido Alterado | `n8n-nodes-base.webhook` | path (auto), statusDe, statusPara |
| Agendamento | `n8n-nodes-base.scheduleTrigger` | cronExpression (com helper visual) |
| Webhook Externo | `n8n-nodes-base.webhook` | path (custom), método |

### Ações (nós de processamento/saída)

| Nome no builder | Tipo n8n | Parâmetros expostos |
|----------------|----------|---------------------|
| Enviar WhatsApp | `n8n-nodes-base.httpRequest` | número, mensagem (com variáveis) |
| Atualizar Lead | `n8n-nodes-base.httpRequest` | leadId, campos a atualizar |
| Atualizar Status Pedido | `n8n-nodes-base.httpRequest` | pedidoId, novoStatus |
| Notificar Atendente | `n8n-nodes-base.httpRequest` | userId, mensagem |
| Enviar Email | `n8n-nodes-base.emailSend` | para, assunto, corpo |
| Requisição HTTP | `n8n-nodes-base.httpRequest` | url, método, headers, body |
| Aguardar | `n8n-nodes-base.wait` | tempo, unidade (min/h/d) |
| Código JavaScript | `n8n-nodes-base.code` | code (editor monaco inline) |

### Controle de Fluxo

| Nome no builder | Tipo n8n | Parâmetros expostos |
|----------------|----------|---------------------|
| Condicional (SE) | `n8n-nodes-base.if` | condições (campo, operador, valor) |
| Switch | `n8n-nodes-base.switch` | campo, casos |
| Dividir em lotes | `n8n-nodes-base.splitInBatches` | tamanho do lote |

---

## 4. ORION API — Proxy para n8n

O frontend nunca chama o n8n diretamente. A ORION API faz proxy com autenticação e RBAC.

```typescript
// apps/api/src/routes/automations.routes.ts

// Listar todos os flows (sistema + customizados)
GET    /api/v1/automations
       → busca n8n GET /api/v1/workflows
       → enriquece com tag 'sistema' vs 'custom'
       RBAC: ADMIN only

// Buscar flow específico
GET    /api/v1/automations/:n8nWorkflowId
       RBAC: ADMIN only

// Criar flow novo
POST   /api/v1/automations
       Body: { name, nodes[], connections }  ← formato ORION (convertido para n8n)
       → converte para n8n JSON → POST n8n /api/v1/workflows
       → salva referência em automation_flows (tabela local)
       RBAC: ADMIN only

// Atualizar flow
PUT    /api/v1/automations/:n8nWorkflowId
       → converte → PUT n8n /api/v1/workflows/:id
       RBAC: ADMIN only

// Ativar/desativar
PATCH  /api/v1/automations/:n8nWorkflowId/toggle
       Body: { active: boolean }
       → POST n8n .../activate ou .../deactivate
       RBAC: ADMIN only

// Deletar (não permite deletar flows 'sistema')
DELETE /api/v1/automations/:n8nWorkflowId
       → verifica tag 'sistema' → rejeita se for sistema
       → DELETE n8n /api/v1/workflows/:id
       RBAC: ADMIN only

// Histórico de execuções
GET    /api/v1/automations/:n8nWorkflowId/executions
       → GET n8n /api/v1/executions?workflowId=:id
       RBAC: ADMIN only
```

### Serviço de Conversão ORION → n8n

```typescript
// apps/api/src/services/n8n.service.ts

class N8nService {
  private baseUrl = process.env.N8N_URL      // http://n8n:5678
  private apiKey  = process.env.N8N_API_KEY
  private headers = { 'X-N8N-API-KEY': this.apiKey, 'Content-Type': 'application/json' }

  // Todos os workflows
  async listWorkflows(): Promise<N8nWorkflow[]>

  // Criar: converte formato ORION → n8n JSON
  async createWorkflow(orionFlow: OrionFlowDefinition): Promise<N8nWorkflow>

  // Atualizar
  async updateWorkflow(id: string, orionFlow: OrionFlowDefinition): Promise<N8nWorkflow>

  // Ativar/desativar
  async toggleWorkflow(id: string, active: boolean): Promise<N8nWorkflow>

  // Execuções
  async getExecutions(workflowId: string, limit = 20): Promise<N8nExecution[]>

  // Converter nó ORION → nó n8n
  private convertNode(orionNode: OrionNode): N8nNode

  // Converter conexões ORION (React Flow edges) → n8n connections map
  private convertConnections(edges: ReactFlowEdge[], nodes: OrionNode[]): N8nConnections
}
```

---

## 5. Frontend — Canvas Builder

**Rota**: `/automacoes`
**Biblioteca**: `@xyflow/react` (React Flow v12 — MIT)

```bash
npm i @xyflow/react
```

### Layout da Tela

```
┌─────────────────────────────────────────────────────────┐
│ Automações              [+ Nova Automação]              │
├──────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│ │WF-A      │ │WF-B      │ │Meu flow  │  [+ Nova]        │
│ │Bot boas- │ │Triagem   │ │custom    │                  │
│ │vindas    │ │WhatsApp  │ │          │                  │
│ │● Ativo   │ │● Ativo   │ │○ Inativo │                  │
│ │[Editar]  │ │[Editar]  │ │[Editar]  │                  │
│ │SISTEMA   │ │SISTEMA   │ │custom    │                  │
│ └──────────┘ └──────────┘ └──────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### Editor de Flow (tela cheia ao clicar em Editar/Nova)

```
┌─────────────────────────────────────────────────────────┐
│ ← Voltar  |  "WF-B: Triagem WhatsApp"  [Salvar] [●Ativar]│
├──────────────┬──────────────────────────────────────────┤
│ Painel de    │                                          │
│ Nós          │   CANVAS (React Flow)                    │
│              │                                          │
│ TRIGGERS     │   ┌──────────────┐                       │
│ • Nova msg   │   │ 🔵 Webhook   │                       │
│   WhatsApp   │   │ Nova msg WA  │                       │
│ • Lead criado│   └──────┬───────┘                       │
│ • Agendamento│          │                               │
│              │   ┌──────▼───────┐                       │
│ AÇÕES        │   │ 🟡 SE        │                       │
│ • Enviar WA  │   │ horário = ok │                       │
│ • Atualizar  │   └──┬───────┬───┘                       │
│   lead       │    SIM│    NÃO│                          │
│ • Notificar  │  ┌────▼─┐ ┌──▼────┐                     │
│   atendente  │  │Resp. │ │Msg    │                     │
│ • HTTP       │  │menu  │ │fora   │                     │
│              │  └──────┘ │horário│                     │
│ CONTROLE     │           └───────┘                     │
│ • SE/SENÃO   │                                          │
│ • Aguardar   │  [Mini-map]          [Zoom +/-] [Fit]   │
│ • JS Code    │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### Painel de Configuração do Nó (Sheet lateral ao clicar no nó)

```
┌────────────────────────────────┐
│ Configurar: Enviar WhatsApp    │
├────────────────────────────────┤
│ Número                         │
│ [{{$json.whatsapp}}          ] │
│                                │
│ Mensagem                       │
│ [Olá, {{$json.nome}}!        ] │
│ [Recebemos seu contato sobre  ]│
│ [{{$json.interesse}}.        ] │
│                                │
│ Variáveis disponíveis:         │
│ • {{$json.nome}}               │
│ • {{$json.whatsapp}}           │
│ • {{$json.interesse}}          │
│ (vindas do nó anterior)        │
│                                │
│ [Testar este nó]  [Confirmar]  │
└────────────────────────────────┘
```

### Componentes React

```
components/modules/automations/
├── AutomationsPage.tsx          ← lista de flows (cards)
├── FlowEditor.tsx               ← canvas principal (React Flow)
├── NodePanel.tsx                ← painel esquerdo de nós disponíveis
├── NodeConfigSheet.tsx          ← configuração do nó selecionado (Sheet)
├── ExecutionHistory.tsx         ← histórico de execuções do flow
├── nodes/
│   ├── BaseNode.tsx             ← componente base de nó (visual)
│   ├── TriggerNode.tsx          ← nós de trigger (borda azul)
│   ├── ActionNode.tsx           ← nós de ação (borda cinza)
│   ├── ConditionNode.tsx        ← nó IF com 2 saídas (borda amarela)
│   └── CodeNode.tsx             ← nó JS com editor Monaco
└── hooks/
    ├── useFlowSync.ts           ← salva/carrega flow do n8n via API
    └── useExecutions.ts         ← polling de execuções (refetch 5s quando ativo)
```

### Lógica de Conversão React Flow ↔ n8n JSON

```typescript
// lib/flow-converter.ts

// React Flow → n8n (para salvar)
export function orionToN8n(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  workflowName: string
): N8nWorkflow {
  return {
    name: workflowName,
    active: false,
    nodes: nodes.map(node => ({
      id:          node.id,
      name:        node.data.label,
      type:        NODE_TYPE_MAP[node.data.orionType],  // mapeia orion → n8n type
      typeVersion: NODE_VERSION_MAP[node.data.orionType],
      position:    [node.position.x, node.position.y],
      parameters:  node.data.parameters ?? {},
    })),
    connections: buildN8nConnections(edges, nodes),
    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
      callerPolicy: 'workflowsFromSameOwner',
    }
  }
}

// n8n → React Flow (para carregar no canvas)
export function n8nToOrion(workflow: N8nWorkflow): {
  nodes: ReactFlowNode[]
  edges: ReactFlowEdge[]
} {
  const nodes = workflow.nodes.map(n8nNode => ({
    id:       n8nNode.id,
    type:     REVERSE_TYPE_MAP[n8nNode.type] ?? 'action',
    position: { x: n8nNode.position[0], y: n8nNode.position[1] },
    data: {
      label:      n8nNode.name,
      orionType:  REVERSE_TYPE_MAP[n8nNode.type],
      parameters: n8nNode.parameters,
    }
  }))

  const edges = buildReactFlowEdges(workflow.connections)
  return { nodes, edges }
}

// Mapa de tipos ORION → n8n
const NODE_TYPE_MAP: Record<string, string> = {
  'whatsapp-trigger':    'n8n-nodes-base.webhook',
  'lead-trigger':        'n8n-nodes-base.webhook',
  'schedule-trigger':    'n8n-nodes-base.scheduleTrigger',
  'send-whatsapp':       'n8n-nodes-base.httpRequest',
  'update-lead':         'n8n-nodes-base.httpRequest',
  'notify-attendant':    'n8n-nodes-base.httpRequest',
  'http-request':        'n8n-nodes-base.httpRequest',
  'wait':                'n8n-nodes-base.wait',
  'if':                  'n8n-nodes-base.if',
  'switch':              'n8n-nodes-base.switch',
  'code':                'n8n-nodes-base.code',
  'email':               'n8n-nodes-base.emailSend',
}
```

---

## 6. Proteção dos Flows de Sistema

Flows WF-A/B/C/D são visíveis e editáveis mas têm aviso visual claro.

```typescript
// Tag 'sistema' é aplicada na criação inicial dos WF-A/B/C/D
// ORION verifica a tag antes de permitir DELETE

// No card do flow:
// SISTEMA → badge "Sistema" em âmbar + tooltip "Este flow é crítico para o funcionamento do ORION"
// Deletar flow sistema → diálogo de confirmação extra com texto de aviso

// Na API:
if (workflow.tags?.some(t => t.name === 'sistema') && action === 'delete') {
  return res.status(403).json({
    error: 'SYSTEM_FLOW_PROTECTED',
    message: 'Fluxos de sistema não podem ser deletados. Desative-os se necessário.'
  })
}
```

---

## 7. Inicialização — Seed dos Flows de Sistema

Na primeira execução (ou se os flows não existirem), a ORION API importa os WF-A/B/C/D automaticamente.

```typescript
// apps/api/src/startup/seed-n8n-workflows.ts

async function seedSystemWorkflows() {
  const existing = await n8nService.listWorkflows()
  const systemFlows = existing.filter(w => w.tags?.some(t => t.name === 'sistema'))

  if (systemFlows.length >= 4) return  // já importados

  const workflows = [
    require('../../n8n/workflows/WF-A-novo-lead.json'),
    require('../../n8n/workflows/WF-B-bot-triagem.json'),
    require('../../n8n/workflows/WF-C-handoff.json'),
    require('../../n8n/workflows/WF-D-status-pedido.json'),
  ]

  for (const wf of workflows) {
    await n8nService.createWorkflow(wf)
    console.log(`[n8n seed] Importado: ${wf.name}`)
  }
}

// Chamar no boot da API, após health check do n8n
```

---

## 8. Variáveis de Ambiente

```bash
# Adicionar ao .env
N8N_URL=http://n8n:5678
N8N_API_KEY=          # gerar em n8n Settings → API → Create API Key
```

---

## 9. Instrução para o Codex

**Ler antes de implementar este módulo:**
```bash
cat prd.docs/10-AUTOMATION-MODULE.md   ← este arquivo
cat prd.docs/00-STACK-RULES.md
```

**Ordem de implementação:**
1. `apps/api/src/services/n8n.service.ts` — cliente HTTP para n8n API
2. `apps/api/src/startup/seed-n8n-workflows.ts` — importar WF-A/B/C/D no boot
3. `apps/api/src/routes/automations.routes.ts` — endpoints proxy
4. `lib/flow-converter.ts` — conversão React Flow ↔ n8n JSON
5. `components/modules/automations/nodes/*` — nós customizados React Flow
6. `components/modules/automations/FlowEditor.tsx` — canvas principal
7. `components/modules/automations/NodeConfigSheet.tsx` — painel de config
8. `components/modules/automations/AutomationsPage.tsx` — listagem
9. `app/(crm)/automacoes/page.tsx` — rota

**Gotchas:**
- n8n API só responde após container estar `healthy` — checar no boot antes do seed
- `connections` do n8n usa nome do nó, não ID — se renomear nó, reconstrói connections
- React Flow usa posições em pixels — n8n também usa pixels, conversão direta
- Flows sistema: tag `sistema` no JSON antes de importar via seed
- `@xyflow/react` requer `<ReactFlowProvider>` envolvendo o canvas
