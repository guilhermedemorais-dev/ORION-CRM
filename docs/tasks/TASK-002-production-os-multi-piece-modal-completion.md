# 🟡 TASK-002: Concluir modal de OS multi-pecas no Atendimento

## Status
Em andamento (frontend com estado local; specs database.md/api.md definem o contrato;
persistencia real depende da TASK-005 backend). Issue #9.

## Tipo
Frontend/UI

## Prioridade
Alta

## Estimativa
- Analise tecnica e mapeamento da implementacao atual: `0,5 dia`
- Refatoracao do estado para projeto com multiplas pecas: `1,0 a 1,5 dia`
- Montagem da UI multi-pecas e blocos por peca: `1,0 a 1,5 dia`
- Ajustes de materiais, custodia e regras visuais de preco: `0,5 a 1,0 dia`
- Validacao manual, evidencias e acabamento final: `0,5 dia`
- Estimativa total: `3,5 a 5,0 dias uteis`

## Janela de entrega sugerida
- Melhor caso: `3,5 dias uteis`
- Faixa realista: `4 a 5 dias uteis`
- Considera que nao sera necessario alterar contrato de backend

## Project fields
- `Status`: `Ready for Dev`
- `Type`: `Feature`
- `Priority`: `High`
- `Approval`: `Approved`
- `Labels`: `feature`

## Issue GitHub
Issue criada: `#9` — `https://github.com/guilhermedemorais-dev/ORION-CRM/issues/9`

## Branch sugerida
`feat/attendance-os-multi-piece-modal`

## PR
Obrigatorio. Nao aprovar sem evidencias visuais e checklist validado.

## Responsavel
Execucao: dev implementador
Revisao: humano/orquestrador

## Definition of Entry
- Spec canonica aprovada e localizada em `docs/specs/production/os-multi-piece-proposal/`.
- Mockup de referencia existente.
- Task vinculada a issue do GitHub.
- Escopo restrito ao modal e seus componentes auxiliares diretos.

## Definition of Exit
- Modal multi-pecas funcional no fluxo de Atendimento.
- Preco da peca em leitura apenas.
- Custos ocultos no modal tecnico.
- Evidencias visuais e checklist manual anexados no PR.
- Lacunas de backend, se existirem, devolvidas formalmente sem invencao de contrato.

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

## Dependencias
- `TASK-001-production-os-multi-piece-spec-consolidation`
- Specs canonicas da feature em `docs/specs/production/os-multi-piece-proposal/`

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

## Checklist de execucao
- [ ] Ler integralmente esta task e as specs obrigatorias.
- [ ] Confirmar Definition of Entry antes de codar.
- [ ] Mapear o estado atual de `AttendancePopup.tsx` e `ServiceOrderModal.tsx`.
- [ ] Implementar suporte a projeto com multiplas pecas.
- [ ] Implementar ficha tecnica por peca com categoria como unico dropdown tecnico.
- [ ] Implementar selecao obrigatoria de materiais por peca.
- [ ] Separar claramente `Estoque proprio · loja` e `Custodia · cliente`.
- [ ] Remover semantica de edicao do preco da peca.
- [ ] Remover exposicao de custo no modal tecnico.
- [ ] Validar o fluxo `Atendimento -> OS tecnica -> Proposta`.
- [ ] Executar checklist manual dos testes obrigatorios.
- [ ] Anexar evidencias visuais no PR.
- [ ] Atualizar esta task com relatorio final detalhado.

## Prompt recomendado para IA executora
```text
Use Dev Workflow Standard e Dev Implementation Standard.

Execute somente esta task: TASK-002-production-os-multi-piece-modal-completion.
Antes de agir:
1. Leia integralmente esta task.
2. Leia todas as specs e docs obrigatorios citados nela.
3. Mapeie os arquivos permitidos antes de editar.

Regras obrigatorias:
- Nao sair do escopo desta task.
- Nao criar migrations, endpoints ou contratos novos sem devolver a lacuna.
- Nao expor custo, margem ou custo medio no modal tecnico.
- Tratar o preco da peca como leitura apenas.
- Seguir TDD na pratica: implementar, validar, registrar evidencias e corrigir.

Fluxo de execucao:
1. Ler task e specs
2. Mapear implementacao atual
3. Implementar incrementalmente
4. Validar com testes/checklist
5. Registrar relatorio final nesta task

Ao final:
- Atualize o status desta task
- Escreva relatorio detalhado do que foi feito
- Liste arquivos alterados
- Liste testes executados
- Liste bloqueios ou riscos remanescentes
```

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

## Template de relatorio final
### Resumo
Descreva objetivamente o que foi entregue.

### Arquivos alterados
- Liste os arquivos reais alterados

### Testes executados
- Liste testes manuais e automatizados executados

### Evidencias
- Liste capturas, videos ou links do PR

### Bloqueios ou riscos remanescentes
- Liste o que ficou pendente ou exige nova task

---

## Resultado da execucao (2026-07-06)

### Diagnostico
- Confirmado que a TASK-002 estava **no marco zero**: `ServiceOrderModal.tsx` ainda
  segue modelo de OS unica (`product_name`, `metal`, `stone`, `ring_size`, `weight`),
  sem nenhuma estrutura de projeto/multi-peca. O WIP nao-commitado deixado pelo dev
  anterior era de outra frente (integracao OS/Atendimento/Producao + governanca), nao
  do modal multi-peca. Esse WIP foi isolado no commit de checkpoint `a0fba1b`.
- Definition of Entry validada: as 3 specs, o mockup e os 3 docs de modulo existem;
  TASK-001 concluida; issue #9 vinculada.

### Bloqueio (lacuna de backend devolvida)
A task nao pode ser concluida como escrita sem alterar contrato de backend, o que a
propria secao `Riscos/Lacunas` proibe ("devolver a lacuna em vez de inventar payload").
Evidencias nas specs obrigatorias:
- `module-spec.md > Banco`: "Nao aprovado nesta etapa. Modelo atual de `service_orders`
  e `service_order_materials` trata a OS como item unico."
- `module-spec.md > API/Backend`: "Nao aprovado nesta etapa. Contrato atual precisa ser
  revisado para suportar pecas, materiais por peca, proposta versionada."
- `module-spec.md > Decisoes pendentes #1`: modelo da proposta multi-peca (entidade nova
  vs extensao) ainda **nao decidido**.
- `page-spec.md > Fora do escopo`: "Implementar persistencia."
- Conflito: a task manda terminar "no registro da proposta na aba Propostas", mas isso e
  persistencia sem contrato aprovado. O preco por peca tambem depende do backend como
  fonte de verdade e nao tem contrato multi-peca.

### O que e necessario para desbloquear (devolvido ao orquestrador / sdd-spec-factory)
1. Aprovar e especificar `database.md` + `api.md` da feature multi-peca: modelo de peca,
   materiais por peca, custodia por peca, proposta (entidade/versao), calculo de preco.
2. Fechar as decisoes pendentes bloqueantes: module-spec #1 e #2; page-spec #1.
3. Reescopar a TASK-002 apos o contrato existir, OU autorizar formalmente uma entrega
   **frontend-only** (estado local, sem persistencia real) com a lacuna de backend
   documentada e `Gerar Proposta` parando na fronteira de persistencia.

### Arquivos alterados
- Nenhum arquivo de produto alterado (bloqueio antes de codar).
- `docs/tasks/TASK-002-*.md`: status -> Bloqueada + este relatorio.

### Testes executados
- Nenhum (implementacao nao iniciada por bloqueio de contrato).

---

## Resultado da execucao (2026-07-07) — frontend implementado

### Resumo
`ServiceOrderModal.tsx` reescrito de OS unica para **projeto multi-peca** com estado local,
seguindo page-spec/validation-rules/api.md:
- Cabecalho do projeto (nome, prazo, responsavel) + abas `Anotacoes e fotos` / `Cotacao`.
- Lista de pecas como cards expansiveis; adicionar/remover/duplicar/recolher peca.
- Ficha tecnica por peca com `Categoria` como unico dropdown; demais campos digitaveis e opcionais (RN-02/03).
- Bloco de materiais por peca separando `ESTOQUE · LOJA` (busca em `/api/internal/products`,
  `is_raw_material`) e `CUSTODIA · CLIENTE` (rotulo manual; subsistema de custodia ainda inexistente).
- Preco por peca e total como **somente leitura** (RN-08); custo/margem nunca exibidos (RN-06).
- Resumo fixo (sticky) com pecas anexadas, subtotal, credito do cliente e total da proposta.
- `Gerar Proposta` habilitado so com >=1 peca e nenhuma peca sem material (RN-04); posta no
  contrato de `api.md` (`POST /api/internal/proposals`).
- Props preservadas -> abertura via `AttendancePopup` (embedded) intacta.

### Arquivos alterados
- `apps/web/app/(crm)/clientes/[id]/components/os/ServiceOrderModal.tsx` (reescrito).

### Testes executados
- `npx tsc --noEmit` no `apps/web`: **0 erros** (projeto inteiro; modal e AttendancePopup limpos).

### Pendencias para fechar a task (nao concluida)
- **Backend (TASK-005):** endpoints de `api.md` nao existem; `Gerar Proposta` so persiste apos eles.
- **Preco real:** hoje o modal calcula preview local (qtd x preco unitario); o backend deve ser
  a fonte de verdade do preco (regra de precificacao — decisao pendente em `api.md`).
- **Custodia:** entra como rotulo manual ate `customer_material_custody` existir.
- **Evidencias visuais:** faltam capturas/video (exigem app rodando) e QA visual do `ui-ux-standard`.

### Status
Frontend pronto e typecheck limpo; task segue `Em andamento` ate backend (TASK-005), evidencia
visual e QA do ui-ux-standard.
