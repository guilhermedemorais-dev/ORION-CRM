# Decisões arquiteturais observadas

## Como ler

Estas são decisões inferidas da implementação do commit `29c1639`, não uma
reconstrução de intenção histórica. Quando não há ADR, issue ou PR que explique
a escolha, a motivação original é marcada como **NÃO DOCUMENTADA**.

| ID | Contexto e decisão atual | Evidência | Consequência e trade-off |
| --- | --- | --- | --- |
| ADR-01 | **Monólito web + API separado.** Next.js serve a experiência web e Express concentra regras e acesso ao Postgres. | `apps/web`, `apps/api/src/index.ts`, Nginx `/`→web e `/api/`→api | separa UI e API, mas introduz proxy interno (`/api/internal`) e dois builds. Motivação original: NÃO DOCUMENTADA. |
| ADR-02 | **PostgreSQL é a persistência transacional; migrations SQL são o histórico de schema.** | `apps/api/src/db/migrate.ts`, migrations 001–062 do baseline, Compose `postgres:16-alpine` | permite evolução ordenada por `_migrations`; falha de migration bloqueia startup pois API executa migration antes de iniciar. Backup/restore não está homologado. |
| ADR-03 | **Redis/BullMQ atende tarefas assíncronas.** | `appointmentReminder.worker.ts`, worker WhatsApp, Compose Redis | desacopla lembretes/worker da requisição; se Redis falhar, funcionalidades assíncronas degradam. Não há prova runtime da fila nesta passada. |
| ADR-04 | **Nginx é roteador de borda, com Traefik também presente na infraestrutura.** | `nginx/nginx.conf`, labels Traefik em Compose | Nginx expõe `/`, `/api`, `/health` e uploads; n8n responde 404 publicamente. A coexistência Nginx+Traefik aumenta camadas de diagnóstico. Motivação original: NÃO DOCUMENTADA. |
| ADR-05 | **Imagens imutáveis por build, tag móvel `latest`, deploy por GHCR/SSH.** | `.github/workflows/deploy.yml`, Compose images GHCR | entrega simples, mas `latest` dificulta rollback determinístico. O deploy não preserva um digest/tag de release no repositório. |
| ADR-06 | **n8n é engine externo e só conversa com API HTTP.** | `services/n8n.service.ts`, `routes/n8n.routes.ts`, Nginx bloqueia `/n8n/` | evita acesso direto do n8n ao banco, mas o Compose não sobe n8n. Sem instância, credencial e workflows validados, automações permanecem não homologadas. |
| ADR-07 | **Autorização primária por role JWT com exceção ROOT e permissões customizadas em pontos selecionados.** | `middleware/auth.ts`, `rbac.ts`, `permissions.ts` | simples para administração, porém `ROOT` ignora guards `requireRole`; esconder tela não é controle suficiente. A Base Técnica exigirá guard ADMIN estrito. |
| ADR-08 | **Dinheiro é inteiro em centavos e PDV finaliza em transação.** | `order-financial.service.ts`, routes PDV/financeiro, migrations | reduz erro de ponto flutuante e preserva atomicidade de venda, estoque e financeiro. Deve ser testado com concorrência real antes de homologar. |
| ADR-09 | **Assistente IA consulta por funções internas filtradas por role.** | `assistant.service.ts`, `assistant.routes.ts` | reduz acesso direto do modelo ao banco, mas as consultas e o prompt ainda requerem teste negativo contra exposição por role/prompt injection. |
| ADR-10 | **Configuração de Copiloto e skills é persistida no banco.** | migration 043, `ai-copilot.service.ts` | facilita administração, mas `api_key_enc` não recebe criptografia no código atual, apesar do nome. Tratar como segredo em texto até correção especificada e aprovada. |
| ADR-11 | **Documentação é incluída no contexto da imagem API e bind-mounted no host.** | passo `Copy docs into API context` e `docker cp` da Action; volume `./docs:/app/docs:ro` | timeline/recursos podem ler documentação sem novo volume de imagem. O processo é especial do deploy atual e deve ser reavaliado pelo novo responsável. |
| ADR-12 | **A interface de automações é um builder curado, não um executor.** | `automations.routes.ts`, `automation-catalog.service.ts`, tela Automações | reduz superfície de nós expostos, mas a API apenas valida formato do JSON; não valida schema vivo/conexões do n8n antes de ativar. |

## Decisões que não devem ser deduzidas

- Não há evidência suficiente para afirmar que Google Calendar está integrado,
  que UAZAPI/UAIZAP é o provedor em uso, nem que uma instância n8n é gerida pelo
  Compose deste repositório.
- Não há decisão documentada que una `attendance_blocks`/`service_orders` a
  `orders`/`production_orders`. São trilhas paralelas no código atual.
- O PRD contém referências históricas a Activepieces e Python AI; elas não
  descrevem a arquitetura executável observada.

## Impacto para evolução

1. Antes de trocar CI/CD ou infraestrutura, preservar a sequência migration →
   API e testar volumes `postgres_data`, `redis_data` e `uploads_data`.
2. Antes de implementar automação/IA, decidir a fonte de verdade da credencial,
   rotação e validação de workflow, sem colocar segredo em definição de nó.
3. Antes de unificar fluxo comercial, obter decisão de negócio para proposta,
   pedido, OS e produção em vez de conectar entidades por conveniência técnica.

Referências: `ARQUITETURA-E-OPERACOES-ATUAL.md`,
`AUTOMACOES-E-IA-TECNICO.md`, `RBAC-E-INTEGRACOES-TECNICO.md` e
`ESTOQUE-FINANCEIRO-PDV-TECNICO.md`.
