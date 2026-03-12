# ORION CRM — PRD: Financeiro

> Baseado no mockup aprovado em 07/03/2026.
> Substituição do financeiro/page.tsx atual (3 KPIs + tabela simples).

---

## Referência Visual
Mockup aprovado: `PRD.DOCS/mockup-financeiro.html`

⚠️ O mockup usa SVG/CSS puro para simular os gráficos.
**NÃO copiar o código dos gráficos do mockup.**
**Usar obrigatoriamente Recharts para TODOS os gráficos.**
O mockup serve apenas como referência de layout, cores e dados — não de implementação.

---

## O que muda vs. atual

| Atual | Novo |
|-------|------|
| 3 KPIs estáticos | 4 KPIs com delta % vs mês anterior |
| Sem gráficos | BarChart + PieChart (Recharts) |
| Sem comissões | Ranking de atendentes com valor calculado |
| Tabela básica | Tabela com filtros, busca, paginação e comprovante |
| Sem modal de lançamento | Modal completo com upload de comprovante |
| Sem filtro de período | Toggle 7d / Mês / Trimestre / Ano |

---

## Layout

```
[TOPBAR: título + seletor de período + botão "Novo Lançamento"]

[KPI x4: Receitas | Despesas | Saldo | Comissões]

[BarChart Recharts (flex-1) | PieChart Recharts (340px)]

[Ranking Comissões (340px) | Tabela Lançamentos (flex-1)]
```

---

## KPI Cards

4 cards com barra colorida no topo (3px):
- **Receitas** — verde — total do período + delta % + contador de lançamentos
- **Despesas** — vermelho — total do período + delta % + contador de lançamentos
- **Saldo do Mês** — gold — receitas − despesas + delta % + ticket médio
- **Comissões a Pagar** — azul — soma das comissões do período + nº de atendentes + data vencimento

Delta calculado comparando com período anterior equivalente.

---

## Gráficos (Recharts obrigatório)

### BarChart — Receitas vs Despesas

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// Dados agrupados por dia (ou semana/mês dependendo do período selecionado)
// Duas barras por grupo: receitas (verde #10B981) e despesas (vermelho #FCA5A5)
// Tooltip customizado com formatação em R$
// ResponsiveContainer height={180}
```

### PieChart — Despesas por Categoria

```typescript
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

// Donut: innerRadius={45} outerRadius={70}
// Cores: Materiais #C8A97A, Aluguel #3B82F6, Marketing #F59E0B, Outros #10B981
// Label customizado com percentual
// Legenda abaixo com barra de progresso (CSS simples)
```

---

## Ranking de Comissões

- Buscar atendentes com vendas no período
- Calcular: `totalVendas * (percentualComissao / 100)`
- Percentual padrão: 5% (configurável futuramente em Ajustes)
- Exibir: avatar initials, nome, nº de vendas, total vendido, barra de progresso relativa, valor da comissão

---

## Tabela de Lançamentos

Colunas: Descrição + responsável | Categoria | Data | Tipo | Valor | Comprovante

Filtros rápidos (pills): Todos / Receitas / Despesas / Pendentes

Busca por descrição (debounce 300ms)

Paginação: 20 itens por página, cursor-based

Badge de tipo:
- Receita: fundo verde claro, texto verde escuro
- Despesa: fundo vermelho claro, texto vermelho escuro
- Pendente: fundo âmbar claro (pagamento link MP aguardando confirmação)

Comprovante: ícone de clipe → abre arquivo em nova aba (se existir)

---

## Modal "Novo Lançamento"

Campos:
- Toggle Receita / Despesa
- Descrição (texto)
- Valor em R$ (máscara monetária)
- Data (date picker, default hoje)
- Categoria (select: Venda balcão, Pedido, Materiais, Aluguel/Infra, Marketing, Outros)
- Comprovante (file upload opcional — imagem ou PDF, max 5MB)

Ao salvar:
- POST /api/v1/financeiro/lancamentos
- Atualiza KPIs e tabela via react-query invalidate

---

## Seletor de Período

Toggle: 7d / Mês / Trimestre / Ano

Afeta todos os dados da página:
- KPIs recalculados
- Gráficos re-renderizados
- Tabela filtrada
- Comissões recalculadas

Implementar como query param: `?periodo=mes` (default: mes)

---

## API — Endpoints

```typescript
// Dashboard financeiro (KPIs + gráficos)
GET /api/v1/financeiro/dashboard?periodo=mes
→ {
    receitas: { total, delta, count },
    despesas: { total, delta, count },
    saldo: { total, delta, ticketMedio },
    comissoes: { total, atendentes: number, vencimento },
    graficoBarras: [{ label, receitas, despesas }][],
    graficoPizza: [{ categoria, valor, percentual }][],
  }

// Comissões por atendente
GET /api/v1/financeiro/comissoes?periodo=mes
→ [{ userId, nome, vendas, totalVendido, comissao, percentual }]

// Lançamentos paginados
GET /api/v1/financeiro/lancamentos?periodo=mes&tipo=todos&search=&page=1
→ { data: Lancamento[], total, page, pages }

// Criar lançamento
POST /api/v1/financeiro/lancamentos
Body: { tipo, descricao, valor, data, categoria, comprovante? }

// Upload comprovante
POST /api/v1/financeiro/lancamentos/:id/comprovante
Body: multipart/form-data
```

---

## Banco de Dados

Verificar se já existe tabela `financeiro_lancamentos`. Se sim, apenas adicionar colunas faltantes:

```sql
-- Se não existir:
CREATE TABLE financeiro_lancamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         VARCHAR(10) NOT NULL CHECK (tipo IN ('receita','despesa')),
  descricao    VARCHAR(255) NOT NULL,
  valor        INTEGER NOT NULL,  -- centavos
  data         DATE NOT NULL,
  categoria    VARCHAR(50) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'confirmado',  -- confirmado | pendente
  comprovante  VARCHAR(500),
  criado_por   UUID NOT NULL REFERENCES users(id),
  referencia_tipo VARCHAR(20),  -- 'venda' | 'pedido' | null
  referencia_id   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_financeiro_data ON financeiro_lancamentos(data DESC);
CREATE INDEX idx_financeiro_tipo ON financeiro_lancamentos(tipo);
```

---

## Protocolo de Execução — CHECKPOINTS OBRIGATÓRIOS

> REGRA ABSOLUTA: implemente um checkpoint por vez. Após cada um, PARE,
> mostre o que foi feito e aguarde aprovação explícita ("ok") antes de continuar.
> Se algo contradiz o que já existe no código, PARE e pergunte antes de decidir.

### CHECKPOINT 1 — DIAGNÓSTICO
Antes de qualquer código, responda:
- A tabela `financeiro_lancamentos` já existe? Com quais colunas?
- O `financeiro/page.tsx` atual tem lógica de cálculo reaproveitável?
- Recharts já está em `apps/web/package.json`?
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 2 — BACKEND
Implemente APENAS:
- Migration (se necessário)
- `GET /api/v1/financeiro/dashboard?periodo=`
- `GET /api/v1/financeiro/comissoes?periodo=`
- `GET /api/v1/financeiro/lancamentos` (paginado)
- `POST /api/v1/financeiro/lancamentos`
Mostre os arquivos criados.
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 3 — KPIs + GRÁFICOS (Recharts)
Implemente APENAS:
- 4 KPI cards com delta %
- BarChart Recharts (receitas vs despesas)
- PieChart Recharts (despesas por categoria)
- Seletor de período funcional

⚠️ Usar Recharts. Não usar SVG manual. Não copiar código do mockup.
Compare layout e cores com `mockup-financeiro.html`.
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 4 — COMISSÕES + TABELA
Implemente APENAS:
- Ranking de comissões com cálculo real
- Tabela de lançamentos com filtros, busca e paginação
- Badge de tipo (receita/despesa/pendente)
- Link de comprovante
Compare com `mockup-financeiro.html`.
⛔ Aguarde aprovação antes de continuar.

---

### CHECKPOINT 5 — MODAL + INTEGRAÇÃO FINAL
Implemente APENAS:
- Modal "Novo Lançamento" com upload de comprovante
- Invalidar queries após salvar (react-query)
- Rodar typecheck em apps/web e apps/api
- Listar TODOs pendentes
⛔ Aguarde aprovação.

---

## Definition of Done

- [ ] 4 KPIs com delta % calculado corretamente
- [ ] BarChart Recharts com dados reais do período
- [ ] PieChart Recharts com categorias de despesa
- [ ] Seletor de período afeta todos os dados
- [ ] Ranking de comissões calculado (5% das vendas)
- [ ] Tabela com filtros + busca + paginação
- [ ] Modal de novo lançamento funcional
- [ ] Upload de comprovante funciona
- [ ] Gráficos implementados com Recharts (não SVG manual)
