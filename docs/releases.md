# ORION CRM — Histórico de Releases

> Cada release tem um resumo curto para usuário leigo (até 350 caracteres), uma explicação do que melhora no dia a dia, a lista de novidades em linguagem clara, e os detalhes técnicos colapsáveis para quem quer ver a parte de código.
>
> Este arquivo é consumido pelo endpoint `GET /api/internal/system/timeline` e renderizado em **Suporte → Linha do Tempo**.

---

## [v1.9.0] — 15 de maio de 2026
### Limpeza do banco direto na tela e roteamento de agendamentos

#### Em poucas palavras
Agora você zera dados de teste do banco direto pelo CRM, sem chamar dev. E configura para qual pipeline o agendamento vai, evitando o erro pós-reset onde a agenda quebrava por apontar para o pipeline antigo.

#### O que melhora pra você
Você ganhou autonomia para preparar o sistema antes de entregar pro cliente final. Antes, zerar dados de teste exigia acesso ao servidor por SSH ou alguém com PgAdmin. Agora é por clique, com confirmação dupla, audit log e proteção das tabelas críticas (usuários, configurações, migrations).

Junto, resolvemos o erro chato onde agendamentos quebravam depois de você zerar o banco — o sistema tentava usar o ID antigo do pipeline. Agora você define numa aba "Agenda" em Ajustes qual pipeline recebe os novos agendamentos. Sem isso configurado, agendamento ainda funciona (mas sem vincular a pipeline).

#### Novidades

- **Aba "Banco de Dados" em Ajustes** (só ROOT) com lista das 61 tabelas mostrando nome amigável em português (ex: "Log de auditoria" no lugar de `audit_logs`), descrição do que cada uma guarda, quantidade de registros e tamanho em disco.
- **Exportar tabela** em CSV (abre no Excel) ou SQL (restaurar em outro Postgres).
- **Exportar tudo** num único arquivo `.sql` para backup completo.
- **Apagar tabela** específica com confirmação digitada (você precisa digitar o nome da tabela).
- **Apagar tudo** preservando automaticamente 3 tabelas críticas (usuários, configurações, histórico de migrations) para você não se trancar fora do sistema.
- **Aba "Agenda" em Ajustes** com dropdown simples para escolher o pipeline padrão dos agendamentos. Banner amarelo alerta quando não está configurado, banner verde confirma quando está.
- **Botão "Baixar .md" no Roadmap**: ROOT pode editar um plano pelo CRM, baixar o arquivo markdown e mandar pro dev versionar no Git, sem precisar de acesso ao banco de produção.

#### Detalhes técnicos
- Migration `053` adiciona `settings.default_appointment_pipeline_id` (UUID nullable com FK `ON DELETE SET NULL`).
- 6 endpoints novos sob `/api/v1/admin/database/*` (lista tabelas, exportar CSV/SQL, exportar tudo, truncate individual, truncate-all preservando whitelist).
- 2 endpoints novos `/api/v1/settings/agenda` (GET + PATCH) com RBAC ROOT/ADMIN.
- `appointments.routes.ts` consulta `settings.default_appointment_pipeline_id` quando `pipeline_id` não vem no request.
- 49 tabelas do banco mapeadas em `TABLE_META` com `{ label, description }`.
- Audit log automático em toda exportação e exclusão.
- TRUNCATE usa `CASCADE` para respeitar foreign keys.

#### Atenção
A operação "Apagar tudo" não pode ser desfeita. Sempre exporte um backup antes (`Exportar tudo (.sql)` no topo da aba Banco de Dados).

---

## [v1.8.0] — 13 de maio de 2026
### Roadmap do Projeto — gestão de planos com aprovação do cliente

#### Em poucas palavras
Aba "Roadmap" em Suporte vira o canal entre dev e cliente: dev publica plano, cliente aprova/reprova/comenta antes do código ser escrito. Acaba com retrabalho de entrega que o cliente não queria. Histórico fica registrado.

#### O que melhora pra você
Antes, planejamento de feature ia por WhatsApp ou e-mail, ficava perdido, e quando o cliente reclamava ninguém sabia o que tinha sido combinado. Agora cada feature vira um card visível para todos, com status, prazo, comentários encadeados e reações.

O cliente entra no CRM, vê o que está sendo construído em linguagem de negócio, aprova ou comenta antes do dev começar. Se reprovar, o plano não vira código. Quando aprova, o dev tem registro claro do escopo. Acabou de entregar, cliente vê o status mudar de "Em andamento" para "Concluído".

#### Novidades

- **Cards do roadmap** com título, descrição em linguagem leiga, status (Planejado / Aguardando aprovação / Aprovado / Em andamento / Parado / Concluído / Reprovado), prazo previsto e detalhes técnicos em dropdown colapsável.
- **Dropdown de status** editável diretamente no card (só ROOT muda).
- **Botões Aprovar / Reprovar** para o cliente (ADMIN/ROOT).
- **Comentários com threading**: cliente pergunta, dev responde abaixo aninhado.
- **Reações 👍 / 👎** nos comentários (só ROOT) — sinaliza "concordo, vou fazer" ou "não vou seguir essa sugestão", com tooltip explicando que não é ofensa.
- **Anexos** no item ou em comentários (PNG, JPG, GIF, WEBP, MP4, WEBM, MOV, PDF — até 10 MB).
- **Selo "IA"** roxo no card quando foi a IA (Claude) que criou o plano.
- **Badge dourado** no menu lateral "Suporte" com contagem de items aguardando sua aprovação (atualiza a cada 60 segundos).
- **Aba "Atualizações" antiga removida** — sua função foi absorvida pelo Roadmap. A Linha do Tempo (gráfico + histórico técnico) continua intacta.
- **Central de Ajuda** ganhou seção "Roadmap do Projeto" explicando todo o ciclo.

#### Detalhes técnicos
- Migration `052` cria 4 tabelas: `roadmap_items`, `roadmap_comments` (threading via `parent_comment_id`), `roadmap_comment_reactions`, `roadmap_attachments`.
- 13 endpoints sob `/api/v1/roadmap/*` com RBAC apropriado: criar/editar só ROOT, aprovar ROOT+ADMIN, comentar/reagir autenticados, deletar comentário próprio ou ROOT.
- Anexos com validação de mime-type e tamanho.
- Selo IA via flag `created_by_ai: boolean` no item.
- Componente `RoadmapTab` em `apps/web/app/(crm)/chamados/components/RoadmapTab.tsx`.

---

## [v1.7.0] — 11 de maio de 2026
### Materiais nas OS, atalho do PDV na ficha e arquitetura OS→PDV revisada

#### Em poucas palavras
Ordem de Serviço agora aceita lista de matérias-primas e peças do estoque com cálculo de subtotal. Mão de obra virou campo separado. Botão "Faturar no PDV" na ficha do cliente abre o PDV com cliente já selecionado. Aba "Caixa" da ficha foi removida — fluxo certo é OS → PDV.

#### O que melhora pra você
Quando atendente cria uma OS, agora consegue listar os materiais que vão ser consumidos (filtrados entre "Matéria-prima" e "Peças prontas"), com preço de venda fotografado no momento — se mudar o preço do produto depois, a OS antiga mantém o valor original. Subtotal aparece em tempo real.

Mão de obra ficou em campo separado (padrão da joalheria — o trabalho do ourives é cobrado à parte do material). Preview do total ajuda a conferir antes de fechar com o cliente.

Na ficha, novo botão "Faturar no PDV" abre o caixa com cliente vinculado, sem precisar buscar de novo. Acelera o fechamento de venda.

#### Novidades

- **Seção "Materiais" no modal de criar OS**: busca de produtos do estoque com filtros Tudo / Matéria-prima / Peças prontas, debounce na busca, lista editável com quantidade, subtotal automático.
- **Snapshot de preço/custo** no momento que o material é adicionado à OS — preço congela mesmo se o produto for repreçado depois.
- **Campo "Mão de obra" separado** do subtotal de materiais.
- **Preview de total**: subtotal materiais + mão de obra, atualiza em tempo real.
- **Botão "Faturar no PDV"** na barra direita da ficha do cliente — abre `/pdv?customer_id=X` com o cliente já vinculado.
- **PDV aceita pré-seleção de cliente via URL** (atalho da ficha).
- **Aba "Caixa" da ficha removida** — era placeholder. Decisão arquitetural: fluxo certo é OS → PDV (não duplicar checkout dentro da ficha).
- **Permissão `ficha.caixa.view` removida** do backend, frontend e painel de Ajustes.
- **Central de Ajuda** ganhou seção "Ordem de Serviço (OS) e materiais".

#### Detalhes técnicos
- Migration `051` cria `service_order_materials` e adiciona colunas `labor_cents`, `materials_subtotal_cents`, `markup_percent` em `service_orders`.
- Endpoints CRUD `/service-orders/:id/materials` (GET/POST/PATCH/DELETE) e `/labor` (PATCH) com recálculo transacional dos totais.
- Limpeza de ruído: `.codex/`, `.opencode/`, `.claude/`, `.playwright-mcp/` e PNGs soltos na raiz agora ignorados pelo Git.

---

## [v1.6.0] — 11 de maio de 2026
### Pipelines configuráveis, regras de handoff, permissões por usuário

#### Em poucas palavras
Configuração do pipeline ficou num modal único com abas Etapas e Regras. Regras movem cards entre pipelines automaticamente (handoff). Permissões controlam quais seções da ficha cada usuário enxerga. Categorias de estoque viraram CRUD com subcategorias e flag "matéria-prima".

#### O que melhora pra você
Você passa a desenhar o fluxo de negócio dentro do CRM como o cliente realmente trabalha. Quando o atendente arrasta um card pra "Convertido" no pipeline de Leads, uma regra dispara e cria automaticamente um card em "Backlog" no pipeline de Produção — handoff entre setores sem retrabalho.

Cada usuário enxerga só as seções da ficha que ele precisa (atendente vê tudo, produção só vê dados/OS/entrega, financeiro só vê pedidos). Reduz erro humano e mantém informação confidencial onde precisa.

Estoque ganhou catálogo de categorias próprio (sem mais string solta), com subcategorias ("Anéis > Aliança"), e cada produto pode ser marcado como matéria-prima (aparece com selo MP no PDV e na lista).

#### Novidades

- **Modal único de configuração do pipeline** com abas Etapas e Regras (substitui o builder React Flow e o builder-v2 do Codex — ambos descontinuados).
- **Regras de pipeline funcionais**: ação "Criar card vinculado" cria de verdade um lead novo no pipeline destino com o mesmo cliente. Idempotente.
- **Handoff entre setores**: mesmo cliente pode existir em pipelines diferentes (Comercial → Produção → Entrega) sem duplicar.
- **Botão `?` no modal de regras** abre ajuda contextual com exemplo prático.
- **Validação visual** no formulário de regra: campo obrigatório destacado, botão desabilitado enquanto faltar dado, mensagem explicando o que falta.
- **9 permissões de ficha** (`ficha.X.view`) controlam visibilidade dos blocos por usuário.
- **Defaults por cargo**: ATENDENTE vê tudo, PRODUÇÃO só dados/OS/entrega, FINANCEIRO só dados/pedidos/caixa/histórico.
- **Central de Ajuda nova em `/ajuda`** (depois consolidada no painel `?` da topbar).
- **CRUD de categorias** direto no Estoque com subcategorias, renomear, excluir com proteção.
- **Toggle "Matéria-prima"** no formulário de produto.
- **Selo MP** dourado nos cards do estoque e do PDV.

#### Detalhes técnicos
- Migration `049` permite mesmo cliente em pipelines diferentes (`UNIQUE (whatsapp_number, pipeline_id)`).
- Toda criação de lead via WhatsApp, formulário público, n8n e POST manual passou a escopar dedup por pipeline.
- Endpoint `GET /api/v1/users/me` retorna `custom_permissions` do próprio usuário sem precisar de role administrativa.
- Migration `050` adiciona `product_categories` com hierarquia (`parent_id`) e flag `products.is_raw_material`.

---

## [v1.5.2] — 02 de maio de 2026
### Correção de navegação de Leads e scroll do kanban

#### Em poucas palavras
Atalho "/leads" no menu voltou a funcionar mesmo depois de mudar o slug do pipeline. Scroll horizontal do kanban parou de gerar erro repetido no console do navegador.

#### O que melhora pra você
Pequenos polimentos que tiram atrito do uso diário. O sistema fica mais "silencioso" — menos erros piscando no console, navegação sem surpresas mesmo se o admin trocar o nome do pipeline default.

#### Novidades

- Dashboard parou de depender de URL fixa `/pipeline/leads`. Atalho `/leads` resolve dinamicamente.
- Rota `/leads` agora prioriza slug `leads`, depois pipeline padrão, depois primeiro disponível.
- Kanban deixou de quebrar com `preventDefault` em listener passivo.

#### Detalhes técnicos
- Listener nativo com `passive: false` no scroll horizontal do pipeline.
- Erro `Unable to preventDefault inside passive event listener invocation` eliminado.

---

## [v1.5.1] — 02 de maio de 2026
### Topbar mobile reorganizada e atalhos flutuantes

#### Em poucas palavras
No celular, o topo do sistema tava amontoado. Reorganizamos em 2 linhas para dar respiro à busca. Botões Pergunte, Ajuda e Notificações saíram do topo e viraram atalhos flutuantes no canto inferior.

#### O que melhora pra você
Se você usa o CRM no celular, a barra superior ficou muito mais legível e a busca ganhou destaque. Atalhos importantes (Pergunte à IA, Ajuda, Notificações) ficam sempre acessíveis no canto da tela, sem competir com o cabeçalho.

#### Novidades

- Topbar mobile reorganizada em 2 linhas.
- Busca global em destaque na primeira linha.
- Contexto (seção + página atual) movido para segunda linha.
- Botão "Pergunte" virou ação flutuante persistente no canto inferior direito.
- Ajuda e Notificações também saíram do topo para atalhos flutuantes.

#### Detalhes técnicos
- Desktop preservado sem alteração.

---

## [v1.5.0] — 02 de maio de 2026
### Estabilização de Clientes, Atendimento, Inbox e Pipeline

#### Em poucas palavras
Pacote de correções críticas. Histórico do cliente voltou a mostrar mensagens reais do WhatsApp. Atendimento ganhou proteção contra ataque XSS. Inbox e Pipeline ficaram mais consistentes.

#### O que melhora pra você
Bugs invisíveis que deixavam o sistema "mentindo" pro usuário (histórico vazio quando tinha dados, painel falhando em silêncio). Foram corrigidos. Atendimento ficou seguro contra colar HTML malicioso (vinha como ataque potencial). RBAC do ROOT consistente em todo o sistema.

#### Novidades

- Histórico do cliente exibe eventos reais e mensagens reais do WhatsApp.
- Contrato frontend/backend da aba Histórico corrigido, sem mascarar erro de banco.
- Sanitização de HTML aplicada no atendimento para bloquear XSS persistente, mantendo formatação básica.
- Painel do cliente voltou a carregar blocos de atendimento sem queda silenciosa.
- Filtro de usuários por papel alinhado para menções e seleção operacional.
- Inbox: perfil ROOT se comporta como superusuário de forma consistente.
- Pipeline builder permite criar, editar, reordenar e remover etapas na própria tela.

#### Detalhes técnicos
- Testes e validações de typecheck executados após as correções.

---

## [v1.4.0] — 28 de abril de 2026
### Sincronização de Clientes, Pipeline e Suporte

#### Em poucas palavras
Ficha do cliente parou de tentar reconverter quem já é cliente. Modal "Novo lead" ganhou busca inteligente (com/sem máscara) para evitar duplicidade. Suporte voltou a exibir commits reais.

#### O que melhora pra você
Cadastro mais inteligente: antes de criar um lead novo, o sistema busca se aquele telefone ou CPF já existe e sugere reaproveitar. Reduz cliente duplicado no banco e perda de histórico.

#### Novidades

- Ficha do cliente não tenta mais converter lead quando o registro já é cliente.
- Validação inline com feedback visual em nome, WhatsApp, e-mail, CPF, estado.
- Modal "Novo lead" busca por nome, CPF ou telefone (com e sem máscara).
- Sugestões de cliente/lead existente preenchem o formulário ou abrem o cadastro.
- Textos do modal de lead reescritos para usuário leigo com ação principal dinâmica.
- Módulo Suporte tenta refletir commits reais via git local com fallback no GitHub.
- Timeline e Atualizações deixaram de quebrar quando `releases.md` não estiver disponível.

#### Detalhes técnicos
- Persistência de WhatsApp liberada no PATCH de clientes.
- Rate limit de login ignorado em ambiente local para testes Playwright.

---

## [v1.3.0] — 25 de abril de 2026
### Pipeline com qualidade alta e módulo Suporte renovado

#### Em poucas palavras
13 das 14 tarefas de qualidade do Pipeline foram resolvidas. Toolbar mais compacta, menu contextual no card (acabou logout acidental), modal "Ganhou/Perdeu" com validações, view em lista, recolhimento de colunas. Suporte ganhou 3 abas (Incidentes, Linha do Tempo, Atualizações).

#### O que melhora pra você
Pipeline ficou profissional. Botão que causava logout sem querer virou menu contextual. Modal Ganhou/Perdeu exige campos certos antes de fechar. Pipeline no celular vira lista automaticamente. Suporte virou central completa para reportar bugs com foto/vídeo e acompanhar entregas.

#### Novidades

- Toolbar compacta do Pipeline com import/export CSV.
- Menu contextual no card de lead (corrige logout acidental).
- Modal "Ganhou": valor da venda obrigatório. Modal "Perdeu": motivo obrigatório.
- View Lista funcional com toggle Pipeline/Lista e preferência salva.
- Pipeline mobile vira lista automaticamente em telas pequenas.
- Validação inline no modal "Novo Lead" com mensagens contextuais.
- Feedback visual ao salvar nota: "Salvando..." → "Salvo ✓" → idle.
- Colunas vazias recolhíveis com persistência.
- Suporte com 3 abas: Incidentes, Linha do Tempo, Atualizações.
- Registro de bugs e sugestões com upload de imagens e vídeos.
- Gráfico de atividade de commits por dia.
- Separação entre entregas concluídas e itens em desenvolvimento.

#### Detalhes técnicos
- Correção de logout ao navegar em ambiente local com HTTP.

---

## [v1.2.0] — 24 de abril de 2026
### Dashboard responsivo e Agenda completa

#### Em poucas palavras
Dashboard resolveu 22 tarefas de qualidade: responsividade mobile/tablet, KPIs com dados consistentes, gráfico com fallback, notificações, aniversariantes com modal de parabéns. Agenda ganhou 6 visualizações estilo Google Calendar e CRUD completo.

#### O que melhora pra você
Dashboard ficou tão responsivo que abre limpo no celular (640px), tablet (1024px) e telas estreitas (380px). Gráfico de faturamento mostra mensagem quando não tem dados, em vez de quebrar. Aniversariantes ganharam botão com modal de parabéns e link WhatsApp já pronto.

Agenda virou um Google Calendar de verdade — Mês, Semana, Dia, 4 Dias, Agenda, Programação. CRUD completo: criar, editar, cancelar com motivo, remarcar.

#### Novidades

- Dashboard responsivo em mobile (640px), tablet (1024px) e telas estreitas (380px).
- Calendário do dashboard sem erro de hidratação SSR.
- Gráfico de faturamento SVG com fallback "Nenhum dado para o período".
- KPI cards com skeleton de carregamento.
- Top Clientes com valores consistentes com faturamento real.
- Botões de aniversariantes com modal de parabéns e link WhatsApp pré-preenchido.
- Painel de Notificações no Topbar com acessibilidade.
- Atividade recente com tempo relativo e labels por tipo.
- Cards de estoque crítico clicáveis com navegação direta.
- Agenda com 6 visualizações Google Calendar.
- CRUD completo de agendamentos com motivo de cancelamento.
- Confirmação obrigatória antes de concluir atendimento com observações.
- Deduplicação de eventos e sistema de cores unificado.
- Máscara de WhatsApp com validação em tempo real.
- Responsável pré-selecionado com o usuário logado.

---

## [v1.1.0] — 12 de abril de 2026
### Central de Ajuda + IA Copiloto com Skills

#### Em poucas palavras
Sistema ganhou ajuda contextual em cada tela (botão `?` com explicações). IA Copiloto virou módulo configurável com skills personalizáveis por categoria. WhatsApp foi reorganizado como sub-aba de Integrações.

#### O que melhora pra você
Usuário leigo deixou de precisar "adivinhar" o sistema. Cada tela tem botão `?` que abre explicações específicas do que está vendo. IA ficou customizável — o atendente pode ativar/desativar skills (atendimento, vendas, etc.) conforme a necessidade.

#### Novidades

- Central de Ajuda com abas Ajuda e Tutorial, documentação de todos os módulos.
- Módulo IA Copiloto nas configurações com skills personalizáveis.
- Skills em cards visuais com ícones por categoria.
- Suporte ao modelo Qwen como alternativa.
- WhatsApp reorganizado como sub-aba dentro de Integrações.
- Até 2 agendamentos por slot de horário com validação na API.
- Bot cria lead automaticamente ao agendar via WhatsApp.

---

## [v1.0.0] — 07 de abril de 2026
### Dashboard com dados reais do banco

#### Em poucas palavras
Dashboard saiu de valores fictícios e passou a exibir dados reais da API. KPIs dinâmicos: faturamento mensal, novos leads, pedidos em aberto, ticket médio. Cada cargo vê uma visão adaptada.

#### O que melhora pra você
Dashboard virou ferramenta real de operação. Cada pessoa vê o que importa pro cargo dela: admin tem visão geral, produção vê fila de OS, financeiro vê fluxo de caixa.

#### Novidades

- KPIs dinâmicos: faturamento, novos leads, pedidos em aberto, ticket médio.
- Fallback visual quando banco não retorna dados para o período.
- Queries adaptadas por role (admin / produção / financeiro).

---

## [v0.9.0] — 01 de abril de 2026
### Agenda completa e redesign do Assistente IA

#### Em poucas palavras
Agenda agora tem backend completo: criar, editar, cancelar e concluir atendimentos. Lead aparece automaticamente no kanban depois de agendar. Assistente IA ganhou redesign estilo Hostinger com painel lateral.

#### O que melhora pra você
Agenda virou ferramenta operacional de verdade — agendou pelo CRM, lead já cai no funil. Assistente IA ficou mais fácil de acessar e usar enquanto navega pelo sistema.

#### Novidades

- Backend completo de agenda: criação, edição, cancelamento, conclusão.
- Calendário navegável por mês, semana e dia (visual Google Calendar).
- Lead aparece no kanban automaticamente após agendamento.
- Redesign do Assistente IA: painel lateral estilo Hostinger.
- PageHeader como faixa dourada compacta padronizada.
- Endpoints n8n: contexto do lead, slots disponíveis, criação de agendamento.

---

## [v0.8.0] — 27 de março de 2026
### Webhooks, login melhorado, deploy automático e estabilidade

#### Em poucas palavras
Sistema ganhou geração de chave de webhook para integrações externas. Login mostra contador regressivo no erro de tentativas excedidas e tem toggle "mostrar senha". CI/CD com GitHub Actions e GHCR. Suíte E2E com Playwright.

#### O que melhora pra você
Cada deploy passa por testes automatizados antes de subir. Login mais amigável. Integrações com terceiros (n8n, Zapier) ficam mais fáceis de configurar com gestão de chaves no painel.

#### Novidades

- Geração de chave de webhook para integrações externas.
- Painel de gerenciamento de múltiplas chaves.
- Login: contador regressivo no erro de limite de tentativas.
- Login: toggle mostrar/ocultar senha.
- Auto-criação do usuário ROOT no primeiro boot via variáveis de ambiente.
- Pipeline CI/CD com GitHub Actions, build via GHCR, deploy automático.
- Suíte E2E com Playwright: health check, login, operação, RBAC.

#### Detalhes técnicos
- Correções: 404 falso em leads, cores do modal, scroll no inbox, bypass do ROOT no RBAC.
- Múltiplas correções de estabilidade NGINX e rede Docker.

---

## [v0.7.0] — 19 de março de 2026
### Segurança avançada e ferramentas de operação

#### Em poucas palavras
Sistema desconecta automaticamente após inatividade configurável. Restrição de login por horário (bloqueia acesso fora do expediente). Adminer disponível para consulta direta ao banco.

#### O que melhora pra você
Segurança pra você dormir tranquilo. Se atendente esquecer logado no balcão, sistema desloga sozinho. Se quiser garantir que sistema só é acessado em horário de expediente, configura uma vez.

#### Novidades

- Timeout de sessão configurável.
- Restrição de login por horário.
- Aba de Segurança nas configurações.
- Adminer: interface web para consulta direta ao banco.

---

## [v0.6.0] — 18 de março de 2026
### Deploy em produção — Hostinger, Traefik e SSL

#### Em poucas palavras
Sistema migrado para servidor de produção na Hostinger com domínio próprio e SSL automático (HTTPS). Containers reiniciam sozinhos em caso de falha.

#### O que melhora pra você
Sistema acessível pelo domínio oficial com cadeado verde no navegador (cliente confia mais). Em caso de queda, containers se recuperam sozinhos.

#### Novidades

- Migração para Traefik como proxy reverso na Hostinger VPS.
- Domínio oficial com SSL automático via Let's Encrypt (HTTPS).
- NGINX com configuração embarcada na imagem Docker.
- Restart automático com healthcheck integrado.

#### Detalhes técnicos
- Correções de rede, DNS e crash loop na inicialização da API em produção.

---

## [v0.5.0] — 16 de março de 2026
### PDV, Estoque, painel do cliente, busca global e RBAC expandido

#### Em poucas palavras
Sistema ganhou Ponto de Venda completo, controle de estoque, painel detalhado do cliente, busca global com Cmd+K, e RBAC validado em cada endpoint.

#### O que melhora pra você
PDV permite vender direto pelo CRM. Estoque mostra entradas/saídas. Painel do cliente concentra tudo (histórico, OS, propostas, atendimentos). Busca global encontra qualquer coisa em segundos.

#### Novidades

- Ponto de Venda (PDV): busca de produtos, carrinho, finalização, cálculo de troco.
- Recibo de venda com modal de impressão.
- Estoque: lista de produtos com ajustes manuais de entrada/saída.
- Painel completo do cliente: histórico, OS, propostas, atendimento.
- Pipeline do lead com detalhe lateral e linha do tempo de atividades.
- Busca global com atalho Cmd+K em clientes, produtos, pedidos, leads.
- Controle de acesso por função (RBAC) validado em cada endpoint.
- Central de Ajuda com conteúdo contextual por módulo.
- Fiscal e Logística unificados na aba Integrações.

#### Detalhes técnicos
- 10 novas migrations: PDV, estoque, painel cliente, transportadoras, provedores.

---

## [v0.4.0] — 12 de março de 2026
### Design System v2 + Inbox avançado + Financeiro

#### Em poucas palavras
Dark theme consistente em todo o sistema. Inbox ganhou encerramento de atendimentos, abas de analytics e canvas de automações. Upload de comprovante no financeiro.

#### O que melhora pra você
Aparência profissional consistente. Inbox virou central de atendimento de verdade — não só conversas, mas analytics, automações e fluxo completo.

#### Novidades

- Dark theme consistente em todos os módulos internos.
- Inbox com encerramento de atendimentos.
- Abas de analytics no Inbox.
- Canvas de automações.
- Upload de comprovante de pagamento no financeiro.
- Lead detail reformulado com layout lateral e hierarquia visual clara.

---

## [v0.3.0] — 09 de março de 2026
### Pipeline v2, Loja Pública, Analytics e IA v2

#### Em poucas palavras
Pipeline ganhou modelo canônico no banco e sidebar dinâmica por funil. Sistema agora tem loja pública (vitrine externa) com checkout Mercado Pago. Analytics de vendas. IA com histórico de conversa e log de uso.

#### O que melhora pra você
Loja pública permite que joalheria venda pelo site sem precisar de outro sistema. Pipeline ficou flexível pra criar múltiplos funis (comercial, recompra, etc.). IA fica responsável por suas conversas com histórico salvo.

#### Novidades

- Pipeline v2 com modelo canônico no banco e sidebar dinâmica.
- Rotas `/pipeline/[slug]` (kanban) e `/pipeline/[slug]/builder` (configuração).
- Loja pública: catálogo, página individual, checkout com Mercado Pago.
- Admin da loja: configuração, categorias, produtos, acompanhamento de pedidos.
- Dashboard de analytics de vendas com filtros por período.
- Assistente IA v2 com histórico de conversa, permissões por role, log de uso.
- Simulador de venda aprovada para testes.

---

## [v0.2.0] — 03 de março de 2026
### CRM Core Completo — do funil ao deploy

#### Em poucas palavras
Primeira versão funcional do CRM completo: leads, clientes, inbox WhatsApp, pedidos, produção, estoque, financeiro, PDV, Mercado Pago, dashboard, IA, landing pública e deploy via Docker.

#### O que melhora pra você
Sistema saiu da fase "esqueleto" para "operação real". Você consegue receber leads, atender pelo WhatsApp, cadastrar pedidos, controlar produção, fechar venda no PDV, ver tudo em dashboard.

#### Novidades

- Design system Next.js 14 + Tailwind + shadcn/ui.
- Gestão de leads com kanban por etapa do funil.
- Gestão de clientes com histórico e painel de detalhes.
- Inbox WhatsApp: conversas, atribuição, encerramento, webhook, fila BullMQ.
- Pedidos de pronta entrega e personalizados com upload de design.
- Fila de produção com avanço por etapa e registro de fotos.
- Controle de estoque com entradas e saídas.
- Módulo financeiro com lançamentos e fluxo de caixa.
- PDV com carrinho e finalização de pagamento.
- Mercado Pago: link de pagamento e confirmação via webhook.
- Dashboard com KPIs e feed de atividade recente.
- Assistente IA integrado.
- Landing pública e catálogo público de produtos.
- Deploy funcional com Docker Compose.

---

## [v0.1.0] — 02 de março de 2026
### Fundação do Sistema

#### Em poucas palavras
Primeira pedra do CRM. Monorepo configurado, autenticação JWT, RBAC, audit log, rate limiting, settings com cache Redis, webhook do operador, healthcheck. Base sólida pra tudo que vem em cima.

#### O que melhora pra você
Não é uma feature visível — é a fundação que faz tudo o resto funcionar bem. Segurança, performance e auditoria desde o dia 1.

#### Novidades

- Monorepo: API Express + TypeScript, Next.js 14, PostgreSQL 16, Redis.
- Autenticação JWT com refresh token rotativo.
- Controle de acesso por função (ROOT, ADMIN, GERENTE, VENDEDOR, PRODUCAO).
- Audit log automático em toda operação de escrita.
- Rate limiting e proteção contra força bruta no login.
- Migrations iniciais: leads, clientes, pedidos, produção, pagamentos, estoque, financeiro.
- Settings singleton com cache Redis (TTL 5 minutos).
- Middleware de suspensão de conta antes da autenticação.
- Webhook do operador com validação HMAC.
- Health check da API e endpoint de diagnóstico.
- Docker Compose completo: API, PostgreSQL, Redis, NGINX.

#### Detalhes técnicos
- Arquivo `.env.example` com todas as variáveis documentadas.
