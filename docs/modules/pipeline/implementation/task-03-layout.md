# TASK-03 — Layout Shell (Topbar + Stagebar + Sidebars + Tabs)

**Depende de:** TASK-02
**Arquivo:** `apps/web/app/(crm)/clientes/[id]/page.tsx` + `layout.tsx`
**Referência:** mockup-painel-completo.html — seção topbar/stagebar/sidebars/tabs

---

## 3.1 Estrutura de arquivos

```
apps/web/app/(crm)/clientes/[id]/
  page.tsx                    ← orquestra tudo, faz fetch do cliente
  layout.tsx                  ← não necessário se já existe layout pai
  components/
    ClientPanelShell.tsx       ← wrapper com topbar+stage+main
    ClientTopbar.tsx
    ClientStagebar.tsx
    ClientLeftSidebar.tsx
    ClientRightSidebar.tsx
    ClientTabs.tsx
```

---

## 3.2 `page.tsx`

```typescript
// Server component ou client com useEffect
// Fetch: GET /api/v1/customers/:id/full
// Fetch: GET /api/v1/customers/:id/stats
// Passar props para ClientPanelShell
// Loading: skeleton fullscreen
// Error: toast + redirect para /crm/clientes
```

---

## 3.3 `ClientTopbar.tsx`

```
height: 48px | bg: var(--bg-1) | border-bottom: 1px solid var(--border)

Esquerda:
  [← Pipeline Leads]  /  [Leads]  /  [Nome do cliente]

Direita:
  [✓ Ganhou]  [✕ Perdeu]

Ganhou → POST /api/v1/leads/:id/won → toast "Lead marcado como ganho" → atualizar stage
Perdeu → abre modal de motivo (campo texto) → POST /api/v1/leads/:id/lost
```

---

## 3.4 `ClientStagebar.tsx`

```
height: 40px | overflow-x: auto | scrollbar oculta

Props: stages[], currentStageId
Renderizar pills: cada stage com ponto colorido
Clicar → PATCH /api/v1/leads/:id/stage → atualizar estado local
Stage ativo: bg gold-dim + borda gold + texto gold
```

---

## 3.5 `ClientLeftSidebar.tsx`

```
width: 224px | bg: var(--bg-1) | overflow-y: auto

Seções (de cima para baixo):
1. HERO
   - Avatar (iniciais, ouro) + indicador online
   - Nome (Playfair Display) + "Cliente desde {data}"
   - Badges: WhatsApp / stage / VIP
   - Grid 2×2: LTV / Compras / Em aberto / Sem interação

2. INFORMAÇÕES
   Origem | Valor estimado (gold) | Previsão | Criado em

3. RESPONSÁVEL
   Avatar + nome + role

4. TAGS
   Chips clicáveis + botão "+"
   Clicar "+" → input inline para adicionar tag

5. ACESSOS (usuários com acesso)
   Nome + role badge por usuário

Todas as seções: padding 10px 14px | border-bottom 1px solid var(--border)
Label seção: 9px UPPERCASE letter-spacing .8px color var(--text-muted)
```

---

## 3.6 `ClientRightSidebar.tsx`

```
width: 208px | bg: var(--bg-1) | overflow-y: auto

Seções:
1. CONTATO
   Avatar + nome + telefone + email
   Botão "›" → expandir com mais dados

2. AÇÕES RÁPIDAS (botões full-width)
   💬 WhatsApp → window.open(wa.me/...)
   📋 Gerar Proposta → abre modal proposta (ver TASK-06)
   ⚙️ Nova OS → abre modal OS (ver TASK-08)
   🧾 Emitir NF-e → POST /api/v1/orders/:id/nfe
   💎 Novo Bloco / 3D → openAttendancePopup()

3. EMPRESA
   Logo iniciais + nome + "Conta vinculada"

4. ARQUIVOS
   Lista de arquivos do cliente (attachments)
   Botão "+" → upload

5. RESUMO FINANCEIRO
   LTV | Em aberto (amber) | Ticket médio | NF-e emitidas (verde)
```

---

## 3.7 `ClientTabs.tsx`

```
height: 44px | bg: var(--bg-2) | border-bottom: 1px solid var(--border)
Tabs: Ficha | Atendimento (badge) | Proposta (badge) | Pedidos (badge) | OS (badge) | Entrega | Histórico

Tab ativa: cor gold + border-bottom 2px gold
Badge: bg gold-dim, 9px bold

State: activeTab (string), setActiveTab
Keyboard: arrow keys para navegar entre tabs
```

---

## 3.8 Layout principal

```
body: overflow hidden, height 100vh, display flex flex-col
.main: display flex, flex 1, overflow hidden

Left sidebar (224px) | Center (flex 1, overflow hidden) |
Right sidebar (208px)

Center = tabs (44px) + tabody (flex 1, overflow-y auto)
```

---

## DoD
- [ ] Página carrega dados do cliente via API
- [ ] Topbar: Ganhou/Perdeu funcionando
- [ ] Stagebar: clicar muda stage + atualiza visualmente
- [ ] Left sidebar: todas as seções com dados reais
- [ ] Right sidebar: ações rápidas funcionando
- [ ] Tabs: navegar entre abas sem reload
- [ ] Responsive: sem scroll horizontal em 1280px
- [ ] `tsc --noEmit` limpo
