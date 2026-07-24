# MODULE SPEC: Producao / OS multi-pecas com proposta

> Spec e contrato do que deve ser construido. Nao e PR, nao e task.
> Deriva do PRD geral e consolida regras hoje espalhadas em `docs/modules/production/`.

## Status
Rascunho

## Product Spec relacionado
- `docs/product/ORION-CRM-PRD-v1.2.md`
- `docs/modules/production/spec-os-attendance-integration.md`
- `docs/modules/production/spec-customer-material-custody.md`

## Objetivo
Transformar a OS tecnica aberta a partir do Atendimento em um projeto com uma ou
mais pecas, capaz de consolidar materiais, custodia do cliente, perda estimada,
preco por peca e geracao de proposta antes de pagamento e liberacao para
Producao.

## Escopo incluido
- Modal de Atendimento com aba `Cotacao` para OS multi-pecas.
- Projeto/OS tecnica com varias pecas no mesmo atendimento.
- Selecionar materiais do estoque por peca.
- Vincular material do cliente em custodia por peca.
- Gerar proposta consolidada a partir das pecas validas.
- Preparar a futura conversao `Proposta -> Venda -> Producao`.

## Fora de escopo
- Implementacao de banco, API ou UI nesta etapa documental.
- Reestruturacao do PDV alem do necessario para definir o fluxo.
- Implementacao da aba Propostas estruturada.
- Implementacao da ordem de Producao final.
- Tela administrativa de permissao/perfil.

## Paginas/telas previstas
- Modal de Atendimento / aba `Cotacao` da OS multi-pecas.
- Aba Propostas do cliente.
- Carrinho lateral do PDV originado da proposta.

## Componentes compartilhados
- Card de peca dentro da OS.
- Resumo fixo da proposta no rodape interno do modal.
- Bloco de materiais da peca com origem `Estoque proprio` e `Custodia`.

## Regras de negocio do modulo
- O fluxo e `Atendimento -> OS tecnica -> Proposta -> pagamento -> Producao`.
- Uma OS tecnica pode conter varias pecas.
- `Categoria` e o unico dropdown da ficha tecnica da peca.
- Demais especificacoes tecnicas sao digitaveis.
- Campos tecnicos digitaveis nao sao obrigatorios por padrao.
- Selecionar materiais/materias-primas da peca e obrigatorio para cotacao.
- Quantidade de material respeita a unidade do cadastro do estoque.
- O preco da peca e calculado automaticamente e exibido como leitura no modal tecnico.
- O total da proposta e calculado no proprio modal a partir das pecas validas.
- Custos internos e margem nao aparecem no modal tecnico nesta primeira fase.
- O credito do material do cliente aparece no fluxo de cotacao para atendimento e gerente.
- A liberacao para Producao depende de regra global em `Ajustes`.
- Regra inicial de liberacao: sinal minimo de 50%.
- Nao existe excecao manual para liberar Producao fora da regra nesta primeira fase.
- A politica comercial por usuario cobre permissao de desconto e limite percentual de desconto.
- A proposta consolida as pecas sem perder rastreabilidade por peca.
- Esta feature termina ao registrar a proposta na aba `Propostas` da ficha do cliente.
- A experiencia posterior da proposta, incluindo envio, impressao, PDF, WhatsApp,
  e-mail e `Finalizar venda`, pertence a uma proxima etapa de especificacao.

## Banco
Nao aprovado nesta etapa. Ha impacto esperado porque o modelo atual de
`service_orders` e `service_order_materials` trata a OS como item unico.
Detalhar depois em `database.md` somente apos aprovacao humana.

## API/Backend
Nao aprovado nesta etapa. O contrato atual ainda precisa ser revisado para
suportar pecas, materiais por peca, proposta versionada e conversao para venda.
Detalhar depois em `api.md` somente apos aprovacao humana. A spec futura precisa
prever:
- configuracao global de `regra_liberacao_producao`
- configuracao global de `percentual_minimo_sinal_producao`
- politica comercial por usuario com permissao e limite de desconto

## Frontend/UI
- Mockup atual: `docs/design/mockups/production/mockup-2026-06-15-os-multi-piece-proposal.html`
- A aba `Cotacao` concentra projeto, pecas, materiais e proposta.
- A aba `Anotacoes e fotos` continua pertencendo ao atendimento e nao deve ser
  confundida com a etapa de proposta.
- O resumo comercial e de pecas fica fixo acima do rodape do modal.
- O card da peca precisa distinguir informacao opcional, material obrigatorio e
  preco de leitura.

## Testes
- Fluxo com uma peca e varias pecas.
- Peca sem material nao gera proposta.
- Quantidade de material respeita unidade do estoque.
- Custodia do cliente permanece separada do estoque proprio.
- Precos, creditos e totais ficam consistentes entre peca e resumo.

## Seguranca
- Custos internos e margem nao devem aparecer no modal tecnico para nenhum perfil nesta primeira fase.
- Custodia do cliente e dado sensivel operacional e exige auditoria.
- O backend continua como fonte de verdade para preco, credito e materiais.

## Observabilidade/logs
- Auditoria de criacao/edicao/remocao de peca.
- Auditoria de vinculo e alteracao de material/custodia.
- Eventos para `proposal_generated`, `proposal_versioned`,
  `proposal_converted_to_sale`.

## Dependencias
- Atendimento / pipeline real do lead.
- Estoque.
- Custodia do cliente.
- Propostas.
- PDV.

## Riscos
- Misturar regra de mockup com regra definitiva de banco/API.
- Duplicar contratos entre Atendimento, OS, Proposta e PDV.
- Expor custo interno para perfis errados.
- Codar antes de fechar as decisoes de fluxo e permissao.

## Decisoes pendentes
1. Se a proposta multi-pecas sera uma entidade nova ou extensao da estrutura atual.
2. Se a Producao nasce por peca ou por projeto com subitens.
3. Em qual area exata de `Ajustes` a politica global de liberacao sera encaixada no produto final.
4. Em qual etapa comercial o desconto por usuario sera aplicado e validado no fluxo real.
5. Como sera a especificacao funcional completa da aba `Propostas` depois do registro inicial.

## Criterios de aceite
- A feature passa a ter spec canonica propria em `docs/specs/`.
- O fluxo macro, regras visuais e regras de negocio principais ficam consolidados.
- Fica claro o que depende de aprovacao antes de Banco/API.
- Existe task executavel ligada a esta spec antes de qualquer codigo.

## Hipoteses
- HIPOTESE: o mockup atual e base suficiente para a primeira rodada de consolidacao.
- HIPOTESE: `docs/modules/production/*.md` vira material de referencia, nao contrato final.
