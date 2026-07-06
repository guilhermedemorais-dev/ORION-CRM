# Pesquisa - Integracao da nova OS no Atendimento

Data: 2026-06-13

## Objetivo

Preservar a acao rapida azul `Nova OS`, mas substituir seu modal legado
descontinuado pelo mesmo `AttendancePopup` usado no Atendimento, aberto com o
bloco `Ordem de Servico` expandido. O objetivo e manter uma unica experiencia e
nao duplicar contratos ou persistencia.

## Estado atual

- `ClientRightSidebar` dispara `onNewOS`; atualmente `ClientPanelShell` abre a
  aba OS e ativa `ServiceOrderModal` por `ClientOSTab`. Esse caminho e legado e
  deve ser substituido.
- `ServiceOrderModal` concentra produto, prioridade, prazo, especificacoes,
  equipe, materiais, filtros, busca e valores.
- `AttendancePopup` possui uma segunda versao do formulario, gravada diretamente
  em `attendance_blocks` quando o status do pipeline e `OS`.
- `ClientAtendimentoTab` abre `AttendancePopup` pelos botoes de criacao e edicao.
- `POST /api/v1/service-orders` ja aceita `customer_id` e
  `attendance_block_id` opcional.
- Materiais e mao de obra ja usam os endpoints existentes da OS.

## Causa raiz

A nova experiencia foi implementada apenas no modal direto. O Atendimento ainda
mantem campos e salvamento proprios, criando dois modelos concorrentes. Alem
disso, o modal novo nao recebe `attendance_block_id`, embora o backend ja suporte
esse vinculo.

## Decisao

- Reutilizar a mesma implementacao de formulario para os dois pontos de entrada.
- Fazer o botao azul `Nova OS` abrir `AttendancePopup` diretamente no contexto
  do cliente, com o bloco `Ordem de Servico` expandido por padrao.
- Descontinuar o modal antigo acionado por `ClientOSTab` para criacao de OS, sem
  remover a aba/listagem de OS nem fluxos que ainda dependam dela.
- No fluxo de Atendimento, renderizar a implementacao nova de OS em um bloco
  colapsavel fixo dentro do proprio `AttendancePopup`, independente da etapa.
- Ao confirmar, persistir primeiro o bloco de Atendimento, reutilizar o ID em
  novas tentativas e passar o `attendance_block_id` retornado para a criacao da
  OS, sem abrir um segundo modal.
- A OS criada aqui registra as informacoes tecnicas e comerciais necessarias
  para gerar uma Proposta. Ela nao cria nem libera Producao diretamente.
- Depois da OS: gerar Proposta, obter aprovacao e confirmar pagamento. Somente
  entao criar/liberar a ordem de Producao e reservar materiais/ourives.
- A OS dentro do Atendimento passa a aceitar varias pecas. Cada clique em `Nova
  peca` abre a ficha tecnica daquela joia; salvar anexa um resumo individual ao
  projeto. `Gerar Proposta` consolida todas as pecas validas.
- Manter `customer_id` obrigatorio nos dois fluxos.
- Nao alterar migrations, schema, endpoints ou contrato backend.
- Remover do Atendimento a dependencia funcional dos campos antigos de OS.
- Exibir no cabecalho apenas o dropdown de etapa real do pipeline do lead. O
  seletor de `block_type` confundia o usuario com um segundo campo chamado
  `Atendimento` e nao era necessario para mover o card.
- Preservar `block_type` no contrato existente: novos registros usam
  `atendimento` e edicoes mantem o valor ja persistido.
- Carregar as etapas configuradas em `pipeline_stages` para o pipeline atual do
  lead e usar o contrato existente `PATCH /leads/:id/stage` para mover o card ao
  salvar, sem retornar ao kanban.
- Manter `attendance_blocks.pipeline_status` como metadado interno do bloco; ele
  nao substitui `leads.stage_id` e nao deve ser apresentado como etapa real do
  kanban.
- O `ClientStagebar` enviava `stage_id`, mas o schema existente da API exige
  `stageId`. A atualizacao local sem validar `res.ok` podia simular uma mudanca
  que nao havia sido persistida.

## Riscos e pendencias

- O repositorio possui registros historicos de OS representados apenas por
  `attendance_blocks`; esta correcao nao migra dados antigos.
- A criacao de OS e a inclusao de materiais ocorrem em requisicoes separadas; a
  atomicidade completa permanece fora do escopo porque exigiria mudanca de API.
- A troca do ponto de entrada deve preservar o contexto do cliente, lead,
  pipeline e callbacks de atualizacao que hoje chegam ao Atendimento.
- Falhas parciais de material/mao de obra devem ser expostas ao usuario; o
  comportamento atual de ignorar falhas silenciosamente precisa ser corrigido na
  camada de UI sem mudar o contrato.
