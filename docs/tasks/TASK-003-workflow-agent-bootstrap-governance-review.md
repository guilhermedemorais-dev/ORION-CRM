# TASK-003: Conferir prompt de governanca dos agentes

## Status visual
- Status visual: A definir
- Status Kanban: Discovery / SDD
- Responsavel: Guilherme / orquestrador
- Issue criada / vinculada: `#10` - `https://github.com/guilhermedemorais-dev/ORION-CRM/issues/10`
- Branch sugerida: `docs/workflow-agent-bootstrap-governance-review`
- Milestone: Workflow / Governanca
- Labels sugeridas: `docs`, `workflow`, `needs-info`
- Pronto para GitHub Projects: sim, com lacuna de inclusao automatica no Project

## Tipo
Docs

## Prioridade
P2

## Objetivo
Conferir o prompt de governanca dos agentes e transformar a revisao em contrato
operacional claro, sem aplicar mudancas de produto e sem iniciar codigo.

## Specs obrigatorias
- `docs/specs/workflow/agent-bootstrap-governance/module-spec.md`
- `docs/specs/workflow/agent-bootstrap-governance/validation-rules.md`

## Docs obrigatorios
- `AGENTS.md`
- `CODEX.md`
- `CLAUDE.md`
- `Gemini.md`
- `docs/README.md`
- `docs/DEVELOPMENT_WORKFLOW.md`
- `docs/DEVELOPMENT_STANDARDS.md`
- `docs/tasks/README.md`
- `docs/specs/README.md`

## Arquivos e modulos permitidos
- Permitido nesta task: documentos de bootstrap de agente e documentos de
  workflow citados acima.
- Proibido nesta task: `apps/web`, `apps/api`, migrations, seeds, rotas,
  componentes de produto e PRDs canonicos sem aprovacao explicita.

## Fora do escopo
- Implementar feature, bugfix ou mudanca visual.
- Alterar schema, endpoint, contrato de API, webhook, pagamento, auth ou
  permissao.
- Substituir stack, runtime ou fluxo do projeto.
- Resolver conteudo de tasks de produto ja existentes.

## Estado atual encontrado
- `AGENTS.md` esta curto e orienta o fluxo correto.
- `CODEX.md` e `CLAUDE.md` replicam o bootstrap curto para agentes que nao
  recebem `AGENTS.md` automaticamente.
- O repo tem alteracoes pendentes amplas; esta task nao deve misturar revisao
  documental com implementacao.
- A ferramenta disponivel permite criar GitHub Issue, mas nao foi validada
  operacao direta de adicionar item ao GitHub Projects.

## Resultado esperado
- Prompt revisado com lacunas, riscos e recomendacoes objetivas.
- Issue GitHub criada ou corpo de issue pronto para criacao manual.
- Status preparado para `Discovery / SDD` no GitHub Projects.
- Nenhum codigo de produto alterado.

## Regras obrigatorias da implementacao
- Nao implementar codigo.
- Nao alterar PRD canonico sem aprovacao humana.
- Nao duplicar regras longas nos bootstraps; detalhes devem continuar em
  `docs/`.
- Se houver conflito entre arquivos de bootstrap e docs canonicos, parar e
  registrar o conflito antes de editar.

## Checklist de execucao
1. Ler esta task e specs obrigatorias.
2. Ler docs obrigatorios.
3. Conferir se o prompt bloqueia implementacao por conversa solta.
4. Conferir se a ordem spec -> task -> aprovacao -> implementacao esta clara.
5. Conferir se UI, seguranca, banco e API possuem gates adequados.
6. Registrar lacunas e recomendacoes.
7. Atualizar `Resultado da execucao`.
8. Vincular ou atualizar a Issue GitHub.

## Prompt para o executor
Use `dev-workflow-standard` como orquestrador e `sdd-spec-factory` apenas para
revisao de spec/task. Nao use `dev-implementation-standard`, porque esta task
nao autoriza codigo de produto.

Leia a task inteira, as specs obrigatorias e os docs obrigatorios. Confira o
prompt de governanca dos agentes contra o fluxo oficial do ORION CRM. Entregue
uma revisao objetiva com pontos fortes, lacunas, riscos e acoes recomendadas.
Pare se a revisao exigir alterar PRD, schema, API, UI, auth, permissao,
pagamento, webhook ou integracao.

## Condicoes de parada
- Falta de acesso aos docs obrigatorios.
- Conflito entre `AGENTS.md` e docs canonicos que mude comportamento de
  implementacao.
- Necessidade de alterar produto em vez de governanca.
- Necessidade de atualizar GitHub Projects sem ferramenta ou permissao
  disponivel.

## Testes obrigatorios
- Validacao documental por leitura cruzada.
- `git status --short` antes e depois.
- Verificar que nenhum arquivo de produto foi alterado por esta task.

## Evidencias esperadas no PR
- Lista de documentos lidos.
- Diff limitado aos arquivos permitidos, se houver alteracao.
- Issue GitHub vinculada.
- Registro de lacunas marcadas como `NAO VALIDADO`.

## Criterios de aceite
- A revisao do prompt aponta riscos e melhorias sem aplicar produto.
- A task esta rastreavel por issue.
- O status correto para amanha e `Discovery / SDD`.
- Banco, API/Backend e Frontend/UI continuam explicitamente fora de escopo.
- GitHub Projects esta atualizado ou marcado como lacuna operacional.

## Banco
N/A. Nenhuma alteracao de banco autorizada.

## API/Backend
N/A. Nenhuma alteracao de backend autorizada.

## Frontend/UI
N/A. Nenhuma alteracao de UI autorizada.

## Validacao
NAO VALIDADO em runtime. Esta task e documental e deve ser validada por leitura
cruzada e rastreabilidade em issue.

## Riscos/Lacunas
- GitHub Projects pode exigir acao manual se a automacao disponivel nao expuser
  inclusao de item no Project.
- Repo esta com muitas alteracoes pendentes; nao misturar esta task com outra
  frente de trabalho.
- Se os bootstraps forem alongados demais, voltam a roubar contexto e criam
  manutencao duplicada.

## Resultado da execucao
Pendente. Executar amanha.
