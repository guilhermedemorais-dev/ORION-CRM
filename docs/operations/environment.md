# Ambiente e Runtime

## Inicialização

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

O `.env.example` define as variáveis exigidas. Secrets reais não devem ser
registrados em documentação, logs ou commits.

## Verificação

- CRM: `http://localhost`
- API: `http://localhost/api/v1`
- Health check: `http://localhost/health`

Antes de afirmar que uma mudança está disponível, confirmar que o stack em
execução utiliza a imagem ou o código mais recente.

Para produção, consultar `README-DEPLOY.md` na raiz.

