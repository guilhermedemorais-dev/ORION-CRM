# Lote 1: Pipeline Foundation

## Goal

Introduce a canonical multi-pipeline foundation without breaking the current lead workflow.

## Scope

### Database

- Create `pipelines`
- Add `pipeline_id` to `pipeline_stages`
- Add `pipeline_id` to `leads`
- Seed default pipelines:
  - `leads`
  - `pedidos`
  - `producao`
- Backfill all existing stages and leads to `leads`
- Keep legacy `leads.stage` for compatibility only

### API

- Add canonical route family under `/api/v1/pipelines`
- Keep minimal compatibility for current `/api/v1/pipeline/stages`
- Add list/create/update/toggle/delete for pipelines
- Add flow save and publish endpoints
- Add stage list/create/reorder endpoints scoped to a pipeline
- Add lead board endpoint scoped to a pipeline slug or id

### Frontend

- Replace static pipeline-related menu items with backend-driven pipeline navigation
- Add `/pipeline/[slug]` route using the current lead kanban as the initial `leads` pipeline implementation
- Add `/pipeline/[slug]/builder` admin-only route
- Keep `/leads` as a compatibility entrypoint

## Non-Goals

- No multichannel inbox work
- No financial redesign
- No store settings or checkout redesign
- No analytics implementation
- No assistant tool-calling rebuild

## Acceptance

- Existing leads render through `/pipeline/leads`
- `/leads` remains functional as a bridge
- Admin can access the builder route
- Non-admin cannot access the builder route
- Existing stage moves still persist correctly
- Stage and lead backfill preserve current data

## Dependencies

- Add test harness before migration-heavy work
- Add canvas/drag-and-drop dependencies only when builder UI is introduced
