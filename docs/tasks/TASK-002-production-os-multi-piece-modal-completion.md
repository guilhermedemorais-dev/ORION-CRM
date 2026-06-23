# TASK-002: Concluir modal de OS multi-pecas no Atendimento

## Status
A fazer

## Tipo
Frontend/UI

## Prioridade
Alta

## Issue GitHub
Issue criada: `#9` — `https://github.com/guilhermedemorais-dev/ORION-CRM/issues/9`

## Branch sugerida
`feat/attendance-os-multi-piece-modal`

## PR
Obrigatorio. Nao aprovar sem evidencias visuais e checklist validado.

## Responsavel
Execucao: dev implementador
Revisao: humano/orquestrador

## Objetivo da task
Concluir a construcao do modal de OS tecnica multi-pecas dentro do fluxo de
Atendimento, substituindo o comportamento atual de OS unica por uma experiencia
alinhada ao mockup e as regras fechadas na spec.

## Specs obrigatorias
- `docs/specs/production/os-multi-piece-proposal/module-spec.md`
- `docs/specs/production/os-multi-piece-proposal/page-spec.md`
- `docs/specs/production/os-multi-piece-proposal/validation-rules.md`

## Docs obrigatorios
- `docs/design/mockups/production/mockup-2026-06-15-os-multi-piece-proposal.html`
- `docs/modules/production/spec-os-attendance-integration.md`
- `docs/modules/production/spec-multi-piece-proposal-sales-flow.md`

## Arquivos e modulos permitidos
- `apps/web/app/(crm)/clientes/[id]/components/attendance/AttendancePopup.tsx`
- `apps/web/app/(crm)/clientes/[id]/components/os/ServiceOrderModal.tsx`
- Componentes auxiliares diretamente ligados a esse modal, se a implementacao exigir

## Fora do escopo
- Criar migrations
- Criar endpoints novos
- Implementar politica global em `Ajustes`
- Implementar permissao comercial por usuario
- Implementar aba Propostas completa
- Implementar envio de proposta por PDF, e-mail, WhatsApp ou impressao
- Implementar botao `Finalizar venda`
- Implementar carrinho lateral do PDV
- Implementar ordem de Producao final
- Alterar contratos de backend sem justificativa formal em nova spec/task

## Estado atual encontrado
- O modal real atual esta concentrado em `ServiceOrderModal.tsx`.
- O modal atual ainda segue modelo de OS unica, com `product_name`, `metal`, `stone`,
  `ring_size`, `weight`, `notes`, materiais e mao de obra.
- O fluxo de abertura acontece a partir de `AttendancePopup.tsx`.
- O modal atual ainda expoe referencias de preco/custo de material na UI e ainda
  nao esta estruturado como projeto com varias pecas no mesmo atendimento.

## Resultado esperado
- O modal passa a operar como **projeto com multiplas pecas** dentro do mesmo atendimento.
- Cada peca tem sua propria ficha tecnica e seu proprio bloco de materiais.
- O usuario pode adicionar mais de uma peca no mesmo modal.
- O preco da peca aparece como **somente leitura**.
- O custo nao aparece no modal tecnico.
- O total da proposta e consolidado no proprio modal.
- O modal segue a estrutura aprovada no mockup.
- Ao clicar em `Gerar Proposta`, o fluxo desta task termina no registro da proposta
  na aba `Propostas` da ficha do cliente, sem detalhar ainda a UX posterior dessa aba.

## Regras obrigatorias da implementacao
- O fluxo continua sendo `Atendimento -> OS tecnica -> Proposta`.
- `Categoria` e o unico dropdown tecnico da peca.
- Demais campos tecnicos sao digitaveis e nao obrigatorios por padrao.
- Material da peca e obrigatorio para gerar proposta.
- Quantidade de material respeita unidade fixa do cadastro e aceita somente numero.
- Preco da peca nao pode ser editavel nesse modal.
- Custo, margem, custo medio, custo unitario e custo total nao devem aparecer.
- Credito do material do cliente pode aparecer para atendimento e gerente.
- O modal precisa preservar compatibilidade visual e operacional com abertura via
  `AttendancePopup` e pelo fluxo que substitui o modal antigo da OS.
- Nenhum botao do modal pode ganhar comportamento comercial futuro nao especificado.
- Os botoes da aba de anotacoes pertencem ao atendimento, nao a proposta.
- `Gerar Proposta` nao deve assumir comportamento de enviar, imprimir, compartilhar
  ou finalizar venda.

## Passos de implementacao
1. Refatorar o estado do modal para suportar **projeto** com lista de pecas, em vez
   de formulario unico de uma unica joia.
2. Criar estrutura visual de card de peca expansivel, com:
   - identificador da peca
   - nome/titulo
   - ficha tecnica
   - bloco de materiais
   - bloco de custodia
   - bloco de preco visual
3. Implementar acao de adicionar nova peca no mesmo modal.
4. Implementar resumo fixo interno com:
   - pecas anexadas
   - subtotal das pecas
   - credito material cliente
   - total da proposta
5. Ajustar o bloco de materiais para:
   - separar `Estoque proprio · loja` e `Custodia · cliente`
   - ocultar qualquer custo
   - manter quantidade coerente com unidade
6. Ajustar o bloco de preco para:
   - remover semantica de input editavel
   - manter valor destacado como leitura
7. Garantir que o botao de gerar proposta fique condicionado a existencia de
   ao menos uma peca valida com material obrigatorio definido.
8. Preservar o comportamento do modal de Atendimento sem quebrar o gatilho atual
   de abertura da OS.
9. Definir explicitamente na implementacao os comportamentos dos botoes que ja
   existem no modal, sem deixar acao ambigua ou placeholder silencioso.

## Testes obrigatorios
- Abrir modal a partir do `AttendancePopup`.
- Adicionar 1 peca e preencher materiais.
- Adicionar 2 ou mais pecas no mesmo projeto.
- Confirmar que o preco da peca aparece como leitura, sem `input` editavel.
- Confirmar que custo nao aparece em nenhum ponto do modal tecnico.
- Confirmar que peca sem material nao permite gerar proposta.
- Confirmar que quantidade de material segue unidade fixa.
- Confirmar que custodia aparece separada de estoque proprio.
- Confirmar que o resumo final consolida as pecas corretamente.
- Confirmar que o fluxo atual de abertura/fechamento do modal nao quebra.

## Evidencias esperadas no PR
- Video curto ou capturas do modal com:
  - 1 peca
  - 2 pecas
  - bloco de custodia
  - resumo final
- Checklist manual dos testes obrigatorios
- Referencia explicita a esta task e as specs obrigatorias

## Criterios de aceite
- O modal real reproduz o fluxo multi-pecas aprovado.
- O modal nao expoe custo.
- O preco da peca e somente leitura.
- O usuario consegue montar mais de uma peca no mesmo projeto.
- O resumo final consolida pecas e proposta.
- O fluxo atual de Atendimento nao quebra.
- O limite da feature fica respeitado no ponto `Gerar Proposta`, sem inventar
  comportamento da aba `Propostas`.

## Banco
Nao alterar nesta task.

## API/Backend
Nao alterar contratos nesta task, salvo ajuste estritamente necessario para nao
expor custo na resposta usada pelo modal. Se isso for necessario, parar e abrir
ajuste de spec/task antes de continuar.

## Frontend/UI
Task principal desta entrega.

## Validacao
Obrigatoria via checklist manual e evidencia visual.

## Riscos/Lacunas
- O backend atual de `service_orders` ainda esta modelado como OS unica.
- Pode haver tensao entre mockup multi-pecas e payload atual do modal.
- Se o frontend depender de contrato novo para persistencia multi-pecas, esta
  task deve parar e devolver a lacuna formalmente em vez de inventar payload.
