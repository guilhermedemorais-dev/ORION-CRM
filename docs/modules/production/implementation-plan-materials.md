# Plano — Materiais na Ordem de Serviço

> Documento para validação do cliente antes da implementação.
> Data: 2026-05-13

---

## Contexto

Hoje o atendente cria uma OS pelo bloco de **Atendimento** → expandindo **"Especificações de Fabricação"** (nome da peça, metal, pedra, aro, peso, gravação, etc.).

O que **falta** é a parte mais importante: **quais materiais do estoque vão ser usados pra fazer a peça e quanto cada um**. Sem isso o sistema não consegue:

- Calcular o custo real da OS
- Baixar matéria-prima do estoque automaticamente
- Saber o que reservar pra cada ourives
- Mostrar pro cliente um detalhamento honesto no orçamento

A proposta é adicionar uma **nova seção dentro do bloco de atendimento**, logo abaixo de "Especificações de Fabricação", chamada **"Materiais e Custo da Peça"**.

---

## Como vai ficar a tela

Dentro do bloco de Atendimento, a seção nova fica colapsável (igual as outras) e tem três blocos:

### Bloco 1 — Origem do material

Logo no topo, uma escolha:

- ☉ **Material da loja** (padrão) — a loja usa matéria-prima do próprio estoque
- ☉ **Cliente trouxe o material** — cliente entregou ouro/peça pra refundir/reaproveitar

A escolha muda o que aparece embaixo:

### Bloco 2A — Quando material é da loja

Mostra uma busca no estoque com filtros (Tudo / Matéria-prima / Peças prontas).

Atendente digita "ouro", "diamante", o código do produto, e o sistema mostra a lista.

Clica no produto e informa **quanto vai usar** (gramas, unidades, etc.). Adiciona quantos itens precisar.

Cada linha mostra:

- Nome do produto + selo MP se for matéria-prima
- Quantidade que vai ser usada
- Custo unitário (custo médio do estoque, calculado automaticamente)
- Custo total da linha
- Botão pra remover

No final aparece:

- **Subtotal de materiais** (soma do custo de tudo que foi escolhido)

### Bloco 2B — Quando cliente trouxe o material

Em vez de buscar no estoque, o atendente registra:

- Que material o cliente trouxe (ex: ouro 18k, 20g)
- Valor de cotação combinado (ex: R$ 300/g)

O sistema então:

1. **Registra esse material como entrada no estoque** da loja (com origem "Cliente Fulano trouxe na OS XXX")
2. O custo médio do estoque é atualizado pela média ponderada
3. A peça é produzida usando esse material (saída do estoque)
4. **Sobra** (material que veio menos o que foi usado) fica como crédito do cliente — pode devolver físico, em dinheiro ou virar saldo pra próxima compra

**Nada da matéria-prima entra no preço cobrado**, porque o material era do cliente.

### Bloco 3 — Mão de obra e total

Independente da origem do material:

- Campo **"Mão de obra (R$)"** — vendedor digita
- Campo **"Preço de venda final (R$)"** — vendedor digita manualmente
- Mostra também um **detalhamento de referência**:
  - Subtotal materiais: R$ X (só se material é da loja)
  - Mão de obra: R$ Y
  - Custo interno total: R$ X + Y
  - Margem em cima do custo: % (calculada automaticamente quando o vendedor digita o preço final)

Essa diferença entre **custo interno** e **preço de venda** é onde a loja ganha. O vendedor define o preço final pensando em mercado, urgência, perfil do cliente. O sistema só ajuda mostrando o custo pra evitar erro de lançamento (vender abaixo do custo, por exemplo).

---

## Exemplos práticos

### Exemplo 1 — Cliente quer uma aliança feita do zero, com material da loja

- Aliança 4mm, ouro 18k amarelo
- Material: **8g de ouro 18k** (do estoque, custo médio R$ 283/g)
- Subtotal materiais: R$ 2.264
- Mão de obra: R$ 800
- **Custo interno**: R$ 3.064
- **Preço de venda** (vendedor digita): R$ 4.500
- Cliente paga R$ 4.500
- Estoque baixa 8g de ouro automaticamente quando a OS for concluída

### Exemplo 2 — Cliente traz corrente de ouro pra fundir e fazer aliança

- Cliente entrega: 20g de ouro 18k, cotação combinada R$ 300/g (valor: R$ 6.000)
- Sistema: **entrada no estoque** de 20g
- Aliança vai precisar de 8g
- **Material do cliente: não entra no preço de venda**
- Mão de obra: R$ 800
- **Preço de venda final**: R$ 800
- Cliente paga R$ 800 pela mão de obra
- Sobra: 12g de ouro → loja **devolve 12g** ao cliente (físico, dinheiro ou crédito)

### Exemplo 3 — Peça pronta + matéria-prima

- Cliente quer um pingente "Coração" pronto da loja + corrente nova feita sob medida
- Pingente "Coração": peça pronta do estoque (1 unidade)
- Corrente: 6g de ouro 18k (matéria-prima do estoque)
- Subtotal materiais: preço do pingente + custo dos 6g de ouro
- Mão de obra (só pra fazer a corrente): R$ 400
- Vendedor define preço final manual

---

## O que o sistema vai fazer sozinho

1. **Custo médio do estoque**: a cada entrada de matéria-prima (compra de fornecedor ou ouro de cliente), o custo médio do produto é recalculado pela média ponderada.

2. **Reserva de estoque ao criar OS**: quando a OS é criada com materiais selecionados, o sistema **reserva** essa quantidade no estoque (não baixa ainda, mas marca como comprometido). Outro atendente vendo o estoque sabe que aqueles gramas já estão prometidos pra outra OS.

3. **Baixa real do estoque ao concluir a produção**: quando o ourives marca a OS como pronta, o sistema baixa a quantidade que foi efetivamente usada (não necessariamente a quantidade reservada — pode ter sobra ou perda).

4. **Ajuste de peso na conclusão**: o ourives informa quanto efetivamente usou. Se reservou 3g e usou 2.7g, os 0.3g voltam pro estoque automaticamente.

5. **Material trazido pelo cliente entra como crédito**: o valor do material vira uma forma de pagamento "Material do cliente" no momento da venda. Se sobrar, vira crédito do cliente na ficha.

---

## O que **NÃO** está nesta primeira entrega

Pra não atrasar, decidimos dividir em fases. Esta primeira entrega cobre **a base** (seleção de materiais + mão de obra + cliente traz material). As funcionalidades abaixo ficam pra etapas seguintes:

- **Fichas técnicas (modelos prontos de OS)**: atendente seleciona "Aliança 4mm" e os materiais já vêm preenchidos. Vai entrar na próxima fase.
- **Atribuir OS a um ourives específico com bolso virtual**: cada ourives recebe os materiais reservados pra suas OS. Próxima fase.
- **Perda fixa 10% configurável**: configurar uma margem de perda esperada em cada matéria-prima. Próxima fase.
- **Categoria "Serviço"** (produto que não tem estoque, só mão de obra avulsa): próxima fase.

---

## Sobre o cálculo do custo médio

Hoje cada produto tem um campo "Custo de aquisição". O sistema vai passar a calcular esse valor automaticamente pela média ponderada de cada entrada:

**Fórmula simples:**

```
novo_custo = (custo_atual × estoque_atual + valor_entrada × qtd_entrada)
              ÷ (estoque_atual + qtd_entrada)
```

**Exemplo:**

- Estoque antes: 100g a R$ 280/g (custo médio)
- Entrada nova: 20g a R$ 300/g (compra ou ouro do cliente)
- **Novo custo médio**: (100 × 280 + 20 × 300) ÷ 120 = **R$ 283,33/g**

Esse é o número que vai aparecer como custo da matéria-prima na OS.

---

## O que muda no fluxo do atendente

**Hoje:**
1. Cria bloco de atendimento
2. Expande "Especificações de Fabricação"
3. Preenche specs
4. Salva

**Depois desta entrega:**
1. Cria bloco de atendimento
2. Expande "Especificações de Fabricação"
3. Preenche specs
4. **Expande "Materiais e Custo da Peça"** (nova seção)
5. Escolhe origem do material (loja ou cliente)
6. Seleciona materiais do estoque OU registra material que cliente trouxe
7. Informa mão de obra
8. Define preço de venda final
9. Salva

A OS sai com tudo registrado. Quando o pedido for faturado no PDV, o atendente digita o código da OS e o sistema puxa tudo automaticamente.

---

## O que o cliente precisa confirmar

1. **A divisão "material da loja" vs "cliente trouxe" no topo da seção faz sentido pra rotina de vocês?**
2. **A ideia de reserva (compromete mas não baixa) → baixa real só na conclusão da produção está correta?**
3. **Aceita que a primeira entrega não inclui fichas técnicas, ourives com bolso virtual, perda fixa configurável e categoria "Serviço"? Essas ficam pra etapas seguintes.**
4. **Sobre o material trazido pelo cliente: confirma que o sobrante pode ser devolvido em dinheiro/crédito (não só físico)?**
5. **O detalhamento de custo no orçamento (subtotal materiais + mão de obra + margem calculada) é suficiente pra conferir lançamentos antes de mostrar pro cliente?**

---

## Próximo passo

Depois da confirmação do cliente, vou:

1. Construir o **backend** (banco de dados + endpoints) e testar com chamadas diretas
2. Pedir aprovação intermediária
3. Construir a **tela** (seção nova dentro do bloco de Atendimento)
4. Pedir validação visual
5. Atualizar o **manual interno do sistema** (Central de Ajuda) com a explicação dessa funcionalidade
6. Subir pra produção
