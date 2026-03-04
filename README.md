# ORION CRM

Monorepo do ORION CRM com:
- `apps/api`: API Express + TypeScript
- `apps/web`: Next.js 14 (CRM + landing publica)
- `nginx`: reverse proxy
- `n8n/workflows`: automacoes importaveis

## Stack local

```bash
docker compose up -d --build
```

Entradas locais:
- `http://localhost` — landing publica e CRM
- `http://localhost/api/v1` — API
- `http://localhost/health` — health check

## Blocos entregues

- Bloco 1: fundacao backend
- Bloco 2: design system + shell
- Blocos 3 a 7: CRM operacional interno
- Bloco 8: landing publica, catalogo, captacao e base de automacao com n8n

## Credenciais locais de teste

- `admin.inbox@orion.local`
- `producao.teste@orion.local`
- senha: `SenhaForte123!`

## Deploy

Consulte [README-DEPLOY.md](/home/guimp/Documentos/Orion-CRM/README-DEPLOY.md) para o fluxo operacional de VPS, `.env`, SSL e publicacao.
