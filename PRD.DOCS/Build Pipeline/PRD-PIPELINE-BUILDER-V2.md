# PRD — Pipeline Builder V2

Data: 2026-05-09
Status: Proposto
Escopo: Backend primeiro, testes depois, frontend por ultimo

## 1. Contexto

O Orion CRM ja possui pipeline, kanban, stages/listas, cards/leads, drag/drop e vinculos operacionais com cliente, lead, pedido e organizacao. O objetivo deste PRD nao e criar um "Pipeline V2" nem refazer o kanban atual.

O objetivo e criar uma nova experiencia de configuracao do pipeline atual: um Builder V2 simples, confiavel e testavel, onde o usuario consiga criar e editar pipelines, listas e regras padrao sem depender de canvas complexo.

O builder visual atual deve ser tratado como legado/avancado. Nesta fase, o produto precisa entregar o arroz com feijao bem feito: configurar kanban, etapas e automacoes simples entre pipelines.

## 2. Problema

A tela atual de builder tenta funcionar como um editor visual de fluxo, parecido conceitualmente com ferramentas como n8n. Para o momento atual do CRM, isso gera complexidade desnecessaria:

- mais risco de bug visual;
- mais dificuldade para o usuario entender;
- mais chance de quebrar fluxo que ja funciona;
- mais custo para testar;
- baixa relacao entre complexidade de UI e valor operacional imediato.

O usuario precisa configurar o pipeline de forma clara:

- criar pipeline;
- criar listas/etapas;
- ordenar listas;
- marcar etapas finais;
- definir regras simples entre pipelines;
- validar que tudo funciona antes de melhorar a interface.

## 3. Decisao de Produto

Criar o **Pipeline Builder V2** como uma nova experiencia de configuracao, mantendo o pipeline atual.

### O que nao muda

- Nao criar um novo modulo Pipeline V2.
- Nao trocar o kanban atual.
- Nao alterar a logica principal de cards sem necessidade.
- Nao quebrar tabelas existentes de pipelines, stages, leads, customers, orders ou organizations.
- Nao substituir o drag/drop operacional do pipeline.

### O que muda

- Nova camada de configuracao para o pipeline atual.
- Backend novo ou expandido para regras operacionais.
- Testes backend antes de qualquer tela nova.
- UI simples, baseada em formulario/listas/tabelas, nao em canvas.

## 4. Objetivos

1. Permitir criar, editar e ativar/desativar pipelines existentes.
2. Permitir criar, editar, ordenar e remover listas/etapas.
3. Permitir definir comportamento padrao de cada lista.
4. Permitir criar regras simples entre pipelines.
5. Garantir que regras sejam executadas quando um card entra em determinada etapa.
6. Preservar vinculos com organizacao, usuario, cliente, lead, pedido e pipeline.
7. Garantir isolamento por organizacao.
8. Garantir permissoes nas rotas de configuracao.
9. Implementar testes backend antes do frontend.
10. Entregar uma UI simples e operacional depois do backend validado.

## 5. Nao Objetivos

Estes itens ficam fora desta fase:

- fluxo visual tipo n8n;
- IA operando regras automaticamente;
- automacoes condicionais complexas com multiplos branches;
- editor visual de nodes;
- criacao de novo sistema de pipeline;
- substituicao do kanban atual;
- marketplace de automacoes;
- automacao multicanal fora do pipeline.

Esses pontos podem entrar em uma V3.

## 6. Referencias Open-Source e Conceituais

As referencias abaixo podem ser usadas para entender funcionalidades uteis, UX e modelagem de produto. Elas nao devem ser copiadas diretamente para dentro do Orion CRM sem avaliacao tecnica, licenca e compatibilidade arquitetural.

### 6.1 WeKan

Links:

- Site: https://wekan.fi/
- Repositorio: https://github.com/wekan/wekan
- Wiki: https://github.com/wekan/wekan/wiki

O que observar:

- regras/automacoes de board;
- modelo mental de triggers e actions;
- listas, cards, labels, membros e swimlanes;
- automacoes simples para usuarios nao tecnicos;
- configuracoes de board sem depender de canvas complexo.

Como aplicar no Orion:

- usar como referencia para o modelo "quando acontecer X, executar Y";
- criar regras simples entre pipelines;
- manter configuracao guiada e compreensivel para usuario operacional.

### 6.2 Kanboard

Links:

- Site: https://kanboard.org/
- Repositorio: https://github.com/kanboard/kanboard
- Documentacao: https://docs.kanboard.org/

O que observar:

- simplicidade de configuracao de projetos/boards;
- colunas, tarefas e limites de trabalho;
- automacoes internas;
- foco em fluxo operacional, nao em editor visual complexo.

Como aplicar no Orion:

- usar como referencia para Builder V2 simples;
- priorizar criacao/edicao de listas e regras claras;
- evitar excesso de UI antes do backend estar validado.

### 6.3 Planka

Links:

- Site: https://planka.cloud/
- Repositorio: https://github.com/plankanban/planka
- Docs: https://docs.planka.cloud/

O que observar:

- experiencia visual moderna de kanban;
- organizacao de boards, listas e cards;
- comportamento de UI mais limpo;
- realtime e experiencia colaborativa.

Como aplicar no Orion:

- usar como referencia visual para o futuro frontend;
- manter cards, listas e configuracoes com aparencia mais profissional;
- evitar o visual pesado e confuso do builder atual.

### 6.4 Focalboard

Links:

- Repositorio: https://github.com/mattermost-community/focalboard
- Mattermost Boards: https://mattermost.com/boards/

O que observar:

- boards, views e propriedades configuraveis;
- experiencia de cards com campos customizados;
- formas diferentes de visualizar o mesmo dado.

Como aplicar no Orion:

- usar como referencia para campos padrao por etapa;
- avaliar ideias de propriedades por card/lista;
- inspirar configuracoes futuras sem mexer no pipeline atual.

### 6.5 Taiga

Links:

- Site: https://taiga.io/
- Repositorio backend: https://github.com/taigaio/taiga-back
- Repositorio frontend: https://github.com/taigaio/taiga-front

O que observar:

- workflow de tarefas;
- permissao por projeto;
- estados e movimentacoes;
- estrutura de produto mais robusta.

Como aplicar no Orion:

- usar como referencia para permissoes e organizacao de fluxo;
- observar separacao entre backend, frontend e regras de negocio.

### 6.6 React Flow / XYFlow

Links:

- Site: https://xyflow.com/
- Repositorio: https://github.com/xyflow/xyflow
- Exemplos: https://reactflow.dev/examples

O que observar:

- editor visual de nodes;
- conexoes entre blocos;
- canvas de fluxo.

Como aplicar no Orion:

- manter como referencia para uma V3 visual;
- nao usar como base principal do Builder V2;
- o V2 deve ser formulario/lista/regras, nao canvas.

### 6.7 n8n

Links:

- Site: https://n8n.io/
- Repositorio: https://github.com/n8n-io/n8n
- Docs: https://docs.n8n.io/

O que observar:

- triggers;
- actions;
- execucoes;
- logs de automacao;
- idempotencia e historico de execucao.

Como aplicar no Orion:

- usar como referencia conceitual futura para V3;
- para V2, aproveitar apenas a ideia de regra/evento/acao;
- nao tentar recriar um n8n dentro do pipeline agora.

### 6.8 Activepieces

Links:

- Site: https://www.activepieces.com/
- Repositorio: https://github.com/activepieces/activepieces
- Docs: https://www.activepieces.com/docs

O que observar:

- automacoes simples guiadas;
- catalogo de actions;
- execucoes e historico;
- experiencia mais amigavel que editores muito tecnicos.

Como aplicar no Orion:

- referencia para futuro motor de automacao;
- nao entra como dependencia do Builder V2;
- pode inspirar logs e teste/simulacao de regra.

### 6.9 Bibliotecas de Drag and Drop

Links:

- dnd-kit: https://github.com/clauderic/dnd-kit
- Documentacao dnd-kit: https://dndkit.com/
- Pragmatic Drag and Drop: https://github.com/atlassian/pragmatic-drag-and-drop

O que observar:

- reordenacao de listas;
- drag/drop acessivel;
- interacoes previsiveis;
- alternativa moderna a libs antigas/depreciadas.

Como aplicar no Orion:

- usar apenas se o builder precisar de reordenacao mais robusta;
- evitar trocar o drag/drop do kanban atual sem necessidade;
- aplicar somente na UI do Builder V2, se fizer sentido.

Regra: nao copiar codigo de terceiros sem validar licenca, compatibilidade e necessidade tecnica. Preferir implementacao propria no dominio do Orion CRM.

## 7. Modelo Mental do Builder V2

O Builder V2 deve ter tres areas principais:

1. **Dados do pipeline**
   - nome;
   - descricao;
   - slug;
   - icone;
   - status ativo/inativo;
   - pipeline padrao ou nao.

2. **Listas/etapas do kanban**
   - nome da etapa;
   - cor;
   - ordem;
   - etapa inicial;
   - etapa de ganho;
   - etapa de perda;
   - SLA padrao;
   - responsavel padrao;
   - limite de cards, se aplicavel;
   - campos obrigatorios antes de mover para a etapa.

3. **Regras simples**
   - quando um card entrar em uma etapa X;
   - executar uma acao Y;
   - exemplo principal:
     - quando `Leads > Convertido`;
     - criar/espelhar card em `Producao > Novo`;
     - manter vinculo com o mesmo cliente/lead/pedido.

## 8. Funcionalidades do Backend

### 8.1 Pipeline

O backend deve suportar:

- listar pipelines da organizacao;
- criar pipeline;
- editar pipeline;
- ativar/desativar pipeline;
- validar slug unico por organizacao;
- impedir acesso cross-organization;
- aplicar permissoes por role.

### 8.2 Etapas/Listas

O backend deve suportar:

- listar etapas de um pipeline;
- criar etapa;
- editar etapa;
- remover etapa com validacao;
- reordenar etapas de forma transacional;
- marcar etapa como inicial;
- marcar etapa como ganho;
- marcar etapa como perda;
- impedir configuracoes invalidas.

Validacoes minimas:

- pipeline deve ter pelo menos uma etapa ativa;
- somente uma etapa inicial por pipeline;
- etapa de ganho e perda nao devem conflitar;
- nao remover etapa com cards ativos sem estrategia definida;
- nao permitir duplicidade de ordem;
- nao permitir duplicidade de nome dentro do mesmo pipeline se isso causar ambiguidade operacional.

### 8.3 Configuracoes Padrao de Etapa

Cada etapa pode ter configuracoes opcionais:

- SLA em minutos/horas/dias;
- responsavel padrao;
- limite maximo de cards;
- checklist padrao;
- campos obrigatorios para entrada;
- campos obrigatorios para saida;
- permissao minima para mover card para esta etapa.

Essas configuracoes devem ser persistidas e retornadas pela API, mesmo que parte delas so seja aplicada em fases posteriores.

### 8.4 Regras Entre Pipelines

Criar uma camada de regras simples, por exemplo `pipeline_automation_rules`.

Campos sugeridos:

- id;
- organization_id;
- source_pipeline_id;
- source_stage_id;
- trigger_event;
- action_type;
- target_pipeline_id;
- target_stage_id;
- link_strategy;
- is_active;
- created_by;
- updated_by;
- created_at;
- updated_at.

Eventos iniciais:

- `CARD_ENTERED_STAGE`

Acoes iniciais:

- `CREATE_LINKED_CARD`
- `MOVE_CARD_TO_PIPELINE`
- `MIRROR_CARD_TO_PIPELINE`

Estrategias de vinculo:

- manter mesmo `lead_id`;
- manter mesmo `customer_id`;
- manter mesmo `order_id`, quando existir;
- criar relacao tecnica entre card origem e card destino.

### 8.5 Execucao das Regras

Quando um card mudar de etapa, o backend deve:

1. validar organizacao e permissao;
2. persistir a mudanca do card;
3. identificar regras ativas para `source_pipeline_id + source_stage_id`;
4. executar regras de forma idempotente;
5. registrar resultado da execucao;
6. emitir evento para realtime, se ja existir suporte.

Idempotencia obrigatoria:

- a mesma mudanca de etapa nao pode criar cards duplicados indefinidamente;
- deve existir chave de idempotencia por evento/regra/card;
- a execucao deve ser segura contra retry.

### 8.6 Auditoria e Logs

Registrar:

- quem criou/editou pipeline;
- quem criou/editou etapa;
- quem criou/editou regra;
- quando uma regra executou;
- se executou com sucesso ou falha;
- mensagem de erro tecnica;
- id da entidade origem e destino.

## 9. API Proposta

Os nomes podem ser ajustados conforme padrao atual do backend.

### Pipeline Builder

- `GET /pipelines`
- `POST /pipelines`
- `GET /pipelines/:id`
- `PATCH /pipelines/:id`
- `POST /pipelines/:id/activate`
- `POST /pipelines/:id/deactivate`

### Stages

- `GET /pipelines/:id/stages`
- `POST /pipelines/:id/stages`
- `PATCH /pipelines/:id/stages/:stageId`
- `DELETE /pipelines/:id/stages/:stageId`
- `POST /pipelines/:id/stages/reorder`

### Stage Defaults

- `GET /pipelines/:id/stages/:stageId/defaults`
- `PATCH /pipelines/:id/stages/:stageId/defaults`

### Rules

- `GET /pipelines/:id/rules`
- `POST /pipelines/:id/rules`
- `PATCH /pipelines/:id/rules/:ruleId`
- `DELETE /pipelines/:id/rules/:ruleId`
- `POST /pipelines/:id/rules/:ruleId/test`

## 10. Permissoes

Regras minimas:

- ROOT: acesso total.
- ADMIN: pode criar/editar pipelines, stages e regras da organizacao.
- MANAGER: pode editar configuracoes operacionais se permitido.
- USER/OPERATOR: nao pode editar builder, apenas usar pipeline.

Todas as rotas devem validar:

- autenticacao;
- role;
- organization_id;
- ownership/escopo da entidade.

## 11. Banco de Dados

Antes de criar migrations, mapear tabelas atuais:

- pipelines;
- pipeline_stages;
- leads/cards;
- customers;
- orders;
- users;
- organizations;
- tabelas de auditoria/log, se existirem.

Novas tabelas candidatas:

1. `pipeline_stage_settings`
2. `pipeline_automation_rules`
3. `pipeline_rule_executions`
4. `pipeline_card_links`, se nao existir uma relacao adequada

O desenho final deve evitar duplicar informacao ja existente.

## 12. Fases de Implementacao

### Fase 0 — Mapeamento Obrigatorio

Entregavel:

- documento curto `PIPELINE_BUILDER_CURRENT_STATE.md`;
- tabelas existentes;
- endpoints existentes;
- actions frontend atuais;
- fluxo atual de criacao/edicao de pipeline;
- fluxo atual de movimentacao de card;
- riscos de quebra.

Nao avancar se houver duvida sobre onde o card muda de etapa hoje.

### Fase 1 — Backend de Pipeline e Etapas

Entregavel:

- consolidar endpoints necessarios para pipeline e etapas;
- corrigir validacoes ausentes;
- garantir transacao em reordenacao;
- garantir isolamento por organizacao;
- garantir permissoes.

Testes obrigatorios:

- criar pipeline;
- editar pipeline;
- criar etapa;
- editar etapa;
- reordenar etapas;
- remover etapa sem cards;
- bloquear remocao invalida;
- bloquear cross-organization;
- bloquear usuario sem permissao.

Gate:

- nao avancar para frontend se testes backend falharem.

### Fase 2 — Backend de Regras Simples

Entregavel:

- migration de regras;
- CRUD de regras;
- validacao de origem/destino;
- endpoint de teste/simulacao de regra.

Testes obrigatorios:

- criar regra `CARD_ENTERED_STAGE`;
- editar regra;
- desativar regra;
- impedir regra cross-organization;
- impedir regra com pipeline/stage inexistente;
- simular regra sem alterar dados reais.

Gate:

- nao avancar se regra puder ser criada com destino invalido.

### Fase 3 — Executor de Regras

Entregavel:

- executar regra quando card entra em etapa;
- criar/mover/espelhar card conforme configuracao;
- manter vinculos;
- idempotencia;
- log de execucao.

Testes obrigatorios:

- card entrando em etapa dispara regra;
- regra cria card no pipeline destino;
- regra preserva customer/lead/order quando aplicavel;
- retry nao cria duplicado;
- falha registra log;
- regra inativa nao executa.

Gate:

- nao avancar se houver duplicidade de card em retry.

### Fase 4 — Frontend do Builder V2

Entregavel:

- nova interface simples de configuracao;
- abas sugeridas:
  - Dados do pipeline;
  - Listas;
  - Regras;
  - Revisao/Publicacao;
- esconder ou rebaixar canvas atual para "Avancado", se necessario.

Requisitos de UI:

- nao usar canvas como fluxo principal;
- usar formularios claros;
- usar lista/tabela para etapas;
- usar construtor de regras em formato:
  - Quando `[pipeline] > [etapa]`
  - Entao `[acao]`
  - Em `[pipeline destino] > [etapa destino]`
- preview da regra antes de salvar;
- mensagens de erro claras;
- loading states;
- confirmacao em acoes destrutivas.

Testes obrigatorios:

- criar pipeline pela UI;
- criar etapa pela UI;
- reordenar etapa pela UI;
- criar regra pela UI;
- simular regra pela UI;
- validar responsividade basica desktop/tablet.

### Fase 5 — QA e Homologacao

Entregavel:

- checklist de homologacao;
- testes E2E principais;
- validacao com dados reais;
- lista de bugs P0/P1/P2;
- decisao de pronto para producao.

Fluxos de homologacao:

1. Criar pipeline novo.
2. Criar listas.
3. Marcar etapa de ganho/perda.
4. Criar regra entre pipelines.
5. Mover card para etapa gatilho.
6. Confirmar criacao/movimentacao no pipeline destino.
7. Confirmar vinculos com cliente/lead/pedido.
8. Repetir evento e confirmar que nao duplica.

## 13. Criterios de Aceite

O Builder V2 sera considerado aceito quando:

- backend de pipeline e etapas estiver coberto por testes;
- backend de regras estiver coberto por testes;
- regra simples entre pipelines funcionar em ambiente local/homologacao;
- idempotencia estiver validada;
- isolamento por organizacao estiver validado;
- permissao estiver validada;
- UI permitir configurar sem depender de canvas;
- usuario conseguir criar pipeline/listas/regras sem suporte tecnico;
- nenhum P0/P1 estiver aberto.

## 14. Riscos

### Risco 1 — Quebrar pipeline atual

Mitigacao:

- nao alterar fluxo de uso do kanban sem teste;
- criar regras como camada adicional;
- preservar APIs existentes quando possivel.

### Risco 2 — Criar cards duplicados

Mitigacao:

- idempotencia obrigatoria;
- tabela de execucao de regra;
- testes de retry.

### Risco 3 — Permissao incorreta

Mitigacao:

- testes com ROOT, ADMIN, MANAGER e USER;
- validar organization_id em todas as queries.

### Risco 4 — UI ficar complexa novamente

Mitigacao:

- sem canvas na configuracao principal;
- regra em formato guiado;
- esconder configuracoes avancadas.

## 15. Ordem Recomendada de Trabalho

1. Mapear estado atual.
2. Corrigir/solidificar backend de pipeline/stages.
3. Criar backend de regras.
4. Testar executor de regras.
5. Criar UI do Builder V2.
6. Rodar QA.
7. Homologar com fluxo real.

## 16. Prompt de Execucao para Agente

Antes de implementar qualquer frontend, execute:

1. Leia este PRD.
2. Mapeie o estado atual do pipeline.
3. Crie `PIPELINE_BUILDER_CURRENT_STATE.md`.
4. Implemente backend primeiro.
5. Rode testes backend.
6. So avance para frontend se nao houver P0/P1.

Regra principal:

> Nao refazer o pipeline atual. Criar apenas uma experiencia nova de builder/configuracao e uma camada segura de regras.
