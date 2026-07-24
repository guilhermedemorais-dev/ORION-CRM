# Regras de Arquitetura

- Preservar a stack definida no PRD e em `docs/architecture/overview.md`.
- Usar o `docker compose` existente na raiz.
- Não introduzir serviço, banco, fila ou proxy paralelo sem decisão registrada.
- Manter serviços internos fora do NGINX público.
- Registrar decisões estruturais em `docs/architecture/decisions/`.
- Tratar estoque, pagamento, autenticação e webhooks como áreas críticas.

