# Lista Mestra para Terminar o Projeto — Reconciliação (23/07/2026)

> Cruza três fontes: (1) o board do GitHub inteiro, (2) o estado do código, e
> (3) as regras definidas em reunião que não estavam registradas.
> Status: ✅ feito (código) · 🟡 parcial · 🔴 a fazer · 🐛 bug · ❓ confirmar em runtime
> Nota: os `docs/tasks/TASK-0XX` citados pelas issues #48–#56 **não existem no
> repo** (ficaram no workspace do Codex) — as specs precisam ser refeitas.

## 1. FINANCEIRO — Prioridade 1
| Item | Status | Board |
|---|---|---|
| Contas a Receber (saldo devedor + liquidar) | 🔴 | não registrado |
| Contas a Pagar / despesas com vencimento | 🔴 | não registrado |
| Crediário / parcelas futuras datadas | 🔴 | não registrado |
| Entrada no caixa após liquidação | 🔴 | não registrado |
| Pendentes vs liquidados | 🟡 | não registrado |
| Origem/vínculo do lançamento na UI | 🟡 | não registrado |

*(#31 "Financeiro v2: dashboard/comissões" é vago e NÃO cobre contas a pagar/receber que o cliente pediu.)*

## 2. ESTOQUE + REGRA DE APROVAÇÃO — Prioridade 2
| Item | Status | Board |
|---|---|---|
| Aprovação→produção só ADMIN/GERENTE | 🔴 | **#48** |
| Baixa da peça só na aprovação (não na venda) | 🔴 | parcial em #48 |
| Baixa de insumos (ouro, pedras) na aprovação | 🔴 | não registrado |
| Reserva de estoque na venda | 🔴 | não registrado |
| Margem de perda de ouro (% por tipo de peça) | 🔴 | não registrado |
| Sobra de insumo volta ao estoque | 🔴 | não registrado |
| Ocultar custo/margem/especificações de vendedor | 🔴 | **#52** |
| Retirada manual só admin/gerente + senha master | 🔴 | senha master não registrada |
| Bug: categoria não salva no cadastro | 🐛 | **#53** |
| Bug: foto padrão/centralização + carrossel | 🐛 | **#54** |
| Bug: erros de hidratação (Intl) no estoque | 🐛 | **#56** |

## 3. PDV — Prioridade 3
| Item | Status | Board |
|---|---|---|
| Núcleo venda→estoque→financeiro | ✅❓ | — (confirmar runtime) |
| Ajuste: gerar pedido "aguardando aprovação" + reserva | 🔴 | junto de #48 |
| Terminais de pagamento (MP Point) | 🔴 | #39 (planejamento) |

## 4. USUÁRIOS / PERMISSÕES — Prioridade 4
| Item | Status | Board |
|---|---|---|
| Toggles de permissão que não enforçam (cosméticos) | 🐛 | **#55**, auditar **#51** |
| Enforcement das chaves no backend | 🔴 | exigido por #52 |
| Senha master para operações sensíveis | 🔴 | não registrado |
| RBAC de clientes inconsistente | 🟡 | **#17** |

## 5. ANALYTICS / DASHBOARD — cliente precisa
| Item | Status | Board |
|---|---|---|
| Unificar dados Analytics ↔ Financeiro (mostra R$0) | 🐛 | não como bug (#33 é SDD) |
| KPIs do Dashboard hardcoded → dados reais | 🐛 | não registrado |
| **APIs internas sem autenticação (SEGURANÇA)** | 🔴 crítico | não registrado |
| Mensagens internas expostas, gráficos mobile, duplicados | 🐛 | não registrado |

## 6. FISCAL
| Item | Status | Board |
|---|---|---|
| NF-e/NFC-e via pacote FinOpenPOS | 🔴 | #27 (só wording); depende do certificado A1 |

## 7. Já resolvido no código — fechar issues (confirmar em runtime)
#15, #16, #18, #19, #20, #21, #22, #23, e #35 (Agenda reconstruída).

## 8. Ainda abertos do backlog antigo
#24 inbox ROOT · #25 feedback stub · #26 IA 3D · #27 NF-e wording · #17 RBAC clientes.

## 9. Planejamento / decidir (não crítico para o go-live)
- #28–#40 SDDs: Inbox V2 (→ Chatwoot), E-commerce, Automações, Assistente IA, Transportadoras, Ajustes — decidir escopo.
- #49 excluir/renomear board no pipeline (UI) · #48 já contado acima.
- #41 Fase 0 · #43 (é de OUTRO projeto — fechar) · #8–#14 OS multi-peça.

## O que só o runtime resolve
Confirmar o que está realmente pronto (PDV, Estoque, Produção, Clientes, Inbox) —
precisa de login no sistema (que já está rodando). O código e os relatórios de
abril já erraram nas duas direções (Analytics pior, Agenda melhor).
