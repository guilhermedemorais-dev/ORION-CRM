# Pesquisa — Material do Cliente em Custódia e Perda de Produção

> Data: 2026-06-15  
> Status: Checkpoint 1 concluído para revisão humana  
> Escopo: documentação e mapeamento; nenhuma alteração de Banco, API ou UI

## 1. Contexto

O fluxo novo de Ordem de Serviço (OS) está embutido no atendimento do cliente e
já registra especificações, materiais do estoque próprio, mão de obra, sinal e
preço total manual. A nova funcionalidade deve receber material que continua
pertencendo ao cliente, rastrear custódia, reserva, consumo, perda, sobra e
eventual crédito ou compra pela loja sem misturá-lo ao estoque próprio.

O documento anterior `implementation-plan-materials.md` e o seed de roadmap
`apps/api/src/db/roadmap-seeds/01-os-materiais.sql` descrevem material do cliente
como entrada no estoque próprio. Essa premissa está superada pelas decisões de
produto aprovadas nesta pesquisa e não deve orientar implementação futura.

## 2. Objetivo

Mapear o estado real do repositório e definir a fronteira técnica necessária
para custódia separada, perda de produção, sobra, crédito negociado e baixa ao
concluir produção, preservando o preço de venda manual.

## 3. Escopo

- Fluxo de OS dentro do atendimento.
- Material próprio já selecionável na OS.
- Material de cliente em custódia, sem compor `products.stock_quantity`.
- Seleção planejada de materiais durante a OS, sem reserva operacional imediata.
- Reserva por OS e, quando aplicável, por ourives somente após proposta
  aprovada e pagamento confirmado.
- Perda estimada, faixa aceitável e perda real.
- Aprovação gerencial de perda fora da faixa.
- Destino da sobra.
- Crédito sugerido e crédito final negociado.
- Baixa idempotente ao concluir produção.
- Reflexos no acerto financeiro e na auditoria.

## 4. Fora de escopo

- Implementar migrations, tabelas, endpoints ou componentes neste checkpoint.
- Criar ficha técnica nova antes de confirmar a estrutura existente.
- Alterar o preço de venda automaticamente.
- Refatorar ou unificar imediatamente `service_orders` e `orders`.
- Transformar custódia em estoque próprio sem acordo formal.
- Remover o botão azul “Nova OS” ou o dropdown novo no atendimento.

## 5. Fontes de verdade consultadas

- `docs/product/ORION-CRM-PRD-v1.2.md`
- `docs/product/ORION-BUILD-GUIDE.md`
- `docs/product/ORION-Fase0-PRD.md`
- `docs/modules/estoque/prd.md`
- `docs/modules/production/implementation-plan-materials.md`
- `docs/modules/production/research-os-attendance-integration.md`
- `docs/modules/production/spec-os-attendance-integration.md`
- `docs/modules/pdv/prd.md` e `docs/modules/pdv/payment.md`
- `docs/modules/financeiro/prd.md`
- `docs/design/runtime-map.md`

## 6. Diagnóstico atual

### Banco

| Domínio | Estrutura encontrada | Diagnóstico |
| --- | --- | --- |
| OS do atendimento | `service_orders` em `030_painel_cliente.sql` | Vincula cliente, atendimento, pedido opcional, designer e `jeweler_id`; guarda especificações em JSONB, sinal e total manual. |
| Materiais da OS | `service_order_materials` em `051_service_order_materials.sql` | Aceita somente `product_id`; representa exclusivamente produto do estoque próprio. Não possui origem, custódia, reserva, peso recebido, perda ou sobra. |
| Estoque próprio | `products` + `stock_movements` | Quantidade agregada por produto. Movimentações são patrimoniais da loja e não distinguem proprietário ou lote custodiado. |
| Matéria-prima | `products.is_raw_material` | Distingue matéria-prima de peça pronta, mas continua sendo estoque próprio. |
| Pedido comercial | `orders`, `order_items`, `custom_order_details` | Fluxo comercial separado da OS do atendimento; `service_orders.order_id` é opcional. |
| Produção | `production_orders`, `production_steps` | Produção nasce vinculada a `orders`, não a `service_orders`; possui `assigned_to` para ourives e etapas operacionais. |
| Pagamento | `payments` | Cobranças financeiras positivas vinculadas a `orders`; não há crédito por material custodiado. |
| Financeiro | `financial_entries` | Registra entradas/saídas e referência a pedido/pagamento; não modela avaliação, negociação ou aquisição de material do cliente. |
| Auditoria | `audit_logs` via `createAuditLog` | Existe, mas as mutações atuais chamam auditoria manualmente por rota. |

Não foi encontrada entidade de lote custodiado, reserva de matéria-prima,
transferência de propriedade, avaliação do material, perda real, sobra ou
aprovação excepcional. Também não foi encontrada ficha técnica/receita ativa no
schema inspecionado.

### API/Backend

Contratos atuais relevantes:

- `POST /api/v1/service-orders`: cria a OS com `specs`, `deposit_cents` e
  `total_cents`.
- `GET|POST|PATCH|DELETE /api/v1/service-orders/:id/materials`: manipula somente
  produtos do estoque próprio.
- `PATCH /api/v1/service-orders/:id/labor`: atualiza mão de obra e markup.
- `PATCH /api/v1/service-orders/:id/step`: avança o fluxo simples da OS.
- `GET /api/v1/production-orders` e `GET /:id`: consulta produção.
- `POST /api/v1/production-orders/:id/advance`: avança etapa de produção em
  transação, mas não registra perda, sobra ou consumo de material.
- `PATCH /api/v1/production-orders/:id/assign`: atribui ourives; não reserva
  material para ele.
- Endpoints de `products` registram movimentações do estoque próprio.
- Aprovação de pagamento baixa estoque de pronta entrega; o PDV também baixa
  estoque na conclusão da venda. Nenhum desses fluxos atende custódia.

O subtotal da OS usa `unit_price_snapshot_cents`, embora o requisito desta
feature determine custo médio (`cost_price_cents`) para custo de matéria-prima.
O frontend cria a OS e depois anexa materiais/mão de obra em chamadas separadas;
falhas parciais são preservadas e exibidas ao usuário.

### Frontend/UI

- `ClientAtendimentoTab.tsx` abre o atendimento por botões de “Ordem de Serviço”.
- `AttendancePopup.tsx` contém o dropdown/accordion novo “Ordem de Serviço”.
- `ServiceOrderModal.tsx` é renderizado dentro desse dropdown e também suporta
  uso não embutido.
- O botão azul `Nova OS` da lateral ainda segue a ponte
  `ClientRightSidebar → ClientPanelShell → ClientOSTab → modal legado`. A decisão
  atual é substituir essa ponte para abrir o mesmo `AttendancePopup`, já com o
  dropdown “Ordem de Serviço” expandido.
- A seção atual pesquisa `products`, filtra matéria-prima/peça pronta, adiciona
  quantidade e calcula subtotal pelo preço de venda.
- O modal já possui especificações, sinal, mão de obra, total manual e preview.
- `ProducaoClient.tsx` possui painel lateral, atribuição de ourives e avanço de
  etapas, mas não possui formulário de perda/sobra.
- `EstoqueClient.tsx` gerencia apenas estoque próprio e movimentação manual.
- Não há mockup específico para custódia/perda. O tema real é escuro/dourado,
  documentado em `docs/design/runtime-map.md`.
- O formulário atual representa somente uma peça por OS. A decisão nova exige
  que o mesmo projeto/orçamento aceite várias peças, cada uma com ficha técnica,
  materiais, custódia, custos e preço próprios.
- `ClientPropostaTab.tsx` atualmente gerencia apenas PDFs anexados. Não existe
  lista de propostas estruturadas geradas pela OS nem ação funcional `Fazer
  venda` baseada em seus itens.
- O PDV atual usa carrinho fixo à direita em `PdvClient.tsx`; a ideia de carrinho
  lateral/drawer será planejada separadamente para receber proposta selecionada.

## 7. Regras de negócio aprovadas

1. Material recebido permanece patrimônio do cliente em custódia separada.
2. Entrada em custódia não altera `products.stock_quantity` nem custo médio da loja.
3. Transferência para crédito, compra ou estoque próprio exige acordo explícito.
4. Perda estimada registra percentual, mínimo e máximo.
5. Ourives registra perda real durante ou ao final da produção.
6. Perda acima da faixa exige justificativa e aprovação gerencial, sem bloquear automaticamente a entrega.
7. Toda sobra recebe destino explícito e histórico.
8. Crédito sugerido é `peso líquido × valor de referência`; o crédito final pode ser negociado manualmente.
9. Reserva por OS/ourives deve impedir uso concorrente do mesmo lote.
10. Baixa do consumido ocorre ao concluir produção, não na entrega ou pagamento.
11. Custo do estoque próprio usa custo médio; preço de venda permanece manual.
12. A OS preenchida no Atendimento é a base técnica para gerar a Proposta; ela
    não envia o trabalho diretamente para Produção.
13. A Produção só é criada/liberada depois da proposta aprovada e do pagamento
    confirmado conforme a regra comercial aplicável.
14. A seleção de matéria-prima feita na OS é planejamento do orçamento. A
    reserva efetiva ocorre na liberação para Produção.
15. Uma OS/projeto pode conter várias peças independentes no mesmo orçamento.
16. Cada peça possui cálculo, materiais e preço manual próprios.
17. `Gerar proposta` consolida as peças em um snapshot comercial versionado.
18. A proposta salva aparece na aba Propostas e pode iniciar `Fazer venda`.
19. `Fazer venda` abre o carrinho lateral pré-preenchido com as peças da versão
    aprovada, sem reconstruir valores a partir da OS atual.

## 8. Lacunas identificadas

### Banco

- Ausência de proprietário/origem e lote individual de custódia.
- Ausência de máquina de estados da custódia e histórico de transições.
- Ausência de reserva quantitativa idempotente por OS e ourives.
- Ausência de pesos bruto/líquido, teor/composição e anexos do recebimento.
- Ausência de perda estimada, faixa, perda real, justificativa e aprovação.
- Ausência de sobra e destino.
- Ausência de crédito sugerido/final e transferência formal de propriedade.
- Duplicidade arquitetural entre `service_orders` e `production_orders` sem
  vínculo obrigatório.

### API/Backend

- Contratos de materiais atuais exigem `product_id`, portanto não podem receber
  custódia sem misturar domínios.
- Não existe operação atômica de concluir produção + registrar perda/sobra +
  consumir custódia.
- Não existe ponte completa e garantida OS → Proposta → Pagamento confirmado →
  Produção, preservando materiais e valores aprovados.
- Não existe controle de concorrência ou idempotência para reserva/baixa de
  material da OS.
- Não existe autorização específica para avaliação, negociação e aprovação de
  perda excepcional.
- O cálculo atual do subtotal não separa custo, preço manual, crédito e saldo.

### Frontend/UI

- Falta alternância explícita entre estoque próprio e material do cliente.
- Falta convergir o botão azul `Nova OS` e o acesso pelo Atendimento no mesmo
  modal canônico; o modal antigo acionado pela aba OS está descontinuado.
- Faltam recebimento, fotos/anexos, pesos, teor, crédito e aceite.
- Faltam campos de perda estimada no atendimento.
- Falta área operacional de perda real e sobra na produção.
- Falta caixa de aprovação gerencial e histórico de decisão.
- Falta detalhamento que preserve preço manual sem confundi-lo com custo.
- Falta entidade/contrato de peça, pois materiais e valores estão ligados
  diretamente à OS única.
- Falta proposta estruturada/versionada; a aba atual só persiste anexos PDF.
- Falta ponte idempotente proposta → venda e carregamento do carrinho lateral.

## 9. Riscos e conflitos

- Misturar custódia em `products` altera patrimônio, inventário e custo médio.
- Usar apenas status em estoque agregado perde identidade e propriedade do lote.
- Usar o pagamento como baixa conflita com o gatilho aprovado de conclusão da
  produção. O pagamento apenas autoriza/libera a entrada na Produção.
- Reservar materiais ou atribuir ourives antes da proposta aprovada/paga pode
  comprometer estoque e agenda para um serviço ainda não contratado.
- Manter dois fluxos de produção desconectados pode concluir uma ordem sem a OS
  de custódia correspondente.
- Percentuais podem ser calculados sobre peso bruto, líquido ou peso reservado;
  a base precisa ser decidida antes da migration.
- Ouro e pedras podem exigir unidades e precisão diferentes.
- Crédito financeiro sem evento formal pode gerar dupla contabilização entre
  sinal, pagamento e aquisição do material.

## 10. Implicações de teste

O plano precisa cobrir OS com e sem custódia, concorrência entre duas OS,
idempotência da conclusão, RBAC permitido/negado, perda dentro/fora da faixa,
todos os destinos de sobra, crédito sugerido/manual, transferência de
propriedade e regressão dos fluxos atuais de OS, produção, estoque e pagamento.

## 11. Decisões pendentes

1. Qual fluxo será canônico para produção desta feature: `service_orders`,
   `production_orders`, ou vínculo obrigatório entre ambos?
2. A perda percentual usa peso líquido recebido, peso reservado ou peso
   efetivamente enviado ao ourives?
3. Qual precisão/unidade mínima para metais e pedras?
4. Quem pode aprovar crédito negociado acima/abaixo do sugerido e a partir de
   qual tolerância a justificativa é obrigatória?
5. A aprovação/acordo será assinatura, checkbox com identidade, anexo ou evento
   de auditoria interno?
6. “Converter em crédito” cria saldo reutilizável do cliente ou desconto apenas
   nesta OS?
7. “Comprar para a loja” exige lançamento financeiro imediato e qual avaliação
   fiscal/contábil?
8. Fotos do atendimento atual podem ser reutilizadas como evidência de
   recebimento ou precisam de anexos imutáveis próprios?
