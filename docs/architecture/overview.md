# Visão de Arquitetura

## Runtime Canônico

O ORION CRM é um monorepo executado por `docker compose` a partir da raiz. Não
devem ser criados stacks paralelos para desenvolvimento ou validação.

## Componentes

- `apps/web`: Next.js 14 App Router e TypeScript estrito.
- `apps/api`: Node.js 20, Express e TypeScript estrito.
- PostgreSQL 16: persistência transacional.
- Redis e BullMQ: cache e processamento assíncrono.
- Activepieces: automações internas.
- Python/FastAPI: serviços de IA previstos pelo PRD.
- NGINX: entrada HTTP e proxy; serviços internos não devem ser expostos.

## Princípios

- Instância isolada por cliente, sem `tenant_id` no domínio.
- Pagamentos e estoque são transacionais.
- Webhooks retornam rapidamente e delegam processamento para filas.
- Autorização é aplicada por RBAC e escritas geram audit log.
- Alterações arquiteturais relevantes devem receber um ADR em `decisions/`.

O contrato detalhado permanece em `../product/ORION-CRM-PRD-v1.2.md`.

