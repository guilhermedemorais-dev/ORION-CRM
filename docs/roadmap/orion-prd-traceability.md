# ORION CRM PRD Traceability Matrix

## Canonical Inputs

| Module | Canonical PRD | Supporting files | Current code status | Target phase |
| --- | --- | --- | --- | --- |
| Pipeline | `PRD.DOCS/Papiline Feature/07-03-26/15-PIPELINE-MODULE.md` | `15-B-LEAD-DETAIL.md`, `mockup-kanban-funcionario.html`, `mockup-pipeline-builder.html`, `mockup-lead-detail.html`, `CODEX-PIPELINE-PROMPT.md` | Partial lead pipeline exists; no canonical `pipelines` model; sidebar static; no builder route | Phase 1 |
| Inbox | `PRD.DOCS/Inbo Feature/03-08-26/16-INBOX-MODULE.md` | `mockup-inbox-v2.html`, `CODEX-INBOX-PROMPT.md` | Reduced WhatsApp-focused inbox exists; no multichannel model or realtime layer | Phase 2 |
| Automations | `PRD.DOCS/10-AUTOMATION-MODULE.md` | n/a | n8n CRUD exists; UI is JSON editor, not visual builder | Phase 2 |
| Finance | `PRD.DOCS/Financeiro feature/F-05-03-26/14-FINANCEIRO.md` | `mockup-financeiro.html`, `CODEX-FINANCEIRO-PROMPT.md` | Basic entries page exists; no PRD dashboard, filters, upload, or commissions ranking | Phase 3 |
| E-commerce | `PRD.DOCS/E-commerce Feature/03-08-26/17-ECOMMERCE-MODULE.md` | `15-B-LEAD-DETAIL.md`, `mockup-ecommerce-web.html`, `mockup-ecommerce-mobile.html`, `mockup-settings-loja.html` | Public catalog exists; no store config, public product route, or store order model | Phase 3 |
| Analytics | `PRD.DOCS/Analytics feature/03-08-26/18-ANALYTICS-MODULE.md` | `mockup-analytics.html` | Placeholder page only | Phase 4 |
| AI Assistant | `PRD.DOCS/11-AI-ASSISTANT.md` | n/a | Heuristic assistant exists; no tool-calling contract or PRD function surface | Phase 4 |

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

- `PRD.DOCS/Papiline Feature/05-03-26/12-PIPELINE-UPGRADE.md`
  - Not present on disk in this workspace
  - Treated as editor-local draft, not implementation canon
