# Escopo de Entrega — Prioridades do Cliente (23/07/2026)

> O que vamos entregar, mapeado 1:1 às 4 prioridades do relatório da reunião.
> Legenda: ✅ já existe e funciona · 🔧 existe, precisa ajustar · 🆕 construir.
> Base verificada no código nesta sessão. Núcleo transacional PDV→estoque→
> financeiro confirmado em `order-financial.service.ts` (finalizePdvSale).

## Prioridade 1 — FINANCEIRO

**✅ Já existe:** lançamentos receita/despesa, entrada automática de receita ao
pagar, comissão calculada por vendedor, filtro por período (7d/mês/tri/ano),
categorias, e vínculo de cada lançamento com pedido e pagamento
(`financial_entries` tem `order_id`, `payment_id`, `commission_user_id`).

**🔧/🆕 Falta:**
- Contas a Receber: visão de saldo devedor por cliente/pedido + botão liquidar (motor de pagamentos parciais + `order_payment_status` já existe) — 🔧
- Contas a Pagar / despesas futuras: adicionar vencimento (`due_date`) + estado pendente→liquidado + ação liquidar — 🆕
- Crediário / parcelas datadas: plano de parcelas sobre o motor de pagamentos — 🆕
- Entrada no caixa após liquidação: ligar a liquidação ao caixa — 🔧
- Pendentes vs liquidados visível (filtro "pendentes" já existe, expor melhor) — 🔧
- Origem/vínculo do lançamento exposto na UI (dado já existe) — 🔧

## Prioridade 2 — ESTOQUE (aplica a REGRA CONGELADA)

**✅ Já existe:** estoque integrado à venda, `stock_movements` com usuário
responsável e vínculo ao pedido, ajuste manual com audit log, materiais na OS
com snapshot de custo, custo no produto, flag matéria-prima, infra de permissão
(`userCan` + `custom_permissions`).

**🔧/🆕 Falta (a regra nova):**
- **Baixa NÃO na venda** — só na **APROVAÇÃO** de GERENTE/ADMIN no Pedido, antes de gerar a OS de produção — 🔧 (muda `finalizePdvSale`)
- Baixa da **peça E dos insumos** (ouro, diamante, pedras) na aprovação — 🆕
- **Margem de perda de ouro** (% por tipo de peça, definida pelo admin) — 🆕
- Retirada manual só ADMIN/GERENTE, via **permissão + senha master** — 🆕
- **Custo oculto** para usuário sem permissão — 🔧 (usa `userCan`)
- **Sobra de insumo volta ao estoque** (reconciliação real vs aprovado) — 🆕
- Correção do bug de upload/centralização de imagem no estoque — 🔧

## Prioridade 3 — PDV INTEGRADO

**✅ Já existe (o núcleo roda):** registra venda, vincula cliente, identifica
produto e código, gera recebimento, alimenta o financeiro automaticamente e
mantém o vínculo venda↔produto↔cliente↔lançamento. Tudo numa transação SQL.

**🔧 Falta:** alinhar com a regra nova — a venda passa a gerar Pedido "aguardando
aprovação" + **reserva** de estoque; a baixa migra para a aprovação. É o **mesmo
motor** da Prioridade 2, não é trabalho separado.

## Prioridade 4 — USUÁRIOS / PERMISSÕES

**✅ Já existe:** RBAC com 7 papéis, matriz de permissões, `custom_permissions`
por usuário, admin com acesso total, financeiro restrito.

**🔧/🆕 Falta:** chaves novas (`estoque.custos`, `estoque.retirada`), **senha
master**, e corrigir a inconsistência de RBAC no módulo de clientes (QA-04/21).

## Correções transversais (QA de abril)

Bugs reais de botões/formulários/estados apontados em `QA-Botoes-Formularios.md`
e no bug de imagem no estoque — entram como punch-list dentro dos marcos.

## Sobre "pegar pronto dos outros repositórios"

Verificado: **o único componente que vale pegar de fora é o motor fiscal do
FinOpenPOS.** Para financeiro, estoque e PDV, o Orion **já é mais completo** que
os repositórios de exemplo (FinOpenPOS tem 11 tabelas; o Orion tem 60 migrations
com regra de joalheria). Importar aquilo seria trocar o que já temos por algo mais
simples + pagar integração. O caminho rápido é **terminar o Orion**.

## Mapa para os marcos do relatório de prazo

- **Marco 1 (até 08/08):** regra de aprovação + baixa na aprovação + perda de
  ouro + custo oculto + senha master + retirada controlada + Contas a Receber +
  correções críticas. (Prioridades 2, 3, 4 + início da 1.)
- **Marco 2 (até 22/08):** cálculo automático de insumo por especificação +
  Contas a Pagar + crediário/parcelas. (Fecha a Prioridade 1.)
- **Marco 3 (depende do certificado A1 do cliente):** emissão fiscal NF-e/NFC-e.
