# ORION CRM - CODEX.md

> Bootstrap visivel para Codex e para devs que nao recebem `AGENTS.md` na
> interface. O Codex tambem le `AGENTS.md` automaticamente.

## Regra principal

Nao implemente a partir de conversa solta. Para feature, regra de negocio, UI,
schema, API, integracao, webhook, pagamento, auth, permissao ou fluxo
operacional, exija antes:

1. Spec em `docs/specs/<modulo>/<feature>/`
2. Task executavel em `docs/tasks/`
3. Aprovacao humana ou do orquestrador

## Plugins do workflow

Repositorio completo:
`https://github.com/guilhermedemorais-dev/Dev-workflow`

Skills usadas neste projeto:

- `dev-workflow-standard`: orquestrador principal
- `sdd-spec-factory`: cria specs e task
- `dev-implementation-standard`: implementa a task aprovada
- `ui-ux-standard`: valida UI
- `security-standard`: valida seguranca

Fluxo obrigatorio:

```text
demanda -> spec -> task -> aprovacao -> implementacao -> PR -> QA/revisao
```

## Leitura obrigatoria

```bash
git log --oneline -10
git status
cat docs/product/ORION-CRM-PRD-v1.2.md
cat docs/product/ORION-BUILD-GUIDE.md
cat docs/product/ORION-Fase0-PRD.md
cat docs/README.md
cat docs/modules/README.md
```

Depois leia o PRD canonico do modulo atual, specs obrigatorias da task e mockups
em `docs/design/mockups/<modulo>/`, quando houver UI.

## Restrições

- Runtime canonico: `docker compose` na raiz.
- Nao criar stack paralela.
- Nao alterar PRD sem aprovacao.
- Nao criar schema, endpoint ou contrato novo sem justificativa na spec.
- Nao usar `any`, `@ts-ignore`, SQL concatenado, CSS inline, secrets em codigo,
  logs com dados sensiveis, `FLOAT` para dinheiro, `axios`, MUI, Chakra, AntD,
  Chart.js, moment.js ou react-beautiful-dnd.
- Reporte sempre por `Banco`, `API/Backend`, `Frontend/UI`, `Validacao` e
  `Riscos/Lacunas`.

Se algo nao foi validado em runtime real, declare `NAO VALIDADO`.
