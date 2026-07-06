# Mapa visual do frontend em producao

Levantamento feito em 09/06/2026 a partir do runtime Docker autenticado em
`http://127.0.0.1` e do codigo em `apps/web`.

## Shell canonico

| Area | Implementacao | Regra visual observada |
|---|---|---|
| Estrutura | `components/layout/AppShell.tsx` | viewport fixa, sidebar de 220 px e conteudo com `min-w-0` |
| Navegacao | `components/layout/Sidebar.tsx` | fundo `#0a0a0c`, item ativo dourado e grupos Pipeline/Operacao/Sistema |
| Cabecalho | `components/layout/Topbar.tsx` | contexto da pagina, busca global central e acoes a direita |
| Conteudo | `components/layout/MainWrapper.tsx` | canvas `#080809`, densidade alta e margens compactas |
| Assistente | `components/layout/AssistantDock.tsx` | painel lateral acionado pelo botao Pergunte |

## Rotas mapeadas

| Rota | Captura | Componente principal |
|---|---|---|
| `/dashboard` | `references/runtime-2026-06-09/dashboard.png` | `CustomDashboardView` |
| `/inbox` | `references/runtime-2026-06-09/inbox.png` | `ConversationList`, `ConversationThread`, `InboxComposer` |
| `/clientes` | `references/runtime-2026-06-09/clientes.png` | pagina de clientes e painel completo do cliente |
| `/clientes/[id]` | `references/runtime-2026-06-09/cliente-360.png` | `ClientPanelShell` e abas do Cliente 360 |
| `/pipeline/leads` | `references/runtime-2026-06-09/pipeline-leads.png` | `LeadsPipelineClient`, `LeadsListView` |
| `/leads/[id]` | `references/runtime-2026-06-09/lead-detail.png` | `LeadDetailClient` e componentes do Cliente 360 |
| `/agenda` | `references/runtime-2026-06-09/agenda.png` | `MonthView` e demais views de calendario |
| `/pedidos` | `references/runtime-2026-06-09/pedidos.png` | `PedidosClient`, `OrderDrawer` |
| `/producao` | `references/runtime-2026-06-09/producao.png` | `ProducaoClient` |
| `/estoque` | `references/runtime-2026-06-09/estoque.png` | `EstoqueClient` |
| `/financeiro` | `references/runtime-2026-06-09/financeiro.png` | `FinanceiroClient` |
| `/pdv` | `references/runtime-2026-06-09/pdv.png` | `PdvClient`, `ReceiptModal` |
| `/analytics` | `references/runtime-2026-06-09/analytics.png` | `AnalyticsClient` |
| `/ajustes` | `references/runtime-2026-06-09/ajustes.png` | `AjustesClient` e abas especializadas |
| `/automacoes` | `references/runtime-2026-06-09/automacoes.png` | `FlowEditor` e catalogo de automacoes |
| `/chamados` | `references/runtime-2026-06-09/suporte.png` | `ChamadosClient`, `DebugTab` e `RoadmapTab` |

## Padroes recorrentes

- Topbar compartilhada em todas as rotas autenticadas.
- Titulos serifados apenas em pontos editoriais; labels e operacao usam fonte sans.
- Cards com `#131316`, borda branca entre 4% e 10% e raio de 8 a 12 px.
- CTAs primarios dourados; acoes secundarias permanecem escuras e contornadas.
- Tabelas densas, cabecalho uppercase, divisores discretos e poucas sombras.
- Estados vazios aparecem dentro do proprio painel, sem spinner central.
- KPI usa cor semantica na borda superior ou no valor, nao como preenchimento total.
- Filtros e busca ficam imediatamente antes de tabelas, kanbans ou grades.

## Fonte de verdade para revisao

O espelho navegavel esta em [`review-hub/index.html`](review-hub/index.html). Ele
usa capturas do runtime real, portanto nao substitui validacao funcional. As
marcacoes de correcao sao armazenadas no `localStorage` do navegador e podem ser
exportadas em Markdown.
