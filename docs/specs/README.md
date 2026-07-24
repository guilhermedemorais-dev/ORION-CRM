# Specs

Este diretório guarda contratos novos de mudança, organizados por módulo e
feature.

Formato recomendado:

```text
docs/specs/<modulo>/<feature>/
  module-spec.md          # quando a mudança altera o módulo
  page-spec.md            # quando houver tela ou fluxo visual
  component-spec.md       # quando houver componente relevante
  validation-rules.md     # regras de negócio e validação
  database.md             # quando houver impacto de banco
  api.md                  # quando houver impacto de backend/API
```

Cada spec deve separar:

- `Banco`
- `API/Backend`
- `Frontend/UI`
- `Testes`
- `Segurança`
- `Observabilidade/logs`
- `Decisões pendentes`
- `Riscos`
- `Critérios de aceite`

Specs não são tasks. A spec define o contrato. A task em `docs/tasks/` define a
ordem de execução.
