# TASK-063: Refazer governança documental com uso obrigatório de plugins

## Status visual

- Status visual: Em andamento
- Status Kanban: In Progress
- Responsável: Codex, com aprovação final do responsável do projeto
- Issue criada / vinculada: [#64](https://github.com/guilhermedemorais-dev/ORION-CRM/issues/64)
- Branch sugerida: `docs/plugin-governance-enforcement`
- Executor LLM primário: Codex
- Executor secundário/revisor: `dev-workflow-standard`
- Modo de handoff: execução documental isolada
- Status da claim: claimed
- `locked_paths`: `AGENTS.md`, `docs/README.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `docs/specs/workflow/plugin-governance-enforcement/**`, `docs/tasks/TASK-063-plugin-governance-documentation.md`, documentação de entrega estritamente necessária
- Conflitos conhecidos: WIP local amplo fora destes caminhos
- Labels sugeridas: `docs`, `workflow`, `governance`

## Tipo

Docs / Governança

## Objetivo

Refazer a documentação de entrega sob uso obrigatório, registrado e verificável
do Dev Workflow, removendo a ambiguidade que permitiu tratar documentação e Git
como exceções.

## Specs obrigatórias

- `docs/specs/workflow/plugin-governance-enforcement/module-spec.md`
- `docs/specs/workflow/plugin-governance-enforcement/validation-rules.md`

## Arquivos permitidos

Somente os `locked_paths` desta task e documentos ativos estritamente
necessários para corrigir inconsistências de entrega.

## Fora do escopo

Código de produto, banco, API, UI, deploy, PRDs canônicos e WIP não relacionado.

## Registro de plugins

- dev-workflow-v2: INVOCADO | estado, fonte de verdade, Issue e worktree remoto verificados
- dev-workflow-standard: INVOCADO | escopo somente documental, sem produto
- sdd-spec-factory: INVOCADO | spec e task desta entrega
- dev-implementation-standard: N/A | não há código de produto
- ui-ux-standard: N/A | não há UI de produto
- security-standard: N/A | não há alteração de superfície de segurança

## Checklist de execução

1. Validar Issue, branch, referência remota e `locked_paths`.
2. Atualizar o contrato de governança.
3. Revisar documentação ativa de entrega, termos e diagramas.
4. Validar Markdown, Mermaid, links e ausência de termos proibidos.
5. Validar o conteúdo publicado na referência remota alvo.
6. Atualizar a Issue com evidências e aguardar aprovação final.

## Banco

N/A.

## API/Backend

N/A.

## Frontend/UI

N/A.

## Validação

Leitura cruzada, validação estática de documentação e confirmação remota.
Runtime de produto: NÃO VALIDADO, fora do escopo.

## Riscos/Lacunas

Qualquer necessidade de alterar comportamento de produto abre nova spec/task.

## Resultado da execução

Em andamento. Aguardando revisão completa dos documentos de entrega e validação
remota antes de solicitar aprovação final.
