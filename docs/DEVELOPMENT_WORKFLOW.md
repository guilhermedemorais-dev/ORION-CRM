# Fluxo de Desenvolvimento

## 1. Descoberta

- Verificar `git log --oneline -10` e `git status`.
- Ler os três documentos centrais em `docs/product/`.
- Ler o PRD, estado atual, especificação e mockups do módulo.
- Inspecionar runtime, código e testes existentes.

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
