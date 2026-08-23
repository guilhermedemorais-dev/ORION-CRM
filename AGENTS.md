# ORION ERP - AGENTS.md

> Lido automaticamente pelo Codex. Este arquivo deve ser curto para economizar
> contexto. Regras detalhadas ficam em `docs/`.

## Regra principal

Nao implemente a partir de conversa solta. Para qualquer feature, mudanca de
regra de negocio, UI, schema, API, integracao, webhook, pagamento, auth,
permissao ou fluxo operacional, deve existir:

1. Spec em `docs/specs/<modulo>/<feature>/`
2. Task executavel em `docs/tasks/`
3. Aprovacao humana ou do orquestrador antes de codigo

Correcao pequena e localizada pode seguir `docs/BUG_FIX_PROTOCOL.md`, mas ainda
precisa declarar escopo, risco e validacao.

## Workflow com plugins

Repositorio dos plugins:
`https://github.com/guilhermedemorais-dev/Dev-workflow`

**Todo trabalho relacionado a desenvolvimento deve invocar o plugin de
workflow antes da primeira acao.** Isso inclui descoberta, auditoria,
documentacao tecnica, Git/branch/commit/push, CI/CD, infraestrutura, bugfix,
feature, UI, banco, API, integracao e validacao. Documentacao e Git nao sao
excecoes para esse controle.

Controlador obrigatorio:

```text
demanda -> dev-workflow-v2: estado, fonte de verdade, escopo, branch/remoto,
            gates e rastreabilidade
```

Depois, aplicar o fluxo especializado:

```text
demanda
  -> dev-workflow-standard: diagnostico, escopo, riscos, perguntas criticas
  -> sdd-spec-factory: specs e task executavel
  -> aprovacao humana
  -> dev-implementation-standard: implementacao limitada a task
  -> ui-ux-standard: obrigatorio quando houver UI
  -> security-standard: obrigatorio quando houver auth, dados sensiveis,
     uploads, pagamentos, webhooks, tenant, tokens ou integracoes externas
  -> dev-workflow-standard: revisao final contra spec/task/PR
```

Se o plugin nao estiver instalado, baixe o repositorio completo acima e instale
as skills necessarias antes de iniciar qualquer trabalho neste projeto.

O uso do plugin deve ficar registrado na task e na Issue: skill invocada,
fonte de verdade consultada, branch/remoto validado, `locked_paths`, comandos
de validacao e resultado. Sem esse registro, a tarefa permanece em
`Discovery / SDD` ou `Blocked`; nao e considerada pronta para implementacao,
commit, push, PR, merge ou deploy.

## Ordem de leitura

Antes de qualquer codigo:

```bash
git log --oneline -10
git status
cat docs/product/ORION-CRM-PRD-v1.2.md
cat docs/product/ORION-BUILD-GUIDE.md
cat docs/product/ORION-Fase0-PRD.md
cat docs/README.md
cat docs/modules/README.md
```

Depois leia o PRD canonico do modulo atual e os mockups correspondentes em
`docs/design/mockups/<modulo>/`, quando houver UI.

## Fontes de verdade

- Produto e regras: `docs/product/`
- Modulos: `docs/modules/`
- Specs novas: `docs/specs/`
- Tasks delegaveis: `docs/tasks/`
- Arquitetura: `docs/architecture/`
- Design system e mockups: `docs/design/`
- QA e evidencias: `docs/qa/reports/`
- Ambiente: `docs/operations/`
- Workflow: `docs/DEVELOPMENT_WORKFLOW.md`
- Padroes tecnicos: `docs/DEVELOPMENT_STANDARDS.md`
- UI: `docs/COMPONENT_STANDARDS.md`

## Regras absolutas

- Stack do projeto nao deve ser substituida.
- Runtime canonico: `docker compose` na raiz do repo.
- Nao criar stack Docker paralela.
- Nao modificar requisitos em `docs/product/` ou `docs/modules/` sem aprovacao.
- Nao adicionar schema, endpoint ou contrato novo sem justificativa na spec.
- Nao usar `any`, `@ts-ignore`, SQL concatenado, CSS inline, secrets em codigo,
  logs com dados sensiveis, `FLOAT` para dinheiro, `axios`, MUI, Chakra, AntD,
  Chart.js, moment.js ou react-beautiful-dnd.
- Dinheiro sempre em centavos com inteiro.
- Webhooks devem retornar rapido e processar via fila quando aplicavel.
- Estoque/pagamento devem usar transacao e bloqueio correto.
- Upload deve validar magic bytes, nao apenas extensao.

## UI obrigatoria

- Seguir `docs/design/design-system/ORION-DESIGN-SYSTEM.html`.
- Mockup `.html` em `docs/design/mockups/` e especificacao visual obrigatoria.
- Todo fetch deve ter loading skeleton, empty state e error state com retry.
- Todo `flex-1` precisa de `min-w-0`; coluna fixa precisa de `flex-shrink-0`.
- Nao declarar tela pronta sem rota/componente existente, runtime atualizado e
  verificacao contra PRD/mockup.

## Reporte obrigatorio

Sempre separar status em:

- `Banco`
- `API/Backend`
- `Frontend/UI`
- `Validacao`
- `Riscos/Lacunas`

Marque explicitamente `NAO VALIDADO` quando nao houver verificacao real.
