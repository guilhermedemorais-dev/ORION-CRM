# ORION CRM PRD Traceability Matrix

## Canonical Inputs

| Module | Canonical PRD | Supporting files | Current code status | Target phase |
| --- | --- | --- | --- | --- |
| Pipeline | `docs/modules/pipeline/prd.md` | `docs/modules/pipeline/lead-detail.md`, `docs/modules/pipeline/builder-prd-v2.md`, `docs/design/mockups/pipeline/`, `.project-ai/prompts/archive/pipeline.md` | Partial lead pipeline exists; no canonical `pipelines` model; sidebar static; no builder route | Phase 1 |
| Inbox | `docs/modules/inbox/prd-v2.md` | `docs/modules/inbox/current-state.md`, `docs/design/mockups/inbox/v2.html`, `.project-ai/prompts/archive/inbox-v1.md` | Reduced WhatsApp-focused inbox exists; no multichannel model or realtime layer | Phase 2 |
| Automations | `docs/modules/automations/prd.md` | n/a | n8n CRUD exists; UI is JSON editor, not visual builder | Phase 2 |
| Finance | `docs/modules/financeiro/prd.md` | `docs/design/mockups/financeiro/overview.html`, `.project-ai/prompts/archive/financeiro.md` | Basic entries page exists; no PRD dashboard, filters, upload, or commissions ranking | Phase 3 |
| E-commerce | `docs/modules/ecommerce/prd.md` | `docs/design/mockups/ecommerce/` | Public catalog exists; no store config, public product route, or store order model | Phase 3 |
| Analytics | `docs/modules/analytics/prd.md` | `docs/design/mockups/analytics/overview.html` | Placeholder page only | Phase 4 |
| AI Assistant | `docs/modules/ai-assistant/prd.md` | n/a | Heuristic assistant exists; no tool-calling contract or PRD function surface | Phase 4 |

## Current Code Gaps

### Global

- No test suite configured for current feature delivery
- No phase artifacts or PRD traceability docs existed in repo
- No multi-pipeline model; leads are still the de facto single pipeline
- Sidebar navigation is static and not driven by backend state

### Pipeline

- `pipeline_stages` exists, but `pipelines` table does not
- Current API is stage-centric, not pipeline-centric
- Current UI route is `/leads`, not `/pipeline/[slug]`
- No persisted builder canvas or publish workflow

### Inbox

- Current data model is WhatsApp-first
- No `channel`, `external_id`, `quick_replies`, or `channel_integrations`
- No websocket layer

### Automations

- Existing n8n service is reusable
- Missing React Flow builder and richer metadata model for system/custom flows

### Finance

- `financial_entries` exists and can be reused
- Missing dashboard endpoint family, receipt upload flow, period contract, and chart datasets

### Store

- Existing `products` and payment flow are partial building blocks
- Missing store configuration, store categories, public product detail route, store order model, and admin settings page

### Analytics and Assistant

- Analytics depends on stable contracts from pipeline, orders, store, production, and finance
- Assistant depends on stable function surface and RBAC-safe data access across modules

## Explicit Non-Canon Inputs

- Documento histórico `12-PIPELINE-UPGRADE.md`
  - Not present on disk in this workspace
  - Treated as editor-local draft, not implementation canon
