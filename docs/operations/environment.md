# Ambiente e Runtime do ORION ERP

## Inicialização

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

O `.env.example` define os nomes das variáveis. Secrets reais não devem ser
registrados em documentação, logs ou commits. O Compose exige
`POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET` e
`OPERATOR_WEBHOOK_SECRET`; ele não fornece defaults de desenvolvimento para
esses valores.

## Verificação

- ERP: `http://localhost`
- API: `http://localhost/api/v1`
- Health check: `http://localhost/health`

Antes de afirmar que uma mudança está disponível, confirmar que o stack em
execução utiliza a imagem ou o código mais recente.

Para produção, consultar `README-DEPLOY.md` na raiz. Ele descreve somente o
fluxo de deploy atualmente observado, sem impor infraestrutura ou CI/CD futuro.
