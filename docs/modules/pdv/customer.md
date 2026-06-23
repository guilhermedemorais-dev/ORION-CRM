# PRD-PDV-02 — Cliente no PDV (Banco Unificado)

## Referência visual
`PRD.DOCS/mockup-pdv-painel.html` — Estado A (padrão) e Estado B (vinculado)

## Leia antes de implementar
- `apps/web/app/(crm)/pdv/` — painel direito atual
- `apps/api/src/routes/customers.ts`
- `apps/api/src/db/schema/` — identificar tabela canônica de clientes

## Decisão arquitetural
O PDV usa a **mesma tabela** de clientes/contatos que alimenta leads do WhatsApp,
landing pages e pipeline de SDR. Sem tabela separada. Sem sincronização.

---

## Banco

```sql
-- Verificar tabela canônica (customers ou contacts) e adicionar apenas o que faltar:
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(20),
  ADD COLUMN IF NOT EXISTS whatsapp  VARCHAR(20);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
```

---

## Seção "Cliente (opcional)" no painel direito do PDV

Adicionar acima da seção de desconto/pagamento.

### Estado vazio (padrão)

```
[ 🔍 Nome, WhatsApp ou CPF...        ]
[ + Cadastro rápido                  ]
```

- Busca: debounce 300ms → `GET /api/v1/customers?q={termo}&limit=5`
- Dropdown com até 5 resultados: avatar inicial, nome, telefone/CPF
- Clicar resultado → vincula ao carrinho

### Mini-form (expandir ao clicar "Cadastro rápido")

```
[ Nome completo *                    ]
[ WhatsApp *          ] [ E-mail     ]
[ CPF ou CNPJ                       ]
[ Cancelar ]  [ Salvar e vincular   ]
```

**POST:** usar endpoint existente de criação de clientes/contatos.
Campos obrigatórios: `name` + `phone`. Opcionais: `email`, `cpf_cnpj`.

**Deduplicação obrigatória antes de criar:**
```typescript
// Verificar por phone ou cpf_cnpj
const existing = await findCustomerByPhoneOrDoc(phone, cpf_cnpj);
if (existing) {
  // Vincular o existente + toast "Cliente já cadastrado — vinculado"
  return existing;
}
// Só cria se não existir
```

### Estado vinculado

```
┌─────────────────────────────────────────┐
│  [MF]  Maria Fernanda Costa         [✕] │  ← border gold
│        📱 (47) 99123-4567               │
│        CPF: 123.456.789-00              │
└─────────────────────────────────────────┘
```

- ✕ desvincula sem excluir o registro
- Nome clicável → abre `/crm/clientes/{id}` em nova aba

### Estado do carrinho

`customer_id` fica no estado local do carrinho.
Enviado no `POST /api/v1/orders` se presente — campo opcional, não bloqueia a venda.

---

## Definition of Done
- [ ] Seção cliente adicionada ao painel direito do PDV
- [ ] Busca por nome, WhatsApp e CPF funciona
- [ ] Mini-form cria cliente na tabela canônica (mesma dos leads)
- [ ] Deduplicação: phone/CPF existente → vincula sem criar duplicata
- [ ] `customer_id` enviado no POST /orders quando vinculado
- [ ] Clicar no nome → abre perfil em nova aba
- [ ] Venda funciona normalmente sem cliente vinculado
- [ ] `tsc --noEmit` limpo
