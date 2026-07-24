# SPEC: Modal de Atendimento / aba Cotacao da OS multi-pecas

> Spec e contrato da tela/fluxo visual. Nao e PR, nao e task.

## Objetivo
Permitir que o atendente monte uma OS tecnica com varias pecas dentro do mesmo
atendimento, selecione materiais por peca, vincule custodia do cliente e gere
uma proposta consolidada antes de pagamento e Producao.

## Usuario alvo
- Atendimento / vendedor
- Gerente

O comportamento visual pode variar por permissao, principalmente em custo,
credito e acoes comerciais.

## Fluxo principal
1. Usuario abre Atendimento ou `Nova OS`.
2. Vai para a aba `Cotacao`.
3. Preenche dados do projeto e adiciona uma ou mais pecas.
4. Para cada peca, registra ficha tecnica e materiais obrigatorios.
5. Opcionalmente vincula custodia do cliente.
6. O sistema consolida pecas no resumo fixo.
7. Usuario gera proposta.

## Layout esperado
- Referencia visual: `docs/design/mockups/production/mockup-2026-06-15-os-multi-piece-proposal.html`
- A aba `Cotacao` nao deve criar caixas redundantes.
- Cada peca aparece como card expansivel.
- O resumo de pecas e o resumo comercial ficam fixos acima do rodape do modal.
- O rodape final do modal contem apenas acoes.

## Componentes obrigatorios
- Cabecalho do projeto: nome, prazo, responsavel.
- Aba `Anotacoes e fotos` com editor rico e area de anexos/fotos.
- Lista de pecas com status visual.
- Card de materiais da peca.
- Bloco de custodia da peca.
- Resumo fixo de pecas anexadas.
- Resumo comercial fixo.
- Alerta de peca sem material.

## Estados da tela
- Loading: carregando dados do estoque/custodia.
- Vazio: nenhuma peca adicionada.
- Com dados: uma ou mais pecas.
- Erro: falha na busca de materiais.
- Sem permissao: custo/credito ocultos para perfis sem acesso.
- Sucesso: proposta pronta para gerar.

## Regras de negocio
- Categoria e o unico dropdown da ficha tecnica da peca.
- Metal, acabamento, cor/banho, cravacao, gravacao e demais campos tecnicos sao digitaveis.
- Campos tecnicos podem ficar vazios sem bloquear a cotacao.
- Material da peca e obrigatorio para gerar proposta.
- Quantidade usa unidade fixa do produto (`g`, `un`, `ct`, etc.) e o usuario digita apenas o numero.
- O preco da peca e calculado automaticamente e aparece como leitura, sem campo editavel.
- O total da proposta e calculado no proprio modal.
- Custos internos, custo medio, margem e derivados de custo nao aparecem no modal tecnico nesta primeira fase.
- O credito do material do cliente aparece na cotacao para atendimento e gerente.

## Validacoes
- Impedir gerar proposta se existir peca sem material selecionado.
- Validar quantidade de material conforme unidade do cadastro.
- Impedir que a mesma peca pareca `Pronta para proposta` sem material.
- Garantir consistencia entre cards de pecas e resumo fixo.

## Navegacao
- Entrada por Atendimento.
- Entrada por botao azul `Nova OS`.
- Saida por `Gerar Proposta`.
- Ao gerar proposta, o fluxo desta feature termina com o registro da proposta na
  aba `Propostas` da ficha do cliente.
- O comportamento interno da aba `Propostas`, incluindo abrir, enviar por PDF,
  enviar por e-mail, enviar por WhatsApp, imprimir ou `Finalizar venda`, fica
  explicitamente para uma proxima etapa de produto.

## Regras dos botoes do modal
- Aba `Anotacoes e fotos`:
  - botoes de formatacao (`negrito`, `italico`, `sublinhado`, listas, mencao e gravacao`) pertencem somente ao contexto de anotacao do atendimento.
  - area de fotos/anexos pertence somente ao contexto de anotacao do atendimento.
  - o botao `Salvar anotacoes` salva o rascunho do atendimento, sem gerar proposta.
  - o botao `Ir para cotacao` apenas muda da aba de anotacoes para a aba tecnica/comercial.
- Aba `Cotacao`:
  - o botao `Salvar cotacao` salva o rascunho tecnico/comercial sem gerar proposta.
  - o botao `Gerar Proposta` encerra a responsabilidade deste modal e registra a proposta na aba `Propostas`.
  - nenhum botao deste modal deve assumir comportamento de envio de proposta, impressao, PDF, WhatsApp, e-mail ou finalizacao de venda.
- Botoes internos da peca:
  - adicionar/remover/duplicar/recolher peca pertencem apenas ao escopo de montagem tecnica do projeto.
  - adicionar material do estoque e adicionar material em custodia pertencem apenas ao escopo tecnico da OS.
  - qualquer botao sem regra fechada de negocio deve ser tratado como fora de escopo desta entrega e nao pode ganhar comportamento inventado.

## Banco
N/A nesta etapa documental.

## API/Backend
N/A nesta etapa documental.

## Frontend/UI
- Seguir `docs/design/design-system/ORION-DESIGN-SYSTEM.html`.
- Nao expor custo medio, custo total, custo estimado ou margem no modal tecnico.
- Diferenciar claramente `Estoque proprio · loja` e `Custodia · cliente`.
- Preco da peca nao pode parecer editavel nesse ponto do fluxo.
- O bloco de preco deve ser visual de leitura, sem cursor de texto, foco ou semantica de input.

## Seguranca
- Custo interno nao aparece no modal tecnico nesta primeira fase.
- Credito do material do cliente e visivel para atendimento e gerente nesta etapa.

## Observabilidade/logs
- Eventos de adicionar/remover peca.
- Eventos de adicionar/remover material.
- Evento de tentativa de gerar proposta com peca invalida.

## Criterios de aceite
- A tela tem contrato visual explicito e reaproveitavel.
- Fica claro o que e opcional, obrigatorio e restrito por permissao.
- O resumo fixo acima dos botoes permanece parte do contrato visual.

## Fora do escopo
- Implementar a tela real em React.
- Implementar permissao real por perfil.
- Implementar persistencia.
- Implementar a experiencia detalhada da aba `Propostas` apos o registro inicial.

## Decisoes pendentes
1. O resumo fixo deve aparecer sempre ou apenas quando houver ao menos uma peca valida.
2. Em qual momento a UI comercial aplicara desconto por usuario fora do modal tecnico.
3. Onde a regra global de sinal minimo sera exposta dentro de `Ajustes`.
4. Como sera a UX completa da proposta na aba `Propostas` apos a geracao inicial.
