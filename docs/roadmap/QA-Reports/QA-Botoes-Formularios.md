# QA — Auditoria Completa de Botões e Formulários

> **Data:** 2026-04-28
> **Escopo:** Comportamento real de botões, formulários, ações Salvar/Cancelar e atualização de UI
> **Modo:** revisão de código + correlação com runtime Docker em execução
> **Postura:** crítica, sem suavização — pensar como SaaS em produção

---

## 1. Mapeamento Geral

### Formulários inspecionados
| Local | Arquivo | Tipo |
|---|---|---|
| Login | `app/(auth)/login/LoginForm.tsx` | Server action (`form action`) |
| Meta mensal financeiro | `components/modules/finance/MonthlyGoalModal.tsx` | Modal client |
| Importação de leads | `components/modules/leads/LeadsImportDialog.tsx` | Modal client wizard |
| Confirmação ganho/perdido | `components/modules/leads/LeadStageConfirmDialog.tsx` | Modal client |
| Novo agendamento | `app/(crm)/agenda/components/CreateAppointmentDialog.tsx` | RHF + Zod + server action |
| Nova OS | `app/(crm)/clientes/[id]/components/os/ServiceOrderModal.tsx` | Modal client (estado local) |
| Nova entrega | `app/(crm)/clientes/[id]/components/tabs/NovaEntregaModal.tsx` | Modal client (fetch direto) |
| Lançamento financeiro | `components/modules/finance/FinanceiroClient.tsx` | Drawer/inline |
| Estoque CRUD | `components/modules/estoque/EstoqueClient.tsx` | Modal + bulk |
| Ajustes / Logística / WhatsApp | `components/modules/settings/*` | Forms inline |
| Pipeline builder | `app/(crm)/pipeline/[slug]/builder/_components/BuilderCanvas.tsx` | Canvas form |
| Chamados / Debug | `app/(crm)/chamados/components/*` | Forms inline |

### Botões críticos identificados
- `Salvar` / `Confirmar e Agendar` / `Despachar` / `Salvar meta` / `Importar` / `Confirmar venda` / `Confirmar perda`
- `Cancelar` (ubiquitário)
- `Excluir` / `Desativar` (destrutivos)
- `Editar` / `Remarcar`
- `Enviar mensagem via Bot`
- `Concluir` / `Voltar` (wizard)

---

## 2. Testes de Botões

### [TESTE-BOTAO]
**Nome:** Submit (`Despachar`) — `NovaEntregaModal`
**Local:** `clientes/[id] → Entregas → Nova entrega`
**Ação esperada:** submeter formulário e fechar modal após sucesso
**Comportamento atual:** botão `<button onClick={handleSubmit}>` está **fora de um `<form>`** (linha 329). Pressionar `Enter` em qualquer input **não dispara o submit**.
**Problema:** quebra de affordance — usuário não consegue submeter por teclado, padrão violado em todo SaaS.
**Severidade:** Alta

### [TESTE-BOTAO]
**Nome:** Backdrop click — `NovaEntregaModal`
**Local:** mesmo modal
**Ação esperada:** se `saving === true`, ignorar clique no backdrop
**Comportamento atual:** linha 129 — `<div onClick={onClose}>` sem checagem de `saving`. Usuário pode fechar **enquanto a requisição POST está em curso**, perdendo feedback de erro.
**Problema:** risco de criar entrega duplicada (usuário re-tenta achando que falhou) e estado órfão.
**Severidade:** Alta

### [TESTE-BOTAO]
**Nome:** Cancelar — `LeadStageConfirmDialog`
**Local:** Pipeline de leads → mover lead para coluna ganho/perdido
**Ação esperada:** desabilitar Cancelar enquanto `submitting === true`
**Comportamento atual:** linha 191 — `<button onClick={onCancel}>` **sem `disabled={submitting}`**. ESC também não bloqueia (linha 33-37).
**Problema:** clicar Cancelar mid-submit deixa o lead numa coluna mas o modal fecha → estado inconsistente entre banco e UI até refresh manual.
**Severidade:** Alta

### [TESTE-BOTAO]
**Nome:** Excluir produto / Excluir transportadora / Excluir usuário / Excluir proposta / Limpar erros
**Local:** EstoqueClient, LogisticaTab, AjustesClient, ClientPropostaTab, DebugTab
**Ação esperada:** confirmação custom com botão destrutivo destacado (padrão SaaS)
**Comportamento atual:** todos usam `window.confirm(...)` nativo — bloqueante, sem branding, fora do design system.
**Problema:** UX amadora; em ambiente Linux/Firefox o diálogo do navegador não respeita tema escuro e parece bug. Acessibilidade ruim.
**Severidade:** Média (funcional, mas inadequado para produção SaaS)

### [TESTE-BOTAO]
**Nome:** `Salvar Alterações` — `CreateAppointmentDialog` (modo edição)
**Local:** Agenda → editar agendamento
**Ação esperada:** mostrar toast/feedback e fechar modal após sucesso
**Comportamento atual:** linha 258-267 — em modo edição apenas chama `editAppointmentAction(formData)` e não chama `setCreatedId`, não chama `handleClose()`, não exibe toast. **Sem feedback visível.**
**Problema:** usuário não sabe se a edição funcionou. Pode clicar Salvar várias vezes.
**Severidade:** Crítica

### [TESTE-BOTAO]
**Nome:** Backdrop click — `CreateAppointmentDialog`
**Local:** Agenda → novo agendamento
**Ação esperada:** confirmar perda de dados antes de fechar com formulário sujo
**Comportamento atual:** linha 303 — `onClick={handleClose}` sem nenhuma verificação de `formState.isDirty` nem de `isPending`.
**Problema:** clique acidental destrói formulário inteiro com 9 campos preenchidos. Risco de perda de dados.
**Severidade:** Alta

### [TESTE-BOTAO]
**Nome:** Botão de submit — `LoginForm`
**Local:** `/login`
**Ação esperada:** desabilitar durante envio
**Comportamento atual:** desabilita apenas em `isRateLimited`. Não há `pending` state durante o `loginAction` server action. Server actions do React 19 não disparam pending automaticamente sem `useFormStatus`.
**Problema:** usuário pode clicar 2-3x → múltiplas tentativas de login → trigger do rate-limit prematuramente. Já houve commit `c6b1990 tune auth login rate limit`, indicando histórico do problema.
**Severidade:** Média

### [TESTE-BOTAO]
**Nome:** `Importar N leads` — `LeadsImportDialog`
**Local:** Pipeline → importar
**Ação esperada:** importação resiliente em batches
**Comportamento atual:** linha 153-179 — for loop **sequencial síncrono**, 1 fetch por linha, sem `Promise.all` nem batching. 500 leads = 500 chamadas seriadas (~5+ min).
**Problema:** modal congela visualmente, sem cancel. Ao falhar metade, **não há retry**: o usuário precisa reimportar tudo (criando duplicados — felizmente o backend trata por `whatsapp_number`).
**Severidade:** Média (funcional mas escala mal)

### [TESTE-BOTAO]
**Nome:** Cancelar / Concluir — `LeadsImportDialog`
**Local:** mesmo modal
**Ação esperada:** botão presente no step `done`
**Comportamento atual:** ✅ correto — desabilita X durante `importing`, footer condicional por step. Bom.
**Severidade:** —

### [TESTE-BOTAO]
**Nome:** `Salvar meta` — `MonthlyGoalModal`
**Local:** Financeiro → header
**Ação esperada:** validação de centavos e disabled durante save
**Comportamento atual:** ✅ correto — `parseCurrencyToCents` valida, ESC respeita `busy`, overlay click também. Bom referencial.
**Severidade:** —

### [TESTE-BOTAO]
**Nome:** Botão `Selecionar arquivo CSV` — `LeadsImportDialog`
**Local:** step upload
**Ação esperada:** validar tamanho e magic bytes
**Comportamento atual:** apenas `accept=".csv,text/csv"` — não valida tamanho. Um CSV de 100MB carregado em memória via `file.text()` **trava o browser**.
**Problema:** sem limite de bytes, sem validação de magic bytes (regra `CLAUDE.md`: "validar por magic bytes, não extensão" — violação).
**Severidade:** Alta

---

## 3. Testes de Formulários

### [TESTE-FORM]
**Nome:** `NovaEntregaModal` — campo `Valor declarado (R$)`
**Campos testados:** input `type="number"` com parseFloat
**Erro encontrado:** `Math.round(parseFloat(declaredValue) * 100)` (linha 82). Em pt-BR usuário digita `1.500,00` ou `1500,00`. `parseFloat("1.500,00")` → `1.5`. `parseFloat("1500,00")` → `1500`. **Resultado: declaredCents = 1500 (R$ 15,00) em vez de R$ 1.500,00.**
**Impacto:** valor declarado errado → seguro de transporte calculado errado → perda real para a joalheria.
**Severidade:** Crítica

### [TESTE-FORM]
**Nome:** `ServiceOrderModal` — campos `deposit_cents_str`, `total_cents_str`
**Campos testados:** parseCents linha 91-94: `parseFloat(str.replace(',', '.'))`
**Erro encontrado:** `"1.500,00".replace(',','.')` → `"1.500.00"` → `parseFloat` → `1.5`. **Mesmo bug de locale.** R$ 1.500,00 vira R$ 1,50.
**Impacto:** OS criada com depósito/total incorretos → discrepância financeira.
**Severidade:** Crítica

### [TESTE-FORM]
**Nome:** `ServiceOrderModal` — submit sem validação visível
**Campos testados:** `product_name` obrigatório
**Erro encontrado:** linha 97 — `if (!form.product_name.trim()) return;` retorna silenciosamente, **sem `setError`**. Usuário clica Salvar e nada acontece.
**Impacto:** UX confusa, parece bug do sistema.
**Severidade:** Média

### [TESTE-FORM]
**Nome:** `CreateAppointmentDialog` — campo `date`
**Campos testados:** input `type="date"`
**Erro encontrado:** Zod só valida `min(1)` — aceita data no passado. Agendar para 2020-01-01 é permitido.
**Impacto:** agendamentos retroativos pollutem agenda; notificações WhatsApp são disparadas para datas passadas.
**Severidade:** Média

### [TESTE-FORM]
**Nome:** `CreateAppointmentDialog` — `defaultValues` deps incompletas
**Campos testados:** preenchimento automático de `assigned_to_id`
**Erro encontrado:** linha 207 — `useMemo` deps `[editData, isReschedule, prefilledLeadId, prefilledCustomerId]` **sem `currentUserId`**. Se `currentUserId` chegar tarde via prop, o default não atualiza.
**Impacto:** "Responsável" inicia vazio em criação rápida.
**Severidade:** Baixa

### [TESTE-FORM]
**Nome:** `LoginForm` — `useEffect` countdown
**Campos testados:** decremento do rate-limit
**Erro encontrado:** linha 25-37 — deps `[]` mas usa `countdown`. Lint reclamaria; o efeito só roda no mount inicial. Funcional, mas frágil.
**Impacto:** se `error` mudar via re-render externo, countdown não reinicia.
**Severidade:** Baixa

### [TESTE-FORM]
**Nome:** `LeadsImportDialog` — parser CSV
**Campos testados:** quebras de linha, separador, escape
**Erro encontrado:** parser custom não trata `\r` em valores quoted, não trata BOM (`﻿`) no início — CSVs exportados pelo Excel pt-BR começam com BOM.
**Impacto:** primeira coluna fica `﻿nome` e `findKey` falha → mensagem genérica "Cabeçalho deve incluir...".
**Severidade:** Média

### [TESTE-FORM]
**Nome:** `LeadStageConfirmDialog` — input "Valor da venda"
**Campos testados:** máscara em tempo real (linha 130-139)
**Erro encontrado:** ✅ Máscara correta convertendo dígitos → centavos. Bom padrão. **Aplicar este mesmo padrão em ServiceOrderModal e NovaEntregaModal.**
**Severidade:** —

---

## 4. 🔥 Comportamento Pós-Ação (FOCO PRINCIPAL)

### [POS-AÇÃO] — SALVAR
**Ação:** Salvar (geral)
**Comportamento esperado:** dado persistido + UI atualizada sem reload + feedback visual + disable durante async + reabertura limpa
**Comportamento atual (matriz):**

| Tela | Persistência | Refresh UI | Feedback | Disable | Nota |
|---|---|---|---|---|---|
| MonthlyGoalModal | ✅ via callback `onSave` | ⚠ depende do parent (FinanceiroClient revalida) | ⚠ sem toast — apenas modal fecha | ✅ | OK |
| LeadsImportDialog | ✅ | ✅ via `onImported()` callback | ✅ painel done com counts | ✅ | OK |
| LeadStageConfirmDialog | ✅ | ⚠ depende do parent | ❌ sem toast | ⚠ Cancel fica clicável | Pendente |
| CreateAppointmentDialog (criar) | ✅ via server action + `revalidatePath` (presumido) | ✅ | ✅ tela "Agendamento Criado ✓" | ✅ `isPending` | OK |
| CreateAppointmentDialog (editar) | ✅ | ⚠ não fecha modal nem mostra toast | ❌ **nenhum feedback** | ✅ | **CRÍTICO** |
| NovaEntregaModal | ✅ | ⚠ via `onCreated()` callback do parent | ❌ apenas fecha | ⚠ backdrop não checa saving | **CRÍTICO** |
| ServiceOrderModal | ✅ | ⚠ via `onSaved()` callback | ❌ sem toast, fecha | ✅ | Pendente |
| EstoqueClient (CRUD) | ✅ via server action | ✅ `revalidatePath('/estoque')` | ⚠ usa `confirm()` nativo | ✅ | Médio |
| LoginForm | ✅ | ✅ redirect server-side | ⚠ sem pending visual | ❌ sem `useFormStatus` | Médio |
| Pipeline builder save | ✅ | ✅ revalidatePath | ⚠ sem toast | ✅ | OK |

**Problemas:**
1. **Sem sistema centralizado de toast.** Existe `OrdersFlashToast` ad-hoc para 1 fluxo. Os demais sucessos são silenciosos. SaaS profissional **sempre** emite toast no Salvar.
2. **Modais com fetch direto** (`NovaEntregaModal`, `ServiceOrderModal`, `LeadsImportDialog`) **não invocam `router.refresh()` nem `revalidatePath`** — dependem 100% do callback do parent. Se o parent esquecer (caso comum em manutenção), a UI fica stale até hard reload.
3. **Edit de agendamento não dá feedback** — bug crítico de UX já citado.
**Severidade global:** Alta

### [POS-AÇÃO] — CANCELAR
**Ação:** Cancelar
**Comportamento esperado:** estado revertido, sem efeito colateral, foco devolvido ao trigger, ESC equivalente
**Comportamento atual:**
- ✅ Modais geralmente fecham sem persistir.
- ❌ `LeadStageConfirmDialog`, `LoginForm` e a maioria não restaura foco no botão original.
- ❌ Nenhum modal pergunta antes de descartar formulário sujo (`isDirty`). Click acidental no overlay = perda total.
- ❌ ESC fecha mesmo durante save em `LeadStageConfirmDialog` e `ServiceOrderModal` (apenas `LeadsImportDialog` e `MonthlyGoalModal` respeitam estado busy).
**Severidade:** Alta

---

## 5. Atualização Automática (State / Real-time)

### [STATE-UPDATE]
**Problema 1:** Inconsistência de estratégia de refresh
- Server actions usam `revalidatePath` (correto). Funciona apenas em RSC pages.
- Modais client (NovaEntrega, ServiceOrder, LeadsImport) usam `fetch()` direto e dependem de `onCreated()/onImported()/onSaved()` para refazer fetch no parent.
- Inbox usa `router.refresh()` no `InboxRealtimeBridge`. Único lugar com refresh "ao vivo".
**Impacto:** comportamento imprevisível entre módulos. Usuário cria entrega → volta para a aba "Entregas" → lista pode estar stale por 1-2s ou eternamente, dependendo de o parent ter refetch.
**Severidade:** Alta

### [STATE-UPDATE]
**Problema 2:** Cache do Next.js
- `revalidatePath` invalida cache do segmento, mas **só refaz fetch RSC** quando o usuário navega. Em páginas client-heavy (Financeiro, Estoque, Pipeline) os componentes mantêm estado local; o revalidate sozinho não atualiza a tela aberta.
**Impacto:** usuário vê valor antigo até clicar em "Atualizar" ou trocar de aba.
**Severidade:** Média

### [STATE-UPDATE]
**Problema 3:** Inexistência de optimistic UI
- Nenhum dos modais aplica `useOptimistic` ou estado otimista. Em conexão lenta o card só aparece após round-trip completo.
**Impacto:** sensação de lentidão; usuário re-clica.
**Severidade:** Baixa

### [STATE-UPDATE]
**Problema 4:** Polling/SSE inexistente fora do Inbox
- Pedidos / Produção / Financeiro não têm polling — duas abas abertas mostram realidades distintas.
**Severidade:** Média

---

## 6. UX e Fluxo

### [UX]
**Problema:** Ausência de toast global → usuário "não sente" o sucesso
**Impacto:** principal queixa típica de operadores ("cliquei em salvar, não sei se foi")
**Sugestão:** adotar `sonner` ou `react-hot-toast`, montar `<Toaster />` no `app/layout.tsx`, expor helper `notify.success/error` e injetar em todos os `onSubmit` resolvidos.

### [UX]
**Problema:** `confirm()` nativo em ações destrutivas
**Impacto:** ruptura visual, sem destaque do botão "Excluir" em vermelho, sem preview do impacto
**Sugestão:** componente `ConfirmDialog` único (já há shadcn), com `variant="destructive"`, exibindo nome do alvo e contagem (ex.: "Esta ação removerá 3 produtos com 47 unidades em estoque").

### [UX]
**Problema:** Backdrop click destrutivo
**Impacto:** perda de dados em modais grandes (CreateAppointment, NovaEntrega, ServiceOrder)
**Sugestão:** padronizar — backdrop fecha **somente** se `formState.isDirty === false` ou se o usuário confirmar perda.

### [UX]
**Problema:** Edit de agendamento sem feedback
**Impacto:** parece quebrado
**Sugestão:** após `editAppointmentAction`, chamar `handleClose()` + toast "Agendamento atualizado".

### [UX]
**Problema:** Locale BR não tratado em campos monetários (`NovaEntregaModal`, `ServiceOrderModal`)
**Impacto:** entradas reais em centavos errados → perda financeira
**Sugestão:** centralizar `parseCurrencyToCents` (já existe em `lib/financeiro.ts`) e proibir parseFloat em qualquer outro modal.

### [UX]
**Problema:** Botão Despachar fora do `<form>` em NovaEntrega
**Impacto:** Enter não funciona, screen readers não associam
**Sugestão:** envelopar em `<form onSubmit={handleSubmit}>`, trocar botão para `type="submit"`.

### [UX]
**Problema:** Falta loading skeleton em alguns modais (carregamento de carriers, pipelines, users)
**Impacto:** flicker entre `loadingCarriers` e lista; pipelines aparecem após delay sem indicação
**Sugestão:** skeleton list para todos os fetch on-mount, conforme regra do `CLAUDE.md`.

---

## 7. Resumo Executivo

| Métrica | Avaliação |
|---|---|
| **Nota geral** | **5.5 / 10** |
| Confiabilidade dos formulários | 6/10 — funcionais, mas locale BR quebrado em monetários e validações inconsistentes |
| Confiabilidade dos botões | 5/10 — disabled states aplicados na maioria, porém Cancel/Backdrop permitem race conditions |
| Atualização automática | 5/10 — estratégia mista (revalidatePath + callbacks + router.refresh isolado) sem padrão |
| Risco de perda de dados | **Alto** — backdrop click fecha modais grandes sem confirmação, valor monetário interpretado errado em 2 modais |
| Risco financeiro direto | **Alto** — bug de locale em `NovaEntregaModal` (valor declarado) e `ServiceOrderModal` (depósito/total) afeta caixa real |
| Pronto para produção? | **Não** — bloqueadores críticos abaixo |

### Bloqueadores críticos (impedem release)
1. Bug de locale em valores monetários (`NovaEntregaModal`, `ServiceOrderModal`).
2. Edição de agendamento sem feedback.
3. Modal `NovaEntregaModal` fechável durante save (estado órfão).
4. Cancel / ESC durante submit em `LeadStageConfirmDialog`.

### Pontos fortes
- `MonthlyGoalModal` é o referencial de qualidade — seguir como template.
- `CreateAppointmentDialog` aplica RHF + Zod corretamente (apesar dos pontos acima).
- `LeadsImportDialog` tem progress bar + estado wizard bem amarrado.
- Server actions com `revalidatePath` em todos os módulos RSC.

---

## 8. Tasks (Pipeline) — ordenado por severidade

### Críticas
- [x] **Corrigir parseCents pt-BR em NovaEntregaModal** — agora usa `parseCurrencyToCents` + máscara em tempo real (digita centavos → `1.500,00`).
- [x] **Corrigir parseCents pt-BR em ServiceOrderModal** — `deposit_cents_str` e `total_cents_str` passam por `parseCurrencyToCents`; inputs com máscara `inputMode=numeric`.
- [x] **Edit de agendamento sem feedback** — `setEditSuccess(true)` após sucesso, banner verde "Agendamento Atualizado ✓" e fecha em 1.1s; erro vai pra `submitError`.
- [x] **NovaEntregaModal: bloquear backdrop e ESC durante save** — `safeClose()` ignora quando `saving`; envolto em `<form onSubmit>`, botão `type="submit"`, ESC handler aplicado.

### Altas
- [x] **LeadStageConfirmDialog: desabilitar Cancel e ESC enquanto submitting** — Cancel (header X e footer) ganhou `disabled={submitting}`; ESC só fecha se `!submitting`.
- [x] **CreateAppointmentDialog: confirmar perda ao clicar fora com isDirty** — `requestClose()` checa `isDirty` + `isPending` e pede confirmação antes de descartar.
- [x] **Validação de tamanho/magic bytes em CSV de leads** — limite de 5 MB e rejeição de binário (NUL bytes nos primeiros 4 KB) em `LeadsImportDialog`.

- [x] **Sistema global de toast** — `<ToastProvider>` in-house (sem nova dep) montado no `app/(crm)/layout.tsx`; helper `notify.success/error/warning/info` em `lib/toast.ts`. Aplicado em NovaEntregaModal, ServiceOrderModal, CreateAppointmentDialog (criar+editar), LeadStageConfirmDialog, LeadsImportDialog, ClientPropostaTab e DebugTab.

- [x] **Bloqueio de duplo-clique no LoginForm** — `<SubmitButton>` interno usa `useFormStatus`, desabilita durante `pending` e exibe "Entrando…".

### Médias
- [x] **Substituir `window.confirm` por ConfirmDialog** — `<ConfirmDialogProvider>` + hook `useConfirm()` em `components/system/ConfirmDialog.tsx`. Substituído em EstoqueClient (bulk delete), AjustesClient (excluir usuário), LogisticaTab (excluir transportadora), ClientPropostaTab (excluir proposta) e DebugTab (limpar erros). Variante `destructive` com botão vermelho.
- [x] **Validar data futura em CreateAppointmentDialog** — Zod `.refine` rejeita datas no passado.
- [x] **Refactor LeadsImportDialog para batches paralelos** — `Promise.all` em chunks de 8.
- [x] **Tratar BOM e CRLF no parser CSV** — `stripBom()` removendo U+FEFF no header[0]; split já era `\r?\n`.
- [x] **Padronizar refresh: router.refresh() ao final dos onCreated/onSaved** — `useRouter().refresh()` adicionado após sucesso em NovaEntregaModal, ServiceOrderModal e LeadsImportDialog (CreateAppointmentDialog já usa server actions com `revalidatePath`).
- [x] **Mensagem de validação visível em ServiceOrderModal (product_name)** — `setError('Informe o nome do produto.')`.

### Baixas
- [x] **Ajustar deps useMemo (defaultValues) em CreateAppointmentDialog** — `currentUserId` incluído.

- [ ] **Skeleton loading em fetch on-mount de carriers/pipelines/users**
  Tipo: UX · Severidade: Baixa · Múltiplos modais

- [ ] **Restaurar foco ao trigger ao fechar modal (acessibilidade)**
  Tipo: UX · Severidade: Baixa · Global

- [ ] **Optimistic UI em criação de leads/entregas/pedidos**
  Tipo: Estado · Severidade: Baixa · Múltiplos
  `useOptimistic` no parent com rollback em erro.

---

## 9. Recomendações de Padronização

1. Criar `components/ui/Modal.tsx` com:
   - Lock de body overflow
   - ESC + backdrop respeitando `isBusy`
   - Slot para footer com `<SubmitButton/>` que escuta `useFormStatus`
   - Confirmação opcional ao fechar com `isDirty`

2. Criar `lib/toast.ts` com `notify.success/error/warning/info` e proibir alerts inline.

3. Adotar `parseCurrencyToCents` (já existe) como **única** porta de entrada para inputs monetários. Adicionar regra de lint custom ou guard manual nos modais identificados.

4. Documentar em `CLAUDE.md` o pós-mutate canônico: `await action(); router.refresh(); notify.success(...);`.

---

**Fim do relatório.**
