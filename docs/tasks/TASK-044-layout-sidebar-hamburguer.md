# TASK-044: Layout — hamburguer recolhe/expande a sidebar no desktop

## Status visual
- Status visual: Em andamento
- Status Kanban: In Review
- Responsavel: Claude Code
- Issue criada / vinculada: #45
- Branch sugerida: `fix/db-admin-apagar-seguro`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: ui-ux-standard
- Motivo da atribuicao: ajuste de UX pedido pelo usuario na mesma sessao
- Modo de handoff: Claude Code CLI
- Status da claim: done
- `locked_paths`:
  - `apps/web/components/layout/AppShell.tsx`
  - `apps/web/components/layout/Sidebar.tsx`
  - `apps/web/components/layout/Topbar.tsx`
- Conflitos conhecidos: nenhum
- Milestone: UX / Layout
- Labels sugeridas: `feature`
- Pronto para GitHub Projects: sim

## Tipo
Feature

## Prioridade
P2

## Objetivo
Permitir recolher/expandir o menu lateral no desktop via botao hamburguer,
liberando a largura total para o conteudo (melhor visibilidade).

## Docs obrigatorios
- `PRD.DOCS/Designer Systems/ORION-DESIGN-SYSTEM.html` (tokens/estilos)

## Arquivos e modulos permitidos
- `apps/web/components/layout/AppShell.tsx`
- `apps/web/components/layout/Sidebar.tsx`
- `apps/web/components/layout/Topbar.tsx`

## Fora do escopo
- Modo "rail" (sidebar so-icones). Ficou como colapso total.
- Ajustes finos da versao mobile (o usuario fara depois).

## Estado atual encontrado
- Sidebar fixa no desktop (`lg:translate-x-0`), sem como esconder.
- Hamburguer do Topbar era `lg:hidden` (so mobile).
- Conteudo com `lg:ml-[220px]` fixo.

## Resultado esperado
- Hamburguer visivel tambem no desktop.
- Desktop: recolhe/expande a sidebar; mobile: mantem o drawer.
- Estado persistido (localStorage).

## Frontend/UI
- `AppShell`: estado `desktopCollapsed` (localStorage `orion:sidebar-collapsed`);
  `toggleSidebar` responsivo (desktop colapsa, mobile abre drawer); margem do
  conteudo condicional com transicao.
- `Sidebar`: prop `desktopCollapsed` -> `lg:-translate-x-full` quando colapsada.
- `Topbar`: remove `lg:hidden` do botao de menu, ajusta tamanho no desktop.

## Testes obrigatorios / Evidencias
- `tsc --noEmit` limpo (web).
- Render conferido em browser: clique no hamburguer colapsa a sidebar e o
  Dashboard ocupa a largura total; clique de novo expande. Estado persiste.

## Criterios de aceite
- Usuario consegue esconder/mostrar a sidebar no desktop pelo hamburguer. [OK]
- Preferencia persiste ao recarregar. [OK]

## Riscos/Lacunas
- Ajuste fino de mobile pendente (fora do escopo, pedido do usuario).

## Resultado da execucao
Concluido e validado em browser. Commit `ceccbda` na branch
`fix/db-admin-apagar-seguro`. Pendente: review ui-ux-standard antes do merge.
