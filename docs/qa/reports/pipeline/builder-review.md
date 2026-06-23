---

# 🔍 AUDITORIA COMPLETA — ORION CRM Builder Visual
## Módulo: `/pipeline/leads/builder`
**Data:** 27/04/2026 | **Ambiente:** Produção Local | **QA:** Sênior Funcional + UX + Responsividade

---

## ⚠️ AVISO CRÍTICO ANTES DO RELATÓRIO

> O módulo **não está em condições de produção**. A maioria dos botões e controles são **decorativos** — sem nenhum handler de evento registrado. O canvas não é interativo. O builder como produto ainda não existe funcionalmente.

---

# 1️⃣ TESTE FUNCIONAL (DESKTOP)

---

**[BUG-FUNCIONAL-01]**
**Descrição:** Botões Mover, Conectar e Pan são completamente decorativos — nenhum `onClick` registrado.
**Passos para reproduzir:** Clicar em qualquer um dos três botões da toolbar do canvas.
**Resultado esperado:** Mudança de modo de interação do canvas (arrastar nó / criar conexão / mover viewport).
**Resultado atual:** Zero resposta. Nenhum handler React registrado (`__reactProps` contém apenas `type`, `className`, `children`). O botão Mover fica permanentemente marcado como "ativo" visualmente mas sem efeito funcional.
**Impacto:** Core do produto. Sem esses modos, o canvas não pode ser operado.
**Severidade: 🔴 CRÍTICA**

---

**[BUG-FUNCIONAL-02]**
**Descrição:** Botões de zoom (`+` e `−`) não funcionam. O indicador "100%" é estático e nunca muda.
**Passos para reproduzir:** Clicar em `+` ou `−` na barra inferior do canvas.
**Resultado esperado:** Zoom in/out no canvas, com o percentual atualizado.
**Resultado atual:** Nenhum onClick registrado. O valor permanece "100%" indefinidamente.
**Impacto:** Impossível navegar em fluxos com muitos nodes.
**Severidade: 🟠 ALTA**

---

**[BUG-FUNCIONAL-03]**
**Descrição:** Tabs "Configuração" e "JSON" não executam troca de conteúdo.
**Passos para reproduzir:** Clicar na tab "Configuração" ou "JSON" no topo do módulo.
**Resultado esperado:** Painéis distintos com configurações do pipeline ou editor JSON.
**Resultado atual:** Nenhum `onClick` nos botões das tabs. O indicador de aba ativa (borda dourada) permanece sempre em "Builder visual". O conteúdo nunca muda.
**Impacto:** Funcionalidade completamente morta. Usuário não consegue acessar configurações ou JSON diretamente pelas tabs.
**Severidade: 🔴 CRÍTICA**

---

**[BUG-FUNCIONAL-04]**
**Descrição:** Itens do painel NODES (Trigger, Stage, Action, Condition) não são arrastáveis nem clicáveis.
**Passos para reproduzir:** Tentar arrastar "Trigger" do painel para o canvas, ou clicar nele esperando adicionar um node.
**Resultado esperado:** Comportamento drag-and-drop similar ao n8n — arrastar item para o canvas cria um novo node.
**Resultado atual:** `cursor: auto`, sem `onDragStart`, sem `onClick`. Itens são HTML estático.
**Impacto:** Impossível adicionar novos nodes ao fluxo. Builder não tem funcionalidade de criação.
**Severidade: 🔴 CRÍTICA**

---

**[BUG-FUNCIONAL-05]**
**Descrição:** Nodes existentes no canvas (entry, qualify, close) não são arrastáveis, selecionáveis, editáveis ou deletáveis.
**Passos para reproduzir:** Tentar mover, clicar, fazer double-click ou deletar qualquer node no canvas.
**Resultado esperado:** Seleção do node, painel de propriedades, possibilidade de reposicionar.
**Resultado atual:** Nodes são `<div>` absolutamente posicionados com posições fixas hardcoded (`left:80px; top:80px`, etc). `cursor: auto`, sem eventos React. Apenas clique simples ativa edição inline do nome (comportamento nativo do browser em texto, não intencional).
**Impacto:** O estado do canvas é imutável via interface. Qualquer mudança requer editar o JSON manualmente.
**Severidade: 🔴 CRÍTICA**

---

**[BUG-FUNCIONAL-06]**
**Descrição:** Node ACTION ("close") sobrepõe visualmente o painel NODES em 23px.
**Passos para reproduzir:** Observar o canvas — o node "close" (left:560px, width:170px → termina em 730px) e o painel NODES (right:16px, width:148px → começa em 708px) se sobrepõem.
**Resultado esperado:** NODES panel não obstrui nenhum node do canvas.
**Resultado atual:** 23px de sobreposição. O node fica parcialmente coberto pelo painel.
**Impacto:** Conteúdo do node inacessível. Em canvas mais denso seria problema grave.
**Severidade: 🟠 ALTA**

---

**[BUG-FUNCIONAL-07]**
**Descrição:** Ausência de qualquer feedback visual após ações nos botões "Desativar" e "Publicar pipeline".
**Passos para reproduzir:** Clicar em "Publicar pipeline" ou "Desativar".
**Resultado esperado:** Loading state no botão, toast de sucesso/erro, atualização do status exibido ("Publicado: Não" → "Publicado: Sim").
**Resultado atual:** Submit do formulário acontece (POST para o servidor), mas não há estado de loading no botão, nenhum spinner, nenhum toast. O usuário não sabe se a ação funcionou.
**Impacto:** Confusão sobre estado do sistema. Double-submit possível.
**Severidade: 🟡 MÉDIA**

---

**[BUG-FUNCIONAL-08]**
**Descrição:** Botões de zoom e controles de canvas ficam inacessíveis em viewports menores que 720px de altura.
**Passos para reproduzir:** Abrir o builder em resolução com altura < 720px (maioria dos laptops: 768px, 800px).
**Resultado esperado:** Controles sempre visíveis ou canvas com scroll interno dedicado.
**Resultado atual:** O canvas tem `min-h-[720px]` mas os botões `+/-` e o NODES panel estão absolutamente posicionados dentro de um container `overflow:hidden`. Com viewport de 603px, os controles ficam no `y=858px` — fora do viewport. A page principal tem scroll total de 2051px.
**Impacto:** Ferramenta de canvas inutilizável em altura padrão de laptop.
**Severidade: 🟠 ALTA**

---

**[BUG-FUNCIONAL-09]**
**Descrição:** Nodes no canvas usam IDs internos (`entry`, `qualify`, `close`) enquanto o pipeline tem 6 etapas reais com nomes distintos (Novo, Qualificado, Proposta Enviada, Negociação, Convertido, Perdido). Não há mapeamento visual entre eles.
**Passos para reproduzir:** Comparar painel "Etapas" com os nodes no canvas.
**Resultado esperado:** Cada node do canvas deve representar uma etapa real do pipeline com seu nome correto.
**Resultado atual:** Canvas tem apenas 3 nodes com slugs técnicos; etapas reais são 6, com nomes amigáveis. Sem vínculo visual.
**Impacto:** O usuário não consegue identificar qual node corresponde a qual etapa do funil.
**Severidade: 🔴 CRÍTICA**

---

**[BUG-FUNCIONAL-10]**
**Descrição:** Erros silenciosos de gráficos no console (width/height = -1 em componente Recharts).
**Passos para reproduzir:** Abrir DevTools → Console ao carregar a página.
**Resultado esperado:** Zero warnings/errors no carregamento.
**Resultado atual:** 5 warnings: `"The width(-1) and height(-1) of chart should be greater than 0"`. Indica componente de gráfico renderizando sem container dimensionado.
**Impacto:** Possível gráfico invisível em alguma seção. Debt técnico.
**Severidade: 🟡 MÉDIA**

---

# 2️⃣ TESTE DE RESPONSIVIDADE

---

**[RESPONSIVIDADE-01]**
**Dispositivo:** Desktop (928px — abaixo do breakpoint xl:1280px)
**Problema:** O grid `xl:grid-cols-[minmax(0,1fr)_320px]` **nunca ativa** porque o breakpoint Tailwind `xl` é 1280px. Na prática, o sistema roda em 928px (confinado pelo sidebar global de 220px), o que significa que a coluna direita (Publicação, Etapas, Flow JSON) **sempre empilha abaixo do canvas** formando uma página de 2051px de scroll. A grade tem apenas `grid-template-columns: 872px` — uma única coluna.
**Impacto:** A sidebar direita deveria ser um painel lateral fixo, mas o usuário precisa scrollar 1300px para baixo para acessá-la.
**Severidade: 🔴 CRÍTICA**

---

**[RESPONSIVIDADE-02]**
**Dispositivo:** Tablet (768px — 1024px)
**Problema:** O layout colapsa para coluna única. O canvas ocupa 100% da largura, mas como o canvas tem `overflow:hidden` e os controles de interação (NODES, zoom) estão absolutamente posicionados internamente, eles ficam visíveis apenas dentro dos limites do canvas. Nenhum reposicionamento responsivo ocorre. O grid lateral desaparece. O painel de configurações fica a 720px+ de scroll abaixo do canvas. Sidebar de navegação não colapsa em tablet — persiste ocupando 220px fixos.
**Impacto:** Experiência inutilizável em tablet. Canvas não é navegável.
**Severidade: 🔴 CRÍTICA**

---

**[RESPONSIVIDADE-03]**
**Dispositivo:** Mobile (320px — 480px)
**Problema:** O canvas não tem breakpoints mobile. Os 3 botões da toolbar (Mover/Conectar/Pan) ficam juntos sem colapsar. O painel NODES sobrepõe o canvas em `position:absolute`. Nodes ficam cortados à direita. Nenhuma versão simplificada mobile existe. O sistema sequer deveria permitir edição de workflow em mobile — mas deveria mostrar uma mensagem orientativa ao invés de uma interface quebrada.
**Impacto:** Interface completamente quebrada em mobile. Scroll horizontal implícito no canvas.
**Severidade: 🔴 CRÍTICA**

---

**[RESPONSIVIDADE-04]**
**Dispositivo:** Desktop (≥1280px)
**Problema:** Mesmo em desktop wide, o canvas fica confinado porque o sidebar esquerdo de navegação (220px fixo) + padding interno consome espaço. O canvas em si tem excesso de área vazia branca. Os 3 nodes ficam todos no canto superior esquerdo com 80px de padding — 70%+ da área do canvas fica vazia. Não há "fit to content" ou centralização automática do fluxo.
**Impacto:** Má utilização do espaço. Parece inacabado.
**Severidade: 🟡 MÉDIA**

---

# 3️⃣ VALIDAÇÃO DE UI/UX PROFISSIONAL

---

**[UX-PROBLEMA-01]**
**Descrição:** O canvas é BRANCO (`#FAFAF9`) enquanto o restante do sistema é completamente PRETO/escuro (`#080809`). Esta é uma ruptura severa de identidade visual. O cliente explicitamente solicitou padrão preto.
**Impacto na experiência:** O usuário sente que entrou em um sistema diferente. Quebra total da identidade dark. Parece um componente de terceiros colado sem adaptação.
**Sugestão de melhoria:** Aplicar tema dark no canvas: fundo `#0F0F11` ou `#111113`, nodes com `bg-[#1A1A1F]`, bordas `#2A2A30`, texto `#E8E5E0`. Referenciar a variável `--orion-void` já presente no sistema.
**Prioridade: 🔴 CRÍTICA**

---

**[UX-PROBLEMA-02]**
**Descrição:** O texto descritivo de cada node é "Etapa visual do fluxo" — um placeholder genérico sem informação real. Os IDs dos nodes (`entry`, `qualify`, `close`) são slugs técnicos, não nomes de etapas legíveis.
**Impacto na experiência:** O usuário não consegue entender o que cada node representa. Parece wireframe, não produto.
**Sugestão de melhoria:** Substituir placeholder pelo nome real da etapa. Vincular cada node a uma Stage do pipeline pelo ID. Exibir descrição da regra de automação (ex: "Quando lead entra → qualificar").
**Prioridade: 🔴 CRÍTICA**

---

**[UX-PROBLEMA-03]**
**Descrição:** A ação "Desativar" não tem diálogo de confirmação. Desativar um pipeline pode interromper fluxos ativos de vendas em produção — ação crítica e potencialmente irreversível sem aviso.
**Impacto na experiência:** Clique acidental em "Desativar" pode desligar o pipeline de Leads em produção sem nenhum checkpoint.
**Sugestão de melhoria:** Modal de confirmação: `"Tem certeza? Desativar este pipeline irá pausar todos os leads em andamento."` com botão destrutivo vermelho.
**Prioridade: 🟠 ALTA**

---

**[UX-PROBLEMA-04]**
**Descrição:** O painel lateral direito (Publicação, Etapas, Flow JSON) fica abaixo do canvas, exigindo scroll de ~1300px. Em um editor de workflow, todas as ferramentas devem estar visíveis simultaneamente.
**Impacto na experiência:** Fricção extrema. O usuário não sabe que existe informação abaixo. A experiência deveria ser similar ao n8n: canvas central, painel de propriedades fixo à direita.
**Sugestão de melhoria:** Implementar o layout de duas colunas efetivo em todos os breakpoints a partir de 900px. Usar `position:sticky` ou remover o `xl:` prefix da grid, usando apenas `grid-cols-[1fr_280px]`.
**Prioridade: 🔴 CRÍTICA**

---

**[UX-PROBLEMA-05]**
**Descrição:** Não existe mecanismo para adicionar novos nodes ao canvas. O usuário vê os 4 tipos de nodes no painel (Trigger/Stage/Action/Condition) mas não consegue interagir com eles. Não há botão "Adicionar node", não há double-click no canvas.
**Impacto na experiência:** O builder é somente leitura. O produto promete edição de workflow mas entrega apenas visualização de um estado fixo.
**Sugestão de melhoria:** Implementar drag-and-drop do painel NODES para o canvas. Alternativamente, double-click no canvas para abrir seletor de node. Seguir padrão n8n/React Flow.
**Prioridade: 🔴 CRÍTICA**

---

**[UX-PROBLEMA-06]**
**Descrição:** O "FLOW JSON" no painel lateral e a tab "JSON" no topo são funções sobrepostas/confusas. Aparecem como duas formas de ver/editar o mesmo JSON, mas com interfaces diferentes.
**Impacto na experiência:** Sobrecarga cognitiva. O usuário não sabe qual usar. A tab JSON não funciona, tornando o FLOW JSON o único caminho — mas ele fica a 1300px abaixo.
**Sugestão de melhoria:** Consolidar: a tab JSON deve abrir um modal ou substituir o canvas por um editor de código full-screen. Remover o "FLOW JSON" do painel lateral ou integrá-lo como drawer.
**Prioridade: 🟡 MÉDIA**

---

**[UX-PROBLEMA-07]**
**Descrição:** O status "Publicado: Não" aparece no painel lateral mas o botão "Publicar pipeline" está no header — distância visual excessiva entre ação e feedback de estado.
**Impacto na experiência:** O usuário publica e não sabe se funcionou porque o status fica a 1300px de scroll abaixo.
**Sugestão de melhoria:** Colocar o badge de status ("Ativo / Publicado") próximo ao botão de publicação no header. Atualizar o badge imediatamente após submit via optimistic update.
**Prioridade: 🟡 MÉDIA**

---

# 4️⃣ CONSISTÊNCIA DE DESIGN SYSTEM

---

**[INCONSISTÊNCIA-01]**
**Descrição:** Conflito grave de paleta de cores — dark system vs. white canvas.
**Onde ocorre:** O sistema global usa `--orion-void: #080809` (preto). O canvas do builder usa `bg-[#FAFAF9]` (quase branco). Os cards dos nodes usam `bg-white`. O painel lateral direito usa `bg-white`. Os headers das seções (Publicação, Etapas, Flow JSON) usam `bg-black` com texto branco — criando um sanduíche de cores caótico: preto → branco → preto → branco.
**Impacto:** Identidade visual fragmentada. Parece que 3 sistemas diferentes foram colados.

---

**[INCONSISTÊNCIA-02]**
**Descrição:** Padrão de labels inconsistente entre seções.
**Onde ocorre:** Canvas usa "NODES" (maiúsculo, sem acento). Sidebar usa "Nodes" (título de lista) com "Nodes" em maiúsculo no HTML. Painel usa "PUBLICAÇÃO", "ETAPAS", "FLOW JSON" — todos caps — mas são renderizados via `text-transform:uppercase` via Tailwind? Não — estão hardcoded como texto maiúsculo em algumas e minúsculo em outras.
**Impacto:** Inconsistência tipográfica que comunica falta de atenção ao detalhe.

---

**[INCONSISTÊNCIA-03]**
**Descrição:** Botão "Mover" aparece sempre no estado "ativo" (cor dourada `#C8A97A`), independente do modo selecionado. Conectar e Pan são sempre brancos. Não há lógica de toggle de estado ativo.
**Onde ocorre:** Toolbar do canvas (Mover/Conectar/Pan).
**Impacto:** O usuário acredita que está no modo "Mover" o tempo todo. Nenhum feedback visual de mudança de modo (que não funciona de qualquer forma).

---

**[INCONSISTÊNCIA-04]**
**Descrição:** As conexões entre nodes (`path` SVG) usam a cor `#D6D3D1` (cinza claro) sobre fundo `#FAFAF9` — contraste muito baixo. Em tema escuro, seria completamente invisível.
**Onde ocorre:** Linhas de conexão entry→qualify→close.
**Impacto:** Conexões mal visíveis, especialmente em telas com brilho baixo.

---

**[INCONSISTÊNCIA-05]**
**Descrição:** Cores das bordas laterais dos nodes (type indicator) usam verde `#10B981` para Trigger, dourado `#C8A97A` para Stage, azul `#3B82F6` para Action — mas no painel NODES, os bullets têm cores diferentes: verde (Trigger), marrom/ocre (Stage), azul (Action), amarelo (Condition). O amarelo do Condition não aparece em nenhum node no canvas.
**Onde ocorre:** Comparação entre NODES panel e node cards no canvas.
**Impacto:** Usuário não consegue associar cor do painel com cor do node no canvas.

---

# 5️⃣ RISCOS DE PRODUTO

---

**[RISCO-PRODUTO-01]**
**Descrição:** O builder é uma casca visual sem funcionalidade. Um usuário que abre esta página para configurar automações entre pipelines sai em 15 segundos por não conseguir realizar nenhuma ação.
**Impacto estratégico:** Zero retenção no módulo. Alta taxa de abandono. Dano à percepção de qualidade do produto como um todo. Clientes que testam o builder antes de assinar perdem confiança imediata.
**Recomendação:** Não disponibilizar esta página para usuários até que pelo menos drag-and-drop básico e conexão de nodes estejam funcionais. Colocar um estado de "Em breve" com wireframe explicativo.

---

**[RISCO-PRODUTO-02]**
**Descrição:** "Desativar" pipeline sem confirmação em produção.
**Impacto estratégico:** Um clique acidental pode interromper fluxo ativo de vendas. Em ambiente de cliente real, isso pode significar perda de leads em andamento.
**Recomendação:** Modal de confirmação obrigatório com campo de digitação do nome do pipeline ("Digite 'leads' para confirmar") ou ao menos um diálogo de 2 etapas.

---

**[RISCO-PRODUTO-03]**
**Descrição:** O canvas branco vs. sistema preto quebra a identidade do produto. Se demonstrado para investidores ou clientes em demo, transmite falta de acabamento.
**Impacto estratégico:** Redução da percepção de valor. O contraste visual entre o "shell" dark e o canvas white parece bug, não design.
**Recomendação:** Implementar dark mode no canvas como prioridade visual imediata — mesmo antes das funcionalidades.

---

**[RISCO-PRODUTO-04]**
**Descrição:** Edição de JSON manual (textarea) como único caminho para modificar o fluxo é extremamente frágil. Um JSON malformado pode corromper o pipeline sem validação client-side.
**Impacto estratégico:** Usuário não-técnico destrói configuração sem saber. Não há validação de schema, não há undo.
**Recomendação:** Adicionar validação de JSON antes do submit. Botão "Resetar para padrão". Histórico de versões.

---

**[RISCO-PRODUTO-05]**
**Descrição:** Nenhum estado de empty/zero nodes. Se o JSON for apagado, o canvas fica vazio sem orientação.
**Impacto estratégico:** Experiência de first-use horrível. Sem onboarding, sem estado inicial orientativo.
**Recomendação:** Estado empty com mensagem: "Arraste um Trigger do painel para começar seu fluxo" com seta indicativa.

---

# 6️⃣ RESUMO EXECUTIVO

| Dimensão | Nota |
|---|---|
| **Nota Geral** | **2.5 / 10** |
| **Desktop (≥1280px)** | 3.5 / 10 |
| **Tablet (768–1024px)** | 1.5 / 10 |
| **Mobile (320–480px)** | 1.0 / 10 |

### Top 5 Problemas Críticos

1. **Canvas completamente não-interativo** — Nenhum botão de ferramenta (Mover/Conectar/Pan/Zoom/Tabs) possui handler de evento. O builder é uma imagem estática.
2. **Nodes não são arrastáveis nem editáveis** — Impossível criar, mover, conectar ou deletar nodes via interface.
3. **Canvas branco em sistema dark** — Violação total da identidade visual exigida pelo cliente.
4. **Layout colapsado em toda resolução abaixo de 1280px** — O painel lateral fica empilhado abaixo de 1300px de scroll, tornando o editor inutilizável em qualquer tela real.
5. **Nodes não mapeados às etapas reais do pipeline** — 3 nodes com slugs técnicos para um pipeline de 6 etapas com nomes reais. Desconexão total.

| | |
|---|---|
| **Risco Geral** | 🔴 CRÍTICO |
| **Pronto para produção?** | ❌ NÃO |

---

# 7️⃣ TASKS PARA PIPELINE

### TASKS SUGERIDAS (ordenadas por prioridade)

---

- [ ] **[TASK-01] Implementar interatividade dos botões Mover/Conectar/Pan com gerenciamento de modo de canvas**
  Tipo: Bug
  Severidade: 🔴 Crítica
  Dispositivo afetado: Todos
  Descrição técnica: Criar estado React `mode: 'move' | 'connect' | 'pan'`. Adicionar `onClick` em cada botão que atualiza o estado. Passar o mode como prop para o canvas. No canvas, aplicar cursor diferente por modo (`grab` para pan, `crosshair` para connect, `default` para move). Aplicar classe `bg-[#C8A97A]` apenas no botão do modo ativo (remover hardcoded do Mover).

---

- [ ] **[TASK-02] Implementar drag-and-drop de nodes do painel NODES para o canvas**
  Tipo: Bug
  Severidade: 🔴 Crítica
  Dispositivo afetado: Desktop, Tablet
  Descrição técnica: Adicionar `draggable={true}` e `onDragStart` nos itens do painel NODES (Trigger/Stage/Action/Condition). No canvas container, adicionar `onDrop` e `onDragOver`. Ao drop: calcular posição relativa ao canvas (subtrair `getBoundingClientRect()` do canvas do `event.clientX/Y`), criar novo node no estado com tipo e posição calculados, persistir via form action `saveFlow`.

---

- [ ] **[TASK-03] Implementar drag-and-drop dos nodes existentes no canvas**
  Tipo: Bug
  Severidade: 🔴 Crítica
  Dispositivo afetado: Desktop, Tablet
  Descrição técnica: Nos cards de node (`[style*="left:"][style*="top:"]`), adicionar `onMouseDown` para iniciar drag. Controlar posição via `useState` com `{x, y}`. No `onMouseMove` do canvas container (quando dragando), atualizar posição. No `onMouseUp`, finalizar e salvar no JSON. Alternativa: usar biblioteca `@dnd-kit/core` ou `react-draggable` que já são compatíveis com Next.js/RSC.

---

- [ ] **[TASK-04] Implementar funcionalidade de conexão entre nodes (modo Conectar)**
  Tipo: Bug
  Severidade: 🔴 Crítica
  Dispositivo afetado: Desktop
  Descrição técnica: Quando `mode === 'connect'`, adicionar `onMouseDown` nos nodes para iniciar conexão. Renderizar SVG path temporário seguindo o cursor até `onMouseUp` em outro node. Ao soltar em um node válido, adicionar conexão no estado JSON `connections[sourceId].push({to: targetId})`. Atualizar o SVG canvas (que já renderiza paths com `M x y C ...`). Salvar via `saveFlow` action.

---

- [ ] **[TASK-05] Implementar troca funcional das tabs Builder visual / Configuração / JSON**
  Tipo: Bug
  Severidade: 🔴 Crítica
  Dispositivo afetado: Todos
  Descrição técnica: Criar estado `activeTab: 'builder' | 'config' | 'json'`. Adicionar `onClick={() => setActiveTab('config')}` em cada botão de tab. Renderizar condicionalmente: tab `builder` → canvas atual; tab `config` → formulário de configurações do pipeline (nome, slug, status, cor); tab `json` → editor de código full-width substituindo o canvas (pode reutilizar o textarea do Flow JSON já existente). Aplicar `border-b-2 border-[#C8A97A]` apenas na tab ativa.

---

- [ ] **[TASK-06] Corrigir layout — implementar painel lateral fixo à direita do canvas**
  Tipo: Responsividade + Refatoração UI
  Severidade: 🔴 Crítica
  Dispositivo afetado: Todos
  Descrição técnica: Alterar `xl:grid-cols-[minmax(0,1fr)_320px]` para `grid-cols-[1fr_280px]` (sem prefixo xl) OU usar `md:grid-cols-[1fr_280px]`. Isso garante o layout de 2 colunas a partir de 768px. O painel direito deve ter `position:sticky; top:0; height:100vh; overflow-y:auto` para acompanhar o scroll do canvas. Em mobile (<768px), esconder o painel direito por padrão com um botão "Painel" que abre como drawer.

---

- [ ] **[TASK-07] Aplicar tema dark no canvas e nodes**
  Tipo: Refatoração UI
  Severidade: 🔴 Crítica
  Dispositivo afetado: Todos
  Descrição técnica: Alterar `bg-[#FAFAF9]` do container do canvas para `bg-[color:var(--orion-void)]` ou `bg-[#0D0D10]`. Alterar node cards de `bg-white` para `bg-[#1A1A1F]` com `border-[#2A2A30]`. Texto de `text-[#111827]` para `text-[#E8E5E0]`. Texto secundário de `text-[#6B7280]` para `text-[#6B7280]` (manter). Alterar cor das conexões SVG de `#D6D3D1` para `#3A3A42`. Alterar painel NODES de `bg-white` para `bg-[#1A1A1F]`.

---

- [ ] **[TASK-08] Implementar funcionalidade de zoom no canvas**
  Tipo: Bug
  Severidade: 🟠 Alta
  Dispositivo afetado: Desktop, Tablet
  Descrição técnica: Criar estado `zoom: number = 1`. Nos botões `+` e `−`, adicionar `onClick={() => setZoom(z => Math.min(2, z + 0.1))}` e `setZoom(z => Math.max(0.25, z - 0.1))`. Aplicar `transform: scale(zoom)` no container interno do canvas (não no overflow container). Exibir `${Math.round(zoom * 100)}%` no indicador. Adicionar suporte a `wheel` event no canvas para zoom com scroll (`Ctrl+Scroll`).

---

- [ ] **[TASK-09] Vincular nodes do canvas às etapas reais do pipeline**
  Tipo: Bug + Melhoria UX
  Severidade: 🔴 Crítica
  Dispositivo afetado: Todos
  Descrição técnica: Ao carregar o builder, buscar as stages do pipeline (`Novo, Qualificado, Proposta Enviada, Negociação, Convertido, Perdido`). Nos node cards, substituir o slug técnico (`qualify`) pelo nome da stage vinculada. Substituir `"Etapa visual do fluxo"` pelo nome da automação/regra configurada. Adicionar campo `label` e `stageId` no schema JSON do flow. Mostrar cor da stage como border-left do node.

---

- [ ] **[TASK-10] Adicionar modal de confirmação para ação "Desativar" pipeline**
  Tipo: Melhoria UX
  Severidade: 🟠 Alta
  Dispositivo afetado: Todos
  Descrição técnica: Interceptar o submit do form "Desativar" com `onSubmit={e => { e.preventDefault(); setShowConfirmModal(true); }}`. Renderizar `<dialog>` ou componente Modal com: título "Desativar pipeline Leads?", descrição "Todos os leads em andamento serão pausados.", botão "Cancelar" e botão "Desativar" (vermelho/destrutivo). Ao confirmar, submeter o form programaticamente.

---

- [ ] **[TASK-11] Adicionar feedback visual (loading + toast) para Publicar pipeline e Salvar estrutura**
  Tipo: Melhoria UX
  Severidade: 🟡 Média
  Dispositivo afetado: Todos
  Descrição técnica: Usar `useFormStatus` do React 19/Next.js para detectar pending state. No botão: `disabled={pending}` com spinner inline quando `pending`. Após submit bem-sucedido: exibir toast "Pipeline publicado com sucesso" (verde) ou "Erro ao publicar" (vermelho) via `useActionState`. Atualizar badge "Publicado: Não" → "Publicado: Sim" sem reload completo.

---

- [ ] **[TASK-12] Corrigir overflow do canvas em viewports com altura < 720px**
  Tipo: Responsividade
  Severidade: 🟠 Alta
  Dispositivo afetado: Laptop (768px–900px height)
  Descrição técnica: Remover `min-h-[720px]` do canvas container. Usar `height: 100%` ou `flex-1`. O canvas deve ocupar a altura disponível do painel, não uma altura fixa. Garantir que os controles absolutamente posicionados (zoom, NODES panel) usem `position:sticky` dentro do canvas scrollável ou sejam reposicionados para fora do `overflow:hidden`.

---

- [ ] **[TASK-13] Adicionar seleção de node com painel de propriedades**
  Tipo: Melhoria UX
  Severidade: 🔴 Crítica
  Dispositivo afetado: Desktop, Tablet
  Descrição técnica: Ao clicar em um node, adicionar border de seleção (`ring-2 ring-[#C8A97A]`). Abrir painel lateral direito com propriedades do node selecionado: campo de nome editável, tipo de node, regras de transição configuradas, botão "Deletar node" (com confirmação). Fechar ao clicar fora ou pressionar Escape.

---

- [ ] **[TASK-14] Adicionar estado empty do canvas com orientação de onboarding**
  Tipo: Melhoria UX
  Severidade: 🟡 Média
  Dispositivo afetado: Todos
  Descrição técnica: Quando `nodes.length === 0`, renderizar no centro do canvas: ícone de fluxo + texto "Arraste um Trigger do painel para iniciar" + seta apontando para o painel NODES. Estilo ghost/sutil usando cores do tema dark.

---

- [ ] **[TASK-15] Corrigir sobreposição do node ACTION com o painel NODES**
  Tipo: Bug
  Severidade: 🟠 Alta
  Dispositivo afetado: Desktop
  Descrição técnica: Reposicionar o painel NODES ou aumentar o padding direito do canvas para garantir que nodes não sobreponham o painel. Opção 1: aumentar `right` do painel para `right-[170px]` (largura do node). Opção 2: adicionar padding direito de 180px no canvas scroll container. Opção 3: mover painel NODES para barra superior ou sidebar dedicada.

---

> **Nota do Auditor:** Este módulo é tecnicamente uma UI estática apresentada como editor de workflow. O core do produto (interatividade do canvas) ainda não foi implementado. Recomendo bloquear o acesso à página em produção com um estado "Em construção" até que as tasks 01–09 estejam concluídas. As tasks 10–15 são de polish e podem vir em sprint seguinte.
