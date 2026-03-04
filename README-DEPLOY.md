# ORION CRM — Deploy Operacional

## 1. Preparacao do VPS

- Instale Docker Engine e Docker Compose plugin
- Garanta DNS apontando para o servidor
- Libere portas `80` e `443`
- Crie o diretório de deploy e copie o repositório

## 2. Ambiente

Crie `.env` a partir de `.env.example` e preencha:

- obrigatorios do core:
  - `POSTGRES_PASSWORD`
  - `DATABASE_URL`
  - `REDIS_URL`
  - `JWT_SECRET`
  - `JWT_REFRESH_SECRET`
  - `OPERATOR_WEBHOOK_SECRET`
  - `APP_URL`
  - `FRONTEND_URL`
- integrações:
  - `META_*`
  - `MP_*`
  - `OPENAI_API_KEY`
  - `N8N_API_KEY`
  - `N8N_WEBHOOK_URL`

## 3. Build e subida

```bash
docker compose config
docker compose up -d --build
```

## 4. Verificacoes pos-deploy

```bash
curl -I http://SEU_DOMINIO/health
curl -I http://SEU_DOMINIO/login
curl -I http://SEU_DOMINIO/catalogo
```

Checks esperados:
- landing publica carregando
- login do CRM carregando
- API respondendo
- `n8n` sem porta publica exposta

## 5. SSL

O `nginx/nginx.conf` ja deixa o bloco preparado para ativar SSL.

Passos:
- montar certificados em `nginx/ssl`
- descomentar `listen 443 ssl http2`
- descomentar `ssl_certificate` e `ssl_certificate_key`
- opcionalmente reativar redirecionamento `80 -> 443`
- rebuild do `nginx`

## 6. n8n

- O container `n8n` roda apenas na rede interna do Compose
- Nao existe publish de porta
- Importe os workflows em `n8n/workflows/`
- Configure credencial HTTP Header Auth com `Authorization: Bearer <N8N_API_KEY>`

## 7. Restore basico

- Banco: restore em `postgres`
- Uploads: restaurar volume `uploads_data`
- n8n: restaurar volume `n8n_data`

## 8. Observacao operacional

Servicos internos nao devem ser expostos diretamente:
- `postgres`
- `redis`
- `n8n`

Todo trafego externo deve entrar apenas por `nginx`.
