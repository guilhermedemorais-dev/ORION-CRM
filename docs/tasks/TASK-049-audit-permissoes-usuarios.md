# TASK-049: Auditar modulo de configuracao de usuarios/permissoes

## Status visual
- Status visual: 🟢 Concluída (diagnóstico)
- Status Kanban: In Review
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

## Resultado da execucao — ACHADOS

Mecanismo funciona: `userCan(user, key)` (ROOT bypassa; senao custom_permissions
override; senao default da matriz `PERMISSIONS`) + `requirePermission(key)`. As
custom_permissions NAO vem no JWT — carregar lazy do DB (padrao em customers.routes).

Enforcement real hoje:
- `requirePermission('pipeline.configure')` — 6 usos (UNICA chave por requirePermission).
- `clientes_outros` — enforcado em customers.routes (leitura direta de custom_permissions).
- `ficha.*.view` (8 chaves) — gate no FRONTEND (leads/[id], clientes/[id]) via userCan.
- Todo o resto do acesso e por `requireRole([...])` (papel), nao por toggle.

Mapa toggle do modal -> enforcado?
| Toggle | Chave | Enforca? |
|--------|-------|----------|
| Editar clientes de outros | clientes_outros | SIM |
| Ficha: agenda/dados/atendimento/proposta/pedidos/os/entrega/historico | ficha.*.view | SIM (front) |
| Leads & Pipeline | leads | NAO (cosmetico) |
| Clientes | clientes | NAO (backend usa client.*) |
| Pedidos | pedidos | NAO (backend usa order.*) |
| Producao | producao | NAO (backend usa so.*) |
| PDV | pdv | NAO |
| Estoque | estoque | NAO |
| Financeiro | financeiro | NAO (backend usa financial.*) |
| Analytics | analytics | NAO |
| Usuarios | usuarios | NAO (backend usa users.manage) |
| Assistente IA | assistente_ia | NAO |

## Bugs derivados (viram tasks proprias)
- P1: ~10 toggles de modulo do modal sao cosmeticos (gravam custom_permissions mas
  nenhuma rota/tela checa). Decidir: (a) ligar cada um ao enforcement (matriz+rota+
  front) ou (b) remover os que nao serao usados. Nao corrigido aqui (diagnostico).

## Impacto nas tasks dependentes
- T-050 e T-046 SAO VIAVEIS: usar o mecanismo que funciona (userCan/custom_permissions
  carregado lazy + gate no front), com chave NOVA enforcada de verdade — NAO reusar o
  padrao cosmetico dos toggles de modulo.

