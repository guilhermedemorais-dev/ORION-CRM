# Segunda passada técnica, linha de base

## Escopo e regra de evidência

Esta segunda passada documenta o comportamento verificável do código. Não
promove uma tela, endpoint, integração ou fluxo a `IMPLEMENTADO` sem evidência
no commit de referência ou validação declarada. Não gera snapshot durante esta
etapa.

## Baseline canônico de handoff

| Item | Evidência |
| --- | --- |
| Commit auditado | `29c1639080a48105bd3a1c9e8c9c355636aa6024` (`29c1639`) |
| Branch no diretório de trabalho | `feat/board-excluir-renomear` |
| Migrations do baseline | `001_settings.sql` a `062_backfill_product_category_name.sql` |
| Aplicação web | Next.js em `apps/web` |
| API | Express/TypeScript em `apps/api` |
| Persistência declarada | PostgreSQL e Redis, via `docker-compose.yml` |

## Separação obrigatória do WIP local

No início desta auditoria a árvore de trabalho continha alterações não
commitadas em API e web, além da migration `063_flow_stage_stock_action.sql` e
documentos de `production-debug`. Esses itens não pertencem ao commit-base, não
foram incorporados ao snapshot inicial e devem ser tratados como **NÃO
VALIDADOS** até terem commit, revisão e evidência própria. Esta documentação não
os usa para afirmar comportamento entregue.

## Superfícies encontradas no código

- A API monta rotas de negócio em `apps/api/src/index.ts`, incluindo auth,
  clientes, leads, pipeline, inbox, agenda, pedidos, produção, estoque,
  financeiro, PDV, integrações, automações, configurações, suporte e sistema.
- O frontend possui páginas do CRM para dashboard, leads, clientes, inbox,
  agenda, pedidos, produção, estoque, financeiro, PDV, automações, analytics,
  chamados e ajustes, além da loja pública.
- As migrations SQL são executadas por `apps/api/src/db/migrate.ts`; a execução
  contra PostgreSQL real permanece **NÃO VALIDADA** nesta passada.
- Serviços, workers e integrações devem ser mapeados pela implementação real,
  não pelo PRD histórico.

## Divergências já confirmadas

| Tema | PRD/documentação histórica | Código/infraestrutura encontrada | Status |
| --- | --- | --- | --- |
| Automação | PRD descreve Activepieces e container Python IA | Compose e rotas atuais referenciam n8n e serviços TypeScript | DIVERGÊNCIA, investigar por módulo |
| Deploy | README-DEPLOY descreve build direto por Compose | `.github/workflows/deploy.yml` copia `docs/` para o contexto da API antes do build e publica imagens GHCR | DIVERGÊNCIA operacional documentada |
| Ficha do cliente | PRD presume fluxo linear completo | Auditorias existentes já apontam contratos e fluxos parciais | PARCIAL, exige rastreio endpoint a endpoint |
| WIP | Diretório de trabalho contém migration 063 e mudanças locais | Commit de handoff termina na migration 062 | FORA DO BASELINE |

## Gate da Base Técnica de Suporte

A Base Técnica foi implementada após spec em `docs/specs/support/`, task
`TASK-062`, issue #62 e aprovação desta solicitação. Ela é uma **feature de
segurança**, não simples organização documental: usa UI, rota API, guarda
explícita `role === 'ADMIN'`, allowlist de Markdown e testes negativos. A
evidência do pacote exportado está em
`VALIDACAO-CRUZADA-SEGUNDA-PASSADA.md`; browser autenticado e produção seguem
**NÃO HOMOLOGADOS**.

## Próximas evidências a produzir

1. Inventário de endpoints de negócio, com auth, RBAC, entidades e efeitos.
2. Mapa de tabelas e migrations com escritores/leitores reais.
3. Fluxos de usuário, começando pela Ficha do Cliente e pelo encadeamento
   WhatsApp a Entrega.
4. Inventário frontend, integrações, operações e QA.
5. Matriz PRD, specs, tasks e código, marcando lacunas sem inferência.
