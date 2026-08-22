# Gestão, Loja, Analytics e Suporte

**Baseline:** `29c1639`.

## Dashboard e Analytics

| Módulo | UI | API | Papel e limite |
| --- | --- | --- | --- |
| Dashboard | `(crm)/dashboard/page.tsx` | `GET /api/v1/dashboard` | resumo operacional; métricas dependem de consultas atuais |
| Analytics | `AnalyticsClient.tsx` | cinco `GET` em `analytics.routes.ts` | análise derivada de banco; não substitui conciliação financeira |
| Timeline/atividade | suporte/system | `/api/v1/system/timeline`, `/activity` | rotas marcadas como públicas no código; exposição precisa revisão de infraestrutura |

Não há evidência nesta passada de métricas conferidas contra dados reais ou de
autorização de todas as superfícies analíticas além das rotas-fonte.

## Loja e e-commerce

| Superfície | Evidência | Persistência/efeito |
| --- | --- | --- |
| Loja pública | `app/loja`, `app/loja/produto/[slug]`, `store.routes.ts` | catálogo e checkout público por rotas de store |
| Configuração da loja | `settings/loja`, `StoreSettingsClient.tsx`, `store-settings.routes.ts` | aparência, produtos e pedidos da loja conforme rota |
| Checkout | `StoreCheckoutForm.tsx` | cria/atualiza fluxo de pedido; integração de pagamento exige confirmação própria |

O PRD histórico trata e-commerce como fora de escopo, enquanto rotas e páginas
existem. Classificação: **IMPLEMENTADO PARCIALMENTE, DIVERGENTE DO PRD**.

## Ajustes, usuários e permissões

- `AjustesClient` reúne agenda, banco de dados, fluxo, IA Copilot, integrações,
  logística e WhatsApp.
- `GET /users/me` é a fonte de `custom_permissions` usada pela Ficha; rotas de
  usuários cobrem listagem, convite/criação, patch, permissões e remoção.
- `settings.routes.ts` tem configurações públicas e administrativas. A rota
  pública precisa ser tratada como contrato de exposição, não usada para dados
  internos.
- Alterações administrativas precisam preservar audit log e não devem depender
  somente de item escondido na UI.

## Suporte e erros

| Recurso | API | Controle / persistência |
| --- | --- | --- |
| Chamados/incidentes | `/api/v1/tickets` | `system_tickets`; cria/lista/atualiza e exporta |
| Exportação | `POST /tickets/export` | ROOT/ADMIN na implementação atual; gera ZIP de relatos/anexos |
| Erros do sistema | `/api/v1/system/errors` | lista, apaga, exporta e recebe captura do cliente |
| Base Técnica | rota `/base-tecnica` e API allowlisted | somente ADMIN, inclusive ROOT negado; Markdown canônico sem tabela própria |

Suporte é um módulo para desenvolvedores, mas exportações, anexos, logs e erros
podem conter dados pessoais. A Base Técnica referencia somente documentação
sanitizada/allowlisted, não incidentes ou logs brutos.

## IA e automação

`ai-copilot.routes.ts` mantém configuração e skills; `assistant.routes.ts`
recebe chat/ação de assistente. `automations.routes.ts` e `flows.routes.ts`
tratam catálogo/execução de workflow. Não existe prova de modelo, credencial ou
execução externa ativa neste baseline. Qualquer afirmação de IA produtiva é
**NÃO HOMOLOGADA** até evidência de provider, RBAC e logs seguros.

## Riscos conhecidos

1. Rotas system públicas precisam de revisão explícita de conteúdo, cache e
   autorização antes de serem tratadas como portal de suporte.
2. Loja/e-commerce, IA e automações coexistem com PRDs de fases distintas;
   não inferir escopo comercial só pela presença da tela.
3. Base Técnica não lê diretórios arbitrários nem usa os tickets como banco de
   conhecimento técnico; a allowlist e a guarda ADMIN foram validadas no ZIP.
