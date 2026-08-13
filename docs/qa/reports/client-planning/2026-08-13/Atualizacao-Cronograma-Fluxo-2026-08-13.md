# Atualizacao do Cronograma e Fluxo — Orion CRM

**Data:** 13/08/2026
**Base historica:** `docs/qa/reports/client-planning/2026-07-23/`
**Objetivo:** preservar o acordo de 23/07 e registrar o ajuste necessario apos a
correcao de fluxo definida em 06/08.

## Resumo executivo

O plano de 23/07 continua valido como acordo historico de escopo e prazo, mas
nao pode mais ser usado sozinho para execucao. A sequencia operacional foi
corrigida depois dele:

```text
ATENDIMENTO -> CAIXA -> ESTOQUE -> OS -> ENTREGA
```

Proposta e documento dentro do Atendimento. Nao e etapa operacional propria.

## Impacto no cronograma original

| Bloco | Plano de 23/07 | Status em 13/08 | Ajuste necessario |
|---|---|---|---|
| A | Regra de aprovacao + Estoque + PDV + Permissoes ate 08/08 | Parcial e fragmentado | Replanejar como fatias executaveis por fluxo: Caixa, Estoque, OS e Permissoes |
| B | Financeiro completo ate 22/08 | Planejado em relatorio, sem task numerada suficiente | Criar specs/tasks para contas a receber, contas a pagar, crediario e caixa |
| C | Calculo automatico de insumo + correcoes QA ate 01/09 | Dependente do Bloco A estabilizado | Separar calculo de insumo, sobra, perda e backflush em tasks proprias |
| D | Fiscal NF-e/NFC-e apos certificado A1 | Roadmap dependente do cliente | Manter fora da estabilizacao ate certificado e inscricao estadual existirem |

## Estado real encontrado

### Banco

- Existem mudancas planejadas e implementadas em branches separadas.
- A branch atual `feat/board-excluir-renomear` contem `062_backfill_product_category_name.sql`.
- A branch `feat/flow-stage-stock-action` contem a fundacao de `stock_action` e
  `min_role_to_move` em `flow_stage_rules`, com PR #58 aberto.
- Antes de mergear qualquer coisa, a ordem de migrations precisa ser verificada
  contra `main`.

### API/Backend

- TASK-046/#48, TASK-050/#52 e TASK-051/#53 tem implementacoes locais descritas,
  mas o board ainda mostra as issues em `Discovery / SDD`.
- TASK-054/#57 esta em PR #58 e deve ser revisada antes de novas fatias de
  estoque/baixa.
- Financeiro completo, contas a receber/pagar, crediario, caixa e liquidacao
  ainda nao estao cobertos por tasks executaveis suficientes.

### Frontend/UI

- TASK-047/#49 foi implementada localmente para renomear/excluir board, mas sem
  PR isolado.
- TASK-052/#54, foto 1:1/crop/carrossel, ainda esta em Discovery / SDD.
- TASK-053/#56, hidratacao do Estoque, teve primeira tentativa falha e precisa
  debug em `next dev`.

### Validacao

- Relatorios antigos dizem que o nucleo PDV -> estoque -> financeiro existe, mas
  tambem registram que nao havia venda real validada em runtime.
- Status de task local e status do GitHub Project estao desalinhados.
- Nao marcar nenhum modulo como concluido sem evidencia de runtime/API/browser.

### Riscos/Lacunas

- Os documentos de 23/07 estavam untracked em worktree Claude e foram preservados
  agora no repo principal.
- Continuar na branch atual sem separar PRs mistura pedidos, estoque, permissao,
  pipeline e docs.
- O proximo trabalho nao deve ser codigo novo; deve ser reconciliacao de board,
  branches, migrations e tasks.

## Proxima execucao recomendada

1. Preservar e commitar os documentos de planejamento em commit separado.
2. Revisar PR #58 primeiro, porque ele cria a base de configuracao de etapa para
   as fatias de estoque.
3. Separar a branch `feat/board-excluir-renomear` em pacotes por issue:
   #48, #49, #52, #53 e docs #45-#56.
4. Criar specs/tasks numeradas para o Bloco B financeiro, que hoje existe como
   compromisso de cliente, mas nao como execucao governada.
5. Atualizar o board para refletir o estado real antes de delegar nova
   implementacao ao Claude Code.
