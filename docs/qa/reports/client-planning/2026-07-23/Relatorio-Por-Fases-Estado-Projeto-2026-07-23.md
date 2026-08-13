# Relatório por Fases — Estado do Projeto Orion CRM (23/07/2026)

> Estado do projeto do início ao fim, dividido em 4 fases.
> Legenda: ✅ concluído · 🟡 parcial · 🔴 falta / não iniciado · ⚠️ existe no
> código mas NÃO validado em runtime · 🐛 bug conhecido.
> Ordem de execução prioritária: Fase 1 (feita) → **Fase 3 (urgente, agora)** →
> Fase 2 (comercial, depois) → Fase 4 (resto).

---

## FASE 1 — Base do Sistema
*Fundação técnica. Praticamente concluída — o sistema sobe e roda.*

| Item | Status |
|---|---|
| Stack Docker (Postgres, Redis, API, Web, NGINX) | ✅ (rodando agora) |
| Migrations de banco (60+) | ✅ |
| Login + JWT + refresh token | ✅ (refresh não usado no web 🟡) |
| Middleware RBAC (7 papéis) | ✅ |
| Audit log automático | ✅ |
| Settings singleton + health checks | ✅ |

**Resumo Fase 1:** ✅ concluída. Base sólida.

---

## FASE 2 — Automação e Comercial
*Pipeline, cadastro e ficha do cliente, atendimento, inbox, automações.*
*Prioridade: fica para depois da Fase 3 (não é o urgente do cliente).*

| Item | Status |
|---|---|
| Pipeline / funil de leads + builder visual | ✅ (QA 8.5) |
| Cadastro de cliente | ✅ |
| Ficha do cliente | 🟡 incompleta — RBAC inconsistente (#17), permissões da ficha |
| Atendimento | 🟡 XSS corrigido; fotos de referência não salvam |
| Feedback do cliente | 🔴 stub (#25) |
| IA 3D | 🔴 stub / "em breve" (#26) |
| Inbox / WhatsApp | 🟡 funciona (QA 7.5); bug de ROOT (#24) |
| Agenda | ✅ reconstruída (6 visualizações) |
| Automações (n8n) | 🟡 editor existe, integração a validar |

**Resumo Fase 2:** 🟡 maior parte construída; ficha do cliente e alguns stubs
(feedback, IA 3D) pendentes. Deixada para depois do financeiro/PDV.

---

## FASE 3 — Financeiro e PDV  ⭐ URGENTE (o que o cliente quer agora)
*O loop que deixa o cliente operar: cadastrar produto → vender → financeiro.*

| Item | Status |
|---|---|
| Cadastro de produtos | 🟡 existe, mas bug: categoria não salva (#53), foto desalinhada (#54) |
| Estoque base (movimentações, ajuste manual) | ✅ |
| PDV — núcleo venda → estoque → financeiro | ⚠️ código existe e correto, mas **0 vendas reais** no sistema — nunca foi exercitado em runtime |
| Financeiro base (lançamentos, comissão) | 🟡 existe; **financeiro aparece zerado porque nenhuma venda foi finalizada** |
| Regra de aprovação (baixa só na aprovação, GERENTE/ADMIN) | 🔴 falta |
| Baixa de insumos + margem de perda de ouro + sobra volta | 🔴 falta |
| Custo oculto do vendedor (#52) + senha master | 🔴 falta |
| Contas a Receber (saldo + liquidar) | 🔴 falta |
| Contas a Pagar (vencimento + liquidar) | 🔴 falta |
| Crediário / parcelas futuras | 🔴 falta |
| Entrada no caixa após liquidação | 🔴 falta |
| Analytics / Dashboard | 🐛 bugado (dados zerados, KPIs fixos) + 🔴 **APIs sem autenticação (segurança)** |

**Resumo Fase 3:** o motor existe mas o loop **nunca rodou de verdade** (banco
mostra 2 produtos, 0 vendas concluídas, 0 lançamentos). Todo o financeiro
avançado (contas a pagar/receber, crediário) ainda **não existe**. **Esta é a
estabilização — o foco imediato.**

---

## FASE 4 — Restante para Concluir o Projeto
*Roadmap. Fora da estabilização.*

| Item | Status |
|---|---|
| Loja pública / e-commerce (#32) | 🔴 |
| Fiscal NF-e/NFC-e (via FinOpenPOS) | 🔴 depende do certificado A1 do cliente |
| Chatwoot (omnichannel) — reescreve #29 | 🔴 primeiro item da Fase 4 (~3–5 dias) |
| Terminais de pagamento MP Point (#39) | 🔴 |
| Assistente IA com function calling (#34) | 🔴 |
| Analytics cross-module avançado (#33) | 🔴 |
| Transportadoras / logística (#37) | 🔴 |

**Resumo Fase 4:** roadmap não iniciado. Planejado após a estabilização.

---

## Leitura geral

- **Fase 1** está pronta. **Fase 2** está 70% construída mas com pontas soltas.
- **Fase 3 é o coração da estabilização** e o que trava o cliente hoje: o loop de
  venda existe em código mas nunca foi usado, e o financeiro completo não existe.
- **Fase 4** é o projeto completo, para depois.
- Ordem sensata: fechar **Fase 3** (estabilização, ~06/09), depois **Fase 2**
  (comercial), depois **Fase 4** (roadmap).
- Pendência real: validar a Fase 3 **em runtime** (rodar uma venda de verdade)
  para separar o que funciona do que só existe em código.
