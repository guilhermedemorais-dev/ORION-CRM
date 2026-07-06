# Plano de Migração da Documentação

Status: EXECUTADO
Data: 2026-06-09

## Objetivo

Consolidar PRDs, especificações, mockups, relatórios de QA, planos e instruções
de agentes em uma estrutura previsível dentro de `docs/`, preservando o
histórico Git e sem alterar o conteúdo funcional dos PRDs durante a migração.

## Diagnóstico Atual

- `PRD.DOCS/` e `docs/` exercem papéis sobrepostos.
- `AGENTS.md`, `CLAUDE.md` e `Gemini.md` referenciam `prd.docs/`, mas a pasta
  existente e versionada é `PRD.DOCS/`.
- Os nomes de módulos não seguem um padrão: há espaços, caixa inconsistente e
  erros como `Papiline`, `Inbo`, `ASSISTENT`, `biulder` e `Designer Systems`.
- PRDs, prompts, tarefas, relatórios de estado e mockups estão misturados nas
  mesmas pastas.
- Datas como `03-08-26` são ambíguas e algumas apontam para datas futuras em
  relação a 2026-06-09. Elas não devem ser reinterpretadas sem confirmação.
- Existem referências para documentos ausentes ou em caminhos antigos.
- Há artefatos locais versionados em `docs/roadmap/QA-Reports/`, incluindo
  `.codex` e nomes sem extensão.
- `AGENTS.md` está ignorado pelo Git, enquanto `CLAUDE.md` e `Gemini.md` estão
  versionados e divergiram entre si.

## Estrutura Canônica Proposta

```text
docs/
  README.md
  DEVELOPMENT_STANDARDS.md
  DEVELOPMENT_WORKFLOW.md
  BUG_FIX_PROTOCOL.md
  COMPONENT_STANDARDS.md
  product/
    ORION-CRM-PRD-v1.2.md
    ORION-Fase0-PRD.md
    ORION-BUILD-GUIDE.md
  modules/
    agenda/
    ajustes/
    analytics/
    automations/
    ecommerce/
    estoque/
    financeiro/
    inbox/
    pdv/
    pipeline/
    production/
    ai-assistant/
    help-system/
  design/
    README.md
    design-system/
      ORION-DESIGN-SYSTEM.html
    mockups/
      <module>/
  architecture/
    overview.md
    decisions/
  qa/
    reports/
      <module>/
  roadmap/
  operations/
  releases.md
.project-ai/
  README.md
  instructions/
  prompts/
  skills/
```

Cada módulo seguirá, quando os documentos existirem:

```text
docs/modules/<module>/
  README.md
  prd.md
  research.md
  spec.md
  implementation-plan.md
  current-state.md
  qa-report.md
```

Não serão criados arquivos vazios apenas para completar a árvore.

## Regras de Nomenclatura

- Diretórios: `kebab-case`, ASCII, sem espaços.
- Documentos operacionais: nomes sem data quando representam o estado atual.
- Snapshots históricos: prefixo ISO `YYYY-MM-DD-` somente quando a data for
  confirmada no próprio documento ou pelo responsável do projeto.
- PRD canônico por módulo: `prd.md`; versões antigas vão para `archive/`.
- Mockups: `docs/design/mockups/<module>/<screen-or-state>.html`.
- Prompts de agentes: `.project-ai/prompts/`, nunca misturados aos PRDs.
- Relatórios de QA: `docs/qa/reports/<module>/YYYY-MM-DD-<scope>.md`.
- Instruções permanentes de agentes: `AGENTS.md` como entrada curta e
  `.project-ai/instructions/` para regras detalhadas.

## Classificação dos Arquivos Atuais

| Origem atual | Destino proposto |
| --- | --- |
| `PRD.DOCS/ORION-CRM-PRD-v1.2.md` | `docs/product/ORION-CRM-PRD-v1.2.md` |
| `PRD.DOCS/ORION-Fase0-PRD.md` | `docs/product/ORION-Fase0-PRD.md` |
| `PRD.DOCS/ORION-BUILD-GUIDE.md` | `docs/product/ORION-BUILD-GUIDE.md` |
| `PRD.DOCS/Designer Systems/*` | `docs/design/design-system/` |
| PRDs de feature | `docs/modules/<module>/prd.md` ou `archive/` |
| Mockups HTML de feature | `docs/design/mockups/<module>/` |
| `CODEX-*-PROMPT.md` e `PROMPT-*.md` | `.project-ai/prompts/archive/` |
| `*_CURRENT_STATE.md` | `docs/modules/<module>/current-state.md` |
| `TASK-*.md`, `INDEX.md` | `docs/modules/<module>/implementation/` |
| `CODE-REVIEW-*.md` | `docs/qa/reports/<module>/` |
| `docs/roadmap/QA-Reports/*` | separar entre `docs/qa/reports/` e `docs/roadmap/` |
| `PLANO-OS-MATERIAIS-2026-05-13.md` | `docs/modules/production/implementation-plan-materials.md` |

Casos duplicados, como `15-B-LEAD-DETAIL.md` em mais de um módulo, serão
comparados por hash e conteúdo antes de escolher o canônico.

## Fases de Execução

### Fase 1 - Governança

1. Criar `docs/README.md` como índice único.
2. Criar os quatro documentos de disciplina de desenvolvimento.
3. Reduzir `AGENTS.md` a regras obrigatórias e links canônicos.
4. Alinhar os adaptadores `CLAUDE.md` e `Gemini.md` ao mesmo índice.
5. Remover `AGENTS.md` do `.gitignore` e versioná-lo.

### Fase 2 - Produto e Design

1. Mover os três documentos centrais para `docs/product/` com `git mv`.
2. Mover o design system e mockups para `docs/design/`.
3. Atualizar referências em código, documentação e configurações locais
   versionadas.

### Fase 3 - Módulos

1. Migrar um módulo por vez.
2. Criar `README.md` do módulo declarando fonte de verdade, status e documentos
   arquivados.
3. Separar PRD, estado atual, implementação, prompt e QA.
4. Não fundir nem reescrever requisitos durante o movimento.

Ordem sugerida: `pipeline`, `inbox`, `pdv`, `estoque`, `financeiro`, `agenda`,
`analytics`, `ecommerce`, `ajustes`, `automations`, `ai-assistant`,
`help-system`, `production`.

### Fase 4 - QA e Roadmap

1. Renomear arquivos sem extensão e corrigir erros de nomenclatura.
2. Remover artefatos locais indevidamente versionados.
3. Separar relatórios de QA de roadmaps e planos de execução.
4. Atualizar a matriz de rastreabilidade para os novos caminhos.

### Fase 5 - Integridade

1. Corrigir todas as referências `prd.docs`, `PRD.DOCS` e caminhos relativos.
2. Verificar links Markdown e referências em comentários SQL/TypeScript.
3. Confirmar que nenhum PRD perdeu conteúdo usando hashes antes/depois.
4. Executar buscas de caminhos legados e exigir resultado zero, exceto no
   registro de migração.
5. Validar `git diff --summary` para confirmar que os movimentos foram
   reconhecidos como renames.

## Comandos de Validação

```bash
git status --short
git diff --check
rg -n 'prd\.docs|PRD\.DOCS' --glob '!docs/DOCUMENTATION_MIGRATION_PLAN.md'
find docs .project-ai -type f -print | sort
git diff --summary
```

Será adicionado um verificador de links locais quando a estrutura final estiver
aprovada. Mudanças apenas documentais não exigem rebuild do Docker, mas as
referências consumidas em runtime ou deploy serão verificadas separadamente.

## Decisões Aprovadas

1. `docs/` substitui integralmente a raiz antiga como diretório canônico.
2. Datas ambíguas foram removidas dos caminhos e preservadas no conteúdo.
3. Documentos antigos relevantes permanecem em `archive/`.
4. `AGENTS.md` volta a ser versionado como regra oficial do repositório.

## Resultado

- PRDs gerais migrados para `docs/product/`.
- Documentos separados por módulo em `docs/modules/`.
- Design system e mockups consolidados em `docs/design/`.
- Prompts históricos separados em `.project-ai/prompts/archive/`.
- QA consolidado em `docs/qa/reports/`.
- Cópia idêntica e mal posicionada de Lead Detail removida; uma única versão
  canônica foi mantida em Pipeline.
- Referências no código, seeds, agentes e documentação foram atualizadas.

## Critério de Conclusão

- Existe uma única raiz canônica de documentação: `docs/`.
- Todo módulo tem uma fonte de verdade explicitamente identificada.
- PRDs, mockups, prompts, QA e planos estão separados por responsabilidade.
- Não existem referências quebradas para caminhos migrados.
- `AGENTS.md`, `CLAUDE.md` e `Gemini.md` apontam para as mesmas regras.
- O conteúdo dos PRDs permanece byte a byte igual durante a fase de movimento.
- A migração pode ser revisada em commits pequenos por fase.
