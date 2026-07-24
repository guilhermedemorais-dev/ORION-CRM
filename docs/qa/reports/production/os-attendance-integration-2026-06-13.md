# QA - Integracao da nova OS no Atendimento

Data: 2026-06-14

## Escopo validado

- Botao azul `Nova OS` preservado no fluxo existente.
- `ServiceOrderModal` reutilizado pela criacao direta e pelo Atendimento.
- No Atendimento, `ServiceOrderModal` e renderizado em modo embutido no mesmo
  modal, sem abrir uma segunda sobreposicao.
- O seletor do cabecalho usa as etapas reais do pipeline do lead e o contrato
  existente de movimentacao do card.
- `Ordem de Servico` aparece em um bloco colapsavel fixo, independente da etapa,
  no mesmo padrao visual de `Gerar modelo 3D com IA`.
- Formulario antigo de especificacoes/equipe/valores removido de
  `AttendancePopup`.
- `attendance_block_id` enviado somente no fluxo iniciado pelo Atendimento.
- `lead_id` enviado na criacao do bloco quando o cliente possui lead vinculado.
- Bloco vinculado recebe os dados reais da `service_order` sem forcar a etapa do
  pipeline para `OS`.
- Busca de materiais e persistencia parcial possuem feedback visivel.
- Designer e ourives exibidos por nome, sem UUID na interface.

## Evidencias automatizadas

- `npm run typecheck --prefix apps/web`: aprovado.
- `npm run typecheck --prefix apps/api`: aprovado.
- `docker compose up -d --build web nginx`: aprovado; build Next.js concluido.
- `docker compose ps`: API, PostgreSQL e Redis saudaveis; web e nginx ativos.
- `git diff --check`: aprovado.
- `npm run test:health --prefix apps/web`: 6 de 7 testes aprovados.

Falha nao relacionada: o teste de `GET /api/v1/operator/health` espera HTTP 200
sem autenticacao, mas o runtime atual retorna 401.

## QA manual autenticado

Executado no runtime canonico em `http://localhost`, cliente de demonstracao:

- Botao azul `Nova OS`: aprovado; abriu o modal principal direto.
- Aba Atendimento -> `+ Ordem de Servico`: aprovado.
- Seletor de etapa: aprovado; o antigo seletor de `block_type` nao aparece e o
  controle nao governa a exibicao do formulario de OS.
- Etapas dinamicas: aprovado em cliente com lead vinculado; o modal exibiu as
  seis listas reais configuradas no pipeline, incluindo `Novo`, `Qualificado`,
  `Proposta Enviada` e `Negociacao`.
- Bloco colapsavel `Ordem de Servico`: disponivel em `Atendimento` e abre o
  formulario novo dentro do mesmo modal.
- Independencia de etapa: aprovado visualmente; ao trocar a etapa selecionada, o
  bloco de OS permaneceu aberto e funcional.
- Formulario novo no mesmo modal: aprovado; produto, especificacoes, equipe,
  materiais e valores estavam visiveis sem segunda sobreposicao.
- Filtros `Tudo`, `Materia-prima` e `Pecas prontas`: aprovados.
- Busca por nome/codigo: aprovada; retornou produtos para `anel`.
- Adicao de material: aprovada; subtotal e preview financeiro recalculados.
- Preenchimento de sinal, mao de obra e total: aprovado.
- Fechar e reabrir: aprovado; o rascunho nao persistido foi limpo corretamente.
- Evidencia visual: `os-attendance-integration-runtime.png` neste diretorio.

O submit final nao foi executado para evitar criar dados artificiais no banco da
cliente de demonstracao. O vinculo `attendance_block_id` foi conferido no
contrato e na implementacao, mas a gravacao ponta a ponta permanece pendente de
um registro de QA descartavel aprovado.

A persistencia da movimentacao usa `PATCH /leads/:id/stage` com `stageId`, contrato
ja existente e usado pelo painel do cliente. A listagem dinamica foi validada em
registro com lead vinculado, mas o submit final da movimentacao nao foi executado
para nao alterar o card real durante o QA.

## Riscos residuais e decisoes pendentes

- A inclusao de materiais, mao de obra e vinculo do bloco usa requisicoes
  separadas. Falhas parciais preservam a OS e geram aviso, mas nao ha transacao
  atomica sem alteracao futura de API.
- Registros historicos representados somente por `attendance_blocks` nao foram
  migrados.
- O campo de observacoes enviado na criacao direta da OS nao faz parte do schema
  atual de `POST /service-orders`; corrigir sua persistencia exigiria decisao de
  contrato backend e ficou fora deste escopo.
- A pagina do cliente ainda dispara tres chamadas diretas em
  `/api/v1/customers/...` que retornam 401, enquanto as rotas internas usadas por
  este fluxo retornam 200. O comportamento e preexistente e ficou fora do escopo.
