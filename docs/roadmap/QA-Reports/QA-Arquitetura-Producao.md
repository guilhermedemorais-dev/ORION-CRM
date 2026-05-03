# QA Arquitetura e Produção

## 1. Resumo executivo
O projeto **não está pronto para produção** no estado atual.

Classificação geral:
- **NÃO RECOMENDADO PARA PRODUÇÃO**

Motivos principais:
- há falhas críticas de segurança e operação, incluindo credenciais reais expostas no ambiente do projeto e segredo OAuth versionado;
- existem falhas de autorização em rotas que permitem acesso indevido a dados de agendamentos e alteração/exclusão de veículos;
- uploads/KYC são gravados em disco local público, sem storage externo, sem validação robusta de tipo/conteúdo e com exposição direta por URL;
- o sistema depende de MySQL para sessão, persiste logs localmente e no banco, não tem filas reais e ainda não está preparado para múltiplas instâncias com segurança operacional adequada;
- a observabilidade é insuficiente para go-live e vários pontos de performance/escalabilidade dependem de queries sem índices compostos e de enriquecimento N+1.

Pontos positivos validados:
- stack coerente com MySQL 8 (`mysql2`, Drizzle, `mysql:8.4` em Docker);
- `sessions.expires` compatível com `express-mysql-session`;
- typecheck local passou com `npm run check`;
- testes unitários/smoke locais passaram com `npm run test:unit`.

## 2. Matriz de criticidade

| Área | Problema encontrado | Evidência no código/configuração | Impacto | Criticidade | Recomendação |
|---|---|---|---|---|---|
| Secrets | Credenciais reais de produção presentes no diretório do projeto | `.env.production:12-35` contém `DATABASE_URL`, `DB_PASSWORD`, `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET` | Comprometimento de banco, sessão e OAuth | Crítica | Rotacionar tudo imediatamente, remover do host/repo local compartilhado, migrar secrets para cofre/secret manager |
| Secrets | Arquivo OAuth com `client_secret` versionado | `client_secret_658016303923-...json:1` | Abuso de OAuth client, fraude de login | Crítica | Revogar e recriar client OAuth; remover do projeto e distribuir via secret manager |
| Autorização | Qualquer usuário autenticado pode editar/deletar qualquer veículo por ID | `server/routes.ts:1023-1035` | Broken access control, fraude e sabotagem de cadastro | Crítica | Validar ownership/admin antes de `updateVehicle` e `deleteVehicle`; auditar acesso |
| Autorização/Privacidade | Qualquer usuário autenticado pode listar agendamentos de qualquer instrutor e dados de alunos | `server/routes.ts:1119-1139` | Vazamento de agenda e telefone de alunos | Crítica | Restringir a instrutor dono/admin; revisar resposta mínima |
| KYC | Se Anthropic não estiver configurado, o fluxo KYC assume selfie/documento válidos | `server/kyc.ts:46-55`, `123-130`, `201-207` | Aprovação indevida de identidade | Crítica | Falhar em modo seguro quando provedor estiver ausente; exigir revisão manual |
| Uploads/Storage | Uploads KYC são públicos e servidos diretamente do disco local | `server/index.ts:26`, `server/kyc.ts:404-420`, arquivos em `uploads/kyc/...` | Vazamento de PII e inviabilidade em múltiplas instâncias | Crítica | Migrar para S3/R2 com ACL privada, URL assinada e antivírus/scan |
| Sessão/CSRF | Sessão em MySQL sem `sameSite` efetivo e sem proteção CSRF encontrada | `server/auth.ts:164-176`; uso intenso de POST autenticado em `server/routes.ts` | Risco de CSRF e endurecimento insuficiente da sessão | Alta | Definir `sameSite=lax/strict`, rotação de sessão em login e CSRF token/origin check |
| Banco/Índices | Modelo tem poucos índices explícitos; queries críticas usam colunas sem índice composto adequado | `shared/schema.ts:17-445` mostra só 5 índices explícitos; consultas em `server/storage.ts:397-420`, `1227-1229` | Lentidão, lock contention, degradação em crescimento | Alta | Criar índices compostos alinhados a bookings, transactions, withdrawals, messages, reviews, availability |
| Performance | Endpoints públicos e autenticados fazem enriquecimento N+1 | `server/routes.ts:782-838`, `1086-1112`, `1119-1139` | Latência crescente e pressão no banco | Alta | Reescrever com joins/batch queries e paginação |
| Booking | Conflito de agenda é verificado carregando todos os bookings do instrutor em memória | `server/routes.ts:1187-1200` | Escala ruim e risco de corrida em concorrência | Alta | Validar conflito via query indexada + transação/lock/constraint lógica |
| Observabilidade | “System health” retorna métricas aleatórias e health check não valida dependências | `server/routes/admin-control.ts:51-70`, `server/routes.ts:229-246` | Falsa sensação de saúde, troubleshooting fraco | Alta | Health check com DB/Redis; métricas reais em Prometheus/Grafana ou equivalente simples |
| Logs | Logger grava sincronicamente em arquivo local e access log persiste cada request autenticada no MySQL | `server/utils/logger.ts:24-29`, `server/routes.ts:188-218` | I/O bloqueante, crescimento de disco e carga no banco | Alta | Preferir stdout estruturado + agregador; reduzir/graduar access log em DB |
| Redis | Redis existe, mas é usado só para cache HTTP opcional; sessão continua no MySQL | `server/redis.ts:1-90`, `server/cache.ts:1-43`, `server/auth.ts:121-158` | Gargalo em sessão/cache e baixa prontidão para escala horizontal | Alta | Migrar sessão, rate limit distribuído, locks e filas para Redis |
| Filas | E-mail, KYC, webhooks, pagamento e repasse financeiro ainda rodam no caminho síncrono | `server/routes.ts:587-589`, `1860-1909`, `1998-2066`, `2172-2279`, `server/services/fees.ts:37-82` | Timeout, retries pobres e inconsistência operacional | Alta | Adotar workers/queue com retries, DLQ e idempotência |
| Infra | `docker-compose.yml` expõe MySQL, Redis e app diretamente | `docker-compose.yml:23-24`, `40-41`, `91-92` | Superfície de ataque desnecessária | Alta | Restringir portas internas; expor só via Nginx/LB |
| Deploy | Script de deploy usa `.env`, não `.env.production`, e profile inexistente | `scripts/deploy.sh:37-59`, `84-109`; `docker-compose.yml` sem `profiles` | Deploy inconsistente e sujeito a erro humano | Alta | Refazer pipeline de build/deploy com ambiente de produção explícito |
| Integridade de dados | `wallets.user_id` e `instructors.user_id` não são únicos no schema | `shared/schema.ts:153-195`, `268-275` | Duplicidade de carteira/perfil e bugs lógicos | Alta | Criar `UNIQUE` para entidades 1:1 esperadas |
| Admin Finance | Endpoint de transações admin sempre retorna vazio por `return []` prematuro | `server/storage.ts:843-860`; consumido em `server/routes/admin-finance.ts:102-127` | Cegueira operacional/financeira | Média | Corrigir implementação antes do go-live |
| Banco | Pool MySQL fixo em 10 conexões, sem separação read/write e sem SSL explícito | `server/db.ts:39-63` | Gargalo e limitação futura para réplica/leitura | Média | Parametrizar pool, SSL e camada read/write futura |
| Backups/DR | Backup automático, retenção, restore testado e RPO/RTO não encontrados | Não encontrado no código/docs inspecionados | Risco alto de perda de dados | Alta | Implementar backup automático, retenção, criptografia e restore drill periódico |
| CORS/Headers | `helmet`, CSP, HSTS e política de CORS explícita não encontrados | Não encontrado em `server/` | Hardening web insuficiente | Média | Adotar headers de segurança e política explícita |

## 3. Banco de dados MySQL 8

### Versão esperada
- Validado uso de MySQL 8.x na documentação e no container: `docker-compose.yml:4-24` usa `mysql:8.4`.
- Driver/ORM adequados: `server/db.ts:1-73` usa `mysql2/promise` + Drizzle.

### Estrutura e migrations
- O projeto usa schema manual em `migrations/mysql-schema.sql` e schema Drizzle em `shared/schema.ts`.
- Existe ferramenta de paridade de schema: `scripts/schema-parity-audit.ts:1-129`.
- Há risco de drift porque a fonte operacional mistura SQL manual e schema TypeScript, sem pipeline formal de migration versionada.
- `sessions` está correto para `express-mysql-session`: `shared/schema.ts:17-25`.

### Achados de modelagem
- MySQL 8 é aceitável como banco principal para este projeto.
- `wallets.userId` não é único (`shared/schema.ts:268-275`), embora a lógica trate carteira como 1:1 (`server/services/wallet.ts:10-29`, `44-84`). Isso permite duplicidade por condição de corrida.
- `instructors.userId` também não é único (`shared/schema.ts:153-195`), apesar do código presumir um perfil por usuário.
- `bookings.paymentId` existe, mas não há índice explícito, embora seja consultado em `server/storage.ts:1227-1229`.
- Não encontrei constraints adicionais de negócio para impedir múltiplos reviews por booking, duplicidade de wallet ou duplicidade de instructor profile.

### Índices existentes
Índices explícitos identificados no schema ORM:
- `sessions.expires` em `shared/schema.ts:17-25`
- `user_access_logs(user_id, created_at)` em `shared/schema.ts:346-367`
- `webhooks_events(provider, event_id)` em `shared/schema.ts:393-406`
- `integrations(slug, environment)` em `shared/schema.ts:425-445`
- `integrations(category, environment)` em `shared/schema.ts:425-445`

### Índices ausentes recomendados
Antes de produção, no mínimo:
- `bookings (instructor_id, date)` para conflito de agenda e listagem por instrutor.
- `bookings (student_id, date)` para dashboard do aluno.
- `bookings (payment_id)` para webhooks/pagamentos.
- `bookings (status, created_at)` ou `(status, date)` para painéis administrativos.
- `transactions (status, created_at)` e `transactions (booking_id)`.
- `withdrawals (status, requested_at)`.
- `messages (sender_id, receiver_id, created_at)`.
- `reviews (instructor_id, created_at)`.
- `availability (instructor_id, day_of_week)`.
- `wallets (user_id)` com `UNIQUE`.
- `instructors (user_id)` com `UNIQUE`.

### Queries lentas / N+1 / gargalos prováveis
- `GET /api/instructors` faz N+1 buscando usuário para cada instrutor: `server/routes.ts:782-838`.
- `GET /api/bookings/student` e `GET /api/bookings/instructor/:instructorId` fazem enriquecimento N+1: `server/routes.ts:1086-1112`, `1119-1139`.
- Criação de booking carrega todos os bookings do instrutor para verificar conflito: `server/routes.ts:1187-1200`.
- Recalcular rating busca todas as reviews do instrutor: `server/storage.ts:1385-1399`.
- `userAccessLogs` grava no MySQL a cada request autenticada: `server/routes.ts:188-218`.

### Paginação
- Há paginação parcial em rotas admin via `limit`.
- Não encontrei paginação em várias rotas públicas/autenticadas relevantes: instrutores, reviews, bookings do aluno, bookings do instrutor, support tickets, disputas.

### Backups / restore / DR
- Não encontrei agendamento automático de backup, retenção, criptografia, restore testado, RPO/RTO documentado ou runbook completo.
- Há dumps SQL no projeto, mas isso **não substitui** política de backup operacional.
- Recomendação mínima: backup diário lógico + snapshot físico/volume, retenção por 7/30/90 dias, restore drill mensal em ambiente isolado.

### Read replicas
- Não há preparação real para read replicas.
- `server/db.ts:39-63` abre um único pool read/write, sem roteamento de leitura.
- Isso não bloqueia o MVP, mas precisa entrar na fase de escala futura.

## 4. Redis, sessão e cache

### Uso atual
- Sessões ficam no MySQL: `server/auth.ts:121-158`.
- Redis é opcional e hoje atende apenas cache HTTP simples: `server/cache.ts:1-43`, `server/redis.ts:44-88`.
- Se Redis não conecta, o sistema segue sem cache: `server/redis.ts:31-41`.

### Dependência excessiva do MySQL
- Sessão em MySQL aumenta carga de leitura/escrita em autenticação.
- Access log autenticado também grava no MySQL por request.
- Sem Redis para rate limit distribuído, múltiplas instâncias terão contadores inconsistentes.

### Onde Redis deve entrar antes da produção
- Sessões compartilhadas entre instâncias.
- Rate limit distribuído para login, KYC, pagamentos e rotas públicas sensíveis.
- Cache de leitura para listagem de instrutores, reviews, configurações e integrações não sensíveis.
- Locks distribuídos para booking/payment/webhook idempotency.
- Filas/jobs e retries.
- Dados temporários de captura remota/KYC, hoje parcialmente salvos no banco e em payloads grandes.

### Risco atual sem Redis
- Escala horizontal limitada.
- Maior pressão no MySQL.
- Rate limit inconsistente entre instâncias.
- Sem base segura para jobs/locks/queue.

## 5. Uploads e storage externo

### Situação atual
- Uploads são servidos publicamente em `/uploads`: `server/index.ts:26`.
- KYC salva arquivos localmente em `uploads/kyc/<userId>/...`: `server/kyc.ts:404-420`.
- Há arquivos KYC reais no diretório `uploads/kyc/...`, indicando persistência local de PII.

### Riscos do disco local
- perda de arquivos em redeploy/rollback/host failure;
- inconsistência entre múltiplas instâncias;
- backup difícil e misturado ao filesystem da aplicação;
- exposição pública de documentos sensíveis por URL direta.

### Validação de upload
- Existe `validateKycUpload`, mas não encontrei uso: `server/kyc.ts:379`, busca sem referências adicionais.
- O helper atual apenas remove prefixo data URL e grava `.jpg`: `server/kyc.ts:414-420`.
- Não há validação robusta de MIME real, magic bytes, antivírus, checksum, tamanho efetivo por arquivo, ou conteúdo malicioso.
- `express.json` aceita payload até 50 MB: `server/index.ts:16-23`.

### Recomendação
- Migrar obrigatoriamente para storage S3-compatible privado: AWS S3, Cloudflare R2 ou equivalente.
- Armazenar apenas chave/metadata no banco.
- Servir download por URL assinada e autorização.
- Validar MIME real, tamanho, extensão, nome lógico, vírus/malware e retenção de documentos.
- Considerar processamento assíncrono e quarantena para KYC.

## 6. Nginx, balanceador e múltiplas instâncias

### Estado atual
- A app pode ficar atrás de proxy/Nginx (`trust proxy` está configurado em `server/index.ts:30-32` e `server/auth.ts:184-189`).
- Documentação operacional já assume Nginx: `docs/deploy/vps-production-requirements.md:130-149`.

### Pontos impeditivos para escala horizontal
- uploads dependem de disco local (`docs/deploy/vps-production-requirements.md:151-155`, `server/kyc.ts:404-420`);
- logs locais em `logs/application.log`: `server/utils/logger.ts:8-29`;
- métricas em memória reiniciadas a cada minuto e por instância: `server/routes.ts:50-53`;
- rate limit em memória do processo: `server/index.ts:42-66`, `server/routes.ts:55-74`;
- sessão em MySQL, não em Redis.

### Nginx / LB
- Nginx é adequado, mas o projeto ainda precisa sair do modelo “single process com estado local”.
- O balanceador só faz sentido depois de externalizar sessão/upload/cache/locks e métricas.

### Observações de deploy
- `docker-compose.yml` expõe MySQL, Redis e app diretamente: `docker-compose.yml:23-24`, `40-41`, `91-92`.
- `scripts/deploy.sh` está desalinhado com produção: usa `.env`, não `.env.production`, e chama `docker-compose --profile production up -d` sem `profiles` definidos no compose (`scripts/deploy.sh:37-59`, `84-109`).
- O `deploy.sh` raiz é simplista demais para produção: `git pull`, `npm install`, `npm run build`, sem migração, health gate ou rollback (`deploy.sh:5-18`).

## 7. Filas e jobs assíncronos

Processos que deveriam ir para fila:

| Processo | Risco atual | Recomendação | Prioridade |
|---|---|---|---|
| Envio de e-mail de verificação | SMTP lento impacta cadastro; hoje é fire-and-forget no processo | Job de e-mail com retry e DLQ | Alta |
| KYC por IA | Chamada externa e processamento pesado no request | Worker assíncrono com status `pending/processing/review` | Crítica |
| Persistência/processamento de uploads KYC | I/O local síncrono e PII sensível | Pipeline assíncrono para upload, scan e persistência em storage externo | Crítica |
| Processamento de webhooks de pagamento | Lógica relevante roda inline no webhook | Enfileirar processamento idempotente; responder 2xx rápido | Alta |
| Repasse financeiro / fees | `feesService.distributeBookingRevenue` roda após webhook/request | Worker financeiro com idempotência forte e auditoria | Alta |
| Notificações | Não encontrei worker | Fila de notificações push/e-mail/in-app | Média |
| Webhooks de integrações futuras | Não encontrado | Base comum de dispatcher assíncrono | Média |
| Relatórios e dashboards agregados | Hoje consultam banco online | Jobs de agregação/cache periódico | Média |
| Rotinas recorrentes | Expiração de capture sessions e limpeza de cache não encontradas | Scheduler dedicado (cron + queue) | Média |

Arquitetura sugerida para o stack atual:
- Redis + BullMQ/bee-queue para filas.
- Workers separados do processo web.
- Retries exponenciais, DLQ, idempotency key por booking/payment/webhook.

## 8. Observabilidade

### O que existe
- logger próprio com sanitização parcial: `server/utils/logger.ts:16-40`.
- health check básico: `server/routes.ts:229-246`.
- contadores em memória para requests/erros: `server/routes.ts:50-53`, `173-183`.
- access log detalhado em tabela MySQL: `server/routes.ts:188-218`.

### Lacunas
- não encontrei monitoramento real de slow queries;
- não encontrei métricas de CPU/memória por processo exportadas para stack externa;
- não encontrei monitoramento de conexões MySQL/Redis;
- não encontrei métricas de latência por rota em ferramenta de observabilidade;
- não encontrei alertas, SLOs, tracing, DLQ ou monitor de fila;
- `admin/system-health` devolve números aleatórios para `activeSessions` e `avgResponseTime`: `server/routes/admin-control.ts:55-69`.

### Mínimo necessário para produção
- logs estruturados em stdout + agregação centralizada;
- métricas de app e infra via Prometheus/Grafana, Datadog ou stack equivalente simples;
- health/readiness com verificação de MySQL e Redis;
- monitor de slow query no MySQL 8;
- alarmes para 5xx, latência p95, falha de webhook, fila acumulada, disco/storage e erro de worker;
- dashboard de jobs e retries.

## 9. Segurança operacional

### Secrets e env
- Crítico: `.env.production` contém segredos reais no diretório do projeto (`.env.production:12-35`).
- Crítico: arquivo OAuth com `client_secret` presente no projeto (`client_secret_...json:1`).
- `.gitignore` ignora `.env.production`, então o arquivo atual parece local, mas isso não reduz o risco operacional no host.

### Sessão / autenticação / autorização
- Sessão em MySQL com `httpOnly` e `secure`, mas sem `sameSite` aplicado no código: `server/auth.ts:164-176`.
- Logout limpa cookie sem `sameSite`: `server/auth.ts:565-587`.
- Não encontrei CSRF token ou validação de `Origin/Referer` para rotas state-changing.
- Falhas críticas de autorização em veículos e bookings de instrutor: `server/routes.ts:1023-1035`, `1119-1139`.
- Existe rota de impersonação admin, o que exige logging forte e trilha de auditoria; hoje ela usa `console.log`: `server/routes/admin-control.ts:153-181`.

### SQL injection / XSS / validação
- O uso de Drizzle reduz risco de SQL injection na maior parte das consultas.
- Há validação com Zod em várias rotas, mas não é consistente em todo o projeto.
- Não encontrei política CSP/headers de browser (`helmet`, CSP, HSTS) nem sanitização sistemática de HTML rico.

### Upload malicioso / arquivos
- KYC aceita base64 grande, grava como `.jpg`, sem validação de magic bytes, antivírus ou inspeção de conteúdo: `server/kyc.ts:399-420`.
- Documentos ficam em área pública de arquivos.

### Logs sensíveis
- O logger mascara chaves com nomes típicos (`password`, `token`, `secret`, `apiKey`), mas o sanitizador é heurístico: `server/utils/logger.ts:43-61`.
- Há muito uso de `console.*` fora do logger, inclusive em auth/KYC/payments, o que aumenta o risco de vazamento acidental em logs.
- `userAccessLogs` persiste IP, user-agent e sessão no MySQL: `server/routes.ts:201-215`; isso exige política LGPD/retenção que não encontrei validada.

## 10. Checklist antes de produção
- [ ] Rotacionar imediatamente `DATABASE_URL`, `DB_PASSWORD`, `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET` e o OAuth client comprometido. Prioridade: Crítica. Responsável: segurança/devops.
- [ ] Corrigir controle de acesso em `/api/vehicles/:id` e `/api/bookings/instructor/:instructorId`. Prioridade: Crítica. Responsável: backend/segurança.
- [ ] Remover fallback permissivo do KYC quando provedor externo estiver ausente. Prioridade: Crítica. Responsável: backend/segurança.
- [ ] Migrar uploads/documentos para storage S3/R2 privado com URLs assinadas. Prioridade: Crítica. Responsável: backend/devops.
- [ ] Introduzir Redis para sessão compartilhada, rate limit distribuído, locks e fila. Prioridade: Alta. Responsável: backend/devops.
- [ ] Implementar filas/workers para e-mail, KYC, webhooks e repasse financeiro. Prioridade: Alta. Responsável: backend/devops.
- [ ] Criar índices compostos mínimos de bookings/transactions/withdrawals/messages/reviews. Prioridade: Alta. Responsável: banco/backend.
- [ ] Corrigir deploy script e compose para produção real, sem expor MySQL/Redis publicamente. Prioridade: Alta. Responsável: devops.
- [ ] Adotar backup automático com retenção e restore testado. Prioridade: Alta. Responsável: banco/devops.
- [ ] Implementar observabilidade real: logs centralizados, readiness com DB/Redis, métricas e alertas. Prioridade: Alta. Responsável: devops/backend.
- [ ] Definir `SameSite`, proteção CSRF e headers de segurança. Prioridade: Alta. Responsável: backend/segurança.
- [ ] Corrigir `getAdminTransactions()` para não retornar vazio. Prioridade: Média. Responsável: backend.
- [ ] Revisar retenção e base legal de `userAccessLogs`. Prioridade: Média. Responsável: backend/segurança/produto.
- [ ] Garantir `UNIQUE` em `wallets.user_id` e `instructors.user_id`. Prioridade: Alta. Responsável: banco/backend.

## 11. Plano de correção por fases

### Fase 1 — Obrigatório antes de produção
- Rotação e saneamento de todos os segredos expostos.
- Correção de broken access control em veículos e bookings de instrutor.
- Remoção do fallback permissivo de KYC.
- Migração de uploads/KYC para storage externo privado.
- Redis para sessão compartilhada e rate limit distribuído.
- Filas para KYC, webhooks, e-mail e repasse financeiro.
- Índices mínimos em bookings/transactions/withdrawals/messages/reviews.
- Health/readiness real, logs centralizados e alertas básicos.
- Backup automático com restore validado.
- Hardening de cookie/session/CSRF/security headers.

### Fase 2 — Primeiros 30 dias após produção
- Refatorar endpoints N+1 e incluir paginação ampla.
- Corrigir `getAdminTransactions()` e consolidar painéis administrativos.
- Reduzir/reestruturar `userAccessLogs` em banco.
- Formalizar migrations versionadas e pipeline de schema.
- Revisar limites de pool MySQL, retries e circuit breakers de integrações.

### Fase 3 — Escala futura
- Read replicas com separação read/write.
- Autoscaling horizontal após externalizar estado.
- Cache de leitura mais seletivo e invalidação por evento.
- Observabilidade avançada com tracing distribuído e SLOs.
- Otimizações de agregações financeiras e relatórios assíncronos.

## 12. Conclusão técnica
O projeto tem base funcional razoável e o stack principal é compatível com produção, mas o conjunto atual ainda apresenta **riscos impeditivos** para go-live.

O que pode ficar como está por ora:
- MySQL 8 como banco principal.
- Express + Drizzle + Docker/Nginx como stack base.
- Estratégia atual de testes locais, que pelo menos está verde.

O que precisa ser corrigido antes de produção:
- segurança de segredos;
- autorização das rotas críticas;
- KYC permissivo;
- uploads públicos em disco local;
- sessão/cache/locks/filas com Redis;
- observabilidade mínima e backups/restore.

O que pode esperar:
- read replicas e autoscaling sofisticado, depois que o estado local for externalizado;
- tracing avançado e dashboards mais ricos, após o mínimo operacional entrar.

Maior risco técnico do projeto hoje:
- **combinação de falhas de segurança operacional e estado local acoplado ao processo web**: segredos expostos, controle de acesso quebrado, KYC permissivo, uploads públicos locais e ausência de filas/Redis tornam o sistema vulnerável e difícil de operar com segurança em produção.
