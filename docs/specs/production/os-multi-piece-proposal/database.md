# DATABASE SPEC: OS multi-peca com proposta (escopo minimo)

> Spec e contrato do modelo de dados. Nao e migration, nao e PR.
> Deriva de `module-spec.md`, `page-spec.md`, `validation-rules.md`.
> Decisoes de entrada: D1 = entidade nova; D2 = escopo minimo para destravar o modal.

## Status
Rascunho (aguarda aprovacao humana antes de virar migration na TASK-005)

## Escopo deste modelo
Persistir um **projeto/proposta** com **uma ou mais pecas**, cada peca com seus
**materiais** (estoque proprio agora; custodia como dependencia futura), preco por peca
calculado pelo backend e total consolidado, ate o ponto de **registrar a proposta**.

Fora deste modelo: versionamento de proposta, conversao Proposta->Venda, regra de
liberacao de producao, politica de desconto por usuario, ordem de Producao.

## Arquitetura escolhida
Entidade **nova**, desacoplada de `service_orders` (que continua modelo de peca unica de
producao). Tres tabelas novas:

```text
proposals (1) ── (N) proposal_pieces (1) ── (N) proposal_piece_materials
```

## Tabela: proposals
| Coluna | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | `gen_random_uuid()` |
| proposal_number | VARCHAR(30) UNIQUE NOT NULL | numeracao legivel |
| customer_id | UUID NOT NULL FK -> customers(id) | dono da proposta |
| attendance_block_id | UUID NULL FK -> attendance_blocks(id) | origem no atendimento, quando houver |
| title | VARCHAR(200) NULL | nome do projeto |
| due_date | DATE NULL | prazo |
| responsible_user_id | UUID NULL FK -> users(id) | responsavel |
| status | VARCHAR(20) NOT NULL DEFAULT 'draft' | `draft` \| `registered` |
| subtotal_cents | INTEGER NOT NULL DEFAULT 0 | soma das pecas, centavos inteiro |
| customer_credit_cents | INTEGER NOT NULL DEFAULT 0 | credito de material do cliente |
| total_cents | INTEGER NOT NULL DEFAULT 0 | subtotal - credito, centavos inteiro |
| created_by | UUID NOT NULL FK -> users(id) | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

- Indice: `(customer_id, created_at DESC)`.
- `status='registered'` marca a fronteira "Gerar Proposta". Nenhum estado comercial
  posterior (enviado, convertido) existe nesta fase.

## Tabela: proposal_pieces
| Coluna | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | |
| proposal_id | UUID NOT NULL FK -> proposals(id) ON DELETE CASCADE | |
| position | SMALLINT NOT NULL DEFAULT 0 | ordem visual da peca |
| category_id | UUID NULL FK -> product_categories(id) | unico dropdown tecnico (RN-02) |
| title | VARCHAR(200) NULL | nome/titulo da peca |
| tech_specs | JSONB NOT NULL DEFAULT '{}' | campos tecnicos digitaveis e opcionais (metal, acabamento, cor/banho, cravacao, gravacao...) (RN-03) |
| price_cents | INTEGER NOT NULL DEFAULT 0 | preco calculado pelo backend; leitura no modal (RN-08) |
| status | VARCHAR(20) NOT NULL DEFAULT 'draft' | `draft` \| `ready` (so `ready` com material valido) (RN-04) |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

- Indice: `(proposal_id, position)`.
- `tech_specs` guarda os campos livres em vez de virar N colunas — mantem RN-03 (opcionais)
  sem inchar o schema.

## Tabela: proposal_piece_materials
| Coluna | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | |
| piece_id | UUID NOT NULL FK -> proposal_pieces(id) ON DELETE CASCADE | |
| origin | VARCHAR(20) NOT NULL | `own_stock` \| `customer_custody` (RN-07) |
| product_id | UUID NULL FK -> products(id) | obrigatorio quando `origin='own_stock'`; produto com `is_raw_material=true` |
| custody_ref | UUID NULL | reservado para vinculo futuro com o subsistema de custodia (ver Dependencias) |
| material_label | VARCHAR(200) NULL | rotulo do material quando custodia ainda nao tem entidade |
| quantity | NUMERIC(10,3) NOT NULL CHECK (quantity > 0) | usuario digita numero; unidade fixa do cadastro (RN-05) |
| unit | VARCHAR(10) NULL | snapshot da unidade (`g`, `un`, `ct`) |
| unit_price_snapshot_cents | INTEGER NOT NULL DEFAULT 0 | snapshot de preco unitario, centavos inteiro |
| notes | TEXT NULL | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

- CHECK de coerencia: `origin='own_stock'` exige `product_id NOT NULL`.
- **Custo NAO e coluna desta tabela nesta fase.** Guardamos apenas snapshot de PRECO. Se
  custo precisar ser persistido no futuro, entra em nova spec e nunca vai na resposta do modal (RN-06).

## Banco (resumo)
- 3 tabelas novas; nenhuma alteracao em `service_orders`/`service_order_materials`.
- Dinheiro sempre em centavos, inteiro. Nunca FLOAT.
- FKs com `ON DELETE CASCADE` de proposta->peca->material.

## Testes (dados)
- Criar proposta com 1 peca e com N pecas.
- Peca sem material nao pode ter `status='ready'`.
- Material `own_stock` sem `product_id` viola CHECK.
- Totais: `total_cents = subtotal_cents - customer_credit_cents`, sempre >= 0.

## Seguranca
- Custodia do cliente e dado sensivel: exige trilha de auditoria quando o subsistema existir.
- Custo/margem nao tem coluna exposta ao modal.

## Observabilidade/logs
- Auditar criar/editar/remover peca e material, e `proposal.registered`.

## Dependencias
- `product_categories`, `products` (com `is_raw_material`), `customers`, `users`,
  `attendance_blocks`: JA existem.
- **`customer_material_custody`: NAO existe** (apenas planejado em
  `docs/modules/production/spec-customer-material-custody.md`). Por isso `custody_ref` fica
  reservado e o caminho `customer_custody` e parcial nesta fase.

## Decisoes pendentes
1. **Unidade do material:** `products` hoje nao tem coluna `unit` verificada. Decidir entre
   (a) adicionar `products.unit`, ou (b) manter `unit` apenas como snapshot em
   `proposal_piece_materials`. Esta spec assume (b) por ora. HIPOTESE a confirmar.
2. **Custodia:** o caminho `origin='customer_custody'` depende do subsistema de custodia
   (nao construido). Definir se a TASK-002 entrega custodia como leitura/placeholder ou se
   custodia vira task separada apos o modelo de custodia existir.
3. **Credito de material do cliente:** origem do valor de `customer_credit_cents` depende
   tambem do subsistema de custodia; ate la, tratar como 0 ou entrada manual controlada.

## Riscos
- Acoplar proposta a custodia antes de a custodia existir gera contrato instavel.
- Calcular preco por peca exige regra de precificacao clara do estoque (ver `api.md`).

## Criterios de aceite
- Modelo suporta projeto com N pecas e materiais por peca, dinheiro em centavos.
- Nenhuma dependencia inventada: custodia fica marcada como pendente, nao como pronta.
- Suficiente para `api.md` e para a TASK-005 (migrations) sem novas decisoes de modelo.
