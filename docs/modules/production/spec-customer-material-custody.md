# Especificação proposta — Material do Cliente em Custódia

> Data: 2026-06-15  
> Status: PROPOSTA — exige aprovação humana antes de Banco/API  
> Pesquisa: `research-customer-material-custody.md`

## 1. Contexto

Clientes podem entregar metais, pedras, joias ou sucata para transformação,
avaliação, devolução, crédito ou compra pela loja. O material deve permanecer
identificável como patrimônio do cliente até acordo formal.

## 2. Objetivo

Planejar um fluxo auditável de recebimento, custódia, reserva, produção, perda,
sobra e destinação, integrado à OS e ao acerto financeiro, sem alterar
automaticamente o preço de venda.

## 3. Escopo

- Recebimento e identificação do lote do cliente.
- Vínculo cliente → material → OS → produção → ourives.
- Reserva exclusiva e consumo na conclusão da produção.
- Perda estimada, real e aprovação excepcional.
- Sobra e seus cinco destinos aprovados.
- Crédito sugerido e final negociado.
- Detalhamento de custos, crédito, sinal e saldo.
- Auditoria, observabilidade, segurança e testes.

## 4. Fora de escopo

- Ficha técnica/modelo novo.
- Cotação diária obrigatória.
- Precificação automática da venda.
- Exposição da custódia como produto disponível no PDV.
- Implementação antes da aprovação dos contratos e do modelo de dados.

## 5. Regras de negócio aprovadas

- Custódia é separada do estoque próprio.
- O recebimento não transfere propriedade.
- Transferência exige acordo e responsável identificados.
- Crédito sugerido = peso líquido × valor de referência.
- Crédito manual aprovado prevalece no acerto.
- Perda estimada possui valor central, mínimo e máximo.
- Perda real acima do máximo exige justificativa e aprovação gerencial.
- Exceção gera alerta, mas não bloqueio automático da entrega.
- Sobra sempre possui destino registrado.
- Reserva por OS/ourives impede alocação concorrente.
- A OS técnica gera uma Proposta antes de qualquer liberação para Produção.
- Selecionar materiais na OS não significa reservá-los imediatamente.
- Proposta aprovada e pagamento confirmado são pré-condições para criar/liberar
  a Produção e efetivar as reservas.
- Consumo/baixa acontece ao concluir produção.
- Custo de material próprio usa custo médio.
- Preço de venda e mão de obra continuam manuais.

## 6. Fluxo de Material do Cliente em Custódia

```text
Recebido
  -> Em custódia
  -> Avaliado e informado na OS técnica
  -> Proposta gerada
  -> Proposta aprovada
  -> Pagamento confirmado
  -> Produção criada/liberada
  -> Reservado para OS
  -> Reservado para ourives (opcional)
  -> Em produção
  -> Consumido parcialmente/totalmente
  -> Sobra definida
  -> Devolvido | Crédito | Nova OS | Mantido em custódia | Comprado pela loja
```

Cada transição deve registrar estado anterior/novo, quantidade/peso afetado,
usuário, horário, OS, ourives quando aplicável, motivo e `requestId`.

O material do cliente já recebido fisicamente permanece em custódia enquanto a
proposta aguarda decisão ou pagamento. Nesse período ele não é consumido, não é
transferido à loja e não é liberado ao ourives.

## 7. Fluxo de perda estimada e perda real

No orçamento, o vendedor informa percentual estimado, mínimo e máximo. O
backend valida `0 <= mínimo <= estimado <= máximo` e a base de cálculo aprovada.

Na produção, o ourives registra peso real consumido, perda real e sobra. O
sistema compara a perda real à faixa. Acima do máximo, exige justificativa e
cria pendência de aprovação para ADMIN/GERENTE. A produção pode ser registrada,
mas a exceção permanece visível e auditável até decisão.

## 8. Fluxo de sobra de material

Destinos suportados:

- `RETURN_TO_CUSTOMER`: devolução física com confirmação.
- `CONVERT_TO_CREDIT`: crédito financeiro aprovado.
- `KEEP_IN_CUSTODY`: novo saldo/lote custodiado disponível.
- `TRANSFER_TO_SERVICE_ORDER`: reserva em outra OS do mesmo cliente.
- `SELL_TO_STORE`: transferência formal para estoque próprio.

O destino deve ser imutável após efetivação; correções usam evento reversor,
nunca edição silenciosa.

## 9. Fluxo de crédito/parte de pagamento

O sistema exibe peso líquido, valor de referência e crédito sugerido. Usuário
autorizado informa crédito final negociado, responsável e observação conforme a
tolerância a aprovar. O crédito só afeta saldo depois do acordo formal.

```text
saldo sugerido = preço de venda manual - sinal - crédito final aprovado
```

Custos, margem e saldo são informativos. Nenhum cálculo substitui o preço de
venda digitado pelo vendedor/gerente.

O detalhamento da OS alimenta a Proposta. O valor aprovado da proposta, sinal,
crédito do material e forma de pagamento devem compor o acerto. Somente após a
confirmação do pagamento a OS pode originar/liberar a ordem de produção.

## 10. Banco

### Estruturas existentes a preservar

- `service_orders`: OS do atendimento e preço/sinal manual.
- `service_order_materials`: materiais do estoque próprio com snapshot.
- `products` e `stock_movements`: patrimônio da loja.
- `orders`, `payments`, `financial_entries`: pedido e acerto financeiro.
- `production_orders` e `production_steps`: execução da produção.
- `users`: atendente, gerente e produção/ourives.

### Modelo conceitual proposto

Não criar até aprovação. A recomendação é uma entidade própria de lote de
custódia, em vez de adicionar o material a `products`:

- `customer_material_custody`: identidade, cliente, descrição, tipo, unidade,
  peso bruto/líquido, teor, estado, evidências e saldo disponível.
- `customer_material_allocations`: reserva por OS, produção e ourives, com
  quantidade reservada/consumida e proteção contra concorrência.
- `customer_material_assessments`: valor de referência, sugerido, negociado,
  acordo, aprovador e justificativa.
- `customer_material_production_results`: perda estimada/faixa, perda real,
  justificativa, aprovação e conclusão idempotente.
- `customer_material_dispositions`: destino da sobra e eventual vínculo com
  nova OS, crédito, devolução ou entrada patrimonial.
- `customer_material_events`: ledger imutável de transições e quantidades.

Alternativas de nomes e normalização permanecem abertas. Restrições mínimas:

- pesos/quantidades em `NUMERIC`, nunca `FLOAT`;
- dinheiro em centavos inteiros;
- chaves idempotentes para concluir produção e efetivar destino;
- `SELECT ... FOR UPDATE` no lote e reservas;
- soma reservada/consumida nunca superior ao saldo do lote;
- estoque próprio só recebe material após evento `SELL_TO_STORE` aprovado;
- rastreabilidade obrigatória até cliente, OS, produção e usuário.

### Impacto estrutural sujeito a aprovação

Será necessária migration porque o schema atual não representa propriedade,
lote, reserva, perda, sobra ou acordo. Antes dela, deve ser decidida a ponte
canônica entre `service_orders` e `production_orders`.

## 11. API/Backend

### Contratos atuais reaproveitáveis

- Criação e atualização da OS.
- CRUD de materiais próprios em `/:id/materials`.
- Atribuição de ourives e avanço de produção.
- Auditoria, autenticação, RBAC, transação e formato de erro existentes.

### Contratos propostos

Rotas são propostas, não aprovadas:

- `POST /service-orders/:id/customer-materials`: receber e vincular custódia.
- `GET /service-orders/:id/customer-materials`: listar lotes e saldos da OS.
- `PATCH /customer-materials/:id/assessment`: avaliar e negociar crédito.
- `POST /customer-materials/:id/approve-agreement`: formalizar uso/crédito/compra.
- `POST /customer-materials/:id/reservations`: reservar para OS/ourives.
- `POST /production-orders/:id/material-result`: registrar consumo, perda e sobra.
- `POST /production-orders/:id/loss-approval`: aprovar/rejeitar exceção.
- `POST /production-orders/:id/complete-with-materials`: concluir de forma
  atômica e idempotente.
- `POST /customer-materials/:id/dispositions`: efetivar destino da sobra.

Antes de criar rotas, avaliar se o contrato de criação da OS deve aceitar um
payload composto e transacional. O fluxo atual de chamadas sequenciais permite
OS parcialmente criada, o que é inadequado para recebimento patrimonial.

Também deve existir uma ação transacional/idempotente para converter a proposta
paga em pedido/ordem de produção. Essa ação deve copiar ou referenciar a versão
aprovada das especificações, materiais planejados, crédito, preço e prazo antes
de criar as reservas.

### Validações e autorização

- ATENDENTE/GERENTE: registrar recebimento e estimativa.
- PRODUCAO/ourives atribuído: registrar perda real e sobra.
- GERENTE/ADMIN: aprovar exceção e crédito negociado conforme política.
- Backend valida propriedade do cliente, saldo, unidade, faixa, transição de
  estado, concorrência e idempotência.
- Backend impede criar/liberar Produção sem proposta aprovada e pagamento
  confirmado.
- A reserva de materiais ocorre na liberação para Produção, não no simples
  preenchimento da OS nem na geração da proposta.
- Conclusão executa reserva, consumo, perda, sobra, eventos e eventual movimento
  de estoque próprio na mesma transação.
- Nenhum endpoint deve aceitar alteração direta de saldo ou estado final.

## 12. Frontend/UI

### Atendimento/OS

No `ServiceOrderModal.tsx`, dentro do dropdown novo renderizado por
`AttendancePopup.tsx`, planejar uma seção “Material do Cliente em Custódia” ao
lado da seção de materiais próprios, sem substituir o fluxo atual.

A revisão multi-peças em `spec-multi-piece-proposal-sales-flow.md` passa a ser
obrigatória: o modal deve tratar a OS como projeto/orçamento e permitir anexar
várias peças. Custódia, materiais, perda estimada, mão de obra, custos e preço
manual devem ser associados à peça correspondente, não apenas ao cabeçalho da
OS.

Esse mesmo `AttendancePopup` será o destino dos dois pontos de entrada:

- criação iniciada na aba Atendimento;
- botão azul `Nova OS` da lateral do cliente.

O botão azul não deve mais abrir o modal legado via `ClientOSTab`. Ele deve abrir
o modal canônico com o dropdown “Ordem de Serviço” expandido por padrão. A aba e
a listagem de OS permanecem disponíveis; somente o fluxo legado de criação fica
descontinuado.

Campos planejados: tipo, descrição, peso bruto, peso líquido, teor/composição,
observações, evidências, valor de referência, crédito sugerido, crédito final,
parte de pagamento, perda estimada/mínima/máxima e aceite.

O detalhamento separa:

- custo médio de materiais próprios;
- custo de pedras/composição;
- mão de obra manual;
- crédito sugerido e aprovado;
- sinal;
- preço de venda manual;
- saldo e margem sugeridos.

Ao concluir o preenchimento técnico, a ação principal deve ser **Gerar
Proposta**, não **Enviar para Produção**. A proposta deve apresentar os dados da
joia, materiais planejados, custódia, perda estimada, mão de obra, crédito,
preço manual, sinal e saldo para aprovação/pagamento.

Quando houver várias peças, a proposta mantém cada uma como item separado e
também apresenta o total consolidado. A proposta gerada deve ser persistida e
listada na aba Propostas do cliente.

### Proposta e venda

A aba atual `ClientPropostaTab.tsx` lista apenas anexos PDF e precisará evoluir
para propostas estruturadas. A ação `Fazer venda` deve abrir um carrinho lateral
pré-preenchido com o snapshot da proposta selecionada. Essa alteração do PDV é
planejada como checkpoint separado e depende de mockup aprovado.

### Produção

No painel lateral de `ProducaoClient.tsx`, planejar seção de materiais alocados,
ourives responsável, peso recebido, perda real, sobra e destino. Perda acima da
faixa exibe alerta persistente, justificativa obrigatória e status da aprovação.
Esse painel só recebe a ordem depois da proposta aprovada e do pagamento
confirmado.

### Gestão

Aprovação gerencial deve estar acessível no contexto da produção/OS e não em um
fluxo genérico desconectado. A tela de estoque próprio não deve listar custódia
como quantidade disponível; uma visão de custódia separada poderá ser planejada
depois do contrato de dados.

Não existe mockup aprovado desta feature. Antes da implementação visual, criar
ou aprovar mockup em `docs/design/mockups/production/` seguindo o tema escuro,
dourado e componentes reais do runtime.

## 13. Testes necessários

- Criar OS sem material do cliente e confirmar regressão zero.
- Abrir pelo Atendimento e pelo botão azul `Nova OS`, confirmando que ambos usam
  o mesmo modal, contexto e contrato.
- Criar OS com custódia e validar vínculo ao cliente.
- Gerar proposta a partir da OS técnica, preservando especificações e valores.
- Gerar proposta com múltiplas peças e validar totais individuais/consolidados.
- Exibir a proposta estruturada na aba Propostas, além dos anexos existentes.
- Abrir `Fazer venda` e validar carrinho lateral preenchido pelo snapshot.
- Impedir entrada em Produção com proposta não aprovada ou pagamento pendente.
- Confirmar pagamento e criar/liberar Produção uma única vez.
- Confirmar que materiais selecionados na OS ainda não estão reservados antes
  da liberação para Produção.
- Confirmar que recebimento não altera `products` nem `stock_movements`.
- Validar cálculo sugerido e crédito manual aprovado.
- Validar faixa de perda e base percentual.
- Reservar para uma OS e impedir reserva concorrente.
- Reservar/reatribuir ourives com RBAC e histórico.
- Registrar perda dentro da faixa.
- Exigir justificativa e aprovação acima da faixa.
- Registrar todos os destinos de sobra.
- Concluir produção e baixar uma única vez, mesmo com retry/double-click.
- Confirmar que pagamento libera Produção e reserva, mas não baixa o consumo.
- Confirmar que entrega não dispara a baixa de custódia.
- Validar transferência para estoque próprio somente após acordo.
- Validar sinal + crédito + preço manual + saldo.
- Testar permissões permitidas e negadas por role.
- Testar rollback integral em falha intermediária.
- Testar precisão e arredondamento de peso/centavos.
- Executar regressão de atendimento, OS, produção, estoque, pedidos e PDV.

## 14. Segurança e auditoria

- Registrar ator de recebimento, avaliação, negociação, produção, aprovação e
  destino da sobra.
- Não expor IDs internos sem necessidade; usar contratos de recurso.
- Validar anexos por magic bytes e limitar tamanho/tipo.
- Não registrar telefone, CPF, email, tokens ou imagens em logs.
- Impedir alteração silenciosa de peso, crédito, perda e propriedade.
- Restringir aprovação ao gerente/admin e impedir autoaprovação quando a
  política exigir segregação de funções.
- Usar locks e restrições para impedir dupla reserva/baixa.
- Auditar valores anteriores e novos, sem dados sensíveis desnecessários.

## 15. Observabilidade/logs

- Eventos estruturados: `custody.received`, `custody.assessed`,
  `custody.reserved`, `production.loss_recorded`, `loss.approval_required`,
  `production.material_consumed`, `custody.disposition_completed`.
- Todo evento inclui `requestId`, IDs técnicos necessários, estado, resultado e
  duração; sem dados pessoais em plaintext.
- Métricas: reservas conflitantes, conclusões duplicadas evitadas, perdas fora
  da faixa, aprovações pendentes e falhas de destinação.
- Alertas: tentativa de consumo superior ao saldo, inconsistência de unidade,
  conclusão parcial e evento financeiro sem acordo.

## 16. Riscos

- Divergência entre OS do atendimento e ordem de produção.
- Produção criada antes da aprovação/pagamento da proposta.
- Alteração da OS depois da aprovação sem versionar ou regenerar a proposta.
- Dupla contabilização do crédito como pagamento e desconto.
- Conversão de unidade/teor incorreta.
- Aprovação retroativa sem segregação de função.
- Edição concorrente de reserva e conclusão.
- Material comprado pela loja sem lançamento financeiro/fiscal correspondente.
- Evidência insuficiente em disputa sobre peso ou estado do material.

## 17. Decisões pendentes

1. Fluxo canônico e vínculo entre `service_orders`, `orders` e `production_orders`.
2. Base do percentual de perda.
3. Precisão e unidades por categoria de material.
4. Política/tolerância para crédito negociado e segregação de aprovação.
5. Forma de aceite/acordo e comprovante de devolução.
6. Semântica do crédito: somente OS atual ou carteira do cliente.
7. Processo contábil/fiscal de compra pela loja.
8. Reuso ou separação dos anexos do atendimento.
9. Necessidade de uma tela dedicada de custódia além da OS.

## 18. Critérios de aceite

- Decisões aprovadas documentadas e antigas premissas conflitantes marcadas.
- Material do cliente nunca aparece como estoque próprio antes da transferência.
- Rastreabilidade cliente → lote → OS → produção → ourives → destino.
- Rastreabilidade OS técnica → proposta aprovada → pagamento → produção.
- Perda estimada/faixa e perda real persistidas com precisão definida.
- Exceção exige justificativa e aprovação, sem bloqueio automático de entrega.
- Sobra possui destino explícito e histórico imutável.
- Crédito sugerido e manual permanecem distinguíveis.
- Baixa é transacional, idempotente e ocorre na conclusão da produção.
- Preço de venda permanece manual.
- RBAC, auditoria, logs seguros e testes de concorrência aprovados.
- Fluxos existentes de OS sem custódia continuam funcionando.
- O botão azul `Nova OS` usa o `AttendancePopup` canônico e não reabre o modal
  legado descontinuado.

## 19. Checkpoints de implementação

### Checkpoint 1 — Documentação e pesquisa

- Concluído neste documento e na pesquisa associada.
- Nenhuma alteração de produto realizada.
- Gate: aprovação humana da documentação.

### Checkpoint 2 — Mapeamento técnico e decisões

- Resolver as decisões pendentes.
- Produzir modelo relacional final, contratos de payload e diagrama de estados.
- Produzir mockup aprovado para atendimento, produção e aprovação gerencial.
- Gate: aprovação humana explícita para Banco e API.

### Checkpoint 3 — Implementação incremental

1. Banco/ledger de custódia e testes de constraints.
2. API de recebimento/avaliação, sem integração financeira automática.
3. Geração/versionamento da proposta com dados técnicos e financeiros da OS.
4. Confirmação de pagamento e liberação idempotente para Produção.
5. Reserva transacional por OS/ourives após a liberação.
6. Produção: perda, sobra, aprovação e conclusão idempotente.
7. Crédito/acerto financeiro e transferência para estoque próprio.
8. UI do atendimento, proposta e produção conforme mockup aprovado.

Cada etapa deve preservar OS sem custódia e parar para validação antes da
seguinte.

### Checkpoint 4 — QA e revisão

- Typecheck, testes unitários/integrados e RBAC.
- Testes de concorrência e idempotência.
- Validação no `docker compose` canônico.
- Browser QA contra mockup e regressão do botão “Nova OS” e dropdown novo.
- Validar especificamente que o botão azul abre o dropdown de OS expandido e
  preserva cliente, lead, pipeline e atualização das listas após salvar.
- Revisão de segurança e auditoria.

## Aprovações humanas exigidas

- Qualquer migration ou nova entidade.
- Qualquer novo endpoint ou mudança de payload existente.
- Definição da ponte OS/pedido/produção.
- Política financeira e contábil do crédito/compra.
- Política de aprovação e segregação de funções.
- Mockup e localização final das interfaces.
