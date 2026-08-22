# Catálogo técnico por módulo

## Convenção

O status é de implementação observável no commit `29c1639`, não de aceitação
comercial: **IMPLEMENTADO** significa que há rota e/ou tela; **PARCIAL** indica
contrato ou interface incompleta; **PLANEJADO/INDEFINIDO** não deve ser vendido
como funcionalidade ativa. Runtime, dados e permissões negativas permanecem
NÃO VALIDADOS salvo evidência específica em outro documento.

| Módulo | Código principal | Dados/contrato principal | Status e ponto crítico |
| --- | --- | --- | --- |
| Dashboard | `dashboard.routes.ts`, `app/(crm)/page.tsx` | agregados de leads, pedidos, produção e financeiro | IMPLEMENTADO em código; KPIs dependem da integridade dos domínios |
| CRM | `leads.routes.ts`, `customers.routes.ts`, páginas Clientes/Leads | leads, customers, timeline e relacionamentos | IMPLEMENTADO/PARCIAL; ver Ficha e fluxo ponta a ponta |
| Pipeline | `pipeline.routes.ts`, `pipelines.routes.ts`, `app/(crm)/pipeline/` | pipelines, stages, cards e leads | IMPLEMENTADO; regras de transição variam por rota e não estão homologadas |
| Cliente | `customers.routes.ts`, `app/(crm)/clientes/[id]/` | ficha, contatos, histórico, blocos, OS e entregas | IMPLEMENTADO/PARCIAL; ver `FICHA-DO-CLIENTE-TECNICA.md` |
| Inbox | `inbox.routes.ts`, `n8n.routes.ts`, `app/(crm)/inbox/` | conversations e messages | IMPLEMENTADO/PARCIAL; envio físico depende de provedor externo |
| Agenda | `appointments.routes.ts`, `appointmentReminder.worker.ts`, `app/(crm)/agenda/` | appointments, fila BullMQ e contexto IA | IMPLEMENTADO/PARCIAL; não é Google Calendar sincronizado |
| Atendimento | `attendance.routes.ts`, abas da ficha | attendance_blocks, sanitização HTML e status operacional | IMPLEMENTADO/PARCIAL; bloco não materializa automaticamente OS/proposta |
| Cotação | não há `quotes.routes.ts` no baseline; superfície comercial se concentra em Propostas | não foi encontrada entidade/rota autônoma de cotação nesta passada | INDEFINIDO como módulo separado; não declarar implementado |
| Propostas | `proposals.routes.ts`, interface comercial | proposals e itens quando presentes no schema | PARCIAL; não há ponte automática comprovada para Pedido |
| Pedidos | `orders.routes.ts`, `app/(crm)/pedidos/` | orders, order_items, custom_order_details e fluxo | IMPLEMENTADO; personalizada gera produção somente após aprovação |
| OS | `service-orders.routes.ts`, aba OS da ficha | service_orders e service_order_materials | IMPLEMENTADO/PARCIAL; distinta do status `OS` de attendance_blocks |
| Produção | `production.routes.ts`, `app/(crm)/producao/` | production_orders, steps e atribuição | IMPLEMENTADO; criada automaticamente somente para pedido personalizado aprovado |
| Estoque | `products.routes.ts`, serviços de pedido/PDV | products, movements, custo e mínimo | IMPLEMENTADO/PARCIAL; reserva/baixa de personalização não homologada |
| Financeiro | `financial.routes.ts`, montada em `/financial-entries` e `/financeiro` | lançamentos, pagamentos, comissões e centavos | IMPLEMENTADO/PARCIAL; conciliação e provedor real pendentes |
| PDV | `pdv.routes.ts`, `order-financial.service.ts`, tela PDV | venda, pagamento, baixa e lançamento em transação | IMPLEMENTADO em código; requer teste com banco e estoque concorrente |
| Usuários | `users.routes.ts`, Ajustes | users, status, roles e permissões customizadas | IMPLEMENTADO/PARCIAL; revisar escopo real de permissões por rota |
| Permissões | `middleware/rbac.ts`, `middleware/permissions.ts` | role JWT e permissões customizadas | PARCIAL; `ROOT` tem bypass global, ver RBAC |
| Auditoria | `middleware/audit.ts` e chamadas explícitas nos domínios; sem rota própria achada | migration `010_audit_logs.sql` e `audit_logs` | PARCIAL; cobertura não é uniforme e não há superfície independente confirmada |
| IA | `assistant.routes.ts`, `ai-copilot.routes.ts` | config, skills, assistant_logs e tools SQL | IMPLEMENTADO/PARCIAL; chave de copiloto não está criptografada de fato |
| Automações | `automations.routes.ts`, `n8n.routes.ts`, tela Automações | workflows n8n espelhados e webhooks internos | PARCIAL; n8n não está no Compose atual |
| E-commerce/Loja | `store.routes.ts`, `app/loja/` | catálogo público, checkout e sincronização de pedido | IMPLEMENTADO/PARCIAL; checkout e pagamento externo não homologados |
| Analytics | `analytics.routes.ts`, páginas de analytics | consultas agregadas e indicadores | IMPLEMENTADO/PARCIAL; origem e qualidade dos eventos precisam validação |
| Ajustes | `settings.routes.ts`, integrações, store-settings, `app/(crm)/ajustes/` | singleton settings, provedores e branding | IMPLEMENTADO/PARCIAL; defaults/segredos de ambiente exigem revisão |
| Suporte | `tickets.routes.ts`, `/base-tecnica`, `support-technical.routes.ts` | tickets, comentários e Markdown técnico allowlisted | PARCIAL; Base Técnica IMPLEMENTADA e não homologada no browser/produção |

## Fronteiras que não podem ser apagadas

1. **Cotação, proposta, atendimento, OS e pedido não são uma mesma entidade.**
   O repositório tem superfícies para todas, mas os encadeamentos não são
   universalmente automáticos.
2. **Configuração de Fluxo não executa estoque.** A migration local 063 não
   pertence ao baseline e, mesmo quando aplicada, armazenar `stock_action` não
   comprova reserva, bloqueio ou baixa.
3. **E-commerce é público e pagamentos são externos.** Uma preference criada
   não comprova pagamento confirmado nem pedido sincronizado em produção.
4. **Base Técnica não é um sistema de tickets nem uma base em banco.** Ela lê
   somente documentos Markdown allowlisted, exige ADMIN explicitamente e nega
   ROOT. Teste HTTP isolado passou; browser e produção não foram homologados.

## Leitura complementar obrigatória

- Fluxos: `FLUXO-OPERACIONAL-END-TO-END.md`
- Dados: `BANCO-ENTIDADES-E-RELACIONAMENTOS.md`
- API: `API-INVENTARIO-DE-NEGOCIO.md`
- Caminhos/métodos de route modules: `API-ROUTE-CATALOG.md`
- Segurança: `RBAC-E-INTEGRACOES-TECNICO.md`
- IA e automações: `AUTOMACOES-E-IA-TECNICO.md`
- QA e divergências: `QA-E-GAPS-PRD-CODIGO.md`
