# Spec: Governança obrigatória por plugin

## Status

Discovery / SDD, Issue [#64](https://github.com/guilhermedemorais-dev/ORION-CRM/issues/64).

## Objetivo

Fazer do uso do Dev Workflow um contrato documentado para qualquer trabalho de
desenvolvimento do ORION ERP, inclusive documentação técnica e operações Git.

## Escopo incluído

- Registrar `dev-workflow-v2` como controlador obrigatório antes da primeira ação.
- Registrar papéis, gates e evidências dos plugins especializados.
- Tornar obrigatório validar a referência remota antes de afirmar que uma
  alteração publicada está correta.
- Revisar a documentação ativa de entrega contra esse contrato.

## Fora de escopo

- Código de produto, banco, API, UI, migrations, deploy ou regras comerciais.
- Alterar PRDs canônicos do produto e dos módulos.
- Instalar, habilitar ou publicar plugins.

## Banco

N/A. Não há alteração de dados, schema ou migration.

## API/Backend

N/A. Não há alteração de endpoint, job, webhook ou serviço.

## Frontend/UI

N/A. Não há alteração de tela ou componente de produto.

## Testes

- Leitura cruzada de `AGENTS.md`, `docs/README.md` e
  `docs/DEVELOPMENT_WORKFLOW.md`.
- Busca dos termos proibidos de handoff pessoal em documentação ativa.
- Validação de links Markdown e sintaxe Mermaid dos documentos alterados.
- Confirmação do conteúdo na referência remota alvo antes de encerrar.

## Segurança

Não há superfície de produto alterada. O contrato deve preservar a exigência de
`security-standard` para auth, dados sensíveis, uploads, pagamentos, webhooks,
tokens e integrações.

## Observabilidade e rastreabilidade

Toda task deve registrar skills, fontes consultadas, branch/remoto,
`locked_paths`, comandos de validação e resultado na task e na Issue.

## Decisões pendentes

N/A. A exigência de uso obrigatório do plugin foi determinada pelo responsável
do projeto.

## Riscos

- Regras extensas no bootstrap podem duplicar documentação canônica.
- O repositório possui WIP local não relacionado; não pode ser incluído.
- Validação local sem leitura da referência remota pode reincidir no erro.

## Critérios de aceite

- Os três documentos de governança dizem explicitamente que documentação e Git
  exigem `dev-workflow-v2`.
- Existe task vinculada à Issue #64 com gates e `locked_paths`.
- Não há código de produto no diff.
- A revisão documental registra o estado remoto efetivamente publicado.
