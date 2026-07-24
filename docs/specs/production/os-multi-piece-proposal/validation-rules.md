# SPEC: Regras de validacao e de negocio

## Status
Rascunho

## Contexto
Feature `OS multi-pecas com proposta` iniciada a partir do Atendimento.

## Regras de negocio
- **RN-01:** uma OS tecnica pode conter uma ou mais pecas.
  - Condicao / gatilho: usuario adiciona pecas ao projeto.
  - Resultado esperado: cada peca tem materiais, valores e status proprios.
  - Excecoes: nenhuma nesta etapa.

- **RN-02:** categoria da peca vem do estoque do cliente.
  - Condicao / gatilho: preencher ficha tecnica da peca.
  - Resultado esperado: `Categoria` e dropdown; demais campos tecnicos sao texto.
  - Excecoes: categorias novas dependem do cadastro/base do estoque.

- **RN-03:** campos tecnicos nao sao obrigatorios por padrao.
  - Condicao / gatilho: salvar peca sem preencher todos os detalhes tecnicos.
  - Resultado esperado: a peca pode continuar em rascunho sem bloquear a edicao.
  - Excecoes: regras futuras podem exigir campos em categorias especificas, se aprovado.

- **RN-04:** materiais da peca sao obrigatorios para proposta.
  - Condicao / gatilho: usuario tenta gerar proposta.
  - Resultado esperado: toda peca da proposta precisa ter material/custodia selecionado.
  - Excecoes: nenhuma.

- **RN-05:** quantidade respeita a unidade do cadastro.
  - Condicao / gatilho: usuario ajusta quantidade do material.
  - Resultado esperado: a UI mostra unidade fixa e o usuario digita apenas o numero.
  - Excecoes: nenhuma.

- **RN-06:** custo interno e margem sao restritos.
  - Condicao / gatilho: tela e aberta por atendimento comum.
  - Resultado esperado: custo medio, custo unitario, custo total e margem ficam ocultos no modal tecnico.
  - Excecoes: nenhuma nesta primeira fase do fluxo tecnico.

- **RN-07:** custodia do cliente nao se mistura com estoque proprio.
  - Condicao / gatilho: selecionar ou cadastrar material do cliente.
  - Resultado esperado: a UI deixa clara a origem `Custodia · cliente`.
  - Excecoes: nenhuma.

- **RN-08:** preco da peca e somente leitura no modal tecnico.
  - Condicao / gatilho: usuario visualiza o valor comercial da peca.
  - Resultado esperado: o valor aparece como display visual, sem edicao direta.
  - Excecoes: nenhuma nesta etapa.

- **RN-09:** proposta so prepara Producao apos sinal minimo global.
  - Condicao / gatilho: proposta/pedido tenta avancar para Producao.
  - Resultado esperado: a liberacao depende da politica global definida em `Ajustes`.
  - Excecoes: nenhuma nesta primeira fase.

- **RN-10:** sinal minimo global inicial e 50%.
  - Condicao / gatilho: tenant sem configuracao customizada posterior.
  - Resultado esperado: a regra inicial considera 50% do valor da proposta/pedido.
  - Excecoes: alteracao administrativa futura em `Ajustes`.

- **RN-11:** permissao comercial por usuario controla desconto, nao override de pagamento.
  - Condicao / gatilho: configuracao de usuarios e politicas comerciais.
  - Resultado esperado: usuario pode ou nao conceder desconto conforme permissao e limite percentual.
  - Excecoes: nenhuma para override de pagamento nesta fase.

## Regras de validacao de entrada
- `Categoria`: obrigatoria apenas se a regra final de fluxo exigir; hoje permanece como campo visual importante.
- `Nome da peca`: pode ficar vazio no mockup/rascunho, mas o card precisa ter titulo fallback.
- `Quantidade do material`: formato numerico compativel com a unidade.
- `Preco da peca`: e calculado e somente leitura no modal tecnico.

## Mensagens
- Peca sem material: `Existe peca sem material selecionado. Selecione a materia-prima/material obrigatorio antes de gerar a proposta.`

## Camada de aplicacao
- **Banco:** N/A nesta etapa.
- **API/Backend:** validacao definitiva de materiais, unidade, credito, sinal minimo e permissao comercial de desconto.
- **Frontend/UI:** validacao imediata de peca sem material, ocultacao visual de custo e bloco de preco somente leitura.

## Casos de borda
- Projeto com varias pecas, mas uma delas sem material.
- Peca com custodia apenas, sem estoque proprio.
- Produto em `g` e produto em `un` no mesmo projeto.
- Perfil de atendimento visualizando proposta com credito, mas sem custo.
- Tentativa de avancar para Producao com pagamento abaixo de 50%.

## Testes
- Criar uma peca sem campos tecnicos e com material selecionado.
- Criar uma peca com campos tecnicos preenchidos e sem material.
- Tentar gerar proposta com peca sem material.
- Ajustar material em `g` digitando apenas o numero.
- Ajustar material em `un` digitando apenas o numero.
- Confirmar ocultacao de custo no mockup de atendimento.
- Confirmar que o preco da peca nao parece editavel no mockup.
- Confirmar bloqueio de avancar para Producao abaixo do sinal minimo configurado.

## Seguranca
- O backend continua como fonte de verdade de custo, credito e permissao.
- O frontend nao pode confiar em ocultacao visual como unica protecao.

## Riscos
- Misturar permissao visual com regra comercial definitiva.
- Tratar mockup como decisao de backend sem aprovacao.

## Decisoes pendentes
1. Se `Categoria` sera obrigatoria para salvar ou apenas para gerar proposta.
2. Onde a politica global de sinal minimo sera encaixada em `Ajustes`.
3. Em qual ponto do fluxo o desconto por usuario sera aplicado.

## Criterios de aceite
- As regras principais da feature ficam numeradas e rastreaveis.
- Fica claro o que e validado na UI e o que depende de backend.
