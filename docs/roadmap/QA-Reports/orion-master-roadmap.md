# ORION CRM Master Roadmap

## Canon

- Source of truth: latest saved PRDs under `PRD.DOCS/`
- Out of canon: `PRD.DOCS/Papiline Feature/05-03-26/12-PIPELINE-UPGRADE.md` because it is not saved in this workspace
- Runtime model: single-tenant instance
- Governance: manual docs and checkpoints because `factory-workflow/` is not present in this repo

## Delivery Order

### Phase 0: Consolidation

- Build PRD traceability matrix
- Map current codebase coverage vs PRD scope
- Freeze phase ordering and first executable lot
- Record explicit gaps and deferred items

### Phase 1: Pipeline Foundation

- Canonical `pipelines` model in database and API
- Dynamic sidebar driven by active pipelines
- Web routes:
  - `/pipeline/[slug]`
  - `/pipeline/[slug]/builder`
- Legacy bridge:
  - `/leads` remains operational and points to `leads` pipeline
- First acceptance target:
  - no lead/stage data loss
  - admin-only builder
  - employee-safe kanban access

### Phase 2: Inbox v2 and Visual Automations

- Multichannel inbox data model
- Realtime events for conversation updates
- Quick replies and assignment workflow
- Visual automation builder on top of existing n8n integration

### Phase 3: Storefront and Financial v2

- Public store with config, category, product, and order models
- Mercado Pago checkout linked to current order/payment flow
- Financial dashboards, filters, receipt upload, and commissions

### Phase 4: Analytics and AI Assistant

- Analytics page with cross-module KPIs and period filters
- Claude tool-calling assistant with RBAC-enforced data access
- Phase only starts after phases 1-3 stabilize their contracts

## Phase Gates

- Phase 0 gate:
  - every PRD file mapped to a phase or explicitly deferred
- Phase 1 gate:
  - migrations applied without breaking current lead flows
  - sidebar, pipeline route, and builder RBAC working
- Phase 2 gate:
  - inbox model and automation builder aligned with n8n and channel integrations
- Phase 3 gate:
  - store checkout and finance dashboard backed by stable APIs
- Phase 4 gate:
  - analytics and assistant consume stable, tested contracts

## Deferred by Default

- Multi-tenant `org_id` model
- Wishlist, reviews, AI-generated product descriptions
- Page builder for store
- Additional direct channels beyond WhatsApp, Instagram DM, Telegram
