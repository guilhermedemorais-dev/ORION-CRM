# QA Auditoria Geral — Backend, Banco, Performance e Arquitetura

## 1. Resumo executivo
O projeto não está tecnicamente saudável no backend atual. Há quebra real de contratos entre frontend e backend, fluxos marcados no UI como disponíveis mas implementados como stub/parcial, e inconsistências sérias de autorização no módulo de clientes e no RBAC de `ROOT`.

Classificação geral:
- NECESSITA CORREÇÃO CRÍTICA ANTES DE CONTINUAR

Validações executadas nesta auditoria:
- `apps/api`: `npm test` e `npm run typecheck` passaram
- `apps/web`: `npm run typecheck` passou
- Mesmo assim, os testes atuais não cobrem os contratos quebrados encontrados abaixo

## 2. Stack detectada
- Linguagem backend: TypeScript sobre Node.js 20+ (`apps/api/package.json:7-12`, `apps/api/package.json:43-45`)
- Framework backend: Express (`apps/api/package.json:19`, `apps/api/src/index.ts:105-132`)
- Banco: PostgreSQL 16 (`docker-compose.yml:5-20`)
- Acesso a dados: `pg` nativo, sem ORM (`apps/api/package.json:24`, `apps/api/src/db/pool.ts:1-38`)
- Migrations: runner próprio em TypeScript + arquivos SQL (`apps/api/src/db/migrate.ts`, `apps/api/src/db/migrations`)
- Frontend identificado: Next.js 14 + React 18 (`apps/web/package.json:23-30`)
- Autenticação: JWT de acesso + cookie `orion_session` no web + refresh token em cookie httpOnly no backend (`apps/api/src/routes/auth.routes.ts:221-260`, `apps/api/src/routes/auth.routes.ts:278-391`, `apps/web/lib/auth.ts:13-84`)
- Autorização: `requireRole(...)` com bypass global para `ROOT` + verificações manuais espalhadas em services (`apps/api/src/middleware/rbac.ts:5-24`)
- Filas/cache: Redis 7 + BullMQ (`docker-compose.yml:22-35`, `apps/api/package.json:16,21`, `apps/api/src/db/redis.ts`)
- Storage/upload: filesystem local em `/app/uploads` + `multer` (`docker-compose.yml:75-77`, `apps/api/package.json:23`, `apps/api/src/routes/customers.routes.ts:599-615`)
- Logs: `pino`, `audit_logs`, `system_errors`, warning de query lenta > 200ms (`apps/api/src/lib/logger.ts:1-37`, `apps/api/src/db/pool.ts:29-35`, `apps/api/src/db/migrations/010_audit_logs.sql`, `apps/api/src/db/migrations/047_system_errors.sql`)
- Integrações externas identificadas: Meta WhatsApp, Mercado Pago, n8n, OpenAI, Anthropic, transportadoras, Evolution API, ViaCEP
- Scripts de build/deploy: Docker, Docker Compose, GitHub Actions + GHCR + SSH deploy (`docker-compose.yml:37-154`, `.github/workflows/deploy.yml:1-99`)

## 3. Principais problemas encontrados
| ID | Área | Problema | Evidência no código | Impacto | Criticidade | Recomendação |
|---|---|---|---|---|---|---|
| QA-01 | Contrato FE/BE | Aba principal de histórico do cliente pede `type=all`, mas backend só implementa `log` e `whatsapp` | `apps/web/app/(crm)/clientes/[id]/components/tabs/ClientHistoricoTab.tsx:417-431`, `apps/api/src/routes/customers.routes.ts:524-567` | Timeline principal retorna vazio e mascara eventos reais do cliente | Crítica | Alinhar contrato imediatamente e cobrir com teste de integração |
| QA-02 | Banco/API | Histórico WhatsApp do cliente consulta colunas/tabelas que não existem mais e ainda engole erro | `apps/api/src/routes/customers.routes.ts:551-564`, `apps/api/src/db/migrations/004_conversations_messages.sql:24-40`, `apps/api/src/db/migrations/018_inbox_multichannel_foundation.sql:14-23,91-95` | Aba WhatsApp pode ficar vazia mesmo com mensagens existentes, sem diagnóstico operacional | Crítica | Reescrever query com o schema atual e remover `catch(() => ({ rows: [] }))` |
| QA-03 | Segurança/RBAC | `ROOT` passa no middleware, mas é bloqueado em `GET /customers/:id` pelo helper interno | `apps/api/src/middleware/rbac.ts:12-16`, `apps/api/src/routes/customers.routes.ts:53-64,174-223` | `ROOT` tem acesso inconsistente ao módulo de clientes | Alta | Centralizar regra de superusuário em um único ponto |
| QA-04 | Segurança/RBAC | Rotas sensíveis de clientes não aplicam o mesmo escopo do detalhe e permitem acesso amplo a `ATENDENTE/GERENTE` | `apps/api/src/routes/customers.routes.ts:375-416,448-483,486-570,573-595` | Exposição indevida de ficha completa, estatísticas, histórico, feedback e edição de clientes fora da carteira | Crítica | Aplicar verificação de ownership/escopo em todas as rotas de cliente |
| QA-05 | Modelo de domínio | Papéis divergem entre migrations, tipos TS, validação backend e uso do frontend | `apps/api/src/db/migrations/002_users.sql:3-18`, `apps/api/src/db/migrations/030_painel_cliente.sql:4-7`, `apps/api/src/db/migrations/038_user_roles_expansion.sql:1-9`, `apps/api/src/types/entities.ts:8`, `apps/api/src/routes/users.routes.ts:20-39`, `apps/web/app/(crm)/clientes/[id]/components/attendance/AttendancePopup.tsx:195-199` | Quebra fluxos de usuário/equipe, menções e gestão de perfis | Alta | Definir enum único de papéis e propagar para DB, backend e frontend |
| QA-06 | API/Usuários | Frontend pede `/users?role=ATENDENTE,ADMIN,MESTRE`, mas backend não aceita filtro `role` | `apps/web/app/(crm)/clientes/[id]/components/attendance/AttendancePopup.tsx:190-199`, `apps/api/src/routes/users.routes.ts:16-18,92-117` | Menções e seleções de equipe retornam lista errada | Média | Implementar filtro de role ou remover o uso no frontend |
| QA-07 | Inbox/RBAC | Middleware permite `ROOT`, mas service do inbox trata apenas `ADMIN` como privilegiado | `apps/api/src/routes/inbox.routes.ts:186-243`, `apps/api/src/services/inbox.service.ts:214-234,236-247,853-951` | `ROOT` pode listar/abrir rota e falhar em escopo, atribuição, handoff ou fechamento | Alta | Substituir checks `role === 'ADMIN'` por política única compatível com `ROOT` |
| QA-08 | Fluxo funcional | Painel do cliente consulta rota inexistente `/customers/:id/attendance-blocks` | `apps/web/app/(crm)/clientes/[id]/components/ClientPanelShell.tsx:40-57`, `apps/api/src/index.ts:113-120`, `apps/api/src/routes/attendance.routes.ts:30-80` | Elegibilidade de entrega falha silenciosamente e pode desabilitar ação correta | Alta | Corrigir rota no frontend ou criar alias compatível no backend |
| QA-09 | Fluxo funcional | UI permite adicionar fotos no atendimento, mas nenhuma foto é enviada ao backend | `apps/web/app/(crm)/clientes/[id]/components/attendance/AttendancePopup.tsx:169-177,271-299,463-477`, `apps/api/src/routes/attendance.routes.ts:84-109` | Usuário acredita ter anexado referência, mas dado é perdido | Alta | Implementar upload real ou remover o affordance visual |
| QA-10 | Produto/IA | Fluxo de IA 3D é “em breve”, backend grava placeholders e polling espera status diferente do retornado | `apps/web/app/(crm)/clientes/[id]/components/attendance/AI3DSection.tsx:230-267,329-359,408-455`, `apps/api/src/routes/renders.routes.ts:41-69,117-127` | Fluxo não é ponta a ponta; aprovação/regeneração não representa geração real | Alta | Marcar como feature não disponível ou completar pipeline assíncrono real |
| QA-11 | Produto | Feedback do cliente é stub no backend | `apps/api/src/routes/customers.routes.ts:572-595`, `apps/web/app/(crm)/clientes/[id]/components/tabs/ClientHistoricoTab.tsx:417-421,565-596` | UI promete avaliações, mas não há persistência nem leitura real | Média | Implementar tabela/serviço ou esconder a aba |
| QA-12 | Fiscal | Solicitação de NF-e apenas cria registro pendente; não existe emissão real | `apps/api/src/db/migrations/028_fiscal_documents.sql:1-17`, `apps/api/src/routes/orders.routes.ts:608-626`, `apps/web/app/(crm)/pedidos/actions.ts:313-337`, `apps/web/components/modules/pdv/ReceiptModal.tsx:368-390` | Processo fiscal é percebido como concluído pelo usuário, mas é só uma fila manual | Alta | Renomear para “solicitar emissão” ou integrar emissor real e estados de processamento |
| QA-13 | Comprovantes | “Enviar comprovante” é apenas redirecionamento manual para `wa.me` ou `mailto:` | `apps/api/src/routes/orders.routes.ts:633-695`, `apps/web/app/(crm)/pedidos/actions.ts:340-378`, `apps/web/components/modules/pdv/ReceiptModal.tsx:392-449` | Não há entrega comprovada, rastreio nem retry; usuário acha que “enviou” | Média | Tratar como ação manual explícita ou integrar envio real |
| QA-14 | Segurança/XSS | Conteúdo HTML do atendimento entra sem sanitização e é renderizado com `dangerouslySetInnerHTML` | `apps/api/src/routes/attendance.routes.ts:84-109`, `apps/web/app/(crm)/clientes/[id]/components/attendance/AttendancePopup.tsx:145-149,265-299,456-460`, `apps/web/app/(crm)/clientes/[id]/components/attendance/AttendanceBlock.tsx:131-135` | Risco de XSS persistente em ambiente autenticado | Crítica | Sanitizar no backend e/ou no frontend antes de persistir/renderizar |
| QA-15 | Sessão | Backend implementa refresh token rotativo, mas o web redireciona no primeiro `401` e não usa `/auth/refresh` | `apps/api/src/routes/auth.routes.ts:221-260,278-391`, `apps/web/lib/auth.ts:13-84`, `apps/web/lib/api.ts:796-814` | Sessão expira sem renovação transparente; complexidade extra sem benefício operacional | Média | Implementar refresh real no proxy/web ou simplificar arquitetura de sessão |

## 4. Fluxos quebrados ou inconsistentes
### Fluxo: Histórico principal do cliente
- Tela/componente: `ClientHistoricoTab`
- Botão/função envolvida: subtab `Histórico`
- Endpoint chamado: `GET /api/internal/customers/:id/history?type=all&limit=200`
- Payload esperado: lista cronológica agregada de eventos
- Payload real: backend cai no `else` e retorna `data: []`
- Ponto de falha: contrato de query param
- Causa provável: frontend foi evoluído para `all`, backend permaneceu com `log`
- Evidência: `ClientHistoricoTab.tsx:427-431`, `customers.routes.ts:532-567`
- Impacto para o usuário: histórico parece vazio ou incompleto
- Correção recomendada: definir contrato único (`all` ou `log`) e cobrir com teste de API

### Fluxo: Histórico WhatsApp do cliente
- Tela/componente: `ClientHistoricoTab`
- Botão/função envolvida: subtab `WhatsApp`
- Endpoint chamado: `GET /api/internal/customers/:id/history?type=whatsapp`
- Payload esperado: mensagens relacionadas ao cliente
- Payload real: query usa `m.message_type`, `contacts`, `cv.contact_id`, e em erro devolve vazio
- Ponto de falha: query desatualizada em relação ao schema
- Causa provável: refactor do inbox sem atualizar essa rota legado
- Evidência: `customers.routes.ts:551-564`, `004_conversations_messages.sql:24-40`
- Impacto para o usuário: conversa some do histórico mesmo existindo
- Correção recomendada: reescrever query usando `messages.type`, `conversations.customer_id/contact_phone` e remover swallow de erro

### Fluxo: Menções/equipe no atendimento
- Tela/componente: `AttendancePopup`
- Botão/função envolvida: `@`
- Endpoint chamado: `GET /api/internal/users?role=ATENDENTE,ADMIN,MESTRE`
- Payload esperado: apenas perfis aptos a serem mencionados
- Payload real: backend ignora `role` e retorna todos os usuários encontrados por `q`
- Ponto de falha: filtro inexistente no backend
- Causa provável: frontend presumiu suporte de filtro por roles
- Evidência: `AttendancePopup.tsx:190-199`, `users.routes.ts:16-18,92-117`
- Impacto para o usuário: lista errada, incluindo perfis indevidos; `MESTRE` não é tratado de forma consistente
- Correção recomendada: implementar filtro de roles e alinhar enum de perfis

### Fluxo: Elegibilidade de entrega no painel do cliente
- Tela/componente: `ClientPanelShell`
- Botão/função envolvida: validação de criação de entrega
- Endpoint chamado: `/api/internal/customers/:id/attendance-blocks`
- Payload esperado: blocos de atendimento do cliente
- Payload real: rota inexistente; erro é engolido no frontend
- Ponto de falha: nome da rota
- Causa provável: mudança de nomenclatura de `attendance-blocks` para `blocks`
- Evidência: `ClientPanelShell.tsx:40-57`, `index.ts:113-120`, `attendance.routes.ts:30-80`
- Impacto para o usuário: botão pode ficar desabilitado sem motivo
- Correção recomendada: corrigir consumo no frontend ou expor alias retrocompatível

### Fluxo: Fotos de referência do atendimento
- Tela/componente: `AttendancePopup`
- Botão/função envolvida: seletor de imagens
- Endpoint chamado: `POST/PATCH /customers/:id/blocks` ou `/blocks/:id`
- Payload esperado: conteúdo + anexos
- Payload real: frontend guarda preview local, mas envia só JSON
- Ponto de falha: anexos não entram no payload nem no schema
- Causa provável: UI criada antes da infraestrutura de upload
- Evidência: `AttendancePopup.tsx:169-177,271-299,463-477`, `attendance.routes.ts:84-109`
- Impacto para o usuário: perda silenciosa de informação
- Correção recomendada: implementar upload multipart e persistência, ou remover o campo

### Fluxo: Geração 3D com IA
- Tela/componente: `AI3DSection`
- Botão/função envolvida: `Gerar modelo 3D`
- Endpoint chamado: `POST /api/internal/blocks/:blockId/render` e polling `GET /api/internal/renders/:id`
- Payload esperado: job assíncrono até render pronto
- Payload real: frontend exibe “Função em breve”; backend grava placeholder e status `generated`; polling espera `done/completed`
- Ponto de falha: feature flag/estado do job
- Causa provável: implementação parcial publicada junto com UI
- Evidência: `AI3DSection.tsx:230-267,329-359,408-455`, `renders.routes.ts:41-69`
- Impacto para o usuário: fluxo parece disponível, mas não entrega resultado real
- Correção recomendada: esconder em produção ou completar worker/integração real

### Fluxo: NF-e e comprovante
- Tela/componente: pedidos / PDV
- Botão/função envolvida: `NF-e`, `Comprovante WhatsApp`, `Comprovante E-mail`
- Endpoint chamado: `/orders/:id/nfe`, `/orders/:id/send-receipt`
- Payload esperado: emissão e envio reais
- Payload real: NF-e cria registro pendente; comprovante só devolve `wa.me` ou e-mail para `mailto:`
- Ponto de falha: backend não conclui o fluxo
- Causa provável: endpoints de “solicitação manual” apresentados como “ação concluída”
- Evidência: `orders.routes.ts:608-626,633-695`, `028_fiscal_documents.sql:1-17`, `ReceiptModal.tsx:368-449`
- Impacto para o usuário: percepção falsa de envio/emissão efetiva
- Correção recomendada: ajustar nomenclatura e UX agora; integrar serviços reais depois

## 5. Backend e APIs
- O módulo de clientes é o ponto mais inconsistente. A própria rota básica `GET /customers/:id` usa `assertCanAccessCustomer`, mas `GET /customers/:id/full`, `GET /customers/:id/orders`, `PATCH /customers/:id`, `GET /customers/:id/stats`, `GET /customers/:id/history` e `GET/POST /customers/:id/feedback` não repetem a mesma proteção (`apps/api/src/routes/customers.routes.ts:53-64,174-223,227-287,375-416,448-483,486-595`).
- Há contratos quebrados entre frontend e backend no histórico do cliente, menções do atendimento e elegibilidade de entrega (`ClientHistoricoTab.tsx:417-431`, `AttendancePopup.tsx:195-199`, `ClientPanelShell.tsx:40-57`).
- O inbox possui duas políticas de autorização simultâneas: middleware com bypass de `ROOT` e service com várias decisões manuais baseadas apenas em `ADMIN` (`rbac.ts:12-16`, `inbox.service.ts:214-234,236-247,853-951`).
- O backend devolve sucesso em fluxos incompletos. Isso aparece em feedback, NF-e e comprovantes (`customers.routes.ts:572-595`, `orders.routes.ts:608-626,690-694`).
- Há tratamento de erro que reduz visibilidade operacional. O caso mais problemático é o histórico WhatsApp devolvendo vazio em qualquer falha SQL (`customers.routes.ts:563`).
- O refresh token foi implementado corretamente do lado do backend, com rotação e detecção de reuse, mas a aplicação web não o consome (`auth.routes.ts:296-338`, `web/lib/api.ts:802-803`).

## 6. Banco de dados
- A base usa PostgreSQL com migrations SQL próprias e sem ORM. Isso dá controle, mas aumenta o risco de drift quando não existe camada central de contratos.
- O drift de schema mais evidente está no histórico WhatsApp: a rota usa `message_type`, `contacts` e `contact_id`, enquanto o schema atual usa `messages.type` e não expõe essas relações naquele formato (`customers.routes.ts:553-559`, `004_conversations_messages.sql:24-40`, `018_inbox_multichannel_foundation.sql:14-23,91-95`).
- O enum `user_role` foi expandido em migrations, mas a aplicação não absorveu todas as variantes (`002_users.sql:3-18`, `030_painel_cliente.sql:4-7`, `038_user_roles_expansion.sql:7-9`, `types/entities.ts:8`).
- `fiscal_documents` é explicitamente um stub de NF-e e não modela um pipeline fiscal operacional completo sozinho (`028_fiscal_documents.sql:1-17`).
- Regras de negócio importantes ainda estão só em validação de aplicação. Exemplo: acesso por carteira de cliente e papéis privilegiados não estão protegidos no banco; dependem de cada rota lembrar de chamar o helper correto.
- Há transações onde faz sentido, como atualização de status de pedidos (`orders.routes.ts:736-774`), mas vários fluxos acoplados continuam sem atomicidade de negócio ponta a ponta porque a feature em si é parcial.

## 7. Performance
- `GET /inbox/conversations/:id/messages` responde após chamada externa para WhatsApp no envio da mensagem; latência do request fica acoplada ao fornecedor (`inbox.routes.ts:507-525`).
- O frontend de inbox carrega `100` conversas por padrão, depois carrega thread selecionada, canais e quick replies em sequência lógica de tela (`apps/web/app/(crm)/inbox/page.tsx:43-79`). Em volume alto, a página tende a degradar antes de qualquer paginação dinâmica.
- `GET /users` não pagina (`users.routes.ts:77-125`). Em times grandes, isso escala mal e piora menus/combos dependentes.
- O endpoint `system/timeline` pode fazer `git log` e, na ausência de repositório local, tentar `fetch` no GitHub em request síncrono (`system.routes.ts:146-185`). Isso é custo variável em rota de suporte/observabilidade.
- O projeto já detecta query lenta > 200ms (`db/pool.ts:29-35`), o que é positivo, mas não há evidência de métricas consolidadas, histogramas ou tracing distribuído.

## 8. Arquitetura
- A principal fragilidade arquitetural é a ausência de um contrato central entre domínio, schema SQL, validação backend e tipos/frontend. O drift de papéis, histórico do cliente e IA 3D é consequência direta disso.
- O RBAC está dividido entre middleware global, helpers locais e condicionais inline em services. Isso gera comportamento não determinístico para `ROOT`, `ADMIN` e perfis operacionais (`rbac.ts:5-24`, `customers.routes.ts:53-64`, `inbox.service.ts:214-234,236-247,853-951`, `notifications.routes.ts:47-76`, `pipelines.service.ts:51-56`).
- Há lógica de negócio relevante dentro de rotas e services de alto acoplamento, com pouca separação por caso de uso. Exemplos: clientes, inbox, pedidos e atendimento concentram validação, autorização, queries e side effects no mesmo fluxo.
- Features parcialmente prontas coexistem no mesmo código de produção sem feature flag forte: IA 3D, feedback, NF-e, comprovante.
- O projeto é manutenível a curto prazo, mas a evolução futura tende a aumentar inconsistência enquanto não houver padronização de contratos, RBAC e estados de domínio.

## 9. Regras de negócio
- Regra esperada: `ROOT` deve ter acesso total.
  - Implementação encontrada: `requireRole` libera `ROOT`, mas helpers/services específicos não o tratam como privilegiado (`rbac.ts:12-16`, `customers.routes.ts:58-64`, `inbox.service.ts:220,226,237,919,951`).
  - Divergência: privilégio total deixa de ser verdade em fluxos concretos.
  - Impacto: comportamento imprevisível para suporte, gestão e operação.
  - Decisão necessária: consolidar se `ROOT` herda sempre `ADMIN` ou se existe matriz própria.

- Regra esperada: atendente só deve acessar clientes da própria carteira, salvo exceções explícitas.
  - Implementação encontrada: só `GET /customers/:id` chama `assertCanAccessCustomer`; várias rotas irmãs não chamam.
  - Divergência: regras mudam conforme endpoint.
  - Impacto: exposição de dados e edições indevidas.
  - Evidência: `customers.routes.ts:174-223` vs `375-595`.
  - Decisão necessária: definir política única de escopo para clientes.

- Regra esperada: features visíveis no UI devem estar operacionais.
  - Implementação encontrada: feedback, IA 3D, NF-e e comprovantes são parciais/stub.
  - Divergência: frontend comunica disponibilidade, backend não fecha o fluxo.
  - Impacto: quebra de confiança operacional.
  - Evidência: `customers.routes.ts:572-595`, `renders.routes.ts:41-69`, `orders.routes.ts:608-695`.
  - Decisão necessária: esconder, rotular como “solicitação manual” ou completar.

- Regra esperada: horários de acesso restrito devem afetar apenas perfis definidos pelo negócio.
  - Implementação encontrada: a restrição é aplicada a todo usuário que não seja `ADMIN`, incluindo `ROOT` (`auth.routes.ts:174-189`).
  - Divergência: não há documentação explícita dizendo que `ROOT` também deve ser bloqueado.
  - Impacto: risco de lockout operacional fora do horário.
  - Evidência: `auth.routes.ts:174-189`.
  - Decisão necessária: REGRA DE NEGÓCIO NÃO DOCUMENTADA — PRECISA DE CONFIRMAÇÃO HUMANA.

## 10. Segurança
- Crítico: XSS persistente potencial no conteúdo de atendimento. O frontend edita HTML bruto, o backend aceita `content` sem sanitização e a listagem renderiza com `dangerouslySetInnerHTML` (`attendance.routes.ts:84-109`, `AttendancePopup.tsx:145-149,265-299,456-460`, `AttendanceBlock.tsx:131-135`).
- Crítico: RBAC inconsistente no módulo de clientes expõe dados fora da carteira e cria comportamentos divergentes por endpoint (`customers.routes.ts:375-595`).
- Alto: `ROOT` não é tratado de forma uniforme em toda a aplicação, o que pode tanto negar acesso indevidamente quanto contornar regras de forma desigual (`rbac.ts:12-16`, `inbox.service.ts`, `notifications.routes.ts:52-75`, `pipelines.service.ts:51-56`).
- Positivo: cookies de sessão do web usam `httpOnly` e `sameSite: 'strict'`, o que reduz risco de CSRF clássico no proxy interno (`web/lib/auth.ts:74-83`).
- Positivo: logger faz redaction de campos sensíveis básicos (`logger.ts:14-29`).
- Dependências vulneráveis: não foi possível validar com `npm audit`/registry nesta auditoria por restrição de ambiente de rede; portanto este ponto permanece pendente.

## 11. Observabilidade
- Positivo: há request logging, `requestId`, `audit_logs`, `system_errors` e warning de slow query (`index.ts`, `db/pool.ts:29-35`, `logger.ts`, migrations `010` e `047`).
- Negativo: erros importantes são ocultados e convertidos em sucesso silencioso ou lista vazia, principalmente no histórico WhatsApp e em alguns fetches do frontend (`customers.routes.ts:563`, `ClientPanelShell.tsx:55-57`).
- Negativo: não há evidência de métricas de latência, tracing distribuído, alerta de erro por endpoint ou dashboard de slow queries.
- Negativo: algumas telas do frontend fazem fallback silencioso; isso dificulta diferenciar “sem dados” de “rota quebrada”.

## 12. Testes necessários
- Teste: contrato `GET /customers/:id/history` com `type=all`, `type=log` e `type=whatsapp`
  - Tipo: integração/API
  - Fluxo coberto: histórico do cliente
  - Criticidade: Crítica
  - Motivo: bug real em produção passou despercebido

- Teste: RBAC completo do módulo de clientes para `ROOT`, `ADMIN`, `GERENTE`, `ATENDENTE`
  - Tipo: integração/API
  - Fluxo coberto: detalhe, ficha, stats, orders, history, patch
  - Criticidade: Crítica
  - Motivo: regras divergentes por endpoint

- Teste: query de histórico WhatsApp compatível com schema atual
  - Tipo: integração/API
  - Fluxo coberto: aba WhatsApp do cliente
  - Criticidade: Alta
  - Motivo: rota usa colunas/tabelas legadas

- Teste: menções do atendimento filtrando usuários por papel
  - Tipo: integração/API
  - Fluxo coberto: `GET /users?role=...`
  - Criticidade: Média
  - Motivo: frontend já depende disso

- Teste: fluxo do painel do cliente para elegibilidade de entrega
  - Tipo: e2e
  - Fluxo coberto: habilitação de entrega
  - Criticidade: Alta
  - Motivo: rota quebrada hoje é escondida por `catch`

- Teste: persistência real de anexos/fotos de atendimento
  - Tipo: integração/e2e
  - Fluxo coberto: upload de referência
  - Criticidade: Alta
  - Motivo: UI coleta foto, backend ignora

- Teste: IA 3D desativada ou operacional
  - Tipo: e2e
  - Fluxo coberto: geração/aprovação/regeneração
  - Criticidade: Alta
  - Motivo: estado atual é parcialmente fake

- Teste: solicitação de NF-e e comprovante com estados esperados
  - Tipo: integração/e2e
  - Fluxo coberto: pedidos/PDV
  - Criticidade: Alta
  - Motivo: evitar vender stub como automação concluída

- Teste: sanitização de conteúdo HTML em atendimento
  - Tipo: segurança/integr. API
  - Fluxo coberto: criação/visualização de bloco
  - Criticidade: Crítica
  - Motivo: risco de XSS persistente

- Teste: renovação de sessão por refresh token
  - Tipo: integração/e2e
  - Fluxo coberto: expiração/renovação de login
  - Criticidade: Média
  - Motivo: backend implementa, frontend não usa

Observação sobre testes existentes:
- No backend, os testes atuais estão concentrados em services utilitários e não exercitam contratos HTTP críticos (`apps/api/package.json:11`, `apps/api/src/services/*.test.ts`)
- No web, os E2E de clientes verificam principalmente presença visual e clique de tabs, sem validar payload, estados ou conteúdo retornado (`apps/web/e2e/05-clientes.spec.ts:142-177`)

## 13. Plano de correção por fases
### Fase 1 — Correções críticas
- Corrigir RBAC do módulo de clientes, incluindo `ROOT` e escopo por carteira
- Corrigir `GET /customers/:id/history` para contrato real com frontend
- Reescrever histórico WhatsApp no schema atual e remover swallow de erro
- Sanitizar conteúdo HTML de atendimento antes de render/persistir
- Corrigir rota inexistente `/attendance-blocks` ou seu consumidor

### Fase 2 — Correções importantes
- Unificar enum de papéis entre migrations, backend e frontend
- Alinhar inbox para tratar `ROOT` como privilegiado de forma consistente
- Corrigir fluxo de menções com filtro real por role
- Remover ou completar upload de fotos do atendimento
- Reclassificar NF-e/comprovante/feedback/IA 3D como feature parcial ou concluir implementação

### Fase 3 — Melhorias estruturais
- Introduzir testes de contrato FE/BE para fluxos críticos
- Extrair políticas RBAC para camada única
- Instrumentar métricas/alertas/trace de erros
- Revisar endpoints sem paginação e telas que carregam listas grandes por padrão
- Decidir se refresh token será realmente usado no web

## 14. Top 10 ações recomendadas
1. Corrigir imediatamente o RBAC do módulo de clientes e padronizar comportamento de `ROOT`.
2. Consertar a aba de histórico principal do cliente (`type=all` vs `log`).
3. Reescrever a query de histórico WhatsApp com o schema atual e sem mascarar erro.
4. Sanitizar HTML de atendimento e revisar todos os pontos de renderização de conteúdo rico.
5. Unificar enum de papéis entre banco, backend, frontend e filtros de usuário.
6. Ajustar o inbox para não depender de checks manuais `role === 'ADMIN'`.
7. Corrigir a rota de `attendance-blocks` usada pelo painel do cliente.
8. Remover ou concluir os fluxos incompletos de IA 3D, feedback, NF-e e comprovantes.
9. Adicionar testes de integração/API para histórico, RBAC e fluxos de pedidos.
10. Implementar observabilidade melhor para erros mascarados e contratos quebrados.

## 15. Conclusão técnica
- Maior problema técnico hoje: ausência de contrato consistente entre frontend, backend, RBAC e schema SQL.
- Maior risco de negócio: o sistema aparenta ter fluxos críticos operacionais que na prática estão quebrados, parciais ou expõem dados fora do escopo correto.
- O que corrigir primeiro: autorização de clientes, histórico do cliente, query de WhatsApp e XSS em atendimento.
- O que pode esperar: refresh token no web, otimizações de performance finas e refinamento de observabilidade, desde que os bugs críticos sejam fechados antes.
- A arquitetura atual aguenta evolução? Aguenta apenas no curto prazo. Para continuar crescendo sem amplificar regressões, precisa reorganizar contratos de domínio/RBAC e aumentar cobertura de testes de integração antes de adicionar novas features.
