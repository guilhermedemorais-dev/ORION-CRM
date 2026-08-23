# Fluxo de Desenvolvimento

## 0. Controle obrigatório por plugin

Antes da primeira ação, inclusive leitura técnica, alteração de Markdown,
`git commit`, `git push`, auditoria, CI/CD ou infraestrutura, invoque
`dev-workflow-v2`. Ele é obrigatório para toda frente de desenvolvimento,
sem exceção para documentação ou Git.

Registre na task e na Issue:

- skill invocada e objetivo;
- fonte de verdade consultada;
- branch local, referência remota e estado de `git status`;
- `locked_paths` e conflitos conhecidos;
- comandos de validação e resultado;
- próximo passo determinístico.

Em seguida, `dev-workflow-standard` conduz escopo, riscos e revisão. Use
`sdd-spec-factory` para specs/tasks; `dev-implementation-standard` apenas
depois da aprovação humana. Acione `ui-ux-standard` e `security-standard`
quando os gatilhos respectivos existirem.

## 1. Descoberta

- Verificar `git log --oneline -10` e `git status`.
- Ler os três documentos centrais em `docs/product/`.
- Ler o PRD, estado atual, especificação e mockups do módulo.
- Inspecionar runtime, código e testes existentes.
- Validar a referência remota que será lida ou alterada. Uma cópia local ou
  uma branch de trabalho não prova o estado de `main`.

## 2. Contrato da Mudança

Para trabalho não trivial, não implementar direto. O contrato da mudança deve
ser produzido antes por `sdd-spec-factory` e revisado pelo orquestrador:

- Specs em `docs/specs/<modulo>/<feature>/`
- Task executável em `docs/tasks/TASK-XXX-<slug>.md`
- Critérios de aceite objetivos
- Escopo fora de jogo
- Testes e evidências obrigatórias

Specs antigas dentro de `docs/modules/<module>/` continuam válidas como fonte
histórica/canônica quando listadas em `docs/modules/README.md`. Specs novas
devem ir para `docs/specs/` para separar requisito de módulo e contrato de
execução.

Dimensões obrigatórias da spec e da task:

- `Banco`
- `API/Backend`
- `Frontend/UI`
- `Testes`
- `Segurança`
- `Observabilidade/logs`
- `Decisões pendentes`
- `Riscos`
- `Critérios de aceite`

## 3. Implementação

- Implementar somente depois de spec e task aprovadas.
- Alterar apenas o escopo definido.
- Preservar contratos públicos, dados e regras não incluídos na mudança.
- Separar o progresso em Banco, API/Backend e Frontend/UI.
- Não criar schema, endpoint, contrato, dependência ou fluxo novo sem estar
  descrito na spec ou aprovado explicitamente.

## 4. Revisão

- Comparar o diff com a task, specs obrigatórias e PRD.
- Verificar regressões, segurança, permissões e exposição de dados.
- Acionar `ui-ux-standard` quando houver UI.
- Acionar `security-standard` quando houver auth, permissões, dados sensíveis,
  uploads, pagamentos, webhooks, tenant, tokens ou integrações externas.
- Atualizar a spec somente quando houver divergência justificada e aprovada.

## 5. Validação

- Executar typecheck, testes e lint relevantes.
- Validar migrations e transações quando houver mudança de banco.
- Validar UI em browser e runtime canônico quando houver mudança visual.
- Registrar evidências em `docs/qa/reports/<module>/` quando necessário.

## 6. Entrega

Reportar separadamente:

- Documentação/Regras
- Banco
- API/Backend
- Frontend/UI
- Validação
- Riscos e lacunas

Marque `NAO VALIDADO` quando uma camada não foi verificada em runtime real.

## Registro mínimo de execução por plugin

```markdown
## Registro de plugins
- dev-workflow-v2: INVOCADO | fonte de verdade: ... | branch/remoto: ...
- dev-workflow-standard: INVOCADO | gate: PASS/BLOCKED | motivo: ...
- sdd-spec-factory: INVOCADO/N/A | motivo: ...
- dev-implementation-standard: INVOCADO/N/A | motivo: ...
- ui-ux-standard: INVOCADO/N/A | motivo: ...
- security-standard: INVOCADO/N/A | motivo: ...
```

`N/A` exige motivo verificável. Ausência de registro não equivale a plugin
dispensado.
