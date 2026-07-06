# 🟢 TASK-001: Consolidar spec canonica da OS multi-pecas

## Status
Concluida

## Tipo
Docs

## Prioridade
Alta

## Project fields
- `Status`: `Done`
- `Type`: `Feature`
- `Priority`: `High`
- `Approval`: `Approved`
- `Labels`: `feature`

## Issue GitHub
Issue criada: `#8` — `https://github.com/guilhermedemorais-dev/ORION-CRM/issues/8`

## Branch sugerida
`chore/production-os-multi-piece-spec-consolidation`

## PR
Abrir PR somente se houver decisao de versionar o checkpoint documental isoladamente.

## Responsavel
Execucao: IA/dev
Revisao: humano/orquestrador

## Definition of Entry
- Specs de origem e mockup existentes e localizados.
- Task vinculada a uma issue do GitHub.
- Escopo limitado a consolidacao documental, sem codigo de produto.

## Definition of Exit
- Specs canonicas criadas/atualizadas em `docs/specs/`.
- Contradicoes e decisoes pendentes registradas.
- Resultado da execucao documentado na propria task.
- Task pronta para servir de base para a execucao tecnica seguinte.

## Objetivo da task
Migrar a feature de OS multi-pecas do estado atual em `docs/modules/production`
para a estrutura canonica nova de `docs/specs/` e `docs/tasks/`, definindo um
contrato claro antes de qualquer codigo.

## Contexto
Hoje a feature foi planejada de forma incremental e espalhada em spec de modulo,
mockup e conversa. O repo agora exige spec canonica em `docs/specs/` e task
executavel em `docs/tasks/` antes de implementar.

## Specs obrigatorias
- `docs/specs/production/os-multi-piece-proposal/module-spec.md`
- `docs/specs/production/os-multi-piece-proposal/page-spec.md`
- `docs/specs/production/os-multi-piece-proposal/validation-rules.md`

## Docs obrigatorios
- `docs/product/ORION-CRM-PRD-v1.2.md`
- `docs/product/ORION-BUILD-GUIDE.md`
- `docs/product/ORION-Fase0-PRD.md`
- `docs/modules/production/spec-os-attendance-integration.md`
- `docs/modules/production/spec-customer-material-custody.md`
- `docs/modules/production/spec-multi-piece-proposal-sales-flow.md`
- `docs/design/mockups/production/mockup-2026-06-15-os-multi-piece-proposal.html`

## Escopo
- Consolidar fluxo, UI e regras de negocio em specs canonicas.
- Identificar decisoes pendentes que bloqueiam implementacao.
- Preparar o terreno para futuras specs de `database.md` e `api.md`.

## Fora do escopo
- Implementacao em `apps/web` ou `apps/api`.
- Migrations, endpoints, contratos novos ou alteracoes de banco.
- Ajustes de permissao definitivos.

## Arquivos provaveis
- `docs/specs/production/os-multi-piece-proposal/module-spec.md`
- `docs/specs/production/os-multi-piece-proposal/page-spec.md`
- `docs/specs/production/os-multi-piece-proposal/validation-rules.md`
- `docs/tasks/TASK-001-production-os-multi-piece-spec-consolidation.md`

## Banco
N/A nesta task. Somente mapear necessidade futura.

## API/Backend
N/A nesta task. Somente mapear necessidade futura.

## Frontend/UI
N/A nesta task para implementacao. Apenas usar o mockup como referencia visual.

## Regras de negocio
- Validar RN-01 a RN-11 do `validation-rules.md`.

## Criterios de aceite
- Existe spec canonica nova da feature em `docs/specs/`.
- Existe task executavel ligada a essa spec.
- Fica explicito o que ainda depende de aprovacao humana antes de Banco/API.
- O material antigo em `docs/modules/production` passa a servir como referencia, nao como contrato principal.

## TDD / Testes obrigatorios
- Revisao documental cruzada entre:
  - spec atual em `docs/modules/production`
  - mockup atual
  - specs novas em `docs/specs/`
- Verificar ausencia de contradicao entre fluxo, UI e regras de negocio.

## Seguranca
- Marcar explicitamente a restricao de custo interno e margem.
- Marcar a necessidade de revisar credito/custodia por perfil.

## Observabilidade/logs
- Identificar eventos e auditorias esperados, sem implementar.

## Instrucao para IA/dev
- Nao tocar em `apps/web`, `apps/api` ou migrations.
- Nao criar `database.md` ou `api.md` antes de aprovacao humana.
- Nao transformar mockup em verdade de backend sem decisao expressa.
- Se houver contradicao entre mockup e regra de negocio, registrar em `Decisoes pendentes`.

## Checklist de execucao
- [x] Ler specs e docs obrigatorios.
- [x] Consolidar a spec canonica em `docs/specs/`.
- [x] Registrar regras e limites da feature sem implementar codigo.
- [x] Registrar decisoes pendentes e bloqueios reais.
- [x] Vincular a task a issue correspondente.
- [x] Escrever relatorio final nesta task.

## Prompt recomendado para IA executora
```text
Use Dev Workflow Standard e Dev Implementation Standard.

Execute somente esta task: TASK-001-production-os-multi-piece-spec-consolidation.
Antes de agir:
1. Leia integralmente esta task.
2. Leia todas as specs e docs obrigatorios citados nela.
3. Respeite o escopo e o fora de escopo.

Regras de execucao:
- Nao implemente codigo de produto.
- Nao altere Banco, API, migrations ou contratos.
- Registre contradicoes, lacunas e decisoes pendentes na documentacao.
- Ao concluir, atualize esta task com relatorio detalhado do que foi feito.

Fluxo obrigatorio:
1. Ler contexto
2. Consolidar documentacao
3. Validar consistencia entre spec, mockup e regras
4. Registrar resultado da execucao
```

## Resultado da execucao

### Resumo
Spec canônica da feature foi consolidada em `docs/specs/production/os-multi-piece-proposal/`.
O material anterior de `docs/modules/production` continua como referência de origem.
Implementação permanece bloqueada até aprovação humana e até a criação futura de
`database.md` e `api.md`, se confirmadas como necessárias.
As decisões mais recentes de fluxo e política comercial foram registradas na spec,
sem implementação de produto.

### Arquivos alterados
- `docs/specs/production/os-multi-piece-proposal/module-spec.md`
- `docs/specs/production/os-multi-piece-proposal/page-spec.md`
- `docs/specs/production/os-multi-piece-proposal/validation-rules.md`
- `docs/tasks/TASK-001-production-os-multi-piece-spec-consolidation.md`

### Comandos executados
- leitura de PRDs e READMEs obrigatórios do repositório
- inspeção das specs de `docs/modules/production/`
- inspeção do mockup `docs/design/mockups/production/mockup-2026-06-15-os-multi-piece-proposal.html`

### Resultado dos testes
Validação documental concluída, sem execução de testes de produto.
NAO VALIDADO em Banco, API/Backend e Frontend real, porque esta task não autoriza código.

### Bloqueios
- Aprovação humana das decisões pendentes da feature.
- Definição do contrato futuro entre proposta multi-peças, venda e produção.
- Definição do encaixe final da política global em `Ajustes`.
- Definição do ponto exato do fluxo onde desconto por usuário será aplicado.

### Observacoes
Esta task cumpre o Checkpoint 1 e prepara o Checkpoint 2.
Próxima etapa correta é detalhar impacto em Banco, API/Backend, Frontend/UI,
QA e Segurança sem ainda implementar código de produto.
Decisões já fechadas nesta rodada:
- preço da peça somente leitura no modal técnico
- custo oculto no modal técnico
- crédito visível para atendimento e gerente
- regra global de liberação para Produção por sinal mínimo
- sinal mínimo inicial de 50%
- política comercial por usuário limitada a desconto, sem override de pagamento
