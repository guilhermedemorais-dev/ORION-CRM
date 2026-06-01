# ORION CRM — Histórico de Releases

> Cada release tem um resumo curto para usuário leigo (até 350 caracteres), uma explicação do que melhora no dia a dia, a lista de novidades em linguagem clara, e os detalhes técnicos colapsáveis para quem quer ver a parte de código.
>
> Este arquivo é consumido pelo endpoint `GET /api/internal/system/timeline` e renderizado em **Suporte → Linha do Tempo**.

---

## [v1.11.0] — 1 de junho de 2026
### Ficha do cliente: salvamento corrigido, etiquetas (tags), responsável automático e histórico em português

#### Em poucas palavras
A ficha do cliente agora salva de verdade. Tinha um problema sério: cliente sem e-mail não conseguia salvar nada — a data de nascimento e outras informações simplesmente sumiam ao recarregar. Isso foi corrigido. Além disso, a ficha ganhou etiquetas (tags), passou a mostrar quem começou e quem está atendendo o cliente, e o histórico ficou todo em português claro.

#### O que melhora pra você
Antes, se o cliente não tivesse e-mail preenchido, ao clicar em "Salvar" o sistema recusava tudo de uma vez e parecia que a ficha não salvava — você digitava data de nascimento, endereço, e ao voltar estava tudo apagado. Agora os campos vazios são tratados corretamente e o salvamento funciona mesmo sem e-mail, CPF ou qualquer campo opcional.

A data de nascimento também não some mais: ela voltava num formato que o campo de data descartava. Corrigido na origem e na tela.

O botão "Salvar alterações" agora fica fixo no rodapé (não some no fim do formulário), só fica ativo quando há algo novo pra salvar, mostra um aviso de "alterações não salvas" e avisa antes de você fechar a aba sem salvar. CPF, CNPJ, telefone e CEP agora têm máscara automática enquanto você digita.

A coluna da esquerda agora mostra o **responsável**: quem começou a atender o cliente e quem está atendendo agora — calculado automaticamente a partir dos pedidos, conversas e atendimentos, sem você precisar marcar nada. E você pode adicionar **etiquetas (tags)** ao cliente (ex.: "VIP", "Aniversário em maio") clicando no "+".

Por fim, a aba **Histórico** parou de mostrar termos técnicos em inglês (como "RESUME_ORDER", "Entity Type: orders"). Os detalhes de cada evento agora aparecem traduzidos e bem explicados.

#### Novidades

- **Salvamento da ficha corrigido**: campos opcionais vazios (e-mail, CPF etc.) não bloqueiam mais o salvamento. Antes, e-mail em branco derrubava o salvamento inteiro.
- **Data de nascimento** volta a aparecer corretamente após salvar.
- **Botão Salvar fixo** no rodapé, com indicador de "alterações não salvas", desabilitado quando nada mudou e aviso ao sair sem salvar.
- **Máscaras automáticas** em CPF, CNPJ, telefone fixo e CEP.
- **Etiquetas (tags)** por cliente: criar com o "+" (Enter confirma), remover no "×". Salvamento automático.
- **Responsável automático** na coluna esquerda: "Começou a atender" (atividade mais antiga) e "Atendendo agora" (mais recente). Quando é a mesma pessoa, mostra uma linha única com a data de início.
- **Histórico em português**: detalhes dos eventos traduzidos (status, motivos, valores em R$, datas), escondendo identificadores técnicos.

#### Detalhes técnicos
- **Migration**: `059_customers_tags.sql` (coluna `tags JSONB` em customers).
- **PATCH /customers/:id**: converte strings vazias em `null` antes da validação (evita `z.string().email()` rejeitar `""` e derrubar o save com 400); aceita `tags` (array, normalizado/deduplicado, gravado como JSONB).
- **GET /customers/:id/full**: retorna `birth_date` como `YYYY-MM-DD` (`TO_CHAR`) e calcula `first_attendant`/`current_attendant` via UNION de `orders.assigned_to`, `conversations.assigned_to` e `attendance_blocks.created_by` (mais antigo/mais recente).
- **Frontend**: `ClientFichaTab.tsx` (normalização de data, máscaras, dirty-tracking, botão fixo); `ClientLeftSidebar.tsx` (tags editáveis + responsável derivado); `ClientHistoricoTab.tsx` (tradução PT-BR dos detalhes e troca de acesso por colchete por `Map.get`).
- Central de ajuda atualizada com Tags e Responsável.

#### Atenção
O responsável é **derivado** dos dados existentes; não há atribuição manual nesta versão. Se nenhum pedido, conversa ou atendimento tiver responsável registrado, a ficha mostra "Sem responsável".

---

## [v1.10.1] — 29 de maio de 2026
### Agenda mais completa, foto do cliente e ajustes no pipeline

#### Em poucas palavras
A agenda ganhou melhorias (duração padrão de agendamento e um resumo do dia ao clicar na data), você passou a poder enviar a foto do cliente direto na ficha, e o pipeline recebeu refinamentos.

#### O que melhora pra você
Na agenda, criar e visualizar agendamentos ficou mais prático: dá pra definir uma duração padrão em Ajustes, e ao clicar num dia aparece um resumo com os compromissos daquele dia. A ficha do cliente agora aceita foto — é só clicar no avatar e enviar (PNG, JPEG ou WebP até 5 MB). O pipeline e alguns pontos de produtos/configurações também foram refinados.

#### Novidades

- **Foto do cliente**: upload direto pelo avatar na coluna esquerda da ficha, com validação de tipo e tamanho.
- **Duração padrão de agendamento** configurável em Ajustes → Agenda.
- **Resumo do dia** (popover) ao clicar numa data no calendário.
- Refinamentos visuais e de comportamento nos componentes da agenda (pílula do compromisso, painel lateral, diálogo de criação, visão mensal e por horário).
- Ajustes no pipeline e em rotas de produtos/configurações.

#### Detalhes técnicos
- **Migrations**: `055_settings_default_appointment_duration.sql`, `056_customers_photo_url.sql`.
- **Backend**: `lib/uploads.ts` (upload com validação por magic bytes), `appointments.routes.ts`, `pipelines.routes.ts`, `products.routes.ts`, `settings.routes.ts`.
- **Frontend**: componentes da agenda (`AppointmentPill`, `AppointmentSheet`, `CreateAppointmentDialog`, `DayPopover`, `MonthView`, `TimeGridView`, `page.tsx`), `ClientLeftSidebar.tsx` (foto) e lista de clientes.

---

## [v1.10.0] — 27 de maio de 2026
### Pedidos com Fluxo configurável, regras de pagamento e histórico completo na ficha

#### Em poucas palavras
O módulo Pedidos ganhou cara nova (no padrão do Estoque) e o sistema agora aceita Fluxos: você desenha como o pedido caminha entre etapas, define regras (ex: "só vai para produção se tiver pago pelo menos sinal") e o CRM bloqueia movimentações que quebrem a regra. Tudo o que acontece no pedido aparece também na linha do tempo do cliente, em PT-BR.

#### O que melhora pra você
Antes, etapa de pedido era fixa no código (Rascunho → Aguard. Pag. → Pago → ...). Não dava pra adaptar ao fluxo real da sua joalheria sem mexer no dev. Agora você cria quantos fluxos quiser em Ajustes baseando-se nos pipelines que já existem, e configura por etapa o que precisa estar pago, se notifica cliente automaticamente, e qual etapa conta como "em produção" ou "finalizado" pros KPIs.

Quando o atendente tenta mover um pedido violando uma regra (ex: mandar pra "Pronto pra retirada" sem o cliente ter pago), aparece um modal vermelho explicando o motivo em português claro. Se for caso excepcional, ROOT ou ADMIN podem **forçar a movimentação** preenchendo um motivo — fica tudo registrado no histórico de auditoria.

A aba "Pedidos" da ficha do cliente também ficou no mesmo padrão visual, filtrada só pelos pedidos dele, com o mesmo drawer lateral pra operar. E o histórico do cliente passou a mostrar cada mudança de etapa, pausa, retomada, cancelamento, override de regra e notificação WhatsApp — com data, autor e motivo.

#### Novidades

- **Módulo Pedidos refeito** com 4 KPIs no topo (Pedidos ativos · Aguardando pagamento · Em produção · Valor em aberto), tabela densa com **barra de progresso por etapa** colorida (dourado = ativo · laranja = pausado · vermelho = cancelado), drawer lateral ao clicar.
- **Drawer com operações completas**: Avançar etapa · Notificar WhatsApp (com prévia editável) · Pausar (com motivo) · Retomar · Cancelar (com motivo) · Abrir ficha do cliente · Gerar link Mercado Pago · Solicitar NF-e · Comprovantes (WhatsApp/E-mail).
- **Filtros**: busca por número/cliente, etapa, tipo (PE/Personalizado), pausados/ativos.
- **Exportar CSV** completo do filtro atual.
- **Aba Fluxo em Ajustes** (só ROOT): lista de fluxos cadastrados, botão "+ Novo fluxo", modal com nome + dropdown de pipeline + regras por etapa (regra de pagamento, conta como, notificar WhatsApp ao entrar).
- **Pedidos novos** ficam automaticamente associados ao fluxo ativo do módulo Pedidos, começando na primeira etapa.
- **payment_status do pedido** sincroniza automaticamente do PDV, Mercado Pago e baixas manuais — você nunca precisa marcar manualmente.
- **ErrorModal padronizado** virou exigência do design system: título PT-BR + lista de violações com borda esquerda vermelha + botão "+ Detalhes técnicos" colapsável + ação secundária opcional (ex: Forçar movimentação).
- **Aba Pedidos na ficha do cliente** repaginada com o mesmo layout do módulo, filtrada pelo cliente, no design system da ficha (DM Sans, paleta própria).
- **Histórico do cliente** ganhou 9 novos eventos: Pedido pausado / retomado / cancelado, etapa movida / overridden, notificação WhatsApp enviada — com ícones próprios (Pause / Play / XCircle / Shield / Send), cor por categoria e descrição em PT-BR incluindo o motivo.
- **Sender de WhatsApp genérico** respeita o provedor marcado como primário em Ajustes > WhatsApp (UazAPI, Evolution, Meta Cloud, Z-API, REST genérico) — sistema todo (Inbox + notificação de pedido) passa a usar o mesmo provedor automaticamente.

#### Detalhes técnicos
- **Migrations**: `057_orders_pause.sql` (paused_at, paused_reason, paused_by + índice parcial); `058_flows_and_payment_status.sql` (3 enums novos, 2 tabelas `flows` e `flow_stage_rules`, 3 colunas em `orders`, backfill de payment_status).
- **Services**: `payment-status.service.ts` (computeOrderPaymentStatus + syncOrderPaymentStatus), `flow-rules.service.ts` (checkFlowRules com 5 regras de pagamento), `whatsapp-sender.service.ts` (roteia pra provedor primary).
- **Rotas novas**: `/flows` (CRUD ROOT-only); `PATCH /orders/:id/stage` (move com validação + override); `POST /orders/:id/pause|resume|cancel`; `POST /orders/:id/notify-whatsapp` + `/preview`; `GET /orders/stats` e `/orders/export`.
- **GET /customers/:id/history** estendido pra incluir audit_logs de orders vinculados ao cliente, com 8 actions novas mapeadas (PAUSE_ORDER, RESUME_ORDER, CANCEL_ORDER, MOVE_STAGE, OVERRIDE_STAGE_MOVE, NOTIFY_WHATSAPP, UPDATE_STATUS, CREATE).
- **applyApprovedPaymentEffects** chama syncOrderPaymentStatus — ponto canônico cobre PDV / Mercado Pago / baixa manual.
- **POST /orders** detecta `flows.active_module='pedidos'` e auto-popula `flow_id` + `current_stage_id` (primeira etapa) na mesma transaction.
- **Frontend**: `components/system/ErrorModal.tsx` (novo padrão obrigatório); `components/modules/pedidos/{PedidosClient,shared}.tsx`; `components/modules/settings/FluxoTab.tsx`; `ClientPedidosTab.tsx` e `ClientHistoricoTab.tsx` atualizados.
- **Design System** (`PRD.DOCS/Designer Systems/ORION-DESIGN-SYSTEM.html`): nova seção documentando o padrão Error Dialog com spec visual e regras de quando usar.

#### Atenção
A coluna `current_stage_id` dos pedidos antigos fica NULL — eles continuam usando o caminho legado (transições do enum `order_status`) até serem associados a um fluxo. Pedidos novos já entram no fluxo ativo automaticamente. Pra retroativar pedidos antigos, basta um UPDATE manual associando `flow_id` e `current_stage_id`.

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
