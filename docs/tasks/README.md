# Tasks

Este diretório guarda tarefas executáveis para devs e agentes.

Uma task só deve existir depois de haver spec suficiente em `docs/specs/` ou
documento canônico equivalente em `docs/modules/`.

Formato recomendado:

```text
docs/tasks/TASK-XXX-<modulo>-<slug>.md
```

Cada task deve conter:

- Objetivo
- Specs obrigatórias
- Issue vinculada, se existir
- Branch sugerida
- Arquivos ou módulos permitidos
- Fora de escopo
- Passos de implementação
- Testes obrigatórios
- Evidências esperadas no PR
- Critérios de aceite
- Riscos e decisões pendentes

Regra: o dev/agente implementa somente a task aprovada. Se a task estiver
ambígua, incompleta ou contradisser o PRD, deve parar e pedir ajuste antes de
codar.
