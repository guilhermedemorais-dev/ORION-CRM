# TASK-06 — Aba Proposta

**Depende de:** TASK-03
**Componente:** `components/tabs/ClientPropostaTab.tsx`
**Referência:** mockup → aba "📋 Proposta" | PRD-PROPOSTAS.md (já existe)

---

## 6.1 Layout

```
Header: "Propostas" + [+ Nova Proposta]

Banner IA:
  [🤖] "Gerar proposta com IA" | "Usa ficha + atendimento automaticamente"
  [Gerar →] → abre ProposalGenerateModal (ver PRD-PROPOSTAS.md)

Lista: GET /api/v1/customers/:id/orders (tipo = proposta)
       ou GET /api/v1/proposals?customer_id=:id
```

## 6.2 ProposalCard

```
Header: código (gold Playfair) + data + badge status (pend/aceita/expirada)
Body: resumo dos itens
Footer: [💬 WA][✉️ Email][🖨️ Imprimir][✏️ Editar] + total (gold right)

Status badges:
  PENDENTE  → amber "⏳ Aguardando"
  PAGA      → verde "✓ Aceita"
  EXPIRADA  → vermelho "✕ Expirada"
  CANCELADA → muted "— Cancelada"
```

## 6.3 Ações

```
WA     → POST /api/v1/orders/:id/send-receipt { channel:'whatsapp' } → window.open(url)
Email  → POST /api/v1/orders/:id/send-receipt { channel:'email' } → toast
Impr.  → window.print() — CSS print já no componente
Editar → abre ProposalGenerateModal com dados pré-preenchidos
```

## DoD
- [ ] Lista carrega propostas do cliente
- [ ] Banner IA abre modal de geração
- [ ] Todos os botões do card funcionam
- [ ] Status badge correto por estado
- [ ] `tsc --noEmit` limpo

---

---

# TASK-07 — Aba Pedidos

**Depende de:** TASK-03
**Componente:** `components/tabs/ClientPedidosTab.tsx`
**Referência:** mockup → aba "🛍️ Pedidos"

---

## 7.1 Layout

```
Header: "Pedidos" + LTV total (gold, right)
Lista: GET /api/v1/customers/:id/orders?limit=20&page=1
Loading: skeleton
Empty: "Nenhum pedido encontrado"
```

## 7.2 OrderCard

```
Header: número (gold) + nome do produto + badge tipo (pronta/personalizado)
Progress bar de etapas (steps array)
Footer: data + status colorido + total (gold)

Tipos de pedido:
  PRONTA_ENTREGA → badge blue "Pronta entrega"
  PERSONALIZADO  → badge purple "Personalizado"
  PDV            → badge green "PDV"

Steps para PERSONALIZADO: Sinal > Design > 3D > Produção > Acabamento > Entrega
Steps para PRONTA_ENTREGA: Pedido > Pagamento > Separação > Entregue

Step visual:
  done   → dot verde com ✓, line verde
  active → dot gold com ícone, line gradient green→gold
  pending→ dot cinza vazio, line cinza
```

## 7.3 Ações por card

```
Click no card → expandir detalhes inline (toggle)
Detalhes: data criação, forma pagamento, atendente, NF-e status
Botões: [🧾 NF-e][💬 WA][✉️ Email]
```

## DoD
- [ ] Lista com paginação
- [ ] Progress steps corretos por tipo
- [ ] Expand/collapse detalhes
- [ ] Botões NF-e/WA/Email funcionam
- [ ] `tsc --noEmit` limpo

---

---

# TASK-08 — Aba Ordem de Serviço

**Depende de:** TASK-05 (pode criar OS a partir de bloco), TASK-07
**Componente:** `components/tabs/ClientOSTab.tsx`
**Modal:** `components/os/ServiceOrderModal.tsx`
**Referência:** mockup → aba "⚙️ OS"

---

## 8.1 Layout

```
Header: "Ordem de Serviço" + [+ Nova OS]
Lista: GET /api/v1/customers/:id/service-orders
```

## 8.2 ServiceOrderCard

```
Header: número OS (gold) + prioridade badge + "Em produção · Xd" (right, amber)
Body 2 colunas:
  Esquerda: produto, cliente, designer 3D, ourives, prazo
  Direita: thumbnail 3D (click → tela cheia placeholder)

SPECS DE FABRICAÇÃO (grid 3 colunas):
  Metal | Pedra central | Tamanho aro
  Espessura aro | Altura cravação | Nº garras
  Perfil aro | Acabamento | Gravação
  Peso estimado | Tolerância | Origem specs (IA+Ajuste)

ARQUIVOS DO DESIGNER 3D:
  [💎 arquivo.stl][📐 arquivo.3dm][🖼️ render-frontal.jpg]
  [+ Adicionar arquivo] → upload POST /service-orders/:id/files

ETAPAS (chips):
  done: verde ✓ | active: gold ⚙ | pending: muted
  Clique em etapa pending → confirmar avanço → PATCH /service-orders/:id/step

Footer: [📝 Atualizar][📷 Foto progresso][💬 Avisar cliente][📐 Ver 3D]
```

## 8.3 ServiceOrderModal (criar/editar)

```
Modal 680px | ESC fecha | click overlay fecha

Seções:
1. Produto: nome, tipo, pedido vinculado (select)
2. Equipe: designer 3D (select usuários role=designer), ourives (select role=producao)
3. Prazo: date picker, prioridade (select)
4. Specs de fabricação: todos os campos (pré-preenchidos se vindo de render)
5. Valores: sinal pago, total

Botões: [Cancelar] [Salvar OS]
POST /api/v1/service-orders → toast + fechar modal + inserir na lista
```

## 8.4 Avanço de etapa

```typescript
// Clicar em etapa pending → modal de confirmação simples
// "Confirmar avanço para: {etapa}?"
// [Cancelar] [Confirmar]
// PATCH /api/v1/service-orders/:id/step { step: 'casting' }
// Atualizar card na lista
// Enviar notificação para responsável pela etapa
```

## 8.5 Notificação ao cliente

```typescript
// "💬 Avisar cliente" → modal com mensagem pré-pronta
// "Sua peça está em [etapa]! Previsão de entrega: [data]. Dúvidas? Estamos aqui. 😊"
// Botão [Enviar via WhatsApp] → POST /api/v1/service-orders/:id/notify
// Botão [Editar mensagem] → textarea editável
```

## DoD
- [ ] Lista carrega OSs do cliente
- [ ] Card com todas as specs visíveis
- [ ] Upload de arquivos .stl/.3dm funcionando
- [ ] Etapas clicáveis com confirmação
- [ ] Modal criar OS com specs pré-preenchidas do render
- [ ] "Avisar cliente" envia WhatsApp
- [ ] `tsc --noEmit` limpo

---

---

# TASK-09 — Aba Entrega

**Depende de:** TASK-07, TASK-08
**Componente:** `components/tabs/ClientEntregaTab.tsx`
**Referência:** mockup → aba "📦 Entrega"

---

## 9.1 Layout

```
Header: "Entregas" + [+ Nova entrega]
Lista: GET /api/v1/customers/:id/deliveries
```

## 9.2 DeliveryCard

```
Header: nº pedido/OS + nome produto + badge tipo [🏪 Retirada / 📦 Envio]
Timeline vertical com steps:

Steps para PERSONALIZADO:
  ✓ Pedido confirmado e sinal pago
  ✓ Design aprovado
  ✓ Arquivo 3D enviado para fabricação
  ⚙ Em produção (ativo)
  ○ Pronto para retirada
  ○ Retirado / Entregue

Steps para PRONTA_ENTREGA:
  ✓ Pedido e pagamento
  ✓ Separação
  ○ Aguardando retirada / Enviado
  ○ Entregue

Step dot: 25px, done=verde, active=gold(animado), pending=cinza
Step line: 2px, done=verde, pending=cinza

Footer: [💬 Avisar][✏️ Atualizar][✓ Marcar entregue]
```

## 9.3 Ações

```
Avisar → same que OS: modal WhatsApp
Atualizar → PATCH /deliveries/:id/status { status, note }
Marcar entregue → confirmar → PATCH { status: 'delivered' } → toast + atualizar card
```

## DoD
- [ ] Lista de entregas do cliente
- [ ] Timeline com steps corretos por tipo
- [ ] Ações funcionando
- [ ] `tsc --noEmit` limpo

---

---

# TASK-10 — Aba Histórico

**Depende de:** TASK-03
**Componente:** `components/tabs/ClientHistoricoTab.tsx`
**Referência:** mockup → aba "🕐 Histórico"

---

## 10.1 Layout

```
Header: "Histórico"
Sub-abas: [📋 Log] [💬 WhatsApp] [✉️ E-mail] [⭐ Feedback]
```

## 10.2 Sub-aba: Log

```
GET /api/v1/customers/:id/history?type=log
Lista de LogItem:

LogItem:
  ícone (bg colorido por tipo) | title + badge (Humano/IA/Sistema) | desc | meta (data + usuário)

Tipos e ícones:
  bloco_criado    → gold-dim | lb-h (Humano)
  design_3d       → teal-dim | lb especial (Designer 3D)
  stage_changed   → gold-dim | lb-h
  venda           → green-dim | lb-h
  ia_atendimento  → purple-dim | lb-ai
  ficha_editada   → bg-3 | lb-sys (Sistema)
  nfe_emitida     → purple-dim | lb-h
```

## 10.3 Sub-aba: WhatsApp

```
Filtros: [Todos][Humano][IA Aurora]
GET /api/v1/customers/:id/history?type=whatsapp

MessageItem:
  avatar + nome + badge tipo + timestamp | texto da mensagem

Estilos:
  humano: border var(--border), bg var(--bg-3)
  ia:     border purple-b, bg rgba(purple, .05)
  cliente:border var(--border), bg var(--bg-3)
```

## 10.4 Sub-aba: E-mail

```
GET /api/v1/customers/:id/history?type=email
Lista de EmailItem:
  avatar + "remetente → destinatário" + timestamp | assunto + preview | attachments

Empty: "Nenhum e-mail registrado"
```

## 10.5 Sub-aba: Feedback

```
Header: "{N} avaliações · Média {X} ⭐" + [+ Solicitar feedback]

FeedbackCard:
  Título + data | Stars (⭐) | Comentário | meta (canal + verificado)

POST /api/v1/customers/:id/feedback → modal simples: rating (1-5 stars click) + comentário

"Solicitar feedback" → POST /api/v1/customers/:id/feedback/request
  → envia template WhatsApp solicitando avaliação
```

## DoD
- [ ] 4 sub-abas navegáveis
- [ ] Log com tipos e badges corretos
- [ ] WhatsApp com filtro humano/IA
- [ ] Feedback: criar e solicitar
- [ ] `tsc --noEmit` limpo
