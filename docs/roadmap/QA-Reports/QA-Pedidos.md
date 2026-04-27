# QA Report — Página de Pedidos

**Data:** 27/04/2026  
**Módulo:** `/pedidos`  
**Ambiente:** Produção (crm.orinjoias.com)  
**QA Orchestrator:** Blackbox AI

---

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| **Nota Geral** | **6.5/10** |
| **Status** | ⚠️ Em desenvolvimento — funcionalidade parcial |
| **Pronto para produção?** | ❌ Não |

### Veredicto

A página de **Pedidos** está implementada com a estrutura principal (criação, listagem, detail panel), porém apresenta **problemas críticos de UX, validação e comportamento** que impedem sua utilização em produção. O módulo `UnderConstruction` ainda está presente, sinalizando desenvolvimento incompleto.

---

## Resultados dos Testes E2E

### Execução Automatizada (Playwright)

| Resultado | Quantidade |
|-----------|------------|
| ✅ Passou | 15/61 |
| ❌ Falhou | 45/61 |
| ⏭️ Pulado | 1/61 |

**Taxa de falha:** 73.7%

As falhas concentram-se em:
- **Autenticação:** 46/61 testes falharam por rate limiting (307s)
- **Infraestrutura:** Health check do banco retornando 401

### Testes Específicos do Módulo

Os testes de pedidos não existem de forma isolada. Há cobertura apenas em:
- `e2e/03-dia-de-operacao.spec.ts:108` → "Página de pedidos carrega sem erro"
- `e2e/03-dia-de-operacao.spec.ts:119` → "Pipeline de pedidos carrega"

Ambos estão falhando.

---

## Checklist de QA Detalhado

### BLOCO 1 — FUNCIONAL

- [ ] **Criação de pedido — Pronta Entrega**
  - Tipo: Funcional
  - Severidade: Média
  - Dispositivo: Desktop
  - Descrição: Formulário的存在. Validação Zod implementada em `actions.ts`. Endpoint POST /orders valida todos os campos. Sem testes E2E de fluxo completo.

- [ ] **Criação de pedido — Personalizado**
  - Tipo: Funcional
  - Severidade: Média
  - Dispositivo: Desktop
  - Descrição: Formulário的存在. Campos adicionais `design_description` e `metal_type`. Validação Zod exige mínimo 10 caracteres. Integração com produção automático ao aprovar.

- [ ] **Atualização de status**
  - Tipo: Funcional
  - Severidade: Crítica
  - Dispositivo: Desktop
  - Descrição: Transições de status validadas服务端. Há máquina de estados com transições permitidas em `orders.routes.ts:143-156`. Problema: não há feedback visual de sucesso após update — apenas redirect.

- [ ] **Geração de link Mercado Pago**
  - Tipo: Funcional
  - Severidade: Crítica
  - Dispositivo: Desktop
  - Descrição: Botão disponível apenas para status RASCUNHO/AGUARDANDO_PAGAMENTO. Sem tratamento de erro robusto se API do Mercado Pago falhar.

- [ ] **Filtragem de pedidos**
  - Tipo: Funcional
  - Severidade: Baixa
  - Dispositivo: Desktop
  - Descrição: Filtros por status e tipo via query params. Funciona. Sem paginação — apenas limite fixo de 100.

---

### BLOCO 2 — RESPONSIVIDADE

- [ ] **Grid responsivo — Desktop (1440px)**
  - Tipo: Responsividade
  - Severidade: Baixa
  - Dispositivo: Desktop
  - Descrição: Grid com 2 colunas para forms, sidebar sticky (`xl:grid-cols-[minmax(0,1fr)_380px]`). Layout adequado.

- [ ] **Grid responsivo — Tablet (768px)**
  - Tipo: Responsividade
  - Severidade: Média
  - Dispositivo: Tablet
  - Descrição: `lg:grid-cols-2` para forms. Provavelmente quebra no detail panel — sidebar não é sticky em telas menores.

- [ ] **Grid responsivo — Mobile (390px)**
  - Tipo: Responsividade
  - Severidade: Alta
  - Dispositivo: Mobile
  - Descrição: Sem viewport meta check no código. Forms usam `grid gap-3` sem ajuste mobile. Detalhe: `xl:sticky` não funciona em mobile — detail panel provavelmente sobrepõe conteúdo.

- [ ] **Inputs responsivos**
  - Tipo: Responsividade
  - Severidade: Média
  - Dispositivo: Mobile
  - Descrição: `md:grid-cols-3` em campos de preço/quantidade. Em mobile fica 1 coluna. Funciona, mas sem teste visual.

---

### BLOCO 3 — UI/UX

- [ ] **Elemento UnderConstruction presente**
  - Tipo: UX-Problema
  - Severidade: Crítica
  - Dispositivo: Todas
  - Descrição: Componente `<UnderConstruction />`renderizado ao final da página. Indica que a página não está pronta para uso.

- [ ] **Mensagem de erro via URL param**
  - Tipo: UX-Problema
  - Severidade: Média
  - Dispositivo: Desktop
  - Descrição: Erros são mostrados via `searchParams?.error`. Isso causa flash de página e não é ideal para UX. Deveria usar toast notifications.

- [ ] **Carregamento de dados — Server Components**
  - Tipo: UX-Problema
  - Severidade: Baixa
  - Dispositivo: Desktop
  - Descrição:Page é Server Component com fetching em paralelo via `Promise.all`. Não há loading states visuais durante fetch inicial.

- [ ] **Empty state**
  - Tipo: UX-Problema
  - Severidade: Baixa
  - Dispositivo: Desktop
  - Descrição: Quando `ordersResponse.data.length === 0` mostra mensagem simples "Nenhum pedido encontrado." Sem illustration ou call-to-action.

- [ ] **Quick filters**
  - Tipo: UX-Problema
  - Severidade: Baixa
  - Dispositivo: Desktop
  - Descrição: Links com GET params. Sem estado ativo destacada — todos os filtros parecem igualmente clicáveis.

---

### BLOCO 4 — BACKEND/API

- [ ] **GET /orders — Autenticação necessária**
  - Tipo: Backend
  - Severidade: Crítica
  - Dispositivo: Todas
  - Descrição:API retorna 401 sem token. Testes E2E falham por rate limiting antes mesmo de testar. Esperado.

- [ ] **POST /orders — Validação de status inicial**
  - Tipo: Backend
  - Severidade: Média
  - Dispositivo: Todas
  - Descrição:	Status inicial automático: PRONTA_ENTREGA → AGUARDANDO_PAGAMENTO, PERSONALIZADO → AGUARDANDO_APROVACAO_DESIGN. implementado corretamente.

- [ ] **PATCH /orders/:id/status — Validação de transição**
  - Tipo: Backend
  - Severidade: Crítica
  - Dispositivo: Todas
  - Descrição: Transições inválidas retornam 409 Conflict. Ex: RASCUNHO → EM_PRODUCAO não permitido. Implemetação robusta. Problema: Frontend não exibe erro 409 de forma amigável.

- [ ] **POST /orders/:id/nfe**
  - Tipo: Backend
  - Severidade: Baixa
  - Dispositivo: Desktop
  - Descrição: Endpoint existe mas não há botão na UI. Funcionalidade órfã.

- [ ] **POST /orders/:id/send-receipt**
  - Tipo: Backend
  - Severidade: Baixa
  - Dispositivo: Desktop
  - Descrição: Endpoint existe mas não há botão na UI. Funcionalidade órfã.

- [ ] **Rate limiting**
  - Tipo: Backend
  - Severidade: Informativa
  - Dispositivo: Desktop
  - Descrição: Rate limit presente (90 req/min para list, 30 para create). Testes E2E batem contra rate limit e são bloqueados.

---

### BLOCO 5 — BANCO DE DADOS

- [ ] **Consultas optimizadas**
  - Tipo: Banco
  - Severidade: Baixa
  - Dispositivo: Desktop
  - Descrição: Queries usam JOINs adequados. Sem N+1 problem. Order items são fetchados separadamente — poderia ser otimizado com JOIN único.

- [ ] **Transações**
  - Tipo: Banco
  - Severidade: Crítica
  - Dispositivo: Desktop
  - Descrição: Criação de pedido usa `transaction()` para atomicidade. Status update também transactional. Implementação correta.

- [ ] **Auditoria**
  - Tipo: Banco
  - Severidade: Média
  - Dispositivo: Desktop
  - Descrição: `createAuditLog` é chamado em create e status update. Rastreabilidade OK.

- [ ] **Dados ausentes no detail**
  - Tipo: Banco
  - Severidade: Média
  - Dispositivo: Desktop
  - Descrição: Campos como `approved_at`, `approved_by_customer` existem no banco mas não são exibidos claramente no UI.

---

### BLOCO 6 — SEGURANÇA

- [ ] **Zod validation — Input sanitization**
  - Tipo: Segurança
  - Severidade: Crítica
  - Dispositivo: Todas
  - Descrição: Todos os inputs são validados com Zod antes de processamento. Implemetação robusta contra injeção e dados malformed.

- [ ] **RBAC — Roles permitidas**
  - Tipo: Segurança
  - Severidade: Crítica
  - Dispositivo: Todas
  - Descrição: rotas de orders requerem ['ADMIN', 'ATENDENTE', 'FINANCEIRO', 'PRODUCAO']. ATENDENTE só vê seus próprios pedidos (scoped). Produção também. Implementação correta.

- [ ] **UUID validation**
  - Tipo: Segurança
  - Severidade: Crítica
  - Dispositivo: Todas
  - Descrição: Todos os IDs de referência são validados como UUID. Sem IDOR vulnerability aparente.

- [ ] **XSS prevention**
  - Tipo: Segurança
  - Severidade: Crítica
  - Dispositivo: Todas
  - Descrição: Next.js por padrão escapa output. Props vindas do servidor são seguras.

---

## Problemas Críticos Identificados

### 1. 🔴 Módulo UnderConstruction ativo
- **Severidade:** CRÍTICA
- **Local:** `page.tsx:linha final`
- **Descrição:** Componente `<UnderConstruction />` indica funcionalidade incompleta. Não deve ir para produção neste estado.

### 2. 🔴 Sem testes E2E específicos para o módulo
- **Severidade:** CRÍTICA
- **Local:** Pasta `e2e/`
- **Descrição:** Não existe `e2e/07-pedidos.spec.ts`. Cobertura zero para fluxos: criação, atualização de status, filtragem, detail panel.

### 3. 🟠 Taxa de falha E2E sistêmica (73%)
- **Severidade:** ALTA
- **Local:** Playwright config + auth helpers
- **Descrição:** Testes batem em rate limiting. Credenciais de teste provavelmente incorretas ou IP bloqueado. Impossível validar comportamento em produção via automação.

### 4. 🟠 Falha de UX — Feedback de erro
- **Severidade:** ALTA
- **Local:** `actions.ts` + `page.tsx`
- **Descrição:** Erros são exibidos via URL query param (`?error=...`). Isso causa:
  - Refresh da página
  - Perda de scroll position
  - Não há toast/snackbar para success
  - Usuário não sabe se ação foi bem-sucedida

### 5. 🟡 Funcionalidades órfãs
- **Severidade:** MÉDIA
- **Local:** `orders.routes.ts`
- **Descrição:** Endpoints `/nfe` e `/send-receipt` existem mas não há botões na UI para acioná-los. Código morto.

### 6. 🟡 Responsividade não testada
- **Severidade:** MÉDIA
- **Local:** CSS Grid + sticky
- **Descrião:** Não há screenshot/verificação de mobile. O detail panel usa `xl:sticky` que não funciona em mobile — UX provavelmente quebrada.

---

## Recomendações de Correção

### Imediatas (antes de produção)

1. **Remover `<UnderConstruction />`**
   - Remover composant da linha final de `page.tsx`
   - Ou manter até Feature Complete e testar completamente antes

2. **Criar testes E2E para pedidos**
   - Criar `e2e/07-pedidos.spec.ts`
   - Testar: criação PE, criação personalizado, update status, filtros

3. **Melhorar feedback de erro**
   - Substituir `searchParams.error` por toast notifications
   - Usar `useFormState` ou `useActionState` do React 19
   - Adicionar loading states nos botões durante submit

4. **Corrigir credenciais de teste**
   - Verificar TEST_EMAIL/TEST_PASSWORD no env
   - Reduzir rate limit nos testes ou mockar auth

### Curto prazo

5. **Adicionar botões para NF-e e Receipt**
   - Criar botões no detail panel
   - Funcionalidades existem no backend, faltam na UI

6. **Testar responsividade mobile**
   - Tirar screenshots em viewport 390px
   - Ajustar grid do detail panel para mobile (talvez transformar em drawer/modal)

7. **Adicionar highlight ao filtro ativo**
   - O link do filtro atual deve ter estilo diferente

---

## Métricas de Cobertura

| Área | Cobertura | Observação |
|------|-----------|------------|
| Validação Zod | ✅ 100% | Todos os campos validados |
| RBAC | ✅ 100% | Roles e permissões implementadas |
| API Routes | ✅ 100% | CRUD completo + nfe + receipt |
| E2E Tests | ❌ 0% | Sem testes específicos |
| Responsividade testada | ❌ 0% | Sem verificação visual mobile |
| Loading states | ❌ 0% | Server component sem suspense |
| Error boundaries | ❌ 0% | Não implementado |

---

## Conclusão

O módulo de Pedidos possuem **fundações sólidas** (API robusta, validação, RBAC), porém está **incompleto** para produção por:

1. Flag `UnderConstruction` ativa
2. Zero cobertura de testes E2E
3. UX problemático (erros via URL, sem feedback)
4. Funcionalidades Backend órfãs (NF-e, Receipt)

**Recomendação:** Bloquear deploy até remoção do UnderConstruction e correção dos problemas de UX. Adicionar testes E2E antes de marcar como "pronto para produção".

---

# ✅ RESULTADO — RESOLUÇÃO (27/04/2026)

**Resumo:** 8 frentes de QA de Pedidos atacadas no frontend. A validação automática global do `apps/web` continua bloqueada por erro pré-existente fora do módulo de pedidos.

## UX / Fluxo

| Task | Status | O que foi feito |
|---|---|---|
| **UnderConstruction** | ✅ | Removido de `app/(crm)/pedidos/page.tsx` |
| **Erro via URL param** | ✅ | Fluxo trocado para `notice` + `noticeType` com toast cliente em `OrdersFlashToast.tsx` |
| **Feedback de sucesso no update status** | ✅ | `updateOrderStatusAction` agora redireciona com toast de sucesso |
| **Quick filters sem estado ativo** | ✅ | Filtros rápidos passaram a ter estilo ativo e preservar contexto atual |
| **Empty state fraco** | ✅ | Empty state melhorado com CTA para limpar filtros |

## Detail Panel / Ações

| Task | Status | O que foi feito |
|---|---|---|
| **Dados ausentes no detail** | ✅ | Adicionados `created_at`, `updated_at`, `production_deadline`, `approved_at` e `approved_by_customer` no painel |
| **POST /orders/:id/nfe órfão** | ✅ | Botão `Solicitar NF-e` adicionado no painel lateral |
| **POST /orders/:id/send-receipt órfão** | ✅ | Botões `Comprovante WhatsApp` e `Comprovante E-mail` adicionados no painel lateral |

## Backend / Actions

| Task | Status | O que foi feito |
|---|---|---|
| **Preservação de contexto** | ✅ | `actions.ts` agora mantém `selected`, `status` e `type` após erro/sucesso |
| **Criação de pedido sem retorno claro** | ✅ | `createReadyOrderAction` e `createCustomOrderAction` agora retornam com toast de sucesso |
| **Falha de link Mercado Pago sem contexto** | ✅ | `createMercadoPagoPaymentLinkAction` mantém seleção e filtros ao retornar erro |

## Arquivos alterados

- `apps/web/app/(crm)/pedidos/page.tsx`
- `apps/web/app/(crm)/pedidos/actions.ts`
- `apps/web/app/(crm)/pedidos/OrdersFlashToast.tsx`

## Pendências reais

- **E2E de pedidos** — continua pendente. Não foi criado `e2e/07-pedidos.spec.ts`.
- **Validação de runtime em browser** — não concluída nesta sessão porque o host local informado (`http://0.0.0.0/dashboard`) não respondeu daqui.
- **Typecheck global do app** — continua falhando por problema fora do escopo em `app/(crm)/pipeline/[slug]/builder/_components/BuilderCanvas.tsx:596`.

## Comando de validação executado

- `npm --prefix apps/web run typecheck -- --incremental false`
  - **Resultado:** falha por erro pré-existente no módulo de pipeline builder, não em `pedidos`

---

*QA Report gerado automaticamente por Blackbox AI — 27/04/2026*
