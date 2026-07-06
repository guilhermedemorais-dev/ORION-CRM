# Especificação proposta — OS com múltiplas peças, Proposta e Venda

> Data: 2026-06-15  
> Status: PROPOSTA — documentação somente; exige aprovação antes de Banco/API/UI  
> Relacionados: `spec-os-attendance-integration.md` e `spec-customer-material-custody.md`

## Mockup para aprovação

- `../../design/mockups/production/mockup-2026-06-15-os-multi-piece-proposal.html`
- Status: navegável e validado localmente; aguardando revisão humana.
- Abrange: modal de Atendimento, coleção de peças, ficha técnica individual,
  seleção pesquisável de matérias-primas do estoque, cadastro/seleção de
  material ou joia em custódia, cálculo por peça, resumo consolidado, estados
  vazio/erro/bloqueado e prévia da proposta.
- Ainda não abrange: aba Propostas completa e carrinho lateral do PDV. Esses
  mockups devem ser criados após a aprovação deste primeiro fluxo.

## 1. Decisão de produto

Um atendimento pode gerar um único orçamento contendo duas, três ou mais peças.
A OS técnica não deve mais ser tratada como uma única joia. Ela passa a ser um
contêiner de projeto/orçamento, e cada peça é um item técnico e comercial
independente dentro dele.

```text
Atendimento
  -> Projeto/OS técnica
       -> Peça 1: ficha + materiais + custos + preço manual
       -> Peça 2: ficha + materiais + custos + preço manual
       -> Peça N: ficha + materiais + custos + preço manual
  -> Gerar Proposta com todas as peças
  -> Proposta salva na aba Propostas
  -> Fazer venda
  -> Carrinho lateral preenchido pela proposta
  -> Pagamento confirmado
  -> Produção liberada para as peças personalizadas
```

## 2. Hierarquia funcional

### Projeto/OS técnica

Representa o contexto geral do atendimento: cliente, prazo, prioridade,
observações, responsável e vínculo com o bloco de atendimento. Não deve guardar
uma única ficha de joia como se todo o orçamento fosse uma peça.

### Peça

Cada peça possui identidade própria dentro do projeto:

- nome/tipo da joia;
- categoria da peça, selecionada a partir das categorias do estoque do cliente;
- metal, pedra, aro, medidas, gravação e demais especificações;
- fotos e anexos aplicáveis;
- materiais próprios planejados;
- material do cliente em custódia alocado àquela peça;
- perda estimada e faixa;
- custo calculado de matéria-prima/pedras;
- mão de obra manual;
- preço de venda manual;
- subtotal, crédito e saldo daquela peça;
- status de preenchimento.

No editor da peça, `Estoque próprio` deve pesquisar o cadastro real por nome,
código e categoria, exibindo disponibilidade e custo médio antes de anexar. A
opção `Custódia do cliente` deve permitir selecionar lote já recebido ou
cadastrar uma nova matéria-prima/joia com tipo, descrição, teor, peso bruto,
peso líquido, valor de referência, crédito negociado, observações e evidências.

Uma peça deve poder ser adicionada, editada, duplicada ou removida antes da
proposta. Remoção posterior à proposta exige nova versão da proposta.

### Proposta

É o snapshot comercial versionado das peças anexadas ao projeto. Deve preservar
nomes, especificações relevantes, preços, descontos, créditos, sinal, total e
condições mesmo que a OS seja alterada depois.

### Venda

A ação `Fazer venda` usa a proposta selecionada como origem. Ela não reconstrói
os itens a partir do estado atual da OS: carrega exatamente a versão aprovada da
proposta no carrinho lateral.

## 3. Frontend/UI — modal da OS

O `AttendancePopup` permanece como modal canônico. Dentro do dropdown `Ordem de
Serviço`, a UI deve deixar de exibir um formulário único e adotar uma coleção de
peças.

### Organização aprovada para o mockup

O modal usa duas abas principais para reduzir densidade e confusão:

1. `Anotações e fotos`: texto livre do atendimento, formatação básica, canal,
   prioridade e fotos/referências gerais da conversa. Não possui gravação de voz.
2. `Cotação`: projeto, peças, especificações técnicas, seleção do estoque,
   custódia, perda estimada, cálculos, preços e geração da proposta.

Fotos gerais ficam em Anotações. Fotos do material recebido permanecem no
cadastro de custódia porque são evidências patrimoniais daquele lote.

```text
[Dados gerais do projeto/OS]

[Peça 1 — Anel solitário] [Editar] [Duplicar] [Remover]
  resumo técnico + materiais + custo + mão de obra + preço

[Peça 2 — Aliança] [Editar] [Duplicar] [Remover]
  resumo técnico + materiais + custo + mão de obra + preço

[+ Nova peça]

[Resumo do orçamento: peças + créditos + sinal + total]
[Gerar proposta]
```

Ao clicar `Nova peça`, abrir um accordion/dropdown ou editor interno com todos
os dados técnicos, materiais e valores daquela peça. `Salvar/Anexar peça`
colapsa o editor e adiciona um card-resumo ao projeto. O botão `Gerar proposta`
fica no nível do projeto e só é habilitado quando existe ao menos uma peça
válida.

Regras de UI:

- `Categoria` é o único dropdown da ficha técnica da peça e deve ser alimentado
  pelas categorias existentes no estoque do cliente, como anel, pulseira,
  cordão, aliança ou outras categorias cadastradas;
- metal, acabamento, gravação, cor/banho, cravação e demais especificações são
  campos digitáveis pelo usuário, não dropdowns;
- os campos técnicos digitáveis da peça não devem ser obrigatórios, porque cada
  peça pode exigir um conjunto diferente de informações;
- a etapa obrigatória da cotação é selecionar os materiais/matérias-primas que
  serão utilizados na fabricação da peça;
- a quantidade do material deve respeitar a unidade cadastrada no estoque
  (`g`, `un`, `ct`, etc.); o atendente edita apenas o valor numérico e a UI
  mostra a unidade como sufixo fixo;
- cada card de peça deve exibir status visual mínimo: `Sem material`,
  `Material selecionado` ou `Pronta para proposta`;
- `Gerar Proposta` deve alertar quando existir peça sem material selecionado,
  apontando a pendência sem bloquear a edição do restante da OS;
- a origem do material deve ficar clara na UI: `Estoque próprio` representa
  patrimônio da loja; `Custódia` representa material entregue pelo cliente;
- custo médio, custo unitário, custo total de material, custo estimado e margem
  não devem aparecer para perfil de atendimento/vendedor sem permissão; a UI do
  atendente mostra material, disponibilidade, quantidade e preço de venda manual;
- custos internos podem existir no backend para cálculo/auditoria, mas exigem
  permissão gerencial/backoffice para exibição;
- o resumo de peças anexadas e o resumo comercial ficam fixos no rodapé interno
  da aba Cotação, imediatamente acima dos botões do modal, para permanecerem
  visíveis enquanto o usuário edita as peças;
- cada peça mostra cálculo e preço manual próprios;
- o resumo geral soma as peças sem apagar sua separação;
- erros de uma peça não podem ser escondidos pelo total geral;
- alteração após proposta gerada exige nova versão;
- criar mockup específico antes da implementação visual.

## 4. Aba Propostas

Diagnóstico atual: `ClientPropostaTab.tsx` lista apenas PDFs anexados por cliente.
Ela não representa propostas estruturadas, peças, status, versão, pagamento ou
venda.

Planejamento:

- listar propostas estruturadas e manter anexos PDF como complemento;
- mostrar código, versão, quantidade de peças, total, validade e status;
- permitir visualizar o detalhamento de cada peça;
- ações: visualizar, baixar/enviar, cancelar, gerar nova versão e `Fazer venda`;
- proposta convertida mostra vínculo com venda/pedido e não pode ser convertida
  novamente.

Status conceituais mínimos: `RASCUNHO`, `ENVIADA`, `APROVADA`,
`AGUARDANDO_PAGAMENTO`, `PAGA`, `CONVERTIDA`, `EXPIRADA`, `CANCELADA` e
`SUBSTITUIDA`. A lista final depende da revisão do PRD canônico de Propostas.

## 5. Carrinho lateral do PDV

Diagnóstico atual: `PdvClient.tsx` mantém carrinho e pagamento em uma coluna fixa
da página. Existem referências visuais em `docs/design/mockups/pdv/panel.html`,
mas a alteração para drawer ainda não está implementada.

Planejamento futuro:

- transformar o carrinho em painel lateral/drawer consistente com os demais;
- `Fazer venda` abre o drawer já preenchido pela proposta selecionada;
- cada peça aparece como item separado, com descrição e preço aprovados;
- painel mostra cliente, proposta, peças, sinal/crédito, total pago e saldo;
- alteração de preço exige permissão e auditoria ou nova versão da proposta;
- conversão proposta → venda é idempotente;
- fechar o drawer antes de concluir não converte a proposta nem libera produção.

Esta mudança do PDV é um subprojeto separado e requer mockup aprovado por alterar
uma superfície operacional crítica.

## 6. Banco

Não criar migration sem aprovação. `service_orders` possui campos de uma única
peça e `service_order_materials` referencia diretamente a OS, portanto o modelo
atual não atende a hierarquia nova.

Modelo conceitual recomendado:

- projeto/OS técnica como cabeçalho;
- entidade de peça vinculada ao projeto;
- materiais, custódia e perda estimada vinculados à peça;
- proposta e versão da proposta;
- itens da proposta vinculados à peça e armazenados como snapshot;
- conversão idempotente da proposta em venda/pedido;
- vínculo da peça aprovada com a futura ordem de produção.

Decisão pendente: normalizar itens da proposta ou manter parte do snapshot em
JSONB. Dados operacionais de produção, custódia e reserva não devem existir
somente em JSONB.

## 7. API/Backend

Contratos conceituais necessários, ainda não aprovados:

- CRUD de peças dentro da OS/projeto;
- CRUD de materiais e custódia por peça;
- cálculo do projeto sem sobrescrever preços manuais;
- geração de proposta versionada a partir das peças válidas;
- listagem/detalhe de propostas por cliente;
- conversão idempotente `Fazer venda`;
- contrato para carregar a proposta no carrinho lateral;
- pagamento que libera produção sem baixar antecipadamente materiais de produção.

Para joias personalizadas, confirmar pagamento não deve aplicar a regra de
pronta entrega que baixa estoque imediatamente. Deve criar/liberar a produção e
efetivar reservas; o consumo ocorre ao concluir a produção.

Todo material escolhido para a peça deve manter vínculo OS -> peça -> material.
Ouro, outros metais, diamantes e pedras naturais usados na fabricação devem dar
baixa no estoque no gatilho de produção aprovado para consumo, não na simples
digitação da cotação.

## 8. Regras de consistência

1. Uma proposta contém uma ou mais peças.
2. Cada item referencia a peça de origem e mantém snapshot próprio.
3. Peça incompleta não entra na proposta.
4. Alterar peça não modifica proposta já gerada.
5. Nova condição comercial gera nova versão ou proposta.
6. Uma proposta só pode gerar uma venda efetiva.
7. O carrinho preserva itens e valores aprovados.
8. Pagamento de personalizada libera produção; não baixa consumo.
9. Cada peça permanece rastreável separadamente na produção.
10. Preço de cada peça e total continuam manuais, assistidos por custos.

## 9. QA

- Criar projeto com uma, duas, três e muitas peças.
- Salvar, editar, duplicar e remover peça antes da proposta.
- Impedir proposta sem peça ou com peça inválida.
- Conferir soma das peças, créditos, sinal e total.
- Gerar proposta e conferir snapshot por peça.
- Alterar OS e confirmar que proposta antiga não muda.
- Gerar nova versão após alteração.
- Listar proposta na aba do cliente.
- Abrir `Fazer venda` e conferir carrinho lateral pré-preenchido.
- Fechar drawer sem converter proposta.
- Impedir venda duplicada por double-click/retry.
- Confirmar pagamento e liberar produção das peças aplicáveis.
- Confirmar que pagamento não registra consumo de produção.
- Regressão do PDV convencional sem proposta.

## 10. Segurança e auditoria

- Auditar criação, edição e remoção de peça.
- Auditar geração, versão, aprovação e cancelamento da proposta.
- Auditar mudanças de preço posteriores à proposta.
- Auditar conversão em venda e impedir duplicidade.
- Validar cliente, proposta e permissões no backend.
- Não aceitar itens/valores do navegador como fonte de verdade na conversão;
  recarregar o snapshot persistido.

## 11. Aprovações humanas necessárias

1. Nome do contêiner: OS, projeto, orçamento ou atendimento técnico.
2. Cada peça gera ordem de produção própria ou uma ordem com subitens?
3. Pagamento exigido: total, sinal mínimo ou qualquer pagamento aprovado?
4. Proposta pode combinar personalizada e pronta entrega?
5. Alteração de preço no carrinho exige gerente ou nova proposta?
6. PDF anexado continuará separado ou associado à proposta estruturada?
7. Aprovação do mockup multi-peças e do carrinho lateral.

## 12. Checkpoints

1. Aprovar hierarquia projeto → peças → proposta → venda.
2. Aprovar mockups do modal multi-peças, aba Propostas e carrinho lateral.
3. Definir Banco e versionamento de proposta.
4. Implementar peças na OS sem alterar produção.
5. Implementar geração/listagem de propostas estruturadas.
6. Implementar `Fazer venda` e drawer do PDV.
7. Integrar pagamento à liberação da produção.
8. Validar QA, concorrência, auditoria e regressões.
