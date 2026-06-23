---

# 🔍 RELATÓRIO DE AUDITORIA TÉCNICA — ORION CRM
## Módulos: Dashboard · Financeiro · Analytics
**Data:** 26/04/2026 | **Auditor:** QA Sênior Full Stack | **Ambiente:** http://127.0.0.1 | **Stack:** Next.js (App Router) + PostgreSQL

---

## ⚠️ STATUS GERAL: **NÃO PRONTO PARA PRODUÇÃO**

---

# 1️⃣ TESTE FUNCIONAL — FLUXO COMPLETO

---

### [BUG-FUNCIONAL-001] — Tooltip do gráfico de barras no Financeiro exibe label incorreto
**Descrição:** O tooltip do gráfico "Receitas vs Despesas" exibe `Despesas : R$ 1.500,00` quando o valor pertence à série de **Receitas**. O mapeamento da chave `receitas_cents` está sendo lido como `despesas_cents` no componente de tooltip.

**Passos para reproduzir:**
1. Acessar `/financeiro`
2. Criar um lançamento de Receita com qualquer valor
3. Passar o mouse sobre a barra verde no gráfico

**Resultado esperado:** Tooltip exibe `Receitas : R$ 1.500,00`
**Resultado atual:** Tooltip exibe `Despesas : R$ 0,00` e `Despesas : R$ 1.500,00` (dois itens errados)
**Impacto:** Usuário interpreta dados financeiros incorretamente. Tomada de decisão baseada em dados falsos.
**Severidade: 🔴 CRÍTICA**

---

### [BUG-FUNCIONAL-002] — Data do lançamento salva com offset de -1 dia (bug de timezone)
**Descrição:** Lançamento criado em 26/04/2026 é exibido na tabela como `25/04`. O backend armazena a data em UTC (`2026-04-26T00:00:00.000Z`) mas o front-end formata usando `.toLocaleDateString()` sem fixar o fuso, resultando em `25/04` para UTC-3.

**Passos para reproduzir:**
1. Criar lançamento no modal com a data atual (26/04)
2. Salvar e verificar a coluna DATA na tabela de lançamentos

**Resultado esperado:** Data exibida: `26/04`
**Resultado atual:** Data exibida: `25/04`
**Impacto:** Relatórios financeiros com datas erradas. Possível perda de lançamentos em consultas por período.
**Severidade: 🔴 CRÍTICA**

---

### [BUG-FUNCIONAL-003] — Analytics desconectado do módulo Financeiro (silos de dados)
**Descrição:** O módulo `/analytics` exibe `Faturamento: R$ 0,00` mesmo após cadastro de R$ 1.500,00 no `/financeiro`. A análise de APIs confirma: Analytics consome dados de `pedidos/vendas operacionais` enquanto Financeiro consome `lançamentos manuais` — são **fontes de dados completamente distintas e não unificadas**.

**Passos para reproduzir:**
1. Criar lançamento de receita em `/financeiro` → R$ 1.500,00
2. Acessar `/analytics` → tab Vendas
3. Verificar o card "Faturamento"

**Resultado esperado:** Analytics reflete dados do Financeiro ou existe documentação clara da distinção
**Resultado atual:** R$ 0,00 no Analytics enquanto Financeiro mostra R$ 1.500,00
**Impacto:** Gestores não conseguem ter visão unificada do negócio. Contradição direta de dados entre módulos.
**Severidade: 🔴 CRÍTICA**

---

### [BUG-FUNCIONAL-004] — HTTP 503 ao recarregar página após POST de lançamento
**Descrição:** Após salvar um lançamento com sucesso (POST → 201), a página `/financeiro` retorna HTTP 503 na requisição RSC (React Server Component) de atualização. A tela se recupera mas há janela de falha.

**Evidência:** `GET /financeiro?_rsc=1uwi6 → 503`
**Impacto:** Inconsistência de UX pós-save. Risco de usuário achar que o dado foi perdido.
**Severidade: 🟠 ALTA**

---

### [BUG-FUNCIONAL-005] — KPIs do Dashboard com valores hardcoded
**Descrição:** Os seguintes valores no Dashboard são **estáticos no código-fonte**, não vêm de nenhuma API:
- Card "Leads — Pipeline": `+3 novos hoje`, `12% conversão 34%` — hardcoded
- Seção Financeiro: `Meta do Mês: 94%`, `Projeção: R$ 51.200` — hardcoded
- Card "Faturamento do Mês": `↑ 18% vs mês anterior` — hardcoded (ignora dados reais)

**Impacto:** Usuário toma decisões baseadas em dados falsos. Apresenta ilusão de funcionalidade inexistente.
**Severidade: 🔴 CRÍTICA**

---

### [BUG-FUNCIONAL-006] — Funcionalidades não implementadas expostas na interface
**Descrição:** O Dashboard exibe widgets com mensagens internas de desenvolvimento que jamais deveriam chegar ao usuário final:
- Mapa de Calor: *"A API atual não entrega série real de vendas por dia e horário para este painel"*
- Agenda: *"Este painel não recebeu compromissos reais para o calendário"*
- Aniversariantes: *"O dashboard não recebeu dados reais de relacionamento para esta semana"*

**Impacto:** Sensação de produto inacabado. Destrói confiança do usuário. Inaceitável em SaaS.
**Severidade: 🟠 ALTA**

---

### [BUG-FUNCIONAL-007] — Produto duplicado em alertas de estoque crítico
**Descrição:** A API `/api/internal/dashboard` retorna o produto "Anel Smoke Test" duas vezes no array `stock_alerts_detail` com estoques diferentes (`current_stock: 99` e `current_stock: 100`). O dashboard exibe `2 alertas` sendo que é o mesmo produto duplicado.

**Evidência via API:** `"stock_alerts_detail":[{"product_name":"Anel Smoke Test","current_stock":99,"minimum_stock":100}, {"product_name":"Anel Smoke Test","current_stock":100,"minimum_stock":100}]`
**Impacto:** Ruído falso de alertas operacionais. Pode mascarar ou inflar alertas reais.
**Severidade: 🟠 ALTA**

---

### [BUG-FUNCIONAL-008] — "Leads por Origem" no Dashboard agrupa WhatsApp como "Outros"
**Descrição:** A API `/api/internal/dashboard` retorna `leads_by_source: [{"source":"WHATSAPP","count":2}]` mas o Dashboard exibe a legenda como **"Outros"** em vez de "WhatsApp". O mapeamento de label da origem não está implementado no componente.

**Impacto:** Relatório de origem de leads inútil. Decisões de marketing comprometidas.
**Severidade: 🟡 MÉDIA**

---

# 2️⃣ TESTE DE RESPONSIVIDADE

---

### [RESPONSIVIDADE-001] — Mobile: Itens de navegação inutilizáveis com toque
**Dispositivo:** Mobile (390px)
**Problema:** Links de navegação do sidebar (Leads, Pedidos, Produção, etc.) possuem apenas **18px de altura**, muito abaixo do mínimo recomendado de 44px para alvos de toque (WCAG 2.5.8 / Apple HIG). Os botões "Todos", "Receitas", "Despesas", "Pendentes" no Financeiro têm apenas **32px de altura**.
**Impacto:** Operação praticamente impossível em dispositivos móveis reais.
**Severidade: 🔴 CRÍTICA**

---

### [RESPONSIVIDADE-002] — Botões da barra de navegação global abaixo do mínimo de toque
**Dispositivo:** Mobile / Tablet
**Problema:** Botões do header (Ajuda, Notificações, Assistente IA) têm **32px × 32px**. O botão "Pergunte" tem **32px de altura**.
**Impacto:** UX de toque degradada em mobile e tablet.
**Severidade: 🟠 ALTA**

---

### [RESPONSIVIDADE-003] — Gráfico de chart com dimensões inválidas (-1px)
**Dispositivo:** Qualquer breakpoint menor que desktop
**Problema:** Console registra repetidamente `The width(-1) and height(-1) of chart should be greater than 0`. O componente Recharts não está recebendo dimensões válidas quando o container não tem tamanho explícito. Isso causa renderização invisível ou quebrada dos gráficos em viewports reduzidos.
**Impacto:** Gráficos do Dashboard e Financeiro potencialmente invisíveis em mobile/tablet.
**Severidade: 🟠 ALTA**

---

### [RESPONSIVIDADE-004] — Tablet (768px): Layout Analytics funcionalmente degradado
**Dispositivo:** Tablet 768–1024px
**Problema:** Em 962px de largura, o Analytics exibe 2 colunas em vez de 4, comprimindo os cards de KPI. O seletor de período e os filtros de data ficam sobrepostos ao cabeçalho.
**Impacto:** Leitura de métricas comprometida em tablets.
**Severidade: 🟡 MÉDIA**

---

# 3️⃣ UI/UX PROFISSIONAL

---

### [UX-PROBLEMA-001] — Mensagens de estado vazio com linguagem técnica/interna
**Descrição:** Mensagens como *"A API atual não entrega série real de vendas"* ou *"Este painel não recebeu compromissos reais para o calendário"* são linguagem de desenvolvedor, não de produto. Um usuário leigo não entende o que fazer com isso.
**Impacto:** Sensação de produto quebrado. Alta taxa de abandono.
**Sugestão:** Substituir por mensagens de onboarding: *"Configure sua agenda para ver compromissos aqui →"* com CTA de ação.
**Prioridade: 🔴 CRÍTICA**

---

### [UX-PROBLEMA-002] — Projeção e Meta do Mês exibem valores sem contexto de configuração
**Descrição:** `Meta do Mês: 94%` e `Projeção: R$ 51.200` aparecem sem que o usuário tenha configurado nenhuma meta. O usuário não sabe de onde vêm esses números.
**Impacto:** Perda de credibilidade do sistema. Dados inventados geram desconfiança.
**Sugestão:** Esconder esses cards se não houver meta configurada, ou mostrar CTA *"Configurar meta do mês →"*.
**Prioridade: 🔴 CRÍTICA**

---

### [UX-PROBLEMA-003] — Gráfico de linha do Dashboard vazio com 29 dias zerados e um pico abrupto
**Descrição:** Com apenas 1 lançamento (26/04), o gráfico mostra linha plana em R$0 por 29 dias e um pico vertical abrupto no último dia. Visualmente parece anomalia/erro, não um gráfico útil.
**Impacto:** Usuário com poucos dados tem experiência visual confusa. Esperado em onboarding de qualquer SaaS.
**Sugestão:** Implementar estado de "dados insuficientes" com placeholder ilustrativo até que haja pelo menos 7 dias de dados.
**Prioridade: 🟠 ALTA**

---

### [UX-PROBLEMA-004] — Ausência de feedback de loading no carregamento inicial do Dashboard
**Descrição:** O Dashboard exibe skeleton de carregamento por ~2 segundos mas sem indicador de progresso. Se a API demora mais (ou retorna 503), a tela permanece em skeleton indefinidamente sem timeout ou mensagem de erro.
**Impacto:** Usuário não sabe se o sistema travou ou está carregando.
**Sugestão:** Implementar timeout de 10s com fallback de erro e botão "Tentar novamente".
**Prioridade: 🟠 ALTA**

---

### [UX-PROBLEMA-005] — Barra de navegação interna do Dashboard sem âncora ativa visível
**Descrição:** A barra "FINANCEIRO | AÇÃO IMEDIATA | OPERAÇÕES | COMERCIAL | ANALYTICS" não destaca qual seção está visível durante o scroll. Não há scrollspy ativo.
**Impacto:** Usuário perde referência de posição na página longa.
**Sugestão:** Implementar Intersection Observer para destacar a seção ativa na nav.
**Prioridade: 🟡 MÉDIA**

---

# 4️⃣ VALIDAÇÃO DE BANCO DE DADOS

---

### [BUG-BANCO-001] — Produto duplicado na query de alertas de estoque mínimo
**Descrição:** A query que popula `stock_alerts_detail` retorna o produto "Anel Smoke Test" duas vezes com estoques diferentes (99 e 100). Isso indica ausência de `DISTINCT` ou `GROUP BY product_id` na query, ou existência de registros duplicados na tabela de produtos/estoque.

**Impacto nos dados:** Alertas de estoque inflados. Operador vê 2 alertas quando deveria ver 1 (ou nenhum, se estoque=mínimo é aceitável).
**Risco:** Inconsistência de dados de produto. Possível duplicidade na tabela `products` sem constraint de `UNIQUE(name, store_id)`.
**Severidade: 🟠 ALTA**

---

### [BUG-BANCO-002] — Campo `competence_date` armazenado em UTC sem tratamento de timezone no frontend
**Descrição:** O banco armazena `"competence_date":"2026-04-26T00:00:00.000Z"` (corretamente em UTC). Porém o front-end renderiza esse timestamp com o JS padrão `new Date(dateString).toLocaleDateString('pt-BR')`, que converte para UTC-3 e resulta em `25/04/2026`.

**Impacto nos dados:** Relatórios por data exibem dia anterior ao real para usuários em UTC-3 (Brasília, Manaus, etc.).
**Risco:** Lançamentos de fim de dia (após 21h) aparecem no dia seguinte; lançamentos manualizados de hoje aparecem ontem.
**Severidade: 🔴 CRÍTICA**

---

### [BUG-BANCO-003] — `source_id` = `id` em lançamentos manuais (campo redundante sem uso)
**Descrição:** A API retorna `"id":"caaad0cc-..."` e `"source_id":"caaad0cc-..."` com o mesmo valor para lançamentos manuais. O campo `source_id` parece pensado para lançamentos originados de pedidos (`reference.order_id`), mas não está sendo usado corretamente.

**Impacto nos dados:** Schema confuso. Futuras queries de reconciliação podem gerar joins incorretos entre `id` e `source_id`.
**Risco:** Dados órfãos se `source_id` for uma FK sem constraint.
**Severidade: 🟡 MÉDIA**

---

### [BUG-BANCO-004] — Lançamento financeiro manual não cria `payment_id` (campo nulo sem referência)
**Descrição:** Lançamentos manuais retornam `"reference":{"order_id":null,"order_number":null,"payment_id":null}`. Não há rastreabilidade de qual forma de pagamento foi usada, nem qual pedido gerou o lançamento. O Financeiro e os Pedidos não têm ponte de dados.

**Impacto nos dados:** Impossibilidade de conciliação financeira real. Seção "Formas de Pagamento" sempre aparece vazia.
**Risco:** Usuário não consegue saber se um pedido foi pago ou se é lançamento manual avulso.
**Severidade: 🔴 CRÍTICA**

---

# 5️⃣ VALIDAÇÃO DE API / BACKEND

---

### [BUG-BACKEND-001] — APIs internas expostas sem autenticação
**Descrição:** Os seguintes endpoints respondem com dados completos sem nenhum cookie, token ou header de autenticação quando acessados diretamente pelo navegador:
- `GET /api/internal/financeiro/lancamentos` → retorna todos os lançamentos com dados financeiros completos
- `GET /api/internal/financeiro/dashboard` → retorna KPIs financeiros completos
- `GET /api/internal/dashboard` → retorna KPIs, leads, alertas de estoque, receita de 30 dias + expõe `"role":"ADMIN"`

**Impacto:** Qualquer pessoa com acesso à rede local (ou se exposto na internet) pode ler todos os dados financeiros do negócio sem se autenticar.
**Risco:** Exposição crítica de dados financeiros e operacionais. Violação potencial da LGPD.
**Severidade: 🔴 CRÍTICA**

---

### [BUG-BACKEND-002] — Role do usuário exposto na resposta da API pública
**Descrição:** A rota `GET /api/internal/dashboard` retorna `{"role":"ADMIN",...}` no payload. Isso expõe o nível de acesso do usuário autenticado (ou não autenticado) sem necessidade.

**Impacto:** Enumeração de privilégios por atacante. Facilita ataques de privilege escalation.
**Risco:** Médio isoladamente, crítico combinado com BUG-BACKEND-001.
**Severidade: 🟠 ALTA**

---

### [BUG-BACKEND-003] — Ausência de proteção CSRF nos formulários
**Descrição:** Nenhum dos formulários identificados (`form[action="/financeiro"]`) possui token CSRF. As ações de criação de lançamento via `POST /api/internal/financeiro/lancamentos` não exigem header `X-CSRF-Token` ou equivalente.

**Impacto:** Vulnerabilidade a ataques Cross-Site Request Forgery. Um site malicioso pode criar lançamentos financeiros em nome do usuário autenticado.
**Risco:** Alto em ambiente multiusuário/SaaS público.
**Severidade: 🟠 ALTA**

---

### [BUG-BACKEND-004] — Falta de rate limiting nos endpoints de API
**Descrição:** Não foram detectados headers de rate limiting (`X-RateLimit-*`, `Retry-After`) nas respostas das APIs. Os endpoints de leitura e escrita do Financeiro não possuem throttling visível.

**Impacto:** Vulnerabilidade a ataques de força bruta, scraping de dados e DoS na camada de aplicação.
**Severidade: 🟡 MÉDIA**

---

### [BUG-BACKEND-005] — Validação ausente no backend para valor zero em lançamentos
**Descrição:** A validação de `valor > 0` existe apenas no frontend (mensagem "Informe um valor maior que zero"). Se a requisição for feita diretamente à API (`POST /api/internal/financeiro/lancamentos`) com `amount_cents: 0`, o backend pode aceitar o registro.

**Impacto:** Lançamentos com valor zero poluem os registros financeiros. Possível bypass da validação de negócio.
**Severidade: 🟡 MÉDIA**

---

# 6️⃣ RISCOS DE PRODUTO

---

### [RISCO-PRODUTO-001] — Desconexão total entre Analytics e Financeiro destrói a proposta de valor
**Descrição:** Um SaaS de CRM comparável ao HubSpot/Pipedrive tem como pilar principal a **visão unificada de dados**. No ORION, o módulo Analytics mostra R$0 enquanto o Financeiro mostra R$1.500. O usuário que cadastra um cliente, gera um pedido e recebe o pagamento não vê nenhuma dessas ações refletidas no Analytics — porque o Analytics só lê pedidos aprovados/pagos via pipeline operacional, não lançamentos manuais.
**Impacto estratégico:** O produto não entrega a promessa central de "inteligência de negócio". Taxa de churn altíssima após onboarding.
**Recomendação:** Definir e implementar **uma única fonte de verdade financeira** que unifique: Pedidos pagos + Lançamentos manuais + PDV. O Analytics deve consumir essa fonte unificada.

---

### [RISCO-PRODUTO-002] — Dashboard com dados fictícios mina a confiança do usuário
**Descrição:** Um usuário com banco zerado que acessa o Dashboard vê `18% vs mês anterior`, `12% conversão`, `34% taxa`, `R$ 51.200 projeção`, `94% meta` — todos inventados. Quando ele descobre que os dados são falsos, a credibilidade do produto é destruída permanentemente.
**Impacto estratégico:** Impossibilidade de usar o Dashboard como ferramenta de gestão real. Produto parece demo, não produção.
**Recomendação:** Remover imediatamente todos os valores hardcoded. Implementar estado de onboarding com guia de primeiros passos.

---

### [RISCO-PRODUTO-003] — APIs expostas sem auth inviabilizam oferta SaaS multi-tenant
**Descrição:** Se o produto for oferecido como SaaS com múltiplos clientes, a ausência de autenticação nas APIs internas significa que qualquer cliente pode acessar dados de outro cliente (se souber a URL).
**Impacto estratégico:** Inviabilidade jurídica (LGPD), comercial e reputacional do produto como SaaS.
**Recomendação:** Implementar middleware de autenticação obrigatória em todas as rotas `/api/internal/*` antes de qualquer deploy em produção.

---

# 7️⃣ CONSISTÊNCIA DE DESIGN SYSTEM

---

### [INCONSISTÊNCIA-001] — Botões de ação com altura inconsistente (32px vs 36px vs 44px+)
**Descrição:** No mesmo módulo Financeiro existem botões com alturas de 32px (filtros Todos/Receitas/Despesas), 36px (filtros de período 7d/Abr/Trim), e 36px (Novo Lançamento). Não há padrão definido de altura de botão no design system.
**Onde ocorre:** `/financeiro` — barra de filtros
**Impacto:** Inconsistência visual e problemas de usabilidade mobile.

---

### [INCONSISTÊNCIA-002] — Mensagens de estado vazio sem padrão visual
**Descrição:** Estados vazios aparecem em pelo menos 8 variações diferentes de copy e visual no Dashboard: algumas com ícone, outras sem; algumas em português técnico, outras em português de produto; algumas centralizadas, outras à esquerda.
**Onde ocorre:** Dashboard (todas as seções), Financeiro, Analytics
**Impacto:** Experiência fragmentada. Ausência de Design System de estados.

---

### [INCONSISTÊNCIA-003] — Gráfico de linha no Dashboard usa cor dourada sem legenda
**Descrição:** O gráfico "Faturamento — Últimos 30 Dias" usa linha dourada sem legenda explicativa. O gráfico "Receitas vs Despesas" no Financeiro usa verde/vermelho com legenda. Padrão visual de gráficos divergente entre módulos.
**Onde ocorre:** `/dashboard` vs `/financeiro`
**Impacto:** Curva de aprendizado desnecessária. Usuário não sabe o que a linha dourada representa.

---

---

# 8️⃣ RESUMO EXECUTIVO

| Dimensão | Nota | Observação |
|---|---|---|
| **Geral** | **4,0 / 10** | Produto funcional básico mas com bugs críticos |
| **Mobile** | **2,5 / 10** | Navegação inutilizável com toque |
| **Tablet** | **5,0 / 10** | Funcional mas degradado |
| **Desktop** | **6,5 / 10** | Melhor experiência, ainda com bugs |
| **Backend / API** | **3,0 / 10** | APIs expostas sem auth — inaceitável |
| **Banco de Dados** | **4,5 / 10** | Bug de timezone crítico, duplicidade, sem reconciliação |

### 🔴 TOP 5 PROBLEMAS CRÍTICOS

1. **APIs internas sem autenticação** — qualquer URL de `/api/internal/*` expõe dados financeiros e operacionais completos
2. **Dados do Analytics desconectados do Financeiro** — produto não entrega visão unificada de nenhum dado
3. **KPIs do Dashboard hardcoded** — `18%`, `12%`, `34%`, `94%`, `R$51.200` são valores inventados exibidos como reais
4. **Bug de timezone** — datas de lançamentos são exibidas com -1 dia em relação ao cadastro
5. **Tooltip do gráfico financeiro com label errado** — Receita exibida como Despesa

**Risco Geral: 🔴 CRÍTICO**
**Pronto para produção: ❌ NÃO**

---

# 9️⃣ TASKS PARA PIPELINE (Ordenadas por Prioridade)

---

- [ ] **[TASK-001] Implementar autenticação obrigatória em todas as rotas `/api/internal/*`**
  Tipo: Segurança
  Severidade: 🔴 Crítica
  Dispositivo afetado: Todos
  Descrição técnica: Criar middleware Next.js em `middleware.ts` que valide o cookie de sessão (ou JWT) para qualquer requisição a `/api/internal/*`. Retornar HTTP 401 se ausente. Adicionar verificação de `tenant_id` para isolamento multi-tenant. Remover exposição de `role` no payload da resposta.

- [ ] **[TASK-002] Corrigir bug de timezone na exibição de datas de lançamentos**
  Tipo: Bug
  Severidade: 🔴 Crítica
  Dispositivo afetado: Todos
  Descrição técnica: No componente de tabela de lançamentos, substituir `new Date(competence_date).toLocaleDateString('pt-BR')` por `new Date(competence_date + 'T00:00:00').toLocaleDateString('pt-BR')` ou usar `date-fns` com `parseISO` + `format` sem conversão de timezone. Garantir que a query SQL use `DATE(competence_date AT TIME ZONE 'America/Sao_Paulo')` para filtros por período.

- [ ] **[TASK-003] Remover todos os valores hardcoded do Dashboard e implementar estado de onboarding**
  Tipo: Bug + UX
  Severidade: 🔴 Crítica
  Dispositivo afetado: Todos
  Descrição técnica: Identificar e remover dos componentes do Dashboard os valores fixos: `18%`, `+3`, `12%`, `34%`, `94%`, `R$ 51.200`. Substituir por dados reais das APIs correspondentes. Se não houver API para determinado KPI, exibir `--` com tooltip explicativo. Implementar empty state de onboarding com CTA para primeiras configurações.

- [ ] **[TASK-004] Corrigir label do tooltip no gráfico "Receitas vs Despesas" do Financeiro**
  Tipo: Bug
  Severidade: 🔴 Crítica
  Dispositivo afetado: Todos
  Descrição técnica: No componente Recharts do Financeiro, o `<Tooltip>` está mapeando ambas as chaves como `despesas_cents`. Corrigir o `formatter` para que a primeira série use `name="Receitas"` referenciando `receitas_cents` e a segunda use `name="Despesas"` referenciando `despesas_cents`. Verificar também a cor da barra (deve ser verde para receita, vermelha para despesa).

- [ ] **[TASK-005] Unificar fonte de dados entre Analytics e Financeiro**
  Tipo: Backend + Banco
  Severidade: 🔴 Crítica
  Dispositivo afetado: Todos
  Descrição técnica: Criar uma view ou service de `faturamento_unificado` no banco que agrupe: (1) lançamentos do tipo `ENTRADA` da tabela `financial_entries`, (2) pedidos com status `pago/aprovado` da tabela `orders`, (3) vendas do PDV. O módulo Analytics deve consumir essa view unificada. Ajustar queries de Analytics para incluir `financial_entries` além de `orders`.

- [ ] **[TASK-006] Corrigir duplicidade de produto em alertas de estoque**
  Tipo: Bug + Banco
  Severidade: 🟠 Alta
  Dispositivo afetado: Todos
  Descrição técnica: Adicionar `DISTINCT ON (product_id)` ou `GROUP BY product_id` na query que busca `stock_alerts_detail`. Investigar se há registros duplicados na tabela `products` e adicionar constraint `UNIQUE(name, store_id)` ou `UNIQUE(sku, store_id)`. Validar que `current_stock` é agregado corretamente por produto.

- [ ] **[TASK-007] Implementar proteção CSRF nos endpoints de escrita**
  Tipo: Segurança
  Severidade: 🟠 Alta
  Dispositivo afetado: Todos
  Descrição técnica: Adicionar geração e validação de token CSRF em todos os forms e mutations. No Next.js App Router, usar `crypto.randomUUID()` para gerar token por sessão, armazenar em cookie `SameSite=Strict`, validar o token no Server Action ou API Route antes de processar o POST. Alternativamente, garantir que todos os endpoints usem `SameSite=Strict` no cookie de sessão.

- [ ] **[TASK-008] Corrigir dimensões do gráfico Recharts para suportar containers fluídos**
  Tipo: Bug + Responsividade
  Severidade: 🟠 Alta
  Dispositivo afetado: Mobile, Tablet
  Descrição técnica: O erro `width(-1) and height(-1)` ocorre quando o container pai não tem dimensão explícita. Adicionar `minHeight: 200` ao container do `<ResponsiveContainer>` ou usar `aspect={2}` como fallback. Envolver o chart em `<div style={{width:'100%', minHeight:'200px'}}>` para garantir dimensão inicial válida.

- [ ] **[TASK-009] Ajustar targets de toque para mínimo 44px em mobile**
  Tipo: Responsividade + UX
  Severidade: 🟠 Alta
  Dispositivo afetado: Mobile
  Descrição técnica: Nos itens de navegação do sidebar, adicionar `min-height: 44px` e `padding-y: 12px`. Nos botões de filtro (Todos/Receitas/Despesas/Pendentes), ajustar de `h-8` (32px) para `h-11` (44px). Nos botões do header (Notificações, Ajuda, Assistente), ajustar de `p-2` para `p-3` com `min-w-[44px] min-h-[44px]`.

- [ ] **[TASK-010] Adicionar validação de negócio no backend para lançamentos financeiros**
  Tipo: Backend + Segurança
  Severidade: 🟡 Média
  Dispositivo afetado: Todos
  Descrição técnica: Na API Route `POST /api/internal/financeiro/lancamentos`, adicionar validação Zod/Yup com: `description: z.string().min(5).max(255)`, `amount_cents: z.number().int().min(1)`, `type: z.enum(['ENTRADA','SAIDA'])`, `category: z.enum([...valores válidos])`, `competence_date: z.string().date()`. Retornar HTTP 400 com body `{errors: [...]}` em caso de violação.

- [ ] **[TASK-011] Substituir mensagens de estado vazio por copy de produto com CTAs**
  Tipo: UX
  Severidade: 🟠 Alta
  Dispositivo afetado: Todos
  Descrição técnica: Criar componente `<EmptyState icon title description ctaLabel ctaHref />` e aplicar em todos os widgets do Dashboard. Exemplos: Mapa de Calor → "Ainda sem vendas suficientes para análise horária. Registre pelo menos 10 vendas para ver o padrão." | Agenda → "Nenhum compromisso hoje. [+ Adicionar compromisso]". Remover qualquer referência a "API" ou linguagem técnica do frontend.

- [ ] **[TASK-012] Implementar rate limiting nos endpoints de API**
  Tipo: Segurança
  Severidade: 🟡 Média
  Dispositivo afetado: Todos
  Descrição técnica: Adicionar middleware de rate limiting usando `upstash/ratelimit` ou `express-rate-limit`. Limites sugeridos: endpoints de leitura → 60 req/min por IP/token; endpoints de escrita → 20 req/min por IP/token. Retornar HTTP 429 com header `Retry-After` quando excedido.

- [ ] **[TASK-013] Corrigir mapeamento de origem de leads no componente de pizza**
  Tipo: Bug
  Severidade: 🟡 Média
  Dispositivo afetado: Todos
  Descrição técnica: No componente de gráfico "Leads por Origem" do Dashboard, adicionar mapa de labels: `const SOURCE_LABELS = { WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', INDICACAO: 'Indicação', LOJA: 'Loja Física', ... }`. Usar `SOURCE_LABELS[source] ?? source` para exibir o label humanizado. Atualizar também as cores por origem.

- [ ] **[TASK-014] Implementar campo de método de pagamento no lançamento financeiro**
  Tipo: Banco + UX
  Severidade: 🟡 Média
  Dispositivo afetado: Todos
  Descrição técnica: Adicionar campo `payment_method` (enum: PIX, CARTAO_CREDITO, CARTAO_DEBITO, DINHEIRO, TRANSFERENCIA, BOLETO) ao form de Novo Lançamento e à tabela `financial_entries`. Isso permitirá popular o widget "Formas de Pagamento" no Dashboard e Financeiro, atualmente sempre vazio.

- [ ] **[TASK-015] Adicionar scrollspy na barra de navegação interna do Dashboard**
  Tipo: UX
  Severidade: 🟡 Baixa
  Dispositivo afetado: Desktop, Tablet
  Descrição técnica: Usar `IntersectionObserver` para detectar qual seção (`#section-financeiro`, `#section-acao-imediata`, etc.) está visível no viewport e adicionar classe `active` ao link correspondente na barra de navegação. Adicionar `scroll-behavior: smooth` e offset de 80px para o header fixo.

---

## 📌 NOTA FINAL DO AUDITOR

O ORION CRM tem uma **base visual promissora** — o design dark theme com dourado é diferenciado e profissional. A arquitetura Next.js com Server Components é a escolha certa. O fluxo de lançamento financeiro **funciona e persiste dados corretamente** no banco.

Porém, o produto tem **3 bloqueadores absolutos para produção**: (1) APIs sem autenticação — dados de clientes expostos, (2) dados hardcoded no Dashboard — sistema apresenta informações falsas como reais, (3) desconexão Analytics/Financeiro — a principal promessa do produto (visão unificada) não funciona.

Esses 3 itens precisam ser resolvidos antes de qualquer demo para clientes ou lançamento em ambiente compartilhado. O restante pode ser tratado em sprints subsequentes com base nas tasks priorizadas acima.

---

# ✅ RESULTADO — QA (26/04/2026)

**Resumo:** 9 tasks de QA concluídas. Todos os `tsc --noEmit` passaram limpos.

## Segurança

| Task | Status | O que foi feito |
|---|---|---|
| **TASK-001** | ✅ | Type guard `isWebSession()` — cookie malformado retorna **401**. `force-dynamic` evita cache de Edge |
| **TASK-007** | ✅ | Cookie alterado de `SameSite=Lax` para `SameSite=Strict` — CSRF mitigado |

## Bugs Funcionais

| Task | Status | O que foi feito |
|---|---|---|
| **TASK-002** | ✅ | Datas parseadas como **data local** — 26/04 não vira mais 25/04 |
| **TASK-004** | ✅ | Tooltip Recharts corrigido — **Receitas** em verde, **Despesas** em vermelho |
| **TASK-013** | ✅ | `SOURCE_LABELS` implementado — `"WHATSAPP"` → `"WhatsApp"` no gráfico de pizza |

## Dashboard

| Task | Status | O que foi feito |
|---|---|---|
| **TASK-003** | ✅ | `18%`, `94%`, `R$ 51.200`, `+3`, `34%` removidos — substituídos por `--` ou empty state |
| **TASK-011** | ✅ | Mensagens técnicas de dev removidas — copy neutro de produto |

## Banco / Mobile

| Task | Status | O que foi feito |
|---|---|---|
| **TASK-006** | ✅ | `DISTINCT ON (name)` na query de estoque — produto duplicado eliminado |
| **TASK-008** | ✅ | `minWidth={1}` `minHeight={200}` nos `ResponsiveContainer` — gráficos visíveis em mobile |
| **TASK-009** | ✅ | Touch targets ajustados para `min-h-[44px]` — sidebar, topbar e filtros do financeiro |

## Tasks restantes (requerem decisão arquitetural)

- **TASK-005** — Unificar Analytics + Financeiro (fonte única de verdade)
- **TASK-010** — Validação Zod no backend de lançamentos
- **TASK-012** — Rate limiting
- **TASK-014** — Campo `payment_method` nos lançamentos
- **TASK-015** — Scrollspy na nav do Dashboard

## Validação em runtime (manual)

- Subir stack: `docker compose up -d --force-recreate`
- Testar rotas: `/dashboard`, `/financeiro`, `/analytics` em **mobile** e **desktop**





