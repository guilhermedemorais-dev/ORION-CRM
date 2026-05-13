# ORION CRM — Histórico de Releases

> Changelog estruturado do desenvolvimento do sistema, organizado por versão e data.
> Atualizado manualmente pelo dev a cada entrega significativa.
> Este arquivo é consumido pelo endpoint `GET /api/internal/system/timeline`.

---

## [v1.8.0] — 2026-05-13
### Roadmap do Projeto — nova aba de gestão de planejamento
- Nova aba **Roadmap** em Suporte: painel de gestão dos planos do projeto em linguagem leiga
- Aba **Linha do Tempo** preservada (gráfico de atividade + histórico técnico de releases continua como estava)
- Aba **Atualizações** removida — sua função foi absorvida pelo Roadmap
- Cards de item com título + descrição + status (planejado, aguardando aprovação, aprovado, em andamento, parado, concluído, reprovado) + prazo previsto + dropdown de detalhes técnicos
- Dropdown de status editável diretamente no card (apenas ROOT)
- Botões **Aprovar / Reprovar** para o cliente (ADMIN/ROOT)
- Comentários com threading (responder a comentário específico)
- Reações **👍 (concordo) / 👎 (não vou seguir)** no comentário, apenas ROOT (com tooltip explicando que não é ofensa)
- Anexos no item ou em comentários (PNG, JPG, GIF, WEBP, MP4, WEBM, MOV, PDF — até 10MB)
- Badge **IA** quando o item foi registrado por Claude direto pelo banco
- Badge numérico dourado no menu lateral **Suporte** com a contagem de items aguardando aprovação (atualiza a cada 60s)
- Central de Ajuda ganhou seção **Roadmap do Projeto** explicando todo o ciclo
- Migration `052` cria 4 tabelas: `roadmap_items`, `roadmap_comments` (com threading via `parent_comment_id`), `roadmap_comment_reactions`, `roadmap_attachments`
- 13 endpoints novos sob `/api/v1/roadmap/...` com RBAC apropriado (criar/editar só ROOT, aprovar ROOT+ADMIN, comentar/reagir autenticados, deletar comentário próprio ou ROOT)

## [v1.7.0] — 2026-05-11
### Materiais na OS, botão "Faturar no PDV" e revisão do fluxo OS→PDV
- Nova seção **Materiais** dentro do modal de criar OS — busca produtos do estoque com filtros (Tudo / Matéria-prima / Peças prontas), adiciona com quantidade, calcula subtotal automaticamente
- Snapshot de preço e custo no momento que o material é adicionado (preserva histórico mesmo se o produto for repreçado depois)
- Mão de obra agora é campo separado (padrão de joalheria) — total preview soma materiais + mão de obra
- Migration `051` cria `service_order_materials` e adiciona `labor_cents`, `materials_subtotal_cents`, `markup_percent` na OS
- Endpoints CRUD `/service-orders/:id/materials` (GET/POST/PATCH/DELETE) + `/labor` (PATCH) com recálculo transacional dos totais da OS
- Botão **Faturar no PDV** na barra direita da ficha do cliente — abre o PDV com cliente pré-selecionado via `?customer_id=`
- PDV aceita pré-seleção de cliente via URL (atalho da ficha para fechar venda rápido)
- Aba **Caixa** da ficha removida (era placeholder) — decisão arquitetural: fluxo correto é OS→PDV, não checkout duplicado na ficha
- Permissão `ficha.caixa.view` removida do backend, frontend e painel de Ajustes
- Central de Ajuda ganhou nova seção **"Ordem de Serviço (OS) e materiais"** documentando o fluxo completo
- Limpeza de ruído: pastas `.codex/`, `.opencode/`, `.claude/`, `.playwright-mcp/` e PNGs soltos na raiz agora ignorados pelo Git (skills locais migradas para `~/.codex/skills`, `~/.opencode/skills`, `~/.claude/skills`)

## [v1.6.0] — 2026-05-11
### Pipeline configurável, regras de handoff, permissões da ficha, central de ajuda e categorias de estoque
- Modal único de configuração do pipeline com abas **Etapas** e **Regras** (substitui o builder React Flow antigo e o builder-v2 do Codex; ambos descontinuados)
- Regras de pipeline funcionais ponta a ponta: ação **Criar card vinculado** agora cria de fato um lead novo no pipeline destino com mesmo cliente, idempotente por `(rule_id, source_lead_id)`
- Migration `049` permite mesmo cliente em pipelines diferentes (`UNIQUE (whatsapp_number, pipeline_id)`) — habilita handoff Comercial → Produção → Entrega sem duplicar cliente
- Toda criação/atualização de lead via WhatsApp, formulário público, n8n e POST manual passou a escopar dedup por pipeline
- UI das ações renomeada e com descrição inline: "Gerar card no setor destino", "Mover card", "Espelhar card"
- Botão `?` no modal de regras abre painel de ajuda contextual com exemplo prático
- Validação visual no formulário de regra: campo Nome marcado obrigatório, botão desabilitado enquanto faltar dado, mensagem explicando o que falta
- 9 permissões `ficha.X.view` controlam visibilidade de cada bloco da ficha do cliente (agenda, dados, atendimento, proposta, pedidos, OS, entrega, caixa, histórico)
- Defaults por cargo aplicados (ATENDENTE vê tudo, PRODUÇÃO só vê dados/OS/entrega, FINANCEIRO só vê dados/pedidos/caixa/histórico) — ajustáveis por usuário em Ajustes
- Endpoint `GET /api/v1/users/me` retorna `custom_permissions` do próprio usuário (sem precisar de role para consultar a si mesmo)
- Aba **Caixa** adicionada à ficha do cliente com placeholder informando integração futura com motor do PDV
- Central de Ajuda em `/ajuda` com sidebar de navegação, busca e renderer markdown próprio (sem dep externa)
- 5 seções iniciais documentadas: Bem-vindo, Pipelines, Regras de handoff, Estoque e categorias, Permissões da ficha
- Migration `050` adicionou `product_categories` com hierarquia (`parent_id`) e flag `products.is_raw_material`
- CRUD de categorias diretamente em **Estoque** (botão **Categorias** no header) — suporta subcategorias, renomear, excluir com proteção contra exclusão em uso
- Formulário de produto: select dinâmico de categoria com agrupamento de subcategorias + toggle "Matéria-prima"
- Badge **MP** dourado em produtos matéria-prima na lista do estoque e nos cards do PDV
- Memória do agente registrada em `~/.claude/projects/.../memory/` para preservar decisões da Fase C entre sessões

## [v1.5.2] — 2026-05-02
### Correção de navegação de Leads + scroll do kanban
- Dashboard deixou de depender do slug hardcoded `/pipeline/leads` e voltou a entrar pelo atalho `/leads`
- Rota `/leads` passou a resolver o pipeline correto dinamicamente, priorizando slug `leads`, depois o pipeline padrão, depois o primeiro disponível
- Kanban de Leads deixou de usar `preventDefault()` em `onWheel` React passivo e passou a usar listener nativo com `passive: false`
- Erro repetitivo `Unable to preventDefault inside passive event listener invocation` removido da interação de scroll horizontal do pipeline

## [v1.5.1] — 2026-05-02
### Topbar mobile reorganizada + atalhos flutuantes
- Topbar mobile reorganizada em 2 linhas para reduzir aperto visual no header
- Busca global ganhou prioridade no mobile com layout `menu + busca` na primeira linha
- Contexto da rota atual (`seção` + `página`) foi movido para uma segunda linha mais legível
- Botão `Pergunte` saiu do header mobile e virou ação flutuante persistente no canto inferior direito
- `Ajuda` e `Notificações` também saíram do header mobile e passaram a usar atalhos flutuantes dedicados
- Desktop preservado com a topbar existente e sem alteração do fluxo principal de ações
- Publicação executada no serviço canônico `web` do Docker Compose para refletir a mudança em `127.0.0.1`

## [v1.5.0] — 2026-05-02
### Estabilização crítica de Clientes, Atendimento, Inbox e Pipeline
- Histórico do cliente ajustado para exibir eventos reais e mensagens reais do WhatsApp
- Contrato entre frontend e backend corrigido na aba Histórico/WhatsApp, sem mascarar erro de banco
- Sanitização de HTML aplicada no atendimento para bloquear XSS persistente mantendo formatação básica
- Painel do cliente corrigido para voltar a carregar blocos de atendimento sem queda silenciosa
- Filtro de usuários por papel alinhado para menções e seleção operacional no atendimento
- Inbox ajustado para que o perfil ROOT se comporte como superusuário de forma consistente
- Builder de pipeline atualizado para permitir criar, editar, reordenar e remover etapas na própria tela
- Testes e validações de typecheck executados para backend e frontend após as correções

## [v1.4.0] — 2026-04-28
### Clientes, Pipeline e Suporte sincronizados com commits recentes
- Correção da ficha do cliente para não tentar converter lead novamente quando o registro já é cliente
- Validação inline na ficha do cliente com feedback visual para nome, WhatsApp, e-mail, CPF e estado
- Persistência de WhatsApp liberada no PATCH de clientes
- Pipeline: modal "Novo lead" agora busca por nome, CPF ou telefone com e sem máscara
- Sugestões de cliente existente podem preencher o formulário para evitar retrabalho
- Sugestões de lead existente permitem abrir o cadastro já criado e evitar duplicidade
- UX do modal de lead ajustada para usuário leigo com textos mais claros e ação principal dinâmica
- Rate limit de login ignorado em ambiente local para permitir testes Playwright sem bloqueio
- Módulo Suporte agora tenta refletir commits reais via git local ou fallback pelo GitHub
- Timeline e Atualizações deixam de quebrar quando o arquivo de releases não estiver disponível

## [v1.3.0] — 2026-04-25
### Pipeline QA + Módulo Suporte com Linha do Tempo
- Pipeline com 13 das 14 tasks de qualidade resolvidas (críticas e altas prioridades)
- Toolbar compacta do Pipeline com visualização rápida, import/export CSV e rodapé do card
- Menu contextual no card do lead substituindo botão que causava logout acidental
- Modal "Ganhou/Perdeu" com confirmação: valor da venda obrigatório vs motivo obrigatório
- View Lista funcional com toggle Pipeline/Lista e preferência salva no navegador
- Pipeline mobile: muda automaticamente para lista em telas pequenas
- Validação inline no modal "Novo Lead" com mensagens de erro contextuais
- Feedback visual ao salvar nota: "Salvando..." → "Salvo ✓" → idle
- Colunas vazias recolhíveis e etapas sem leads ocultáveis, com persistência
- Módulo Suporte reformulado com 3 abas: Incidentes, Linha do Tempo e Atualizações
- Registro de bugs e sugestões com upload de imagens e vídeos
- Histórico visual completo do desenvolvimento com gráfico de atividade por dia
- Separação entre entregas concluídas e itens em desenvolvimento
- Correção de logout ao navegar em ambiente local com HTTP

## [v1.2.0] — 2026-04-24
### Dashboard QA Completo + Agenda Reformulada
- Dashboard com 22 tasks de qualidade resolvidas — responsividade, dados e polish visual
- Responsividade completa: mobile (640px), tablet (1024px) e telas estreitas (380px)
- Calendário do dashboard com data real sem erro de hydration SSR
- Gráfico de faturamento SVG com fallback "Nenhum dado para o período"
- KPI cards com skeleton de carregamento e proteção contra flickering
- Top Clientes com valores consistentes ao faturamento real
- Botões de aniversariantes com modal de parabéns e link WhatsApp pré-preenchido
- Painel de Notificações no Topbar com acessibilidade completa
- Atividade recente com tempo relativo e labels por tipo de evento
- Cards de estoque crítico clicáveis com navegação direta ao módulo
- Agenda com 6 visualizações estilo Google Calendar (Mês, Semana, Dia, 4 Dias, Agenda, Programação)
- Agenda com 19 tasks de qualidade resolvidas — CRUD completo e responsividade
- CRUD completo: criar, editar, cancelar com motivo e remarcar agendamentos
- Confirmação obrigatória antes de concluir atendimento, com campo de observações
- Deduplicação de eventos e sistema de cores unificado em todo o calendário
- Máscara de WhatsApp com validação em tempo real no formulário
- Responsável pré-selecionado com o usuário logado ao criar agendamento

## [v1.1.0] — 2026-04-12
### Central de Ajuda + IA Copiloto com Skills
- Central de Ajuda com abas Ajuda e Tutorial, documentação de todos os módulos
- Módulo IA Copiloto nas configurações com sistema de skills personalizáveis
- Skills organizadas em cards visuais com ícones por categoria
- Suporte ao modelo Qwen como alternativa ao assistente padrão
- WhatsApp reorganizado como sub-aba dentro de Integrações
- Até 2 agendamentos por slot de horário com validação na API
- Bot cria lead automaticamente ao agendar via WhatsApp

## [v1.0.0] — 2026-04-07
### Dashboard com Dados Reais do Banco
- Dashboard passou a exibir dados reais da API em vez de valores fixos
- KPIs dinâmicos: faturamento mensal, novos leads, pedidos em aberto, ticket médio
- Fallback visual quando o banco não retorna dados para o período selecionado
- Queries adaptadas por role: admin vê visão geral, produção vê fila, financeiro vê fluxo de caixa

## [v0.9.0] — 2026-04-01
### Agenda Completa + Redesign do Assistente IA
- Agenda com backend completo: criação, edição, cancelamento e conclusão de atendimentos
- Calendário navegável por mês, semana e dia com visual Google Calendar
- Lead aparece no kanban do pipeline automaticamente após agendamento
- Redesign completo do Assistente IA: painel lateral estilo Hostinger com botão na topbar
- PageHeader como faixa dourada compacta padronizada em todos os módulos
- Novos endpoints para integração n8n: contexto do lead, slots disponíveis e criação de agendamento

## [v0.8.0] — 2026-03-27
### Webhooks, Login UX, CI/CD e Estabilidade
- Geração de chave de webhook para integrações externas com o CRM
- Painel de gerenciamento de múltiplas chaves de webhook nas configurações
- Login: contador regressivo no erro de limite de tentativas
- Login: toggle mostrar/ocultar senha
- Auto-criação do usuário ROOT no primeiro boot via variáveis de ambiente
- Pipeline CI/CD com GitHub Actions, build via GHCR e deploy automático
- Suite de testes E2E com Playwright: health check, login, operação e RBAC
- Correções: 404 falso em leads, cores do modal, scroll no inbox, bypass do ROOT no RBAC
- Múltiplas correções de estabilidade no NGINX e na rede Docker

## [v0.7.0] — 2026-03-19
### Segurança Avançada + Ferramentas de Operação
- Timeout de sessão configurável: sistema desconecta automaticamente após inatividade
- Restrição de login por horário: bloqueia acesso fora do expediente definido
- Aba de Segurança nas configurações com controles de acesso avançados
- Adminer: interface web para consulta e gerenciamento direto do banco de dados

## [v0.6.0] — 2026-03-18
### Deploy em Produção — Hostinger + Traefik + SSL
- Migração para Traefik como proxy reverso na Hostinger VPS
- Domínio oficial configurado com SSL automático via Let's Encrypt (HTTPS)
- NGINX com configuração embarcada na imagem Docker
- Correções de rede, DNS e crash loop na inicialização da API em produção
- Restart automático dos containers com healthcheck integrado

## [v0.5.0] — 2026-03-16
### PDV, Estoque, Clientes v2, Busca Global e RBAC Expandido
- Ponto de Venda (PDV): busca de produtos, carrinho, finalização de venda e troco
- Recibo de venda com modal de impressão
- Estoque: lista de produtos com ajustes manuais de entrada e saída
- Painel completo do cliente: histórico, ordens de serviço, propostas e atendimento
- Pipeline do lead com detalhe lateral e linha do tempo de atividades
- Busca global funcional com atalho Cmd+K — busca em clientes, produtos, pedidos e leads
- 10 novas migrations: PDV, estoque, painel cliente, transportadoras e provedores
- Controle de acesso por função (RBAC) validado em cada endpoint da API
- Central de Ajuda com conteúdo contextual por módulo e painel deslizante
- Fiscal e Logística unificados na aba Integrações das configurações

## [v0.4.0] — 2026-03-12
### Design System v2 + Inbox Avançado + Financeiro
- Dark theme consistente aplicado em todos os módulos internos
- Inbox com encerramento de atendimentos, abas de analytics e canvas de automações
- Upload de comprovante de pagamento no módulo financeiro
- Lead detail reformulado com layout lateral e hierarquia visual clara

## [v0.3.0] — 2026-03-09
### Pipeline v2, Loja Pública, Analytics e IA v2
- Pipeline v2 com modelo canônico no banco e sidebar dinâmica por funil
- Rotas /pipeline/[slug] (kanban) e /pipeline/[slug]/builder (configuração de etapas)
- Loja pública: catálogo de produtos, página individual e checkout com Mercado Pago
- Admin da loja: configuração, categorias, produtos e acompanhamento de pedidos
- Dashboard de analytics de vendas com filtros por período
- Assistente IA v2 com histórico de conversa, permissões por role e log de uso
- Simulador de venda aprovada para testes sem depender do ambiente de produção

## [v0.2.0] — 2026-03-03
### CRM Core Completo — Do Funil ao Deploy
- Design system: Next.js 14 + Tailwind + shadcn/ui com layout de CRM e autenticação
- Gestão de leads com kanban por etapa do funil de vendas
- Gestão de clientes com histórico e painel de detalhes
- Inbox WhatsApp: conversas, atribuição, encerramento, webhook e fila BullMQ
- Pedidos de pronta entrega e pedidos personalizados com upload de design
- Fila de produção com avanço por etapa e registro de fotos
- Controle de estoque com entradas e saídas
- Módulo financeiro com lançamentos e fluxo de caixa
- PDV com carrinho e finalização de pagamento
- Mercado Pago: link de pagamento e confirmação via webhook
- Dashboard com KPIs e feed de atividade recente
- Assistente IA integrado ao CRM
- Landing pública e catálogo público de produtos
- Deploy funcional com Docker Compose

## [v0.1.0] — 2026-03-02
### Fundação do Sistema
- Monorepo estruturado: API Express + TypeScript, Next.js 14, PostgreSQL 16, Redis
- Autenticação JWT com refresh token rotativo e proteção de sessão
- Controle de acesso por função (ROOT, ADMIN, GERENTE, VENDEDOR, PRODUCAO)
- Audit log automático em toda operação de escrita no banco
- Rate limiting e proteção contra força bruta no login
- Migrations iniciais: leads, clientes, pedidos, produção, pagamentos, estoque, financeiro
- Settings singleton com cache Redis (TTL 5 minutos)
- Middleware de suspensão de conta executado antes da autenticação
- Webhook do operador com validação HMAC
- Health check da API e endpoint de diagnóstico
- Docker Compose completo: API, PostgreSQL, Redis, NGINX
- Arquivo .env.example com todas as variáveis documentadas
