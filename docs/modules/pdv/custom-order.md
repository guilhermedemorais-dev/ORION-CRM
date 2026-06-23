# PRD-PDV-03 — Pedido Personalizado no PDV

## Referência visual
`PRD.DOCS/mockup-pdv-painel.html` — Estado B (busca) e Estado C (puxado)
`PRD.DOCS/mockup-pdv-pagamento.html` — Estado "Personalizado — sinal"

## Leia antes de implementar
- `apps/web/app/(crm)/pdv/` — painel direito e modal de pagamento
- `apps/api/src/routes/orders.ts` — pedidos e tipos
- `apps/api/src/db/schema/` — tabela orders, campos type e status

## Contexto
Cliente vai à loja buscar ou pagar joias personalizadas. O atendente precisa
finalizar a venda no PDV para baixar estoque e registrar pagamento (total ou sinal).

---

## Banco

```sql
-- Verificar se já existem; adicionar apenas o que faltar:
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  is_custom_pickup BOOLEAN DEFAULT FALSE,
  -- TRUE quando pedido personalizado é finalizado no PDV

  signal_amount_cents INTEGER,
  -- valor do sinal (se pagamento parcial)

  remaining_amount_cents INTEGER;
  -- saldo a pagar na entrega (calculado: total - signal_amount)
```

---

## Seção "Pedido Personalizado (opcional)" no painel direito

Adicionar abaixo da seção de cliente.

### Campo de busca

```
[ 💎 Nº do pedido ou nome do cliente... ]
```

- Busca: debounce 300ms → `GET /api/v1/orders?type=PERSONALIZADO&q={termo}&status=PRODUCAO`
- Retorna: número, nome do produto, cliente, valor total, valor pago (sinal), saldo

### Dropdown de resultados

```
PERS-20260210-0034
Anel Solitário Personalizado — gravação "MF"
Maria Fernanda · Sinal: R$ 500 pago · Restante: R$ 2.700
```

- Clicar → puxar pedido para o carrinho
- Se pedido tiver cliente vinculado: auto-vincular na seção de cliente (sem sobrescrever se já tiver outro)

### Item do pedido personalizado no carrinho

Renderizar diferente de produto normal:

```
[💎] Anel Solitário Personalizado      [PERS]
     PERS-20260210-0034 · gravação "MF"
     Sinal pago: R$ 500,00

     [Total pedido] [Já pago]  [A cobrar]
     [  R$ 3.200  ] [  R$ 500] [ R$ 2.700]
```

- Badge `PERS` em roxo
- Grid de 3 valores: total / já pago / a cobrar
- Não tem controle de quantidade — é sempre 1 pedido

### Painel de totais quando pedido personalizado está no carrinho

```
Valor do pedido         R$ 3.200,00
Sinal já pago         − R$   500,00
─────────────────────────────────────
Total a cobrar          R$ 2.700,00
```

---

## Modal de Pagamento — variantes para pedido personalizado

### Variante A: Pagamento total (saldo restante)
- Header mostra "Total a cobrar: R$ 2.700,00"
- Aviso: "Pagamento final do pedido personalizado"
- Ao confirmar: `orders.status → CONCLUIDO`, baixar estoque normalmente

### Variante B: Novo sinal / pagamento parcial
- Toggle no modal: "Cobrar valor diferente"
- Campo de valor livre (ex: R$ 1.000,00)
- Ao confirmar: registrar pagamento parcial, atualizar `signal_amount_cents`, status permanece em produção
- **Estoque NÃO é baixado** — só na entrega final

### Aviso no modal (pedido personalizado)

```
💎 Pedido personalizado
Estoque NÃO será descontado neste sinal.
Desconto ocorre somente na entrega final.
```

---

## Novos endpoints

### `GET /api/v1/orders?type=PERSONALIZADO&q={termo}&status=PRODUCAO`
Adicionar filtro `q` (busca por número ou nome do cliente) se não existir.
Retornar: `id, number, product_name, customer_name, total_cents, paid_cents, remaining_cents`.

### `POST /api/v1/orders/:id/partial-payment`
Registrar pagamento parcial de pedido personalizado.
```typescript
body: { amount_cents: number; payment_method: string }
// Atualiza signal_amount_cents, cria registro financeiro
// NÃO baixa estoque
```

---

## Regras

- Pedido personalizado e produtos normais podem coexistir no mesmo carrinho
- Se coexistirem: exibir totais separados (subtotal produtos + saldo pedido)
- Pedido personalizado só aparece na busca se `status IN ('PRODUCAO', 'AGUARDANDO_RETIRADA')`
- Ao confirmar pagamento total: `status → CONCLUIDO` + `is_custom_pickup = true`

---

## Definition of Done
- [ ] Seção "Pedido personalizado" no painel direito com busca
- [ ] Dropdown mostra número, produto, cliente e valores
- [ ] Item no carrinho renderiza diferente com grid de 3 valores
- [ ] Totais do painel refletem "valor do pedido − já pago = a cobrar"
- [ ] Modal de pagamento tem aviso correto para pedido personalizado
- [ ] Pagamento total: status → CONCLUIDO + estoque baixado
- [ ] Pagamento parcial (sinal): estoque NÃO baixado
- [ ] `tsc --noEmit` limpo
