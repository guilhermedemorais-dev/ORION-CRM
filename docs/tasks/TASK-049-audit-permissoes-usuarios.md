# TASK-049: Auditar modulo de configuracao de usuarios/permissoes

## Status visual
- Status visual: A definir
- Status Kanban: Discovery / SDD
- Responsavel: Claude Code
- Issue criada / vinculada: #51
- Branch sugerida: `audit/permissoes-usuarios`
- Executor LLM primario: Claude Code
- Executor secundario/revisor: security-standard
- Modo de handoff: Claude Code CLI
- Status da claim: unclaimed
- `locked_paths`: (auditoria — somente leitura + doc de achados)
- Conflitos conhecidos: bloqueia parcialmente T-046 (que depende do modelo funcionar)
- Labels sugeridas: `tech-debt`, `security`, `bug`
- Pronto para GitHub Projects: sim

## Tipo
QA / Audit

## Prioridade
P1

## Objetivo
Diagnosticar por que ha toggles de permissao que "nao funcionam" no modal Editar
Usuario, e mapear o que realmente e enforcado. Base para confiar em novas
permissoes (ex.: order.approve — #48).

## Estado atual encontrado
- Modelo hibrido existe: `userCan` checa `custom_permissions[chave]` e cai no
  default da matriz `PERMISSIONS` (permissions.ts). `requirePermission` aplica.
- Matriz ja tem GERENTE e chaves granulares (order.view/edit, ficha.*, etc.).
- Modal (`AjustesClient.tsx`) grava `custom_permissions` (invitePerms/editPerms) e
  tem toggles por MODULO — possivel divergencia entre chave do toggle (modulo) e
  chave granular enforcada no backend.

## Entregavel
- Tabela: toggle do modal -> chave gravada -> enforcado no backend? (sim/nao/onde).
- Lista de lacunas: toggle cosmetico (sem enforcement), enforcement sem toggle,
  divergencia de nomenclatura.
- Bugs classificados P0/P1/P2 -> viram tasks de correcao (nao corrigir aqui).

## Fora do escopo
- Corrigir os bugs (cada correcao sera task propria).

## Testes/Evidencias
- Para 2-3 permissoes: alterar toggle e confirmar via API se o acesso muda.

## Criterios de aceite
- Documento de achados com o mapa toggle->chave->enforcement e a lista de bugs.

## Resultado da execucao
(a preencher)
