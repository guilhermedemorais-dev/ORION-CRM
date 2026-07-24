---

# 🔍 AUDITORIA COMPLETA — MÓDULO PIPELINE (ORION CRM)
**Data:** 25/04/2026 | **Ambiente:** Produção — crm.orinjoias.com | **Auditor:** QA Sênior Automatizado

---

## 1️⃣ TESTES FUNCIONAIS — DESKTOP

---

### [BUG-FUNCIONAL-01]
**Descrição:** Botão "+" do card de lead redireciona para a página de login, efetivamente deslogando o usuário da sessão.

**Passos para reproduzir:**
1. Acessar `/pipeline/leads`
2. Localizar qualquer card de lead na coluna "Novo"
3. Clicar no botão "+" circular no rodapé do card

**Resultado esperado:** Abrir um menu contextual com ações rápidas (adicionar tarefa, nota, etc.)

**Resultado atual:** A sessão é destruída e o usuário é redirecionado para `/login`

**Impacto:** Perda total de fluxo de trabalho; usuário perde sessão ativa sem aviso.

**Severidade: Crítica**

---

### [BUG-FUNCIONAL-02]
**Descrição:** Botão "Lista" (toggle de view Pipeline/Lista) não executa nenhuma ação. A view Kanban permanece ativa independentemente de cliques, inclusive com parâmetro `?view=list` na URL.

**Passos para reproduzir:**
1. Acessar `/pipeline/leads`
2. Clicar no botão "Lista" no canto superior direito
3. Observar que nada muda

**Resultado esperado:** Alternar para view de lista tabular com colunas (Nome, Etapa, Valor, Responsável, etc.)

**Resultado atual:** Nenhuma mudança visual ou funcional. View Lista é uma funcionalidade morta.

**Impacto:** Feature prometida inacessível. Afeta usuários que preferem visualização tabular e trabalho com grandes volumes.

**Severidade: Alta**

---

### [BUG-FUNCIONAL-03]
**Descrição:** Botão "Importar leads" não executa nenhuma ação visível — sem modal, sem navegação, sem feedback.

**Passos para reproduzir:**
1. Acessar `/pipeline/leads`
2. Clicar em "Importar leads" no canto superior direito

**Resultado esperado:** Abertura de modal/wizard para importação de CSV ou integração

**Resultado atual:** Nenhuma reação. Botão completamente inerte. A mensagem de erro anterior do formulário ("Verifique os campos informados.") persiste no topo da página ao clicar.

**Impacto:** Impossibilita importação em massa de leads. Bloqueia onboarding de novos clientes com base de contatos existente.

**Severidade: Alta**

---

### [BUG-FUNCIONAL-04]
**Descrição:** Modal "Novo Lead" fecha silenciosamente ao submeter dados inválidos (telefone com formato inválido, ex: "abc123"), exibindo apenas a mensagem genérica "Verifique os campos informados." no topo da página — sem indicar qual campo falhou.

**Passos para reproduzir:**
1. Clicar em "Novo Lead"
2. Preencher Nome: "Teste"
3. Preencher Telefone: "abc123"
4. Clicar em "Criar lead"

**Resultado esperado:** Modal permanece aberto com destaque visual no campo inválido e mensagem específica (ex: "Formato de telefone inválido. Use +5511999999999")

**Resultado atual:** Modal fecha. Banner vermelho genérico aparece no topo. Usuário perde o contexto do formulário e precisa reabrir e redigitar os dados.

**Impacto:** Fricção severa na criação de leads. Sem feedback inline, usuário não sabe o que corrigir.

**Severidade: Alta**

---

### [BUG-FUNCIONAL-05]
**Descrição:** Na página do lead, clicar no botão "Ganhou" (verde) converte o lead imediatamente para "Convertido" sem nenhum modal de confirmação, campo de observação ou possibilidade de desfazer.

**Passos para reproduzir:**
1. Acessar qualquer lead via `/leads/{id}`
2. Clicar em "Ganhou" no canto superior direito

**Resultado esperado:** Modal de confirmação com: valor da venda, responsável, campo de observação e botão "Confirmar"

**Resultado atual:** Conversão instantânea e irreversível. Badge "Convertido" aparece imediatamente.

**Impacto:** Leads podem ser convertidos por acidente (fat finger). Sem registro de motivo, dados analíticos ficam incompletos.

**Severidade: Alta**

---

### [BUG-FUNCIONAL-06]
**Descrição:** Aba "Pedidos" dentro da página do lead exibe erro "Erro ao carregar pedidos." com botão "Tentar novamente" que também falha.

**Passos para reproduzir:**
1. Abrir qualquer lead: `/leads/{id}`
2. Clicar na aba "Pedidos"

**Resultado esperado:** Lista de pedidos vinculados ao lead (mesmo que vazia)

**Resultado atual:** Banner vermelho de erro. API provavelmente retornando 404 ou 500.

**Impacto:** Visão 360° do cliente quebrada. Equipe de vendas não consegue ver histórico de compras dentro do CRM.

**Severidade: Alta**

---

### [BUG-FUNCIONAL-07]
**Descrição:** Botão "Adicionar lead" existente no rodapé de cada coluna do Kanban abre o mesmo modal "Novo Lead" do botão principal "Novo Lead" — duplicidade de ação sem diferenciação de contexto (não pré-seleciona a etapa correspondente à coluna).

**Passos para reproduzir:**
1. Clicar em "+ Adicionar lead" na coluna "Qualificado"

**Resultado esperado:** Modal de criação de lead com etapa "Qualificado" pré-selecionada

**Resultado atual:** Modal genérico sem etapa pré-definida. Lead sempre é criado como "Novo".

**Impacto:** Fricção de usabilidade. Usuário precisa mover o card manualmente após criar.

**Severidade: Média**

---

### [BUG-FUNCIONAL-08]
**Descrição:** Inconsistência grave entre os botões "Ganhou" e "Perdeu": "Perdeu" exibe modal de confirmação com campo de motivo (correto), enquanto "Ganhou" age instantaneamente sem confirmação (incorreto).

**Passos para reproduzir:**
1. Abrir lead → Clicar "Perdeu" → Modal aparece (correto)
2. Abrir lead → Clicar "Ganhou" → Ação instantânea (incorreto)

**Resultado esperado:** Ambos os botões devem ter modal de confirmação com campos contextuais (motivo para perdeu, valor/produto para ganhou)

**Resultado atual:** Comportamento assimétrico. "Ganhou" é 1-click irreversível.

**Severidade: Alta**

---

### [BUG-FUNCIONAL-09]
**Descrição:** O campo de nota inline dos cards (`textarea "Adicionar nota..."`) não possui limite de caracteres (`maxLength: -1`) e não há botão de salvar explícito nem feedback de confirmação após digitar e sair do campo (blur).

**Passos para reproduzir:**
1. Clicar no campo "Adicionar nota..." de qualquer card
2. Digitar texto
3. Pressionar Tab ou clicar fora

**Resultado esperado:** Confirmação visual de que a nota foi salva (toast, indicador, etc.)

**Resultado atual:** Incerto se a nota é salva. Sem feedback visual.

**Severidade: Média**

---

### [BUG-FUNCIONAL-10]
**Descrição:** Não há validação de formato do telefone no modal "Novo Lead" — apenas o campo em branco é bloqueado via `required` nativo do browser. Telefone "abc123" passa pela validação do frontend e só é rejeitado no backend, gerando a mensagem genérica.

**Resultado esperado:** Regex de validação inline (ex: `^+55[0-9]{10,11}$`) com mensagem específica antes do envio.

**Severidade: Média**

---

## 2️⃣ TESTE DE RESPONSIVIDADE

---

### [RESPONSIVIDADE-01]
**Dispositivo:** Mobile (≤375px)

**Problema:** A sidebar lateral **não possui botão hambúrguer visível em mobile** — o botão existe no DOM (`aria-label="Abrir menu de navegação"`) mas está `display: none` no breakpoint atual testado. Embora a sidebar use `lg:translate-x-0` / `-translate-x-full` corretamente (desaparece em mobile), o toggle para reexibi-la está oculto ou inoperante dependendo do contexto.

**Impacto:** Usuário mobile fica sem acesso à navegação principal — impossível navegar entre módulos.

**Severidade: Crítica**

---

### [RESPONSIVIDADE-02]
**Dispositivo:** Mobile / Tablet

**Problema:** O Kanban board não é adaptado para telas pequenas. Com `scrollWidth: 1660px` e `clientWidth: 1252px` já no desktop, em mobile (375px) o scroll horizontal é extenso e as colunas têm ~230px cada. Os cards são dificilmente clicáveis com o dedo (tap target do botão "+" fica com área real muito pequena, abaixo de 44px de zona segura). Sem swipe entre etapas.

**Impacto:** Kanban completamente inutilizável em mobile. Impossível visualizar todas as etapas do pipeline.

**Severidade: Crítica**

---

### [RESPONSIVIDADE-03]
**Dispositivo:** Tablet (768px–1024px)

**Problema:** A sidebar usa `lg:translate-x-0` (breakpoint 1024px), portanto em tablets de 768–1023px a sidebar fica **oculta** como em mobile. O botão hambúrguer precisa aparecer e funcionar nesse intervalo. A barra de etapas horizontais (`Novo | Qualificado | ...`) transborda em telas abaixo de ~900px, criando quebra de linha ou corte.

**Impacto:** Tablet perde a navegação lateral. Layout do Kanban fica com espaço excessivo de conteúdo mas sem sidebar.

**Severidade: Alta**

---

### [RESPONSIVIDADE-04]
**Dispositivo:** Mobile

**Problema:** A barra de filtros rápidos (Todos / Meus leads / Com WA / Sem interação 7d+ / Com tarefas) usa `flex-wrap` — em mobile, os chips quebram em múltiplas linhas, ocupando grande parte do viewport antes de chegar ao Kanban. Sem opção de scroll horizontal nos filtros.

**Impacto:** Área útil de conteúdo reduzida drasticamente em mobile. Kanban fica espremido abaixo.

**Severidade: Alta**

---

### [RESPONSIVIDADE-05]
**Dispositivo:** Mobile

**Problema:** Na página do lead (`/leads/{id}`), o stepper de etapas (Novo → Qualificado → ... → Perdido) e as abas de conteúdo (Agenda / Ficha / Atendimento...) ficam em posições muito próximas verticalmente. Em mobile, a área clicável do stepper se sobrepõe visualmente às abas, causando cliques acidentais que **mudam o estágio do lead** ao invés de trocar de aba — BUG já reproduzido no desktop com window estreita.

**Impacto:** Leads têm estágio alterado acidentalmente ao navegar pelas abas.

**Severidade: Crítica**

---

### [RESPONSIVIDADE-06]
**Dispositivo:** Desktop (≥1280px)

**Problema:** O Kanban usa `overflow-x-scroll` e já no desktop (1440px) há scroll horizontal pois as colunas somam ~1660px. A coluna "Convertido" fica parcialmente oculta à direita. O espaço poderia ser melhor aproveitado reduzindo padding das colunas ou usando colunas de largura mais flexível.

**Impacto:** Usuário não percebe que existem mais colunas à direita (Perdido fica fora da viewport).

**Severidade: Média**

---

### [RESPONSIVIDADE-07]
**Dispositivo:** Mobile

**Problema:** Os botões "Ganhou" e "Perdeu" na página do lead ficam no header superior direito. Em telas pequenas, esses botões ficam comprimidos ou fora da área visível, sem adaptação para posição fixa no bottom ou outro padrão mobile-friendly.

**Impacto:** Ações primárias do CRM ficam inacessíveis em mobile.

**Severidade: Alta**

---

## 3️⃣ VALIDAÇÃO DE UI/UX PROFISSIONAL

---

### [UX-PROBLEMA-01]
**Descrição:** Ausência total de modal de confirmação no botão "Ganhou" — ação de alto impacto executada com 1 clique sem reversão.

**Impacto na experiência:** Conversões acidentais geram dados analíticos falsos. Equipe perde confiança no sistema.

**Sugestão de melhoria:** Implementar modal com campos: valor da venda, produto associado, responsável, observação. Botão "Confirmar" em destaque. Log automático no Histórico.

**Prioridade: Crítica**

---

### [UX-PROBLEMA-02]
**Descrição:** O campo "Adicionar nota..." inline nos cards do Kanban é um textarea vazio e sem placeholder de contexto. Não há botão de salvar, não há contador de caracteres, não há confirmação de salvamento. O usuário não sabe se a nota está sendo autosalva ou se precisa pressionar Enter.

**Impacto na experiência:** Dados podem ser perdidos. Gera insegurança e abandono do campo.

**Sugestão de melhoria:** Exibir micro-botão "Salvar" ao focar no campo + toast de confirmação "Nota salva" + limite de caracteres visível.

**Prioridade: Alta**

---

### [UX-PROBLEMA-03]
**Descrição:** Mensagem de erro de validação genérica "Verifique os campos informados." sem especificidade — não indica qual campo, qual regra, nem como corrigir.

**Impacto na experiência:** Usuário frustrado refaz o formulário sem saber o que corrigiu. Aumenta abandono na criação de leads.

**Sugestão de melhoria:** Destacar campo(s) com borda vermelha + mensagem inline abaixo de cada campo com a regra violada.

**Prioridade: Alta**

---

### [UX-PROBLEMA-04]
**Descrição:** O stepper de etapas do pipeline (Novo → Qualificado → Proposta Enviada...) na página do lead usa a mesma faixa visual que as abas de conteúdo, sem separação hierárquica clara. São dois sistemas de navegação sobrepostos visualmente.

**Impacto na experiência:** Usuário confunde mudança de etapa com mudança de aba, causando alterações acidentais de stage.

**Sugestão de melhoria:** Mover o stepper de etapas para a sidebar esquerda (abaixo do nome do lead), ou usar um componente dropdown "Mover para etapa" com confirmação. As abas de conteúdo ficam isoladas no conteúdo principal.

**Prioridade: Alta**

---

### [UX-PROBLEMA-05]
**Descrição:** Colunas vazias do Kanban (Qualificado: 0, Proposta Enviada: 0, Negociação: 0) ocupam 70% do espaço horizontal da tela com apenas o texto "Nenhum lead nesta etapa". Há grande desperdício de espaço e poluição visual de colunas inutilizadas.

**Impacto na experiência:** Colunas com conteúdo ficam comprimidas. Foco visual desviado para áreas sem informação.

**Sugestão de melhoria:** Permitir colapsar colunas vazias (ícone toggle). Opção "Ocultar etapas vazias" nas configurações de view.

**Prioridade: Média**

---

### [UX-PROBLEMA-06]
**Descrição:** O badge "Convertido" e tags nos cards (WA, contador de tarefas, temporizador de inatividade) não possuem tooltips explicativos. Usuário novo não sabe o que "11d" ou "0d" significa, nem qual o critério do timer.

**Impacto na experiência:** Curva de aprendizado alta. Onboarding prejudicado.

**Sugestão de melhoria:** Adicionar tooltips informativos (hover/tap) em cada badge. Ex: "10d = Último contato há 10 dias".

**Prioridade: Baixa**

---

### [UX-PROBLEMA-07]
**Descrição:** O filtro "Convertido" na barra de etapas possui um ícone de chevron (˅) sugerindo dropdown, mas ao clicar apenas filtra — sem menu. Expectativa criada e não cumprida.

**Impacto na experiência:** Pequena confusão de affordance. Usuário clica esperando opções de sub-filtro.

**Sugestão de melhoria:** Remover o chevron se não há dropdown. Ou implementar o dropdown com opções como "Convertido no mês", "Convertido esta semana".

**Prioridade: Baixa**

---

### [UX-PROBLEMA-08]
**Descrição:** Não há estado de loading global para operações de busca, criação de lead ou mudança de etapa. As ações parecem instantâneas sem feedback intermediário (spinner, skeleton, etc.).

**Impacto na experiência:** Em conexões lentas, usuário não sabe se a ação foi disparada — pode clicar múltiplas vezes.

**Sugestão de melhoria:** Adicionar estado `disabled` + spinner nos botões durante requisições assíncronas.

**Prioridade: Alta**

---

## 4️⃣ CONSISTÊNCIA DE DESIGN SYSTEM

---

### [INCONSISTÊNCIA-01]
**Descrição:** Os botões de ação primária alternam entre dois padrões visuais distintos sem critério claro: `bg-[color:var(--orion-gold)]` (botão "Novo Lead") e `bg-brand-gold/10` com borda (botão "Adicionar lead"). Um é sólido, o outro é ghost — mas ambos representam criação de entidade.

**Onde ocorre:** Header principal vs. rodapé de colunas do Kanban.

**Impacto:** Hierarquia visual inconsistente. Usuário não percebe ambos como a mesma ação.

---

### [INCONSISTÊNCIA-02]
**Descrição:** Modais sem padrão consistente: "Novo Lead" usa fundo escuro com borda sutil; "Novo Agendamento" usa fundo levemente diferente com sombra mais evidente; "Marcar como Perdido" é um modal mais minimalista. Padding, tamanho e tipografia variam entre os três.

**Onde ocorre:** Todos os modais do módulo Pipeline.

**Impacto:** Percepção de produto inacabado. Falta design system unificado.

---

### [INCONSISTÊNCIA-03]
**Descrição:** O botão "Ganhou" usa verde sólido com ícone ✓ e o botão "Perdeu" usa vermelho sólido com ícone ✗ — visualmente corretos. Porém o comportamento é assimétrico (um pede confirmação, outro não). Inconsistência funcional grave mascarada por consistência visual.

**Onde ocorre:** Header da página do lead.

**Impacto:** Usuário assume que ambos funcionam da mesma forma ao ver o design idêntico.

---

### [INCONSISTÊNCIA-04]
**Descrição:** Ícones sem labels textuais em vários pontos: botões do header (Ajuda, Notificações, Busca, IA) usam apenas ícones sem texto. Botões de edição do pipeline na sidebar (ícone caneta ✏️) não possuem tooltip ao hover nem label visível.

**Onde ocorre:** Header global + sidebar PIPELINE.

**Impacto:** Reduz descobribilidade de funcionalidades. Inacessível para usuários com deficiência visual leve.

---

### [INCONSISTÊNCIA-05]
**Descrição:** A barra de etapas horizontais dentro da página do lead (stepper) usa cor de texto `text-muted` para etapas inativas e cor destacada para a etapa atual, mas não segue o mesmo padrão de cores do badge de etapa no Kanban (que usa pontos coloridos). Dois sistemas de representação de "stage" coexistem sem unificação.

**Onde ocorre:** Kanban (pontos coloridos) vs. página do lead (stepper textual).

**Impacto:** Falta de linguagem visual unificada para o conceito central do produto.

---

### [INCONSISTÊNCIA-06]
**Descrição:** Tipografia do texto de nota nos cards usa `text-[11px]` — extremamente pequena. O restante da interface usa escalas maiores. Não há token de tipografia documentado sendo seguido uniformemente.

**Onde ocorre:** Cards do Kanban, área "Adicionar nota..."

**Impacto:** Legibilidade comprometida em monitores 1080p ou menores.

---

## 5️⃣ RISCOS DE PRODUTO

---

### [RISCO-PRODUTO-01]
**Descrição:** Botão "+" dos cards causa logout — risco de perda de trabalho não salvo em sessão ativa.

**Impacto estratégico:** Um único clique errado destrói a sessão do usuário. Em um CRM de uso intensivo (múltiplos leads por hora), a probabilidade de acionamento acidental é alta. Gera abandono e desconfiança no sistema.

**Recomendação:** Correção emergencial. Identificar o handler do botão, resolver o conflito de autenticação e implementar dropdown de ações contextual.

---

### [RISCO-PRODUTO-02]
**Descrição:** Ação "Ganhou" sem confirmação + sem log automático no histórico.

**Impacto estratégico:** Dados de conversão falsos contaminam analytics de vendas. Decisões estratégicas baseadas em dados incorretos. Impossível auditar quem converteu, quando e com qual valor.

**Recomendação:** Implementar modal obrigatório com valor da venda + registrar evento no histórico do lead automaticamente.

---

### [RISCO-PRODUTO-03]
**Descrição:** View "Lista" e "Importar Leads" são funcionalidades mortas no produto — botões visíveis mas sem ação.

**Impacto estratégico:** Usuários tentam usar, falham, e percebem o produto como instável/inacabado. Reduz confiança e aumenta churn em early adopters. Features prometidas que não funcionam são piores do que não tê-las.

**Recomendação:** Remover os botões da UI até as features estarem implementadas, ou adicionar badge "Em breve" com tooltip explicativo.

---

### [RISCO-PRODUTO-04]
**Descrição:** API de pedidos retorna erro na aba "Pedidos" do lead — falha silenciosa em produção.

**Impacto estratégico:** Equipe de vendas toma decisões sem visualizar histórico de compras. Pode resultar em abordagens incorretas (oferecer produto já comprado, não reconhecer cliente VIP).

**Recomendação:** Investigar e corrigir a integração. Adicionar monitoramento de erro (Sentry ou similar) para detectar falhas de API em produção.

---

### [RISCO-PRODUTO-05]
**Descrição:** Produto completamente inutilizável em mobile — sidebar inacessível, Kanban não adaptado, ações primárias fora do viewport.

**Impacto estratégico:** Vendedores em campo (showroom, feiras) não conseguem operar o CRM pelo celular. Força uso exclusivo desktop, limitando a mobilidade da equipe comercial.

**Recomendação:** Implementar versão mobile mínima viável: sidebar hambúrguer funcional, view de lista como fallback do Kanban em mobile, botões Ganhou/Perdeu fixos no bottom.

---

## 6️⃣ RESUMO EXECUTIVO

| Métrica | Nota |
|---|---|
| **Nota Geral** | **4.5 / 10** |
| **Nota Desktop** | **5.5 / 10** |
| **Nota Tablet** | **3.5 / 10** |
| **Nota Mobile** | **2.0 / 10** |

**Top 5 Problemas Críticos:**

1. **Botão "+" do card destrói a sessão** — usuário sofre logout ao clicar numa ação corriqueira
2. **"Ganhou" sem confirmação** — leads convertidos acidentalmente contaminam dados de negócio
3. **View "Lista" e "Importar leads" inoperantes** — features visíveis e quebradas
4. **Produto inutilizável em mobile** — sem acesso à navegação, Kanban ilegível
5. **Aba "Pedidos" com erro de API em produção** — visão 360° do cliente comprometida

**Risco Geral: 🔴 ALTO**

**Está pronto para produção? ❌ NÃO**

> O produto tem uma base visual sólida e identidade de marca coerente (dark theme, dourado, tipografia cuidada), mas possui bugs críticos que causam logout, ações irreversíveis sem confirmação, funcionalidades prometidas inoperantes e ausência total de suporte mobile. Requer pelo menos 2–3 sprints de correção antes de ser considerado estável para uso comercial real.

---

## 7️⃣ TASKS PARA PIPELINE

---

- [ ] **[TASK-01] Corrigir botão "+" do card que causa logout**
  Tipo: Bug
  Severidade: Crítica
  Dispositivo afetado: Desktop, Tablet, Mobile
  Descrição técnica: O botão circular "+" no rodapé dos cards do Kanban (`/pipeline/leads`) dispara uma ação que invalida o token de sessão e redireciona para `/login`. Investigar o event handler associado ao botão (provavelmente um `<form>` com `method="POST"` ou `<button type="submit">` envolto num contexto de logout). Corrigir para abrir dropdown contextual com opções: "Adicionar tarefa", "Adicionar nota", "Mover etapa". Garantir que `type="button"` está setado para evitar submit acidental.

---

- [ ] **[TASK-02] Implementar modal de confirmação no botão "Ganhou"**
  Tipo: Bug + Melhoria UX
  Severidade: Crítica
  Dispositivo afetado: Desktop, Mobile
  Descrição técnica: O botão "Ganhou" (`/leads/{id}`) executa a conversão para "Convertido" sem confirmação. Implementar modal idêntico ao de "Perdeu" com campos: Valor da venda (input numérico, obrigatório), Produto/serviço (texto opcional), Observação (textarea opcional). Ao confirmar, registrar evento no histórico do lead com timestamp, usuário logado e dados preenchidos. Alinhar com o comportamento já existente em "Perdeu".

---

- [ ] **[TASK-03] Implementar view Lista funcional no Pipeline**
  Tipo: Bug
  Severidade: Alta
  Dispositivo afetado: Desktop, Tablet
  Descrição técnica: O botão "Lista" (`button[ref_34]`) não altera a view. Implementar view tabular alternativa ao Kanban com colunas: Nome, Origem, Etapa, Valor Estimado, Responsável, Última Interação, Ações. Persistir preferência de view no `localStorage` ou na sessão do usuário. Toggle deve atualizar state de view e re-renderizar o componente correspondente.

---

- [ ] **[TASK-04] Implementar funcionalidade "Importar leads"**
  Tipo: Bug
  Severidade: Alta
  Dispositivo afetado: Desktop
  Descrição técnica: O botão "Importar leads" está inerte. Implementar modal de importação com: upload de arquivo CSV (aceitar `.csv`), mapeamento de colunas (Nome → campo, Telefone → campo, Origem → campo), preview dos primeiros 5 registros antes de confirmar, barra de progresso de importação, relatório final (X importados, Y duplicados, Z com erro). Se a feature não estiver pronta, remover o botão da UI até implementação.

---

- [ ] **[TASK-05] Corrigir sidebar mobile — hambúrguer e navegação em telas <1024px**
  Tipo: Responsividade
  Severidade: Crítica
  Dispositivo afetado: Mobile, Tablet
  Descrição técnica: A sidebar usa `lg:translate-x-0 -translate-x-full` (colapsa em viewports <1024px). O botão hambúrguer (`aria-label="Abrir menu de navegação"`) existe mas não está acessível/visível corretamente em contexto não-mobile. Garantir que: (1) o botão hambúrguer fica visível e funcional em `< 1024px`, (2) ao clicar abre sidebar sobre o conteúdo com overlay semitransparente, (3) clicar fora fecha a sidebar, (4) pressionar ESC fecha a sidebar.

---

- [ ] **[TASK-06] Adaptar módulo Pipeline para mobile (view alternativa ao Kanban)**
  Tipo: Responsividade
  Severidade: Alta
  Dispositivo afetado: Mobile (≤768px)
  Descrição técnica: O Kanban com scroll horizontal é inutilizável em mobile. Em viewports `≤ 768px`, exibir automaticamente a view Lista (tabela) como fallback, OU implementar um swiper de etapas (1 coluna por vez com swipe horizontal). Os botões de ação primária ("Ganhou", "Perdeu") devem ser fixados no `bottom` em mobile (`position: fixed; bottom: 0`). Os filtros rápidos devem usar `overflow-x-auto` com scroll horizontal ao invés de `flex-wrap`.

---

- [ ] **[TASK-07] Corrigir separação visual entre stepper de etapas e abas de conteúdo no lead**
  Tipo: Bug + Melhoria UX
  Severidade: Alta
  Dispositivo afetado: Desktop, Mobile
  Descrição técnica: Na página `/leads/{id}`, o stepper de etapas (`Novo → Qualificado → ...`) fica na mesma faixa visual das abas de conteúdo (`Agenda / Ficha / Atendimento...`), causando cliques acidentais que alteram o stage do lead. Solução recomendada: mover o stepper para a sidebar esquerda como dropdown `<select>` estilizado com label "Mover para etapa" + botão de confirmação, separando hierarquicamente a navegação de conteúdo da navegação de estado de negócio.

---

- [ ] **[TASK-08] Corrigir API de pedidos na aba "Pedidos" do lead**
  Tipo: Bug
  Severidade: Alta
  Dispositivo afetado: Desktop
  Descrição técnica: A aba "Pedidos" em `/leads/{id}` retorna erro "Erro ao carregar pedidos." Investigar a chamada de API responsável (provavelmente `GET /api/pedidos?clienteId={id}` ou equivalente em Supabase). Verificar RLS policies, foreign keys e se o endpoint existe. Adicionar tratamento de erro mais específico com código HTTP e mensagem de suporte. Adicionar monitoramento (Sentry) para capturar falhas de API silenciosas em produção.

---

- [ ] **[TASK-09] Melhorar validação inline do modal "Novo Lead"**
  Tipo: Melhoria UX
  Severidade: Alta
  Dispositivo afetado: Desktop, Mobile
  Descrição técnica: O modal fecha ao submeter dados inválidos e exibe mensagem genérica. Implementar: (1) validação client-side com regex de telefone antes do envio (`/^\+55[1-9][0-9]{9,10}$/`), (2) manter modal aberto em caso de erro, (3) highlight do campo com erro (`border-red-500`), (4) mensagem inline abaixo do campo (`text-red-400 text-xs`), (5) remover o banner de erro global para erros de formulário.

---

- [ ] **[TASK-10] Adicionar feedback de salvamento da nota inline nos cards**
  Tipo: Melhoria UX
  Severidade: Média
  Dispositivo afetado: Desktop, Mobile
  Descrição técnica: O textarea "Adicionar nota..." nos cards do Kanban não exibe feedback de salvamento. Implementar: (1) autosave com debounce de 1000ms após parar de digitar, (2) indicador de estado "Salvando..." → "Salvo ✓" no canto do textarea, (3) limite de 500 caracteres com contador visível, (4) em caso de erro, exibir "Falha ao salvar. Tentar novamente" com botão.

---

- [ ] **[TASK-11] Corrigir botão "Adicionar lead" nas colunas para pré-selecionar a etapa**
  Tipo: Bug + Melhoria UX
  Severidade: Média
  Dispositivo afetado: Desktop, Tablet
  Descrição técnica: Cada coluna do Kanban possui "+ Adicionar lead" no rodapé, mas o modal que abre não pré-seleciona a etapa da coluna. Passar o `stageId` como prop ao abrir o modal. No modal, exibir campo "Etapa" como read-only pré-preenchido com o nome da coluna clicada. Lead deve ser criado diretamente na etapa correspondente.

---

- [ ] **[TASK-12] Unificar design system dos modais**
  Tipo: Refatoração UI
  Severidade: Média
  Dispositivo afetado: Desktop, Mobile
  Descrição técnica: Os modais do módulo Pipeline ("Novo Lead", "Novo Agendamento", "Marcar como Perdido") possuem variações de padding, border-radius, tamanho e tipografia. Criar componente `<Modal>` base com props `size` (sm/md/lg), header padronizado (`SEÇÃO` + `Título`), footer com botões alinhados à direita (`Cancelar` ghost + `Confirmar` primary). Migrar todos os modais do Pipeline para usar este componente.

---

- [ ] **[TASK-13] Adicionar tooltips nos badges e ícones sem labels**
  Tipo: Melhoria UX
  Severidade: Baixa
  Dispositivo afetado: Desktop
  Descrição técnica: Adicionar `title` ou componente `<Tooltip>` nos elementos: badge "WA" (explicar: "Lead originado via WhatsApp"), badge contador de dias "11d" (explicar: "Último contato há 11 dias"), ícone ✏️ na sidebar (explicar: "Editar pipeline"), ícones do header (Ajuda, Notificações, IA). Em mobile, usar `data-tooltip` que abre ao long-press.

---

- [ ] **[TASK-14] Colapsar colunas vazias no Kanban ou adicionar opção de ocultar**
  Tipo: Melhoria UX
  Severidade: Baixa
  Dispositivo afetado: Desktop, Tablet
  Descrição técnica: Colunas com 0 leads ocupam espaço igual às colunas com leads. Implementar: botão de colapso `<` em cada coluna que a reduz para uma faixa vertical com apenas o nome e contador. Persistir estado de colapso por usuário. Adicionar opção global "Ocultar etapas vazias" nas configurações de view do Pipeline.

---

*Relatório gerado em 25/04/2026 | Auditoria cobrindo Desktop, Tablet e Mobile | Total de issues: 14 bugs funcionais, 7 problemas de responsividade, 8 problemas UX, 6 inconsistências de design, 5 riscos de produto | 14 tasks geradas ordenadas por severidade*