# Visão de Arquitetura do ORION ERP para Joalherias

## Runtime Canônico

O ORION ERP é um monorepo executado por `docker compose` a partir da raiz. CRM
é um domínio do produto, não sua fronteira. Não devem ser criados stacks
paralelos para desenvolvimento ou validação.

## Componentes

- `apps/web`: Next.js 14 App Router e TypeScript estrito.
- `apps/api`: Node.js 20, Express e TypeScript estrito.
- PostgreSQL 16: persistência transacional.
- Redis e BullMQ: cache e processamento assíncrono.
- Integrações n8n, WhatsApp, Mercado Pago, IA, ViaCEP e transportadoras:
  conectores externos configurados por ambiente, não serviços declarados pelo
  Compose atual.
- NGINX: entrada HTTP e proxy; serviços internos não devem ser expostos.

## Princípios

- Instância isolada por cliente, sem `tenant_id` no domínio.
- Pagamentos e estoque são transacionais.
- Webhooks retornam rapidamente e delegam processamento para filas.
- Autorização é aplicada por RBAC; cobertura de audit log deve ser conferida
  por domínio, não presumida como universal.
- Alterações arquiteturais relevantes devem receber um ADR em `decisions/`.

O contrato histórico permanece em `../product/ORION-CRM-PRD-v1.2.md`. Há
divergência entre o PRD que menciona Activepieces/Python e o baseline atual de
código/Compose que usa TypeScript e referências a n8n. Consulte
`../handoff/ERP-OPERATING-MANUAL.md` e trate qualquer convergência como decisão
arquitetural explícita.
