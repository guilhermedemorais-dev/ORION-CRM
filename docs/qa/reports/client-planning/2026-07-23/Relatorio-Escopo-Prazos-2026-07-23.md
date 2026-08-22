# Relatório de Escopo e Prazos — Orion CRM

**Data:** 23/07/2026
**Objeto:** Escopo detalhado por módulo prioritário e cronograma de conclusão.

---

## 1. Situação atual (já entregue e em produção)

Os seguintes módulos já estão implementados e operacionais, e **não fazem parte
do prazo abaixo** (contam como concluídos):

- Autenticação, sessão e papéis de usuário
- Pipeline / funil de leads (com builder visual)
- Ficha do cliente e atendimento
- Inbox / WhatsApp com tempo real
- Agenda
- Analytics
- **Módulo de Produção** (painel e etapas da bancada)
- Núcleo transacional de venda (PDV) → estoque → financeiro, funcionando

O escopo a seguir cobre o que **falta** para atender às 4 prioridades do cliente,
já incorporando as correções de bugs do QA anterior em cada módulo.

---

## 2. Regra central (aprovação do gerente)

Regra que atravessa Estoque, PDV e Pedidos: **a baixa de estoque não ocorre na
venda.** A venda gera um pedido "aguardando aprovação" e **reserva** o estoque.
Somente ADMIN ou GERENTE aprovam, podendo editar as quantidades de insumo. A
baixa (peça + insumos) ocorre **na aprovação**, antes de gerar a OS de produção.

---

## 3. Escopo por módulo prioritário

### Prioridade 1 — Financeiro
- Contas a Receber: saldos devedores por cliente/pedido + ação de liquidar
- Contas a Pagar: despesas com vencimento, estado pendente → liquidado + liquidar
- Crediário e parcelas/lançamentos futuros (datados)
- Entrada do valor no caixa após a liquidação
- Identificação de lançamentos pendentes e liquidados
- Origem e vínculo de cada lançamento (cliente / venda / pedido) na tela

### Prioridade 2 — Estoque
- Venda gera pedido "aguardando aprovação" + reserva (deixa de baixar na venda)
- Tela de aprovação (ADMIN/GERENTE) com edição das quantidades de ouro/insumo
- Baixa automática de peça e insumos (ouro, diamante, pedras) na aprovação
- Margem de perda de ouro (% por tipo de peça) aplicada no cálculo
- Retirada/baixa manual liberada só por permissão + senha master
- Custo do produto oculto para usuário sem autorização
- Retorno de sobra de insumo ao estoque
- Usuário responsável registrado em cada movimentação
- Correção do bug de upload/centralização de imagem

### Prioridade 3 — PDV
- Ajuste do fechamento da venda para gerar pedido + reserva (regra central)
- Exibição clara do produto e código vendido
- Recebimento gerado e financeiro alimentado, validado ponta a ponta
- Vínculo venda ↔ produto ↔ cliente ↔ lançamento financeiro

### Prioridade 4 — Usuários e Permissões
- Admin com acesso integral; funcionário com acesso operacional
- Custo bloqueado para usuários comuns
- Acesso restrito ao financeiro
- Retirada de estoque controlada e baixa manual protegida
- Senha master / autorização específica para operações sensíveis
- Correção da inconsistência de permissão no módulo de clientes

### Fase complementar — Cálculo automático de insumo
- Cálculo automático da matéria-prima a partir das especificações da peça
- Fatores/percentuais por tipo de peça definidos pelo admin

### Fase fiscal — NF-e / NFC-e
- Emissão fiscal integrada (motor vendorizado, licença MIT)
- **Depende do certificado digital A1 e da inscrição estadual da contratante**

---

## 4. Cronograma

| Bloco | Escopo | Prazo |
|---|---|---|
| A | Regra de aprovação + Estoque + PDV + Permissões (Prior. 2, 3, 4) | **08/08/2026** |
| B | Financeiro completo (Prioridade 1) | **22/08/2026** |
| C | Cálculo automático de insumo + fechamento de correções QA | **01/09/2026** |
| D | Fiscal NF-e/NFC-e | **+1 semana após o envio do certificado A1 pela contratante** |

---

## 5. Prazo de conclusão

- **Núcleo operacional completo** (venda → estoque com aprovação → financeiro,
  com controle de acesso): **22/08/2026**
- **Software completo** (incluindo cálculo automático e correções de QA
  fechadas): **01/09/2026**
- **Emissão fiscal:** aproximadamente **uma semana após** a contratante fornecer
  o certificado digital A1 e a inscrição estadual — dependência que está sob
  responsabilidade da contratante.

---

## 6. Observação

Prazos consideram implementação com testes e revisão de segurança nos pontos que
tocam dinheiro, estoque e autorização (obrigatório, dado o caráter anti-fraude do
controle solicitado). Mudanças de regra durante a execução podem deslocar as
datas proporcionalmente.
