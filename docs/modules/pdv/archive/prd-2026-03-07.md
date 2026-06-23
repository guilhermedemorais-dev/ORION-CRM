# ORION CRM — PRD: PDV (Ponto de Venda)

> Baseado no mockup aprovado em 07/03/2026.
> Substituição completa do pdv/page.tsx atual (formulário simples) por PDV real.

---

## Referência Visual
Mockup aprovado: `PRD.DOCS/mockup-pdv.html`
Abrir no browser antes de implementar qualquer componente.

---

## Layout

Duas colunas fixas, altura total da tela (sem scroll externo):

```
[TOPBAR — 56px]
[LEFT: busca + categorias + grid de produtos | RIGHT: carrinho 400px]
```

---

## Topbar

- Título "Ponto de Venda" + badge "PDV"
- Atalhos visíveis: F2 focar busca · F9 finalizar · ESC limpar busca
- Nome do atendente logado (vindo do JWT)

---

## LEFT — Busca + Produtos

### Busca
- Input com foco automático ao abrir a página
- F2 sempre refoca o input
- Busca em tempo real (debounce 300ms) por: nome, código, material
- Mostra contador de resultados: "5 resultados para 'anel'"

### Categorias
- Pills horizontais: Todos + categorias do estoque
- Buscar `GET /api/v1/estoque/categorias`
- Filtro combinado com busca textual

### Grid de Produtos
- Cards responsivos: minmax(160px, 1fr)
- Cada card mostra: emoji/foto, nome, material/detalhe, preço, badge de estoque
- Badge estoque: verde (>3), amarelo (1-3), vermelho (0 — sem estoque)
- Card sem estoque: opacity-50, cursor not-allowed, não adiciona ao carrinho
- Click no card → adiciona 1 unidade ao carrinho com animação sutil

---

## RIGHT — Carrinho (400px fixo)

### Header
- Título + contador de itens (bolinha gold)
- Botão "Limpar tudo" com confirmação

### Itens do Carrinho
- Cada item: ícone, nome, detalhe, preço total da linha
- Controle de quantidade: botão − / número / botão +
- Botão ✕ remove o item
- Scroll interno se muitos itens
- Atualiza totais em tempo real

### Desconto
- Input de valor + toggle R$ / %
- Aplica desconto sobre o subtotal

### Totais
```
Subtotal:     R$ X
Desconto:   − R$ X
Total:        R$ X  (destaque gold)
```

### Formas de Pagamento
6 opções em grid 3x2:
- 💵 Dinheiro → mostra seção de troco
- ⚡ PIX
- 💳 Débito
- 💳 Crédito → mostra campo de parcelas (1x a 12x)
- 🔗 Link MP → gera link Mercado Pago
- 📋 Fiado → associa ao cliente cadastrado

### Troco (só quando Dinheiro)
- Input "Valor recebido"
- Calcula troco em tempo real
- Verde se positivo, vermelho se insuficiente

### Botão Finalizar
- Altura 48px, gold, texto "✓ Finalizar Venda [F9]"
- Desabilitado se carrinho vazio
- F9 aciona mesmo sem click

---

## Modal de Recibo (pós-venda)

Aparece após finalizar. Contém:
- ✅ ícone de sucesso
- Número da venda (ex: #VDA-2024-0089) + data/hora
- Resumo dos itens
- Total + forma de pagamento
- Troco (se dinheiro)
- 3 botões: Imprimir · Enviar WhatsApp · Nova Venda

"Nova Venda" → fecha modal + limpa carrinho + refoca busca

---

## API — Endpoints Necessários

```typescript
// Busca de produtos para o PDV
GET /api/v1/pdv/produtos?search=anel&categoria=aneis
→ { id, nome, codigo, material, preco, estoque, emoji, categoria }[]

// Categorias disponíveis
GET /api/v1/pdv/categorias
→ string[]

// Finalizar venda
POST /api/v1/pdv/vendas
Body: {
  itens: [{ produtoId, quantidade, precoUnitario }],
  desconto: { tipo: 'valor'|'percentual', valor: number },
  pagamento: { forma: 'dinheiro'|'pix'|'debito'|'credito'|'link_mp'|'fiado', parcelas?: number, valorRecebido?: number },
  clienteId?: string   // obrigatório se forma = 'fiado'
}
→ { vendaId, numero, total, troco, createdAt }

// Gerar link Mercado Pago
POST /api/v1/pdv/link-pagamento
Body: { valor, descricao }
→ { url, qrCode }
```

**O que a API faz ao finalizar venda:**
1. Cria registro em `vendas` (tabela)
2. Baixa estoque de cada item (`estoque_movimentacoes`)
3. Cria lançamento financeiro (`financeiro_lancamentos`)
4. Retorna dados do recibo

---

## Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| F2 | Foca input de busca |
| F9 | Finaliza venda |
| ESC | Limpa busca |
| Enter (na busca com 1 resultado) | Adiciona produto ao carrinho |
| + / - (com item selecionado) | Aumenta/diminui quantidade |

---

## Banco de Dados

```sql
CREATE TABLE vendas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          VARCHAR(20) UNIQUE NOT NULL,  -- VDA-2024-0089
  atendente_id    UUID NOT NULL REFERENCES users(id),
  cliente_id      UUID REFERENCES clientes(id),
  subtotal        INTEGER NOT NULL,  -- centavos
  desconto        INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL,
  forma_pagamento VARCHAR(20) NOT NULL,
  parcelas        INTEGER,
  valor_recebido  INTEGER,
  troco           INTEGER,
  status          VARCHAR(20) NOT NULL DEFAULT 'concluida',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venda_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id        UUID NOT NULL REFERENCES vendas(id),
  produto_id      UUID NOT NULL REFERENCES estoque(id),
  quantidade      INTEGER NOT NULL,
  preco_unitario  INTEGER NOT NULL,
  total           INTEGER NOT NULL
);
```

---

## Protocolo de Execução — CHECKPOINTS OBRIGATÓRIOS

> REGRA ABSOLUTA: implemente um checkpoint por vez. Após cada um, PARE,
> mostre o que foi feito e aguarde aprovação explícita ("ok") antes de continuar.
> Se algo abaixo contradiz o que já existe no código, PARE e pergunte antes de decidir.

---

### CHECKPOINT 1 — DIAGNÓSTICO
Antes de escrever qualquer código, responda:
- Quais tabelas de estoque e financeiro já existem no banco?
- O `pdv/page.tsx` atual tem lógica reaproveitável ou é substituição total?
- Quais endpoints de produto/estoque já existem na API?

⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 2 — BACKEND
Implemente APENAS:
- Migration: tabelas `vendas` e `venda_itens` (SQL na seção Banco de Dados deste PRD)
- `GET /api/v1/pdv/produtos?search=&categoria=`
- `GET /api/v1/pdv/categorias`
- `POST /api/v1/pdv/vendas` (baixa estoque + cria lançamento financeiro)

Mostre os arquivos criados.
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 3 — BUSCA + GRID DE PRODUTOS
Implemente APENAS:
- Input de busca com debounce 300ms + atalhos F2 e ESC
- Pills de categoria filtráveis
- `ProductCard` com badge de estoque (verde/amarelo/vermelho)
- Card sem estoque: opacity-50, não adiciona ao carrinho

Compare cada detalhe com `mockup-pdv.html` antes de mostrar.
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 4 — CARRINHO + PAGAMENTO
Implemente APENAS:
- Estado do carrinho: adicionar, remover, alterar quantidade
- Cálculo de subtotal, desconto (R$ e %) e total em tempo real
- 6 formas de pagamento (dinheiro, pix, débito, crédito, link MP, fiado)
- Troco automático quando forma = Dinheiro

Compare visual com `mockup-pdv.html` antes de mostrar.
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 5 — FINALIZAÇÃO + RECIBO
Implemente APENAS:
- Botão Finalizar + atalho F9 (desabilitado se carrinho vazio)
- Chamada `POST /api/v1/pdv/vendas`
- Modal de recibo: número, itens, total, forma de pagamento, troco
- Botão "Nova Venda": fecha modal + limpa carrinho + refoca busca

⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 6 — INTEGRAÇÃO FINAL
- Confirmar busca real conectada ao banco
- Confirmar que venda baixa estoque e cria lançamento financeiro
- Rodar `typecheck` em `apps/web` e `apps/api`
- Listar qualquer TODO pendente

Mostre resultado final.
⛔ Aguarde aprovação.

---

## Definition of Done

- [ ] Busca em tempo real funciona (debounce 300ms)
- [ ] Filtro por categoria funciona combinado com busca
- [ ] Adicionar/remover produto do carrinho
- [ ] Controle de quantidade com − e +
- [ ] Desconto em R$ e %
- [ ] Todas as 6 formas de pagamento funcionam
- [ ] Troco calculado em tempo real (só quando Dinheiro)
- [ ] F2, F9 e ESC funcionam
- [ ] Modal de recibo abre após finalizar
- [ ] "Nova Venda" limpa tudo e refoca busca
- [ ] Estoque baixado após venda finalizada
- [ ] Lançamento financeiro criado após venda
- [ ] Produto sem estoque não é adicionável
