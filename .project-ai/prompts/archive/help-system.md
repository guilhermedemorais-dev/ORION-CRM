# TASK — Sistema de Ajuda Contextual (Help Panel)

## Contexto
Adicionar um botão (?) fixo em todo o sistema que abre um painel lateral de ajuda.
O conteúdo do painel muda automaticamente conforme a página/contexto ativo.
Também corrigir os botões da toolbar de atendimento que não têm funcionalidade.

## Leia antes
- `apps/web/components/layout/` — layout shell existente
- `apps/web/components/attendance/AttendancePopup.tsx` — toolbar do bloco de nota
- `apps/web/app/(crm)/` — rotas existentes para mapear contextos

---

## PARTE 1 — Botão (?) no Topbar

### Localização
No topbar existente, **à esquerda do sino (notificações)**, adicionar:

```tsx
import { HelpCircle } from 'lucide-react'

<button
  onClick={() => setHelpOpen(true)}
  title="Ajuda"
  style={{
    width: 32, height: 32, borderRadius: 6,
    background: 'var(--bg-3)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all .15s',
    color: 'var(--text-muted)',
  }}
>
  <HelpCircle size={15} />
</button>
```

Hover: `border-color: var(--gold-border), color: var(--gold)`

---

## PARTE 2 — Componente HelpPanel

**Arquivo:** `apps/web/components/help/HelpPanel.tsx`

### Layout
```
Painel lateral deslizante da direita
  width: 320px
  height: 100vh
  position: fixed
  right: 0, top: 0
  z-index: 150
  background: var(--bg-1)
  border-left: 1px solid var(--border-mid)
  box-shadow: -8px 0 32px rgba(0,0,0,.4)
  animation: slideIn 200ms ease (translateX 320px → 0)

Overlay escuro atrás (opcional, clique fecha):
  position: fixed, inset: 0, z-index: 149
  background: rgba(0,0,0,.3)
  clique → fechar painel
```

### Estrutura interna
```
┌── HEADER ──────────────────────────────────────────┐
│  [HelpCircle 16px]  Ajuda                  [X]     │
│  "Documentação do módulo ativo"                    │
├── CONTEXTO BADGE ──────────────────────────────────┤
│  📍 Você está em: [nome da página]                 │
├── CONTEÚDO (scroll) ───────────────────────────────┤
│  Seções de ajuda conforme contexto                 │
└────────────────────────────────────────────────────┘
```

Header:
```css
padding: 16px;
border-bottom: 1px solid var(--border);
display: flex; align-items: center; gap: 10px;

título: font-size 15px, font-weight 700
subtítulo: font-size 11px, color var(--text-muted), margin-top 2px
botão X: position absolute, right 14px, top 14px
```

Badge de contexto:
```css
margin: 12px 16px;
padding: 6px 12px;
background: var(--gold-dim);
border: 1px solid var(--gold-border);
border-radius: 6px;
font-size: 11px; font-weight: 600; color: var(--gold);
```

Área de conteúdo:
```css
padding: 0 16px 20px;
overflow-y: auto;
flex: 1;
```

---

## PARTE 3 — Sistema de contexto

### Hook `useHelpContext`
**Arquivo:** `apps/web/hooks/useHelpContext.ts`

```typescript
import { usePathname } from 'next/navigation'

export function useHelpContext(): HelpContext {
  const pathname = usePathname()

  if (pathname.includes('/pdv'))        return 'pdv'
  if (pathname.includes('/estoque'))    return 'estoque'
  if (pathname.includes('/pedidos'))    return 'pedidos'
  if (pathname.includes('/clientes'))   return 'clientes'
  if (pathname.includes('/financeiro')) return 'financeiro'
  if (pathname.includes('/analytics'))  return 'analytics'
  if (pathname.includes('/pipeline'))   return 'pipeline'
  if (pathname.match(/clientes\/[^/]+/)) return 'ficha-cliente'
  return 'dashboard'
}

type HelpContext =
  | 'dashboard' | 'pdv' | 'estoque' | 'pedidos'
  | 'clientes' | 'financeiro' | 'analytics'
  | 'pipeline' | 'ficha-cliente'
```

O painel busca o conteúdo usando este contexto e renderiza o help correto.

---

## PARTE 4 — Conteúdo de ajuda por contexto

**Arquivo:** `apps/web/components/help/helpContent.tsx`

### Componente de seção
```tsx
function HelpSection({ title, items }: { title: string, items: HelpItem[] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.7px', color: 'var(--text-muted)',
        marginBottom: 10, paddingBottom: 6,
        borderBottom: '1px solid var(--border)'
      }}>
        {title}
      </div>
      {items.map(item => (
        <HelpItem key={item.label} {...item} />
      ))}
    </div>
  )
}

function HelpItem({ icon, label, description }: HelpItem) {
  return (
    <div style={{ display:'flex', gap:10, marginBottom:12 }}>
      <div style={{
        width:28, height:28, borderRadius:6, flexShrink:0,
        background:'var(--bg-3)', border:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'center'
      }}>
        {icon} {/* Lucide icon */}
      </div>
      <div>
        <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.5 }}>{description}</div>
      </div>
    </div>
  )
}
```

### Conteúdo: contexto `ficha-cliente` (aba Atendimento — toolbar)

```typescript
'ficha-cliente': {
  pageTitle: 'Ficha do Cliente',
  sections: [
    {
      title: 'Toolbar do Bloco de Nota',
      items: [
        {
          icon: <Bold size={13} />,
          label: 'Negrito (B)',
          description: 'Deixa o texto selecionado em negrito. Atalho: Ctrl+B'
        },
        {
          icon: <Italic size={13} />,
          label: 'Itálico (I)',
          description: 'Deixa o texto selecionado em itálico. Atalho: Ctrl+I'
        },
        {
          icon: <Underline size={13} />,
          label: 'Sublinhado (U)',
          description: 'Sublinha o texto selecionado. Atalho: Ctrl+U'
        },
        {
          icon: <List size={13} />,
          label: 'Lista',
          description: 'Cria uma lista com marcadores. Útil para listar preferências do cliente.'
        },
        {
          icon: <AtSign size={13} />,
          label: 'Mencionar (@)',
          description: 'Menciona um colega de equipe na nota. Ele receberá uma notificação.'
        },
        {
          icon: <Mic size={13} />,
          label: 'Gravar voz',
          description: 'Grava áudio e transcreve automaticamente para texto na nota. Clique para iniciar, clique novamente para parar.'
        },
        {
          icon: <MessageCircle size={13} />,
          label: 'Canal (WhatsApp / Presencial / E-mail)',
          description: 'Define por qual canal este atendimento aconteceu. Fica registrado no histórico.'
        },
        {
          icon: <AlertCircle size={13} />,
          label: 'Prioridade (Normal / Urgente)',
          description: 'Define a prioridade deste bloco. Blocos urgentes aparecem com destaque na lista.'
        },
      ]
    },
    {
      title: 'Status do Atendimento (Mini Kanban)',
      items: [
        {
          icon: <Circle size={13} color="var(--amber)" />,
          label: 'Atendimento',
          description: 'Estágio inicial. O cliente está sendo atendido, informações sendo coletadas.'
        },
        {
          icon: <Circle size={13} color="var(--purple)" />,
          label: 'Proposta',
          description: 'Uma proposta foi gerada e enviada ao cliente. Aguardando resposta.'
        },
        {
          icon: <Circle size={13} color="var(--blue)" />,
          label: 'Pedido',
          description: 'Cliente aprovou. Pedido confirmado com sinal ou pagamento.'
        },
        {
          icon: <Circle size={13} color="var(--teal)" />,
          label: 'OS (Ordem de Serviço)',
          description: 'Peça aprovada para fabricação. O fabricante recebe as especificações técnicas.'
        },
        {
          icon: <Circle size={13} color="var(--green)" />,
          label: 'Entrega',
          description: 'Peça pronta. Aguardando retirada na loja ou envio ao cliente.'
        },
      ]
    },
    {
      title: 'Abas do Painel',
      items: [
        {
          icon: <User size={13} />,
          label: 'Ficha',
          description: 'Cadastro completo do cliente: dados pessoais, contatos, endereço, preferências e dados para emissão de NF-e.'
        },
        {
          icon: <MessageSquare size={13} />,
          label: 'Atendimento',
          description: 'Blocos de atendimento que ainda não chegaram à fabricação. Cada bloco registra uma conversa, preferência ou orçamento do cliente.'
        },
        {
          icon: <FileText size={13} />,
          label: 'Proposta',
          description: 'Propostas comerciais geradas para este cliente, com QR Code PIX e status de pagamento.'
        },
        {
          icon: <ShoppingBag size={13} />,
          label: 'Pedidos',
          description: 'Pedidos confirmados: produtos de pronta entrega comprados no PDV ou catálogo.'
        },
        {
          icon: <Settings size={13} />,
          label: 'OS (Ordem de Serviço)',
          description: 'Ordens de serviço aprovadas para fabricação. Visível pelo fabricante e designer 3D. Aqui não é possível criar novas OS — elas vêm da aba Atendimento.'
        },
        {
          icon: <Truck size={13} />,
          label: 'Entrega',
          description: 'Acompanhamento de entrega: retirada na loja ou envio. Histórico de rastreio.'
        },
        {
          icon: <Clock size={13} />,
          label: 'Histórico',
          description: 'Log completo de tudo que aconteceu: atendimentos, mudanças de etapa, mensagens WhatsApp, e-mails e avaliações do cliente.'
        },
      ]
    }
  ]
},
```

### Conteúdo: contexto `pdv`

```typescript
'pdv': {
  pageTitle: 'PDV — Ponto de Venda',
  sections: [
    {
      title: 'Como usar o PDV',
      items: [
        {
          icon: <Search size={13} />,
          label: 'Buscar produto (F2)',
          description: 'Pressione F2 ou clique na barra de busca para encontrar produtos por nome ou código.'
        },
        {
          icon: <ShoppingCart size={13} />,
          label: 'Carrinho',
          description: 'Clique em um produto para adicioná-lo ao carrinho. Use + e - para ajustar a quantidade.'
        },
        {
          icon: <User size={13} />,
          label: 'Vincular cliente (opcional)',
          description: 'Busque o cliente por nome, CPF ou WhatsApp. Se não tiver cadastro, use "+ Cadastro rápido". Necessário para emitir NF-e e enviar comprovante.'
        },
        {
          icon: <Tag size={13} />,
          label: 'Desconto',
          description: 'Aplique desconto em R$ ou %. O desconto é aplicado no total do carrinho.'
        },
        {
          icon: <CreditCard size={13} />,
          label: 'Formas de pagamento',
          description: 'Dinheiro (calcula troco automaticamente), PIX, Débito, Crédito (escolha as parcelas) ou Link Mercado Pago.'
        },
        {
          icon: <CheckCircle size={13} />,
          label: 'Venda Concluída',
          description: 'O estoque só é baixado ao clicar em "Venda Concluída". Antes disso, nada é registrado.'
        },
        {
          icon: <FileText size={13} />,
          label: 'Proposta',
          description: 'Gera uma proposta com QR Code PIX para o cliente pagar depois. O estoque não é reservado.'
        },
      ]
    }
  ]
},
```

### Conteúdo: contexto `estoque`

```typescript
'estoque': {
  pageTitle: 'Estoque',
  sections: [
    {
      title: 'Controle de estoque',
      items: [
        {
          icon: <Plus size={13} />,
          label: 'Adicionar Produto',
          description: 'Cadastra um novo produto no estoque. O estoque inicial cria uma movimentação "Entrada Inicial" no histórico.'
        },
        {
          icon: <AlertCircle size={13} />,
          label: 'Estoque Crítico',
          description: 'Produtos com quantidade abaixo do mínimo configurado. Administradores recebem notificação automática.'
        },
        {
          icon: <BarChart size={13} />,
          label: 'Ajustar Estoque',
          description: 'Use para registrar entradas, saídas, perdas ou devoluções manuais. Todo ajuste fica no histórico com responsável.'
        },
        {
          icon: <Download size={13} />,
          label: 'Exportar / Importar CSV',
          description: 'Exporte a lista completa em CSV. Para importar, use o modelo padrão — campos obrigatórios: internal_code, name, price_cents, stock_quantity.'
        },
        {
          icon: <Eye size={13} />,
          label: 'Painel lateral',
          description: 'Clique em qualquer linha para ver os detalhes do produto e as últimas 5 movimentações de estoque.'
        },
        {
          icon: <Shield size={13} />,
          label: 'pdv_enabled',
          description: 'Se desativado, o produto não aparece no PDV mesmo com estoque disponível.'
        },
      ]
    }
  ]
},
```

### Conteúdo: contexto `pedidos`

```typescript
'pedidos': {
  pageTitle: 'Pedidos',
  sections: [
    {
      title: 'Tipos de pedido',
      items: [
        {
          icon: <Package size={13} />,
          label: 'Pronta entrega',
          description: 'Produtos do estoque comprados no PDV ou catálogo. Estoque baixado na hora da venda.'
        },
        {
          icon: <Gem size={13} />,
          label: 'Personalizado',
          description: 'Joias sob encomenda. Criadas na aba Atendimento do cliente ao avançar para status "OS".'
        },
        {
          icon: <Monitor size={13} />,
          label: 'PDV',
          description: 'Vendas realizadas diretamente pelo Ponto de Venda. Aparecem aqui automaticamente após conclusão.'
        },
      ]
    },
    {
      title: 'Ações',
      items: [
        {
          icon: <User size={13} />,
          label: 'Ver ficha (ícone pessoa)',
          description: 'Abre a ficha completa do cliente vinculado ao pedido.'
        },
        {
          icon: <FileText size={13} />,
          label: 'NF-e (ícone nota)',
          description: 'Solicita emissão de nota fiscal. Requer CPF/CNPJ cadastrado na ficha do cliente.'
        },
        {
          icon: <MessageCircle size={13} />,
          label: 'WhatsApp (ícone mensagem)',
          description: 'Envia o comprovante do pedido diretamente para o WhatsApp do cliente.'
        },
      ]
    }
  ]
},
```

### Conteúdo: contexto `clientes`

```typescript
'clientes': {
  pageTitle: 'Clientes',
  sections: [
    {
      title: 'Base unificada',
      items: [
        {
          icon: <Users size={13} />,
          label: 'Uma ficha, múltiplas origens',
          description: 'O mesmo cliente cadastrado no PDV, pelo WhatsApp ou pela landing page é sempre o mesmo registro. Não há duplicatas entre canais.'
        },
        {
          icon: <AlertCircle size={13} />,
          label: 'Deduplicação automática',
          description: 'Ao criar um cliente, o sistema verifica se o telefone já existe. Se sim, vincula ao cadastro existente.'
        },
      ]
    },
    {
      title: 'Badges de origem',
      items: [
        {
          icon: <MessageCircle size={13} />,
          label: 'WhatsApp',
          description: 'Cliente que entrou via atendimento automático ou humano pelo WhatsApp.'
        },
        {
          icon: <Monitor size={13} />,
          label: 'PDV / Balcão',
          description: 'Cliente cadastrado durante uma venda presencial.'
        },
        {
          icon: <Globe size={13} />,
          label: 'Online',
          description: 'Cliente que veio pelo catálogo ou formulário online.'
        },
        {
          icon: <Edit size={13} />,
          label: 'Manual',
          description: 'Cadastro feito diretamente nesta tela pela equipe.'
        },
      ]
    }
  ]
},
```

---

## PARTE 5 — Corrigir toolbar do bloco de nota

Os botões existentes sem funcionalidade devem ser implementados:

```typescript
// Dentro do contenteditable do AttendancePopup

// B — Negrito
document.execCommand('bold')

// I — Itálico
document.execCommand('italic')

// U — Sublinhado
document.execCommand('underline')

// Lista (≡)
document.execCommand('insertUnorderedList')

// @ — Menção
// Inserir "@" no cursor e abrir dropdown de usuários da equipe
// GET /api/v1/users?role=ATENDENTE,ADMIN,MESTRE

// Gravar voz
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
recognition.lang = 'pt-BR'
recognition.continuous = true
recognition.interimResults = false
recognition.onresult = (e) => {
  const transcript = Array.from(e.results)
    .map(r => r[0].transcript)
    .join(' ')
  // Inserir transcript no contenteditable no cursor atual
  document.execCommand('insertText', false, transcript)
}
// btn clique: toggle recognition.start() / recognition.stop()
// mudar visual do botão: cor vermelha + texto "Parar" quando gravando

// Canal (WhatsApp / Presencial / E-mail / Telefone)
// Salvo no campo block.channel ao salvar o bloco

// Prioridade (Normal / Urgente / Concluído)
// Salvo no campo block.priority ao salvar o bloco
// Urgente: card com borda vermelha na lista
```

---

## PARTE 6 — Integração no layout global

No layout shell (`apps/web/components/layout/CRMLayout.tsx` ou equivalente):

```tsx
const [helpOpen, setHelpOpen] = useState(false)
const helpContext = useHelpContext()

// Passar setHelpOpen para o topbar
// Renderizar HelpPanel condicionalmente
{helpOpen && (
  <HelpPanel
    context={helpContext}
    onClose={() => setHelpOpen(false)}
  />
)}
```

O estado `helpOpen` deve ser acessível pelo botão no topbar. Use Context API ou Zustand se o estado já existir no projeto.

---

## Definition of Done

- [ ] Botão `<HelpCircle>` no topbar à esquerda do sino
- [ ] Painel lateral desliza da direita com animação 200ms
- [ ] Clique fora fecha o painel
- [ ] Badge mostra a página atual
- [ ] Conteúdo muda automaticamente conforme a rota ativa
- [ ] Ajuda para: ficha-cliente, pdv, estoque, pedidos, clientes
- [ ] Seção de toolbar do bloco de nota explica cada botão
- [ ] Seção do mini kanban explica cada status
- [ ] Seção das abas do painel explica para que serve cada aba
- [ ] Botão B implementado: execCommand bold
- [ ] Botão I implementado: execCommand italic
- [ ] Botão U implementado: execCommand underline
- [ ] Botão lista implementado: execCommand insertUnorderedList
- [ ] Botão @ implementado: abre dropdown de usuários
- [ ] Botão Gravar: Web Speech API pt-BR, toggle start/stop, visual vermelho ao gravar
- [ ] Select Canal: salvo no campo block.channel
- [ ] Select Prioridade: salvo no campo block.priority, urgente = borda vermelha no card
- [ ] Zero emoji como ícone de UI — tudo Lucide
- [ ] `tsc --noEmit` limpo
