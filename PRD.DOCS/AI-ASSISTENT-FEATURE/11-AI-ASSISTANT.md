# ORION CRM — Assistente IA Interno

> O Assistente ORION é a única IA que roda DENTRO do CRM.
> Ele lê dados do sistema conforme o role do usuário logado.
> Roda na ORION API via Anthropic Claude + Function Calling.
> NÃO interage com clientes — isso é responsabilidade dos flows n8n.

---

## 1. O que é

Um chat interno acessível por todos os usuários do CRM. O usuário pergunta em linguagem natural e o assistente consulta os dados do sistema para responder.

```
[Usuário digita no CRM]
"Quantos leads novos hoje?"
         ↓
[ORION API — POST /api/v1/assistant/chat]
         ↓
[Claude claude-sonnet-4-5 com Function Calling]
  → detecta que precisa de dados
  → chama função: getLeadsStats({ period: 'today' })
         ↓
[ORION API executa a função com RBAC do usuário]
         ↓
[Claude recebe os dados e formula resposta]
         ↓
"Hoje chegaram 8 leads novos. 3 já foram qualificados
 e 5 ainda estão aguardando atendimento."
```

---

## 2. RBAC — O que cada role pode perguntar

O RBAC é aplicado nas funções, não no prompt. Claude nunca recebe dados que o usuário não pode ver.

| Role | Funções disponíveis |
|------|-------------------|
| **ADMIN** | Tudo — leads, clientes, pedidos, produção, estoque, financeiro, usuários, comissões, analytics |
| **ATENDENTE** | Só os seus — leads atribuídos, clientes atribuídos, pedidos dos seus clientes, sua comissão |
| **PRODUCAO** | Ordens de produção atribuídas a ele, etapas, prazos |
| **FINANCEIRO** | Entradas, saídas, comissões, relatórios financeiros |

---

## 3. Funções Disponíveis (Function Calling)

```typescript
// apps/api/src/services/assistant/functions.ts

// Cada função recebe o userId + role para aplicar RBAC internamente

export const ASSISTANT_FUNCTIONS = {

  // ─── LEADS ───────────────────────────────────────────
  getLeadsStats: {
    description: 'Retorna estatísticas de leads por período',
    parameters: {
      period: { type: 'string', enum: ['today', 'week', 'month'] },
      stage:  { type: 'string', enum: ['NOVO','QUALIFICADO','PROPOSTA_ENVIADA','NEGOCIACAO','CONVERTIDO','PERDIDO'], optional: true }
    },
    roles: ['ADMIN', 'ATENDENTE'],
    execute: async ({ period, stage }, { userId, role }) => {
      const filter = role === 'ATENDENTE' ? { assignedTo: userId } : {}
      return db.leads.getStats({ period, stage, ...filter })
    }
  },

  getMyLeads: {
    description: 'Lista leads do atendente logado ou todos (ADMIN)',
    parameters: {
      stage:  { type: 'string', optional: true },
      limit:  { type: 'number', default: 10 }
    },
    roles: ['ADMIN', 'ATENDENTE'],
    execute: async ({ stage, limit }, { userId, role }) => {
      const filter = role === 'ATENDENTE' ? { assignedTo: userId } : {}
      return db.leads.findMany({ stage, limit, ...filter })
    }
  },

  // ─── PEDIDOS ─────────────────────────────────────────
  getOrdersStats: {
    description: 'Estatísticas de pedidos — quantidade e valor por status',
    parameters: {
      period: { type: 'string', enum: ['today', 'week', 'month'] }
    },
    roles: ['ADMIN', 'ATENDENTE', 'FINANCEIRO'],
    execute: async ({ period }, { userId, role }) => {
      const filter = role === 'ATENDENTE' ? { createdBy: userId } : {}
      return db.orders.getStats({ period, ...filter })
    }
  },

  getPendingOrders: {
    description: 'Lista pedidos aguardando pagamento ou ação',
    parameters: {
      status: { type: 'string', optional: true }
    },
    roles: ['ADMIN', 'ATENDENTE'],
    execute: async ({ status }, { userId, role }) => {
      const filter = role === 'ATENDENTE' ? { createdBy: userId } : {}
      return db.orders.findPending({ status, ...filter })
    }
  },

  // ─── PRODUÇÃO ─────────────────────────────────────────
  getProductionOrders: {
    description: 'Lista ordens de produção com prazo e etapa atual',
    parameters: {
      filter: { type: 'string', enum: ['all', 'mine', 'late', 'today'], default: 'mine' }
    },
    roles: ['ADMIN', 'PRODUCAO'],
    execute: async ({ filter }, { userId, role }) => {
      if (role === 'PRODUCAO' || filter === 'mine') {
        return db.productionOrders.findByAssignee(userId)
      }
      if (filter === 'late') return db.productionOrders.findLate()
      return db.productionOrders.findAll()
    }
  },

  // ─── FINANCEIRO ───────────────────────────────────────
  getFinancialSummary: {
    description: 'Resumo financeiro — entradas, saídas e saldo',
    parameters: {
      period: { type: 'string', enum: ['today', 'week', 'month'] }
    },
    roles: ['ADMIN', 'FINANCEIRO'],
    execute: async ({ period }) => {
      return db.financialEntries.getSummary({ period })
    }
  },

  getCommissions: {
    description: 'Comissões por atendente no período',
    parameters: {
      period: { type: 'string', enum: ['week', 'month'] },
      userId: { type: 'string', optional: true }
    },
    roles: ['ADMIN', 'ATENDENTE', 'FINANCEIRO'],
    execute: async ({ period, userId: targetId }, { userId, role }) => {
      // ATENDENTE só vê a própria comissão
      const id = role === 'ATENDENTE' ? userId : (targetId ?? undefined)
      return db.financialEntries.getCommissions({ period, userId: id })
    }
  },

  // ─── ESTOQUE ──────────────────────────────────────────
  getStockAlerts: {
    description: 'Produtos com estoque abaixo do mínimo',
    parameters: {},
    roles: ['ADMIN'],
    execute: async () => db.products.findBelowMinStock()
  },

  // ─── ANALYTICS ────────────────────────────────────────
  getConversionRate: {
    description: 'Taxa de conversão de leads em clientes',
    parameters: {
      period: { type: 'string', enum: ['week', 'month'] }
    },
    roles: ['ADMIN'],
    execute: async ({ period }) => db.leads.getConversionRate({ period })
  },

  getTopProducts: {
    description: 'Produtos mais vendidos no período',
    parameters: {
      period: { type: 'string', enum: ['month', 'quarter'] },
      limit:  { type: 'number', default: 5 }
    },
    roles: ['ADMIN', 'FINANCEIRO'],
    execute: async ({ period, limit }) => db.orders.getTopProducts({ period, limit })
  },
}
```

---

## 4. Serviço do Assistente

```typescript
// apps/api/src/services/assistant/assistant.service.ts

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export class AssistantService {

  async chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    user: { id: string; role: string; name: string }
  ): Promise<string> {

    // Filtrar funções disponíveis para o role do usuário
    const availableFunctions = Object.entries(ASSISTANT_FUNCTIONS)
      .filter(([, fn]) => fn.roles.includes(user.role))
      .map(([name, fn]) => ({
        name,
        description: fn.description,
        input_schema: {
          type: 'object' as const,
          properties: fn.parameters,
        }
      }))

    const systemPrompt = `Você é o Assistente ORION, assistente interno do CRM de uma joalheria.
Usuário: ${user.name} | Role: ${user.role}
Data atual: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

Responda sempre em português brasileiro, de forma direta e objetiva.
Formate valores monetários como R$ 1.800,00.
Quando tiver dados numéricos, seja específico.
Você só tem acesso aos dados permitidos pelo role do usuário — nunca invente dados.
Se não tiver uma função para responder, diga claramente que não tem acesso a essa informação.`

    // Loop de Function Calling (máx 3 iterações)
    let currentMessages = [...messages]
    let iterations = 0

    while (iterations < 3) {
      iterations++

      const response = await client.messages.create({
        model:      'claude-sonnet-4-5',
        max_tokens: 1024,
        system:     systemPrompt,
        tools:      availableFunctions,
        messages:   currentMessages,
      })

      // Resposta final — sem mais chamadas de função
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text')
        return textBlock?.type === 'text' ? textBlock.text : 'Não consegui processar sua pergunta.'
      }

      // Processar chamadas de função
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
        const toolResults = []

        for (const block of toolUseBlocks) {
          if (block.type !== 'tool_use') continue

          const fn = ASSISTANT_FUNCTIONS[block.name as keyof typeof ASSISTANT_FUNCTIONS]

          // Verificar RBAC — dupla checagem
          if (!fn || !fn.roles.includes(user.role)) {
            toolResults.push({
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify({ error: 'Acesso não autorizado para este tipo de dado.' })
            })
            continue
          }

          try {
            const result = await fn.execute(block.input as any, { userId: user.id, role: user.role })
            toolResults.push({
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify(result)
            })
          } catch (err) {
            toolResults.push({
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify({ error: 'Erro ao consultar os dados.' })
            })
          }
        }

        // Adicionar resposta do Claude + resultados das funções ao histórico
        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: response.content },
          { role: 'user' as const, content: toolResults }
        ]
      }
    }

    return 'Não consegui completar a consulta. Tente reformular sua pergunta.'
  }
}
```

---

## 5. Endpoint

```typescript
// POST /api/v1/assistant/chat
// Auth: Bearer JWT (todos os roles)
// Rate limit: 20 req/min por usuário

Body: {
  messages: [
    { role: 'user', content: 'Quantos leads novos hoje?' }
    // histórico da conversa — frontend mantém e envia sempre
  ]
}

Response: {
  reply: 'Hoje chegaram 8 leads novos...',
  usage: { inputTokens: 450, outputTokens: 120 }
}
```

---

## 6. Frontend — Widget do Assistente

O widget já existe na tela (imagem do usuário). O que precisa estar implementado:

```typescript
// components/modules/assistant/AssistantWidget.tsx

// Estado local — histórico da conversa (não persiste entre sessões)
const [messages, setMessages] = useState<Message[]>([])
const [input, setInput]       = useState('')
const [loading, setLoading]   = useState(false)

const sendMessage = async () => {
  const userMsg = { role: 'user', content: input }
  const newHistory = [...messages, userMsg]
  setMessages(newHistory)
  setInput('')
  setLoading(true)

  const res = await fetch('/api/v1/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: newHistory })
  })

  const { reply } = await res.json()
  setMessages([...newHistory, { role: 'assistant', content: reply }])
  setLoading(false)
}

// UI:
// - Input na parte de baixo
// - Histórico com scroll
// - Mensagem do assistente com avatar ORION
// - Loading: skeleton de 1 linha enquanto aguarda
// - Máximo 20 mensagens no histórico (truncar as mais antigas)
// - Atalho: Ctrl+K abre/fecha o widget
```

---

## 7. Banco de Dados

Não persiste histórico de conversa — cada sessão começa do zero. O frontend mantém o histórico em memória e envia sempre no request.

**Apenas para analytics** (opcional):
```sql
CREATE TABLE assistant_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  user_role        VARCHAR(20) NOT NULL,
  functions_called TEXT[],           -- quais funções foram chamadas
  input_tokens     INTEGER,
  output_tokens    INTEGER,
  latency_ms       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 8. Variáveis de Ambiente

```bash
ANTHROPIC_API_KEY=    # já existe no .env
```

---

## 9. Custo Estimado

| Cenário | Custo |
|---------|-------|
| 10 usuários × 10 perguntas/dia | ~R$ 3/dia |
| 10 usuários × 30 perguntas/dia | ~R$ 9/dia |

Modelo: `claude-sonnet-4-5` (~$3/M input tokens, ~$15/M output tokens)

---

## 10. Instrução para o Codex

**Ler antes de implementar:**
```bash
cat prd.docs/11-AI-ASSISTANT.md   ← este arquivo
cat prd.docs/00-STACK-RULES.md
```

**Ordem de implementação:**
1. Migration: `assistant_logs` (opcional mas recomendado)
2. `services/assistant/functions.ts` — todas as funções com RBAC
3. `services/assistant/assistant.service.ts` — loop de Function Calling
4. `routes/assistant.routes.ts` — endpoint POST /chat com rate limit
5. Verificar se widget já está implementado — se sim, só conectar ao endpoint real
6. Se widget não existe: `components/modules/assistant/AssistantWidget.tsx`

**Gotchas:**
- RBAC duplo: filtrar funções disponíveis pelo role ANTES de chamar Claude + checar novamente dentro de cada função ao executar
- Histórico: frontend envia sempre — backend é stateless, não salva conversa
- Truncar histórico no frontend a 20 mensagens para não estourar context window
- `tool_use` e `tool_result` seguem formato específico do SDK Anthropic — não adaptar para OpenAI
- Rate limit: 20 req/min por usuário — não por IP (usuário autenticado)
