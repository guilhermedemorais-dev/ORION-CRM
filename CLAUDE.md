# ORION CRM - CLAUDE.md

> Bootstrap curto para Claude Code. O contrato detalhado do projeto esta em
> `AGENTS.md` e `docs/`.

## Regra principal

Nao implemente a partir de conversa solta. Para feature, regra de negocio, UI,
schema, API, integracao, webhook, pagamento, auth, permissao ou fluxo
operacional, exija antes:

1. Spec em `docs/specs/<modulo>/<feature>/`
2. Task executavel em `docs/tasks/`
3. Aprovacao humana ou do orquestrador

Correcao pequena e localizada deve seguir `docs/BUG_FIX_PROTOCOL.md`.

## Plugins obrigatorios do workflow

Repositorio completo:
`https://github.com/guilhermedemorais-dev/Dev-workflow`

Se o dev/agente nao tiver os plugins, deve baixar esse repo completo e instalar:

- `dev-workflow-standard`: orquestracao, escopo, gates e revisao final
- `sdd-spec-factory`: specs e task executavel
- `dev-implementation-standard`: implementacao limitada a task aprovada
- `ui-ux-standard`: obrigatorio quando houver UI
- `security-standard`: obrigatorio para auth, permissoes, dados sensiveis,
  uploads, pagamentos, webhooks, tenant, tokens e integracoes externas

Fluxo:

```text
demanda -> spec -> task -> aprovacao -> implementacao -> PR -> QA/revisao
```

## Ordem de leitura antes de codigo

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

## Fontes de verdade

- Regras do repo: `AGENTS.md`
- Produto: `docs/product/`
- Modulos: `docs/modules/`
- Specs novas: `docs/specs/`
- Tasks: `docs/tasks/`
- Workflow: `docs/DEVELOPMENT_WORKFLOW.md`
- Padroes tecnicos: `docs/DEVELOPMENT_STANDARDS.md`
- UI: `docs/COMPONENT_STANDARDS.md`
- QA: `docs/qa/reports/`

## Regras absolutas resumidas

- Runtime canonico: `docker compose` na raiz.
- Nao criar stack paralela.
- Nao alterar PRD sem aprovacao.
- Nao criar endpoint/schema/contrato sem justificativa na spec.
- Nao usar `any`, `@ts-ignore`, SQL concatenado, CSS inline, secrets em codigo,
  logs com dados sensiveis, `FLOAT` para dinheiro, `axios`, MUI, Chakra, AntD,
  Chart.js, moment.js ou react-beautiful-dnd.
- Dinheiro sempre em centavos com inteiro.
- Webhook nao processa pesado de forma sincrona.
- UI precisa de skeleton, empty state, error state e retry.
- Reporte sempre por `Banco`, `API/Backend`, `Frontend/UI`, `Validacao` e
  `Riscos/Lacunas`.

Se algo nao foi validado em runtime real, declare `NAO VALIDADO`.
