# TASK-042: Exportar incidentes do suporte com prints

## Status visual
- Status visual: Em andamento
- Status Kanban: In Review
- Responsavel: Codex
- Issue criada / vinculada: #42
- Branch sugerida: `feat/support-incident-export`
- Milestone: Suporte
- Labels sugeridas: `feature`, `high-priority`
- Pronto para GitHub Projects: sim

## Tipo
Feature

## Prioridade
P1

## Objetivo
Implementar exportacao de incidentes registrados no Suporte, com prints/anexos,
para que Guilherme consiga baixar o pacote e transformar os relatos em tasks de
backlog.

## Specs obrigatorias
- `docs/specs/support/incident-export/module-spec.md`

## Docs obrigatorios
- `docs/README.md`
- `docs/modules/README.md`
- `docs/product/ORION-CRM-PRD-v1.2.md`
- `docs/product/ORION-BUILD-GUIDE.md`

## Arquivos e modulos permitidos
- `apps/api/src/routes/tickets.routes.ts`
- `apps/web/app/api/internal/[...path]/route.ts`
- `apps/web/app/(crm)/chamados/components/ChamadosClient.tsx`

## Fora do escopo
- Criar tasks automaticamente no GitHub.
- Criar PDF.
- Alterar schema de banco.
- Exportar dados de roadmap/debug.

## Estado atual encontrado
- `system_tickets` ja guarda incidentes e anexos em `attachments JSONB`.
- `tickets.routes.ts` lista, cria e atualiza status, mas nao exporta.
- A UI de `Incidentes` nao tem selecao nem download.
- O proxy interno do Next repassa respostas como texto, o que corromperia ZIP.

## Resultado esperado
- Admin/root consegue selecionar incidentes e baixar pacote `.zip`.
- Admin/root consegue baixar todos os incidentes.
- O zip contem `incidents.md` e arquivos de `attachments/`.

## Regras obrigatorias da implementacao
- Exportacao restrita a `ROOT` e `ADMIN`.
- Resolver anexos somente dentro de `UPLOAD_PATH`.
- Nao falhar exportacao inteira por anexo ausente.
- Sem dependencias novas para zip.

## Checklist de execucao
1. Criar endpoint `POST /api/v1/tickets/export`.
2. Gerar ZIP sem dependencia nova.
3. Ajustar proxy interno para preservar binarios e `Content-Disposition`.
4. Adicionar selecao e botoes de download na UI de Incidentes.
5. Rodar typecheck de API e web.

## Prompt para o executor
Use esta task como contrato operacional. Leia a spec obrigatoria e implemente
apenas a exportacao de incidentes em ZIP, com Markdown e anexos. Nao crie tasks
automaticamente e nao altere schema de banco.

## Condicoes de parada
- Necessidade de alterar o schema de `system_tickets`.
- Necessidade de acessar anexos fora de `UPLOAD_PATH`.
- Falha estrutural no proxy que exija refatoracao ampla.

## Testes obrigatorios
- `npm run typecheck --prefix apps/api`
- `npm run typecheck --prefix apps/web`

## Evidencias esperadas no PR
- Saida dos typechecks.
- Descricao do formato do ZIP.

## Criterios de aceite
- `Baixar selecionados` funciona com 1+ incidentes selecionados.
- `Baixar tudo` funciona com a lista completa.
- ZIP abre com `incidents.md` e anexos.
- Usuarios nao admin nao veem os controles.

## Banco
Sem alteracao.

## API/Backend
Novo endpoint de exportacao.

## Frontend/UI
Controles de selecao e download na aba Incidentes.

## Validacao
- `npm run typecheck --prefix apps/api`: passou.
- `npm run typecheck --prefix apps/web`: passou.
- Runtime com incidentes/anexos reais: NAO VALIDADO nesta rodada.

## Riscos/Lacunas
- Validacao runtime depende de haver incidentes com anexos reais no ambiente local.
- Anexos ausentes entram no Markdown como `NAO EXPORTADO`, sem quebrar o ZIP.

## Resultado da execucao
Implementado.

### Banco
Sem alteracao de schema.

### API/Backend
- Criado `POST /api/v1/tickets/export`.
- Exportacao restrita a `ROOT` e `ADMIN`.
- Pacote gerado em `.zip` com `incidents.md` e pasta `attachments/`.
- Anexos sao resolvidos apenas quando apontam para `/uploads/` dentro de
  `UPLOAD_PATH`.

### Frontend/UI
- Adicionados controles para selecionar incidente individualmente.
- Adicionados comandos `Selecionar tudo`, `Baixar selecionados` e `Baixar tudo`.
- Controles aparecem apenas para `ROOT` e `ADMIN`.

### Validacao
- Typecheck da API passou.
- Typecheck da Web passou.
- Download real com incidente e print do ambiente local ainda precisa ser
  validado manualmente.
