# Regras de validação: Governança obrigatória por plugin

## RN-01: Sem exceção documental ou Git

Documentação técnica, auditoria, commit, push, PR, CI/CD e infraestrutura devem
invocar `dev-workflow-v2` antes da primeira ação.

## RN-02: Fonte remota obrigatória

Antes de declarar uma mudança como publicada, a tarefa deve validar a referência
remota alvo, por exemplo `origin/main`, e não apenas o arquivo local.

## RN-03: Registro auditável

Cada task deve conter o registro mínimo de plugins definido em
`docs/DEVELOPMENT_WORKFLOW.md`.

## RN-04: Gates especializados

`dev-workflow-standard` coordena a entrega. `sdd-spec-factory` é obrigatório
para mudança não trivial; UI e segurança acionam suas skills específicas.

## RN-05: Condição de parada

Sem Issue, fonte de verdade, `locked_paths` ou validação remota, a tarefa fica
em `Discovery / SDD` ou `Blocked` e não pode fazer commit, push, PR ou deploy.
