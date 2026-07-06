# Especificacao - Integracao da nova OS no Atendimento

Data: 2026-06-13

## Arquivos previstos

- `apps/web/app/(crm)/clientes/[id]/components/os/ServiceOrderModal.tsx`
  - aceitar contexto opcional de atendimento;
  - enviar `attendance_block_id` no contrato existente;
  - continuar sendo o formulario interno reutilizado pelo dropdown de OS;
  - apresentar erros de busca e de persistencia parcial.
- `apps/web/app/(crm)/clientes/[id]/components/attendance/AttendancePopup.tsx`
  - remover os campos duplicados da OS antiga;
  - preservar criacao/edicao do atendimento e exibir somente o dropdown de
    etapa real da pipeline do lead no cabecalho;
  - remover da UI o seletor de `block_type`, mantendo o valor existente no
    payload para compatibilidade;
  - enviar o `lead_id` existente ao criar um bloco novo, preservando o vinculo
    entre cliente, atendimento e card do pipeline;
  - manter um bloco colapsavel `Ordem de Servico`, no mesmo nivel visual do bloco
    `Gerar modelo 3D com IA`, independente da etapa selecionada;
  - entregar o ID do bloco salvo para o fluxo novo de OS.
- `apps/web/app/(crm)/clientes/[id]/components/ClientPanelShell.tsx`
  - substituir a ponte atual `Nova OS` -> aba OS -> modal legado por
    `Nova OS` -> `AttendancePopup` com `Ordem de Servico` expandida;
  - preservar a aba/listagem de OS para consulta, sem usa-la como ponto de
    criacao pelo botao azul;
  - centralizar a chamada ao endpoint existente de movimentacao do lead;
  - passar etapas, lead atual e callback de movimentacao ao Atendimento;
  - enviar `stageId`, conforme o schema vigente da API, e atualizar o estado
    local somente depois de resposta bem-sucedida.
- `apps/web/app/(crm)/clientes/[id]/components/ClientStagebar.tsx`
  - reutilizar o callback centralizado de movimentacao, evitando manter um
    segundo payload divergente.
- `apps/web/app/(crm)/clientes/[id]/components/tabs/ClientAtendimentoTab.tsx`
  - abrir o modal em `Atendimento`, mantendo `Ordem de Servico` como bloco
    colapsavel fixo dentro do modal;
  - preservar o cliente e o bloco de origem;
  - atualizar listas e aba OS apos sucesso.
- `apps/web/app/(crm)/clientes/[id]/components/ClientRightSidebar.tsx`
  - manter o botao azul `Nova OS` e seu callback publico;
  - encaminhar a acao ao fluxo canonico do Atendimento, sem abrir o modal
    descontinuado.
- Testes frontend focados, se a estrutura atual permitir cobertura sem criar
  infraestrutura paralela.

## Contratos

- Banco: sem mudanca.
- API: sem endpoint novo.
- Payload existente de criacao de OS recebe `attendance_block_id` somente no
  fluxo iniciado pelo Atendimento.
- O botao azul passa pelo Atendimento e deve enviar o bloco salvo como
  `attendance_block_id`, alem de `customer_id` e dos dados da OS.

## Criterios de aceite

- A acao rapida azul `Nova OS` abre o mesmo `AttendancePopup` do Atendimento,
  com o dropdown `Ordem de Servico` expandido por padrao.
- O modal legado de criacao acionado pela aba OS nao e mais usado por esse
  botao; a aba/listagem de OS continua disponivel para consulta.
- O Atendimento nao exibe o formulario antigo de especificacoes/valores da OS.
- O cabecalho exibe um unico seletor com as listas/etapas configuradas no
  pipeline atual do lead.
- A etapa escolhida e persistida em `leads.stage_id` pelo endpoint existente ao
  salvar o Atendimento ou criar a OS, permitindo mover o card sem retornar ao
  kanban.
- Clientes sem lead vinculado exibem o controle desabilitado e nao tentam mover
  um card inexistente.
- O bloco `Ordem de Servico` fica sempre disponivel e abre o formulario novo
  dentro do mesmo modal em qualquer etapa.
- Os dois pontos de entrada, Atendimento e botao azul `Nova OS`, convergem no
  mesmo modal e no mesmo contrato de persistencia.
- Salvar a OS encerra a coleta tecnica e habilita a geracao da Proposta; nao
  envia diretamente para Producao.
- A sequencia obrigatoria e `Atendimento -> OS tecnica -> Proposta -> aprovacao
  e pagamento -> Producao`.
- A OS tecnica e um projeto com uma ou mais pecas. Cada peca possui editor,
  materiais, calculo e preco proprios; o botao `Gerar Proposta` fica no nivel do
  projeto e consolida as pecas anexadas.
- A proposta gerada e salva na aba Propostas. A acao futura `Fazer venda` abre o
  carrinho lateral do PDV preenchido com o snapshot dessa proposta.
- Criar uma OS pelo Atendimento preserva a etapa selecionada no cabecalho.
- Materiais, filtros, busca e valores permanecem disponiveis.
- Fechamento, scroll, loading, vazio e erro nao regridem.
- Typecheck frontend limpo e fluxo validado no runtime canonico.

## Fora de escopo

- Migracao de OS historicas armazenadas apenas em `attendance_blocks`.
- Alteracao de schema, endpoint ou transacao backend.
- Redesenho geral do modal de Atendimento.
