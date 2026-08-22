# ORION ERP para Joalherias, deploy atualmente observado

> Este documento registra o deploy que está configurado hoje no repositório para
> facilitar a transição. Não define a estratégia futura do ORION ERP. O próximo
> responsável pode alterar branches, CI/CD, registry, infraestrutura e processo
> de deploy mediante planejamento e validação próprios.

## Fluxo atual

```text
push na main
  → GitHub Actions
  → build das imagens Docker (API, Web e NGINX)
  → push para GitHub Container Registry, GHCR
  → SSH no servidor Hostinger
  → docker compose pull api web nginx
  → atualização dos containers
```

A fonte do fluxo é `.github/workflows/deploy.yml`. O workflow só é disparado
por push na branch `main`.

## O que o workflow faz

1. Faz checkout do código.
2. Autentica no GHCR com o token do GitHub Actions.
3. Copia `docs/` para o contexto de build da API, pois a imagem serve a
   documentação técnica e a infraestrutura monta `./docs:/app/docs:ro`.
4. Constrói e publica as imagens `api:latest`, `web:latest` e
   `nginx:latest` no namespace configurado no workflow.
5. Conecta por SSH ao host atualmente configurado no secret do GitHub.
6. Entra no diretório de deploy existente, autentica o Docker no GHCR,
   executa `docker compose pull api web nginx`.
7. Cria temporariamente um container da imagem da API, extrai `/app/docs`
   para o diretório `./docs/` do host e o remove.
8. Recria somente API, Web e NGINX com
   `docker compose up -d --no-build api web nginx`.
9. Executa `docker image prune -f` para liberar imagens não usadas.

PostgreSQL e Redis não são recriados nesse passo, portanto seus volumes
persistentes permanecem no host.

## Pré-requisitos do host atual

- Docker Engine e Docker Compose plugin.
- Diretório de deploy contendo `docker-compose.yml`, `.env`, volumes e a
  pasta `docs/` que será atualizada pelo workflow.
- Rede externa `traefik-proxy`, declarada como external no Compose.
- Secrets de deploy no GitHub Actions, inclusive chave SSH e token de leitura
  do GHCR. Eles não fazem parte do repositório nem deste snapshot.
- Variáveis obrigatórias em `.env` ou ambiente do host:
  `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET` e
  `OPERATOR_WEBHOOK_SECRET`. O Compose entregue falha de propósito se elas
  não forem fornecidas.

## Topologia usada pelo Compose

| Serviço | Papel | Persistência/observação |
| --- | --- | --- |
| PostgreSQL | dados do ERP | volume `postgres_data` |
| Redis | cache e filas | volume `redis_data` |
| API | Express, migrations e workers | executa migrations no start; volume de uploads e docs read-only |
| Web | Next.js | chama API pela rede interna |
| NGINX | ponto de entrada HTTP(S) | conecta à rede externa Traefik |
| Adminer | ferramenta administrativa de banco | exposta pelo roteamento Traefik configurado |

O Compose atual **não declara um serviço n8n**. A API aceita configuração para
n8n e outras integrações externas, mas elas são recursos externos a este
Compose e devem ser instaladas, autenticadas e homologadas separadamente.

## Verificações pós-deploy ainda necessárias

O workflow não executa smoke test HTTP explícito. Depois de qualquer deploy,
quem operar deve validar, no mínimo:

```bash
docker compose ps
docker compose logs --tail=200 api web nginx
curl -fsS https://SEU_DOMINIO/health
curl -fsSI https://SEU_DOMINIO/login
```

Também validar migration aplicada, login autenticado, leitura/escrita em banco,
uploads e o fluxo de negócio alterado. Integrações com Meta, Mercado Pago, n8n,
IA e transportadoras devem ter testes próprios autorizados.

## Limites conhecidos

- Este documento não prova acesso atual ao servidor Hostinger, nem backups,
  restore, rollback, DNS, certificados ou observabilidade.
- A documentação antiga que descrevia n8n como container do Compose não
  representa a configuração encontrada em `docker-compose.yml`.
- O mecanismo atual usa tags `latest`; não há evidência nesta entrega de tag
  imutável por release, rollback automatizado ou promotion entre ambientes.
- Não há obrigação de preservar GHCR, SSH, Traefik ou Hostinger na próxima
  operação. A mudança só precisa ser planejada para proteger banco, uploads,
  secrets, migrations e rollback.
