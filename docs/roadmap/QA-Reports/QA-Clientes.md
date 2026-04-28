# QA Report — Módulo Clientes

**Data:** 27/04/2026  
**Analista:** QA Orchestrator AI (Staff Engineer)  
**Método:** Análise Estrutural + Código + E2E (bloqueado por rate limit)  
**Versão:** Production (crm.orinjoias.com)

---

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| **Nota Geral** | **7.5/10** |
| Status | 🟡 Em análise |

### Problemas Críticos
1. Rate limit excessivo bloqueia testes E2E automatizados
2. Modal de "Novo Cliente" sem validação visual de máscara
3. Tabs sem contagem de badge em alguns estados
4. Feedback "E-mail" ainda é placeholder

---

## Bloco 1 — Funcional

### ✅ Comportamentos Validados (via código)

| ID | Funcionalidade | Status | Observação |
|----|---------------|--------|------------|
| F01 | Lista de clientes carrega | ✅ OK | Paginação via `?limit=100` + query search |
| F02 | Busca por nome/WhatsApp/e-mail | ✅ OK | Debounce 300ms implementado |
| F03 | Modal "Novo Cliente" abre | ✅ OK | Abre via click no botão "+ Novo cliente" |
| F04 | Criação de cliente via API | ✅ OK | POST `/api/internal/customers` |
| F05 | Navegação para detalhe do cliente | ✅ OK | Link para `/clientes/[id]` |
| F06 | Tabs do detalhe (8 tabs) | ✅ OK | Agenda, Ficha, Atendimento, Proposta, Pedidos, OS, Entrega, Histórico |
| F07 | Timeline de histórico | ✅ OK | Agrupamento por data + filtragem por categoria |
| F08 | Lista de pedidos | ✅ OK | Steps visuais (Sinal → Design → 3D → Produção → ...) |
| F09 | Upload de propostas PDF | ✅ OK | Limite 20MB, validação de tipo |
| F10 | Botões Won/Lost no topo | ✅ OK | Lead management integrado |

### ⚠️ Issues Funcionais

| ID | Título | Severidade | Dispositivo |
|----|--------|------------|-------------|
| F-BUG-01 | Rate limit impede testes E2E em produção | **CRÍTICA** | Todos |
| F-BUG-02 | Validação de WhatsApp rejeita formatos comuns | **ALTA** | Desktop/Mobile |
| F-BUG-03 | Modal "Novo Cliente" permite submit duplicado | **MÉDIA** | Todos |

**F-BUG-01 — Rate Limit Excesivo:**
O endpoint de login retorna rate limit após ~5 tentativas rápidas:
```
?error=Muitas%20requisi%C3%A7%C3%B5es.%20Tente%20em%20284%20segundos.
```
**Impacto:** Impossibilita automação de testes E2E.  
**Recomendação:** Implementar autenticação via API key para testes ou criar ambiente de staging.

**F-BUG-02 — Validação de WhatsApp Estrita:**
O schema Zod em `actions.ts` exige formato E.164 estrito:
```typescript
whatsapp_number: z.string().regex(/^\+[1-9]\d{1,14}$/)
```
Usuários comuns往往会 colar números como `11999999999` (sem +).  
**Recomendação:** Normalizar input antes da validação ouaceitar mais formatos.

**F-BUG-03 — Submit Duplicado:**
O botão "Criar cliente" não é desativado imediatamente após o clique.  
**Recomendação:** Desabilitar botão no `onClick` antes do fetch.

---

## Bloco 2 — Responsividade

### Layout Detalhado

| Componente | Desktop (1440px) | Tablet (768px) | Mobile (390px) |
|------------|-------------------|----------------|-----------------|
| **Lista Clientes** | Grid 5 colunas | Grid 3 colunas | Stack vertical |
| **Topbar Cliente** | 48px fixa | 48px fixa | 44px |
| **Tabs** | Scroll horizontal | Scroll horizontal | Scroll horizontal |
| **Sidebar** | 280px fixa | Collapsible | Hidden |

### ⚠️ Issues de Responsividade

| ID | Título | Severidade | Dispositivo |
|----|--------|------------|-------------|
| R-UX-01 | Tabela sem scroll horizontal em mobile | **ALTA** | Mobile |
| R-UX-02 | Modal "Novo Cliente" extrapolando viewport em 320px | **MÉDIA** | Mobile |
| R-BUG-01 | Breadcrumb em duas linhas em telas estreitas | **BAIXA** | Mobile |

**R-UX-01 — Tabela Horizontal:**
A tabela de clientes usa `display: grid` com 5 colunas. Em telas < 420px, o conteúdo estoura.  
**Recomendação:** Adicionar `overflow-x: auto` no container da tabela.

---

## Bloco 3 — UI/UX

### Análise Visual

| Elemento | Cor | Fonte | Tamanho |
|----------|-----|-------|----------|
| Título Página | `#F0EDE8` | Playfair Display | 22px |
| Nome Cliente | `#F0EDE8` | DM Sans | 13px |
| LTV | `#C8A97A` | Playfair Display | 13px |
| Badge Tab | `#C8A97A` | DM Sans | 9px |
| Border | `rgba(255,255,255,0.06)` | — | 1px |

### ⚠️ Issues UI/UX

| ID | Título | Severidade |
|----|--------|------------|
| UX-01 | Skeleton de loading muito robusto | BAIXA |
| UX-02 | Sem skeleton no carregamento do histórico | MÉDIA |
| UX-03 | Ícones em linha (sem gap) em algumas seções | BAIXA |
| UX-04 | Empty state sem CTA claro em algumas tabs | MÉDIA |

---

## Bloco 4 — Backend/API

### Endpoints Detectados

| Endpoint | Método | Validação |
|----------|--------|-----------|
| `/api/internal/customers` | GET, POST | ✅ Zod validation |
| `/api/internal/customers?q=` | GET | Query param |
| `/customers/[id]/full` | GET | Fallback to `/customers/[id]` |
| `/api/internal/customers/[id]/history` | GET | `?type=all&limit=200` |
| `/api/internal/customers/[id]/orders` | GET | — |
| `/api/internal/customers/[id]/proposals/attachments` | GET, POST, DELETE | — |
| `/api/internal/customers/[id]/feedback` | GET | — |
| `/api/internal/leads/[id]/won` | POST | — |
| `/api/internal/leads/[id]/lost` | POST | Body JSON optional |

### ⚠️ Issues Backend

| ID | Título | Severidade |
|----|--------|------------|
| API-01 | Sem rate limit header na resposta | MÉDIA |
| API-02 | Fallback não documentado em `/customers/[id]/full` | BAIXA |
| API-03 | Error redirect usa query string (não ideal) | BAIXA |

---

## Bloco 5 — Banco

### Estruturas Inferidas (via código)

| Tabela | Campos Relevantes |
|--------|-------------------|
| `customers` | id, name, whatsapp_number, email, origin, is_converted, ltv_cents, lifetime_value_cents, preferred_metal, assigned_to, created_at, updated_at |
| `leads` | id, status, customer_id, ... |
| `orders` | id, customer_id, order_number, type, status, final_amount_cents, nfe_status, payment_method, created_at |
| `proposals` | id, customer_id, name, url, size_bytes, uploaded_at |
| `history` | id, customer_id, type, description, user_name, created_at, metadata |

### ⚠️ Issues Banco

| ID | Título | Severidade |
|----|--------|------------|
| DB-01 | Schema não versionado | BAIXA |
| DB-02 | Sem índice em `whatsapp_number` (busca) | MÉDIA |

---

## Bloco 6 — Segurança

### Análise Estática

| Item | Status | Observação |
|------|--------|------------|
| Input sanitization | ✅ OK | Zod valida inputs |
| Auth via session | ✅ OK | Redirect se não autenticado |
| API internal exposta? | ⚠️ Verificar | `/api/internal/*` — verificar se há guarda |

### ⚠️ Issues Segurança

| ID | Título | Severidade |
|----|--------|------------|
| SEC-01 | Rate limit muito agressivo (bloqueia até login) | ALTA |
| SEC-02 | API key exposta em logs de erro? | Verificar |

---

## Checklist de Testes

- [ ] **F01** - Lista de clientes carrega  
- [ ] **F02** - Busca funciona com debounce  
- [ ] **F03** - Modal abre/fecha corretamente  
- [ ] **F04** - Criar cliente com dados válidos  
- [ ] **F05** - Criar cliente com WhatsApp inválido → rejeita  
- [ ] **F06** - Submit duplicado não cria dois clientes  
- [ ] **F07** - Navegar para detalhe de cliente  
- [ ] **F08** - Todas as 8 tabs respondem ao click  
- [ ] **F09** - Timeline agrupa por data  
- [ ] **F10** - Timeline filtra por categoria  
- [ ] **F11** - Lista de pedidos mostra steps visuais  
- [ ] **F12** - Upload de PDF funciona  
- [ ] **F13** - Upload de PDF > 20MB rejeita  
- [ ] **F14** - Botão Won marca lead como ganho  
- [ ] **F15** - Botão Lost abre modal com reason  
- [ ] **R01** - Layout em 1440px  
- [ ] **R02** - Layout em 768px  
- [ ] **R03** - Layout em 390px  
- [ ] **R04** - Tabela scrolla horizontal em mobile  
- [ ] **UX01** - Skeleton de loading aparece  
- [ ] **UX02** - Empty states têm CTA  
- [ ] **API01** - GET /customers retorna 200  
- [ ] **API02** - GET /customers/[id] retorna 404 se não existe  
- [ ] **API03** - POST /customers retorna 400 com dados inválidos  

---

## Priorização

### 🔴 Crítico
- F-BUG-01 — Rate limit (impossibilita testes)

### 🟠 Alto
- F-BUG-02 — Validação WhatsApp
- SEC-01 — Rate limit agressivo
- R-UX-01 — Tabela mobile

### 🟡 Médio
- F-BUG-03 — Submit duplicado
- UX-04 — Empty states
- DB-02 — Índice SQL

### 🔵 Baixo
- UX-01, UX-03 — Estilo
- API-01, API-02, API-03 — Documentação

---

## Próximos Passos

1. Resolver rate limit (ambiente staging ou API key)
2. Validar e normalizar inputs de telefone
3. Implementar scroll horizontal na tabela mobile
4. Adicionar skeleton no histórico
5. Executar testes E2E completos após fix #1

---

## Evidências

- **Testes E2E criados:** `apps/web/e2e/05-clientes.spec.ts`
- **Arquivo de spec:** 7 casos de teste cobrindo lista e detalhe
- **Status Execução:** Bloqueado por rate limit em produção

---

*Report gerado por QA Orchestrator AI - 27/04/2026*