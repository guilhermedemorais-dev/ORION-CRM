# API SPEC: OS multi-peca com proposta (escopo minimo)

> Spec e contrato de backend. Nao e implementacao, nao e PR.
> Deriva de `module-spec.md`, `page-spec.md`, `validation-rules.md`, `database.md`.
> Decisoes de entrada: D1 = entidade nova; D2 = escopo minimo para destravar o modal.

## Status
Rascunho (aguarda aprovacao humana antes de virar codigo na TASK-005)

## Principio de contrato
- Backend e **fonte de verdade** de preco, credito e totais (module-spec Seguranca).
- **Nenhuma resposta consumida pelo modal expoe custo, margem, custo medio/unitario/total** (RN-06).
- Dinheiro sempre em centavos, inteiro.
- Base de rota segue o padrao existente `/api/internal/...`.

## Endpoints (minimos)

### 1. Criar projeto/proposta (rascunho)
`POST /api/internal/proposals`
- Body: `{ customer_id, attendance_block_id?, title?, due_date?, responsible_user_id? }`
- Cria `proposals` com `status='draft'`.
- Response: proposta em rascunho (ver Response abaixo).

### 2. Ler proposta consolidada
`GET /api/internal/proposals/:id`
- Response consolida pecas + materiais + totais. **Sem custo/margem.**

### 3. Adicionar peca
`POST /api/internal/proposals/:id/pieces`
- Body: `{ category_id?, title?, tech_specs? }`
- Cria `proposal_pieces` com `status='draft'`, `price_cents=0`.

### 4. Editar / remover peca
`PATCH /api/internal/proposals/:id/pieces/:pieceId`
`DELETE /api/internal/proposals/:id/pieces/:pieceId`

### 5. Adicionar material a peca
`POST /api/internal/proposals/:id/pieces/:pieceId/materials`
- Body (estoque proprio): `{ origin: "own_stock", product_id, quantity }`
- Body (custodia): `{ origin: "customer_custody", material_label, quantity }` (parcial; ver Dependencias)
- Backend valida `quantity > 0`, coerencia de origem, grava `unit`/`unit_price_snapshot_cents`.
- Recalcula `price_cents` da peca e totais da proposta.

### 6. Remover material
`DELETE /api/internal/proposals/:id/pieces/:pieceId/materials/:materialId`

### 7. Fontes de material (reuso, nao criar)
- Estoque proprio: **reusar** o endpoint de produtos existente filtrando `is_raw_material=true`.
- Custodia: pendente do subsistema de custodia (nao construido) — ver Dependencias.

### 8. Registrar proposta (fronteira "Gerar Proposta")
`POST /api/internal/proposals/:id/register`
- Pre-condicao: >= 1 peca com material valido; toda peca `ready` tem material (RN-04).
- Efeito: `status='draft' -> 'registered'`. **Encerra o escopo desta feature.**
- Nao envia, nao imprime, nao gera PDF, nao converte em venda.

## Contrato de Response (proposta consolidada) — SEM CUSTO
```jsonc
{
  "id": "uuid",
  "proposal_number": "PROP-000123",
  "status": "draft",
  "customer_id": "uuid",
  "title": "Alianca + anel",
  "pieces": [
    {
      "id": "uuid",
      "position": 0,
      "category_id": "uuid",
      "title": "Alianca",
      "tech_specs": { "metal": "ouro 18k", "acabamento": "polido" },
      "status": "ready",
      "price_cents": 250000,            // leitura; calculado no backend
      "materials": [
        {
          "id": "uuid",
          "origin": "own_stock",
          "product_id": "uuid",
          "product_name": "Ouro 18k",
          "quantity": 4.5,
          "unit": "g",
          "unit_price_snapshot_cents": 50000
          // NUNCA: unit_cost, margin, custo_*
        }
      ]
    }
  ],
  "subtotal_cents": 250000,
  "customer_credit_cents": 0,
  "total_cents": 250000
}
```

## Regras de calculo de preco
- `piece.price_cents` = soma dos materiais (`quantity * unit_price_snapshot_cents`)
  + regra de precificacao do estoque, calculada no backend.
- `subtotal_cents` = soma de `piece.price_cents` das pecas.
- `total_cents` = `subtotal_cents - customer_credit_cents` (>= 0).
- HIPOTESE: a regra de markup/precificacao do estoque existe no backend; se nao existir de
  forma clara, e **decisao pendente** (ver Riscos) e a TASK-005 deve devolver a lacuna.

## Testes
- Criar proposta, adicionar 1 e N pecas, adicionar/remover material.
- `register` falha se existir peca sem material (retorna 4xx com motivo).
- Response nunca contem campo de custo/margem (teste de contrato).
- `total_cents = subtotal_cents - customer_credit_cents`.

## Seguranca
- Custo/margem fora de toda resposta consumida pelo modal (RN-06).
- Custodia e dado sensivel: auditoria quando o subsistema existir.
- Autorizacao: reutilizar o middleware de auth interno existente (`/api/internal/*`).
  HIPOTESE a confirmar na TASK-005; validado por `security-standard`.

## Observabilidade/logs
- Eventos: `proposal.created`, `piece.added/removed`, `material.added/removed`,
  `proposal.register.rejected` (peca invalida), `proposal.registered`.

## Dependencias
- Endpoint de produtos com `is_raw_material=true`: confirmar que existe; senao, pequeno
  ajuste de leitura (nao novo dominio).
- Subsistema de custodia (`customer_material_custody`): **nao existe**. O caminho
  `origin='customer_custody'` fica parcial (label + quantidade, sem vinculo forte) ate ele existir.

## Decisoes pendentes
1. Regra de precificacao do estoque para `price_cents` da peca (markup? tabela de preco?).
2. Grau de entrega de custodia nesta fase (placeholder de leitura vs task separada).
3. Origem real de `customer_credit_cents` (depende de custodia).

## Riscos
- Sem regra de preco clara, `price_cents` fica indefinido — bloquearia a TASK-005.
- Contrato de custodia instavel se acoplado antes do subsistema existir.

## Criterios de aceite
- Endpoints minimos cobrem montar projeto/pecas/materiais e registrar proposta.
- Nenhuma resposta expoe custo/margem.
- Fronteira "Gerar Proposta" explicita, sem comportamento comercial posterior.
- Suficiente para a TASK-005 (implementacao) e para religar a TASK-002 (frontend).
