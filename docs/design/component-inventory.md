# Inventario de componentes do frontend

Inventario do codigo real em `apps/web`, organizado por responsabilidade. Este
arquivo define o que deve ser reutilizado antes da criacao de um componente novo.

## Shell e utilidades globais

| Componente | Uso |
|---|---|
| `AppShell` | Estrutura autenticada completa |
| `Sidebar` | Branding, navegacao fixa, pipelines e usuario |
| `Topbar` | Contexto da rota, busca, ajuda, notificacoes e IA |
| `MainWrapper` | Limites e espacamento do conteudo |
| `AssistantDock` | Assistente lateral |
| `GlobalSearch` | Busca global por comando |
| `HelpPanel`, `ModuleTutorial` | Ajuda contextual e tours |
| `ToastProvider`, `ErrorModal`, `ConfirmDialogProvider` | Feedback e confirmacoes globais |

## Primitivos de interface

| Componente | Variantes ou estados obrigatorios |
|---|---|
| `Button` | `primary`, `secondary`, `ghost`, `danger`, `gold-ghost`; tamanhos `sm/md/lg` |
| `Card` | titulo, descricao, conteudo e hover de borda |
| `KpiCard` | icone, helper e tendencia positiva/negativa/neutra |
| `Input` | normal, foco, placeholder e desabilitado |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | navegacao de secoes |
| `StatusBadge` | leads, conversa, pedidos, agenda e producao |
| `Switch` | configuracoes booleanas |
| `Skeleton` | carregamento local de blocos |
| `EmptyState` | lista ou painel sem registros |
| `ApiErrorMessage` | erro resumido ou completo com detalhes seguros |
| `PageHeader` | acoes de pagina |
| `ComingSoon`, `UnderConstruction` | indisponibilidade explicita |

## Dashboard

`CustomDashboardView` concentra: navegacao interna, quatro KPI cards, grafico de
faturamento, meta mensal, formas de pagamento, alertas, agenda compacta, pedidos
prontos, producao por etapa, tempo medio, atividade recente, top clientes,
aniversariantes, mapa de calor, origem dos leads e produtos mais vendidos.

## Inbox

`ConversationList`, `ConversationThread`, `InboxComposer`, `MessageBubble`,
`InboxEmptyState` e `InboxRealtimeBridge`.

## Pipeline e leads

`LeadsPipelineClient`, `LeadsListView`, `LeadQuickViewDialog`, `LeadDetailClient`,
`LeadCardMenu`, `LeadsImportDialog`, `PipelineRulesDialog` e
`LeadStageConfirmDialog`.

## Cliente 360

`ClientPanelShell`, `ClientTopbar`, `ClientStagebar`, `ClientLeftSidebar`,
`ClientRightSidebar`, `ClientTabs`, `QuickChatPanel`, `ClientFichaTab`,
`ClientHistoricoTab`, `ClientAtendimentoTab`, `ClientPropostaTab`,
`ClientPedidosTab`, `ClientOSTab`, `ClientEntregaTab`, `NovaEntregaModal`,
`AttendanceBlock`, `AttendancePopup`, `AI3DSection` e `ServiceOrderModal`.

## Agenda

`CalendarHeader`, `ViewSelector`, `MonthView`, `WeekView`, `DayView`, `YearView`,
`ScheduleView`, `TimeGridView`, `CalendarLegend`, `AppointmentPill`, `DayPopover`,
`AppointmentSheet`, `CreateAppointmentDialog`, `LeadAppointmentsTab` e
`AiContextCard`.

## Pedidos e producao

`PedidosClient`, `OrderDrawer`, `StageBar`, `InfoCell`, `WhatsAppPreviewModal`,
`ReasonModal`, `OrdersFlashToast` e `ProducaoClient`.

## Estoque, financeiro, PDV e analytics

| Modulo | Componentes |
|---|---|
| Estoque | `EstoqueClient` |
| Financeiro | `FinanceiroClient`, `MonthlyGoalModal` |
| PDV | `PdvClient`, `ReceiptModal` |
| Analytics | `AnalyticsClient` |

## Ajustes, loja e automacoes

`AjustesClient`, `WhatsAppTab`, `IntegracoesTab`, `IACopilotoTab`, `AgendaTab`,
`FluxoTab`, `LogisticaTab`, `BancoDadosTab`, `StoreSettingsClient`,
`StoreProductCard`, `StoreCheckoutForm`, `FlowEditor`, `FlowEditorWrapper`,
`AutomationCatalogPanel` e `AutomationCanvasPreview`.

## Regra de evolucao

1. Procurar neste inventario e no codigo antes de criar algo.
2. Estender variante quando a semantica e a estrutura forem as mesmas.
3. Criar componente novo apenas quando houver responsabilidade distinta.
4. Adicionar loading, vazio, erro, permissao e responsividade quando aplicavel.
5. Atualizar este inventario quando o novo componente for reutilizavel.
