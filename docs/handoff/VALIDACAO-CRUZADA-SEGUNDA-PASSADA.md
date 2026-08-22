# Validação cruzada, segunda passada

## Método e escopo

- Baseline auditado: commit `29c1639`; WIP local não foi usado para declarar
  entrega.
- Verificados nesta rodada: 48 arquivos de rota, 63 migrations presentes no
  diretório de trabalho (o baseline de handoff termina em 062), 23 páginas
  Next.js, 27 artefatos em `docs/qa` e 23 documentos de handoff.
- Documentos de handoff foram lidos contra `index.ts`, routes, serviços,
  migrations, Compose, Nginx, GitHub Action, PRD e relatórios QA citados.
- `git diff --check` passou para os documentos criados.

## Resultado por requisito da segunda passada

| Item | Status | Evidência | Pendência |
| --- | --- | --- | --- |
| Auditoria de repo | PARCIAL | baseline, superfície, riscos e catálogo em `SECOND-PASS-BASELINE.md` e `MODULOS-CATALOGO-TECNICO.md` | não é revisão linha a linha dos 48 route files |
| User flows | PARCIAL | Mermaid da Ficha, PDV e cadeia ponta a ponta | cadeia WhatsApp→Entrega precisa prova runtime |
| Ficha do Cliente | CONCLUÍDO documental | `FICHA-DO-CLIENTE-TECNICA.md` | transições automáticas não homologadas |
| Módulos transversais | PARCIAL | estoque/financeiro/PDV, gestão/loja/suporte, IA e automações documentados | contratos de operação externa e homologação ainda pendentes |
| Banco/ER | PARCIAL | `BANCO-ENTIDADES-E-RELACIONAMENTOS.md` | ER completo e todos os leitores/escritores pendentes |
| Inventário API | PARCIAL | `API-INVENTARIO-DE-NEGOCIO.md`, fluxos e contratos n8n/IA | payload/status de todos endpoints pendentes |
| Frontend | PARCIAL | Ficha, operação central, fluxo ponta a ponta e catálogo | componentes/hooks por módulo ainda não são catálogo exaustivo |
| RBAC/segurança | PARCIAL | `RBAC-E-INTEGRACOES-TECNICO.md` e matriz HTTP isolada da Base Técnica | demais rotas e ambiente real pendentes |
| Integrações | PARCIAL | Meta, n8n, MP, transportadoras, ViaCEP e webhooks n8n | credenciais/workflows externos e retry real pendentes |
| Arquitetura/deploy/runbook | CONCLUÍDO documental | `ARQUITETURA-E-OPERACOES-ATUAL.md` | backup/restore/rollback real NÃO VALIDADO |
| QA/gaps/traceability | PARCIAL | `QA-E-GAPS-PRD-CODIGO.md` | matriz completa feature por feature pendente |
| Comentários/docstrings críticos | PARCIAL | comentários existentes em OS, PDV e middleware foram revisados | auditoria linha a linha e mudanças mínimas pendentes |
| Base Técnica | IMPLEMENTADA, NÃO HOMOLOGADA | task #62, rota/service/página, teste unitário e matriz HTTP do ZIP | browser autenticado e produção pendentes |
| Snapshot final | CONCLUÍDO | `ORION-CRM-handoff-2026-08-22.zip` e `DELIVERY-MANIFEST.md` | equipe cria repositório privado e primeiro commit quando necessário |

## Inconsistências confirmadas durante a validação

1. Diretório de trabalho contém migration 063, mas baseline de snapshot/handoff
   tem migrations 001–062; qualquer documento que trate 063 como entregue está
   incorreto.
2. PRD cita Activepieces/Python IA; Compose atual não declara esses serviços e
   código atual usa n8n/TypeScript.
3. README-DEPLOY descreve n8n no Compose; `docker-compose.yml` atual não cria
   container n8n.
4. A Action de deploy copia docs para o contexto de build da API; procedimento
   local descrito não reproduz esse passo.
5. `requireRole` libera ROOT globalmente; requisito de Base Técnica só ADMIN
   exige guard específico e não pode reutilizar esse bypass sem alteração.

## Estado de validação

Nenhuma destas conclusões substitui: PostgreSQL real, browser autenticado,
webhook externo, n8n produtivo, Mercado Pago, transportadoras, backup/restore e
rollback. Todos permanecem **NÃO VALIDADOS** nesta segunda passada.

### Evidência de ambiente local, 2026-08-22

`docker compose ps` mostrou Postgres, Redis e API saudáveis, com Web ativo. As
imagens API/Web em execução foram criadas há quatro dias e não contêm os novos
arquivos da Base Técnica desta árvore de trabalho. Não houve rebuild ou restart:
isso preserva WIP alheio e impede usar o runtime atual como falsa evidência de
`/base-tecnica`. A validação disponível é build, typecheck e teste unitário;
browser autenticado e HTTP por role continuam pendentes.

Como confirmação adicional dessa separação, uma chamada sem credencial ao
endpoint novo no container API ativo devolveu `404`, não `401`: a rota ainda não
existe na imagem em execução. Não é falha do código novo, é evidência de que
nenhum teste browser/API contra esse container pode homologar a Base Técnica.

Leitura somente de metadados no Postgres local confirmou 63 registros em
`_migrations`, de `001_settings.sql` até `063_flow_stage_stock_action.sql`, e
a existência de `ai_copilot_config`, `automation_flows`, `appointments` e
`production_orders`. Isto prova disponibilidade/ledger local, **não** prova
regra de negócio, integridade de dados ou que 063 pertença ao snapshot. Ao
contrário, confirma que esse banco é posterior ao baseline 29c1639 e não pode
ser usado como evidência da entrega limpa.

### Evidência isolada da Base Técnica, 2026-08-22

Foi criado um conjunto descartável de Postgres, Redis e API, em rede Docker
isolada, com `docs/handoff` montado em somente leitura. Após executar as
migrations nesse banco temporário, a rota foi exercitada por HTTP: sem token
retornou `401`; token `ADMIN`, `200` com 13 documentos antes da inclusão do
catálogo completo de rotas; `ROOT` e `ATTENDANT`,
`403`; busca por `n8n`, `200`; e id fora da allowlist, `404`. Isso confirma o
guard exclusivo de ADMIN e a leitura da allowlist no runtime novo.

Há uma limitação que não pode ser omitida: o build Docker recebeu a árvore de
trabalho atual e, por isso, aplicou também a migration local não versionada
`063_flow_stage_stock_action.sql`. A matriz prova a Base Técnica no código
atual, mas **não** é um build reproduzido estritamente do commit `29c1639`.
Nenhum container do Compose existente foi reiniciado ou alterado.

### Evidência final da exportação curada, 2026-08-22

O ZIP foi construído a partir do commit `29c1639` com overlay controlado de
documentação e Base Técnica, sem WIP alheio. O conteúdo final contém somente
migrations `001`–`062`; API e Web foram recompiladas a partir dessa exportação,
e `docker compose config --no-interpolate`, locks `npm ci --dry-run` e
integridade do ZIP passaram.

Em Postgres e Redis descartáveis, a imagem API da exportação, com
`docs/handoff` montado somente leitura, aplicou 62 migrations e respondeu:
`401` sem token, `200` ADMIN com 16 documentos, inclusive
`API-ROUTE-CATALOG.md`, `403` ROOT e `404` para id fora da allowlist. Isso
substitui a evidência anterior contaminada por 063 para a Base Técnica. Browser
autenticado, serviços externos e produção permanecem **NÃO VALIDADOS**.
