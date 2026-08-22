# Assunção técnica do ORION ERP para Joalherias

## Comece pela operação, não pela árvore de arquivos

O ORION deve ser assumido como um ERP vertical de joalheria. CRM é o domínio
que inicia parte da jornada, mas a responsabilidade do sistema alcança cliente,
venda, peça, oficina, estoque, caixa, entrega e gestão.

A leitura recomendada depende da decisão que será tomada:

| Se você precisa... | Comece aqui | Depois confira |
| --- | --- | --- |
| Entender o que o produto é e onde estão os riscos reais | `ERP-OPERATING-MANUAL.md` | fluxo operacional e dossiês |
| Corrigir uma venda, encomenda, OS ou produção | `FLUXO-OPERACIONAL-END-TO-END.md` | estoque/financeiro/PDV e banco |
| Alterar dados, migration ou relação entre módulos | `BANCO-ENTIDADES-E-RELACIONAMENTOS.md` | API, migration concreta e spec |
| Alterar endpoint ou permissão | `API-ROUTE-CATALOG.md` | RBAC, contrato crítico e teste negativo |
| Assumir deploy, incidente ou atualização | `OPERATIONS-RUNBOOK.md` | arquitetura, Compose e workflow atual |
| Avaliar se algo está realmente pronto | `QA-E-GAPS-PRD-CODIGO.md` | matriz de rastreabilidade e evidências |
| Atender suporte administrativo | rota `/base-tecnica` para ADMIN | documentos allowlisted e runbook |

## Ordem de assunção recomendada

1. Leia `ERP-OPERATING-MANUAL.md`. Ele define unidades de trabalho, registros
   canônicos e as fronteiras entre CRM, venda, oficina, estoque e financeiro.
2. Leia `SECOND-PASS-BASELINE.md`. Ele separa o commit entregue do WIP local
   que não foi transportado.
3. Escolha o ciclo de negócio que você vai assumir e siga-o de ponta a ponta em
   `FLUXO-OPERACIONAL-END-TO-END.md`. Não comece por um componente isolado.
4. Só então abra a rota, service, migration e tela referidos nos dossiês. A
   documentação aponta o caminho, mas o código continua sendo a verdade da
   implementação.
5. Antes de mudança de regra, crie spec e task. Estoque, financeiro, pedido,
   produção, autorização e integrações não admitem alteração por inferência.

## Estado honesto da entrega

O baseline de código é o commit `29c1639`. O pacote de entrega inclui
documentação e Base Técnica de suporte como overlay auditado, sem histórico Git
e sem WIP de outras frentes.

- O código demonstra módulos de relacionamento, venda, oficina, estoque,
  financeiro, gestão, integrações e suporte.
- A conexão entre módulos ainda é parcial em pontos críticos, especialmente
  proposta para pedido, OS versus produção, reserva/baixa/devolução de estoque
  e conciliação financeira.
- Banco real, browser autenticado, Meta/WhatsApp, Mercado Pago, n8n,
  transportadoras, backup, restore, rollback e produção estão **NÃO
  HOMOLOGADOS**, salvo evidência específica nos relatórios.
- O PRD histórico menciona Activepieces e Python; o baseline de código/Compose
  referencia n8n e TypeScript. Essa divergência não foi resolvida pela
  documentação e deve ser tratada como decisão de arquitetura.

## Mapa de documentos

### Produto, ciclo e módulos

- `ERP-OPERATING-MANUAL.md`: manual completo de assunção do ERP, ciclos,
  entidades canônicas, decisões pendentes e checklist de mudança.
- `FLUXO-OPERACIONAL-END-TO-END.md`: caminhos confirmados de WhatsApp até
  entrega, com transições humanas, automáticas e parciais separadas.
- `MODULE-OPERATING-DOSSIERS.md`: por módulo, tela, API, persistência,
  estados, permissões, dependências e risco.
- `MODULOS-CATALOGO-TECNICO.md`: inventário resumido e status técnico.

### Dados e contratos

- `BANCO-ENTIDADES-E-RELACIONAMENTOS.md`: entidades, relações e migrations.
- `API-INVENTARIO-DE-NEGOCIO.md`: API organizada pelo domínio do ERP.
- `API-ROUTE-CATALOG.md`: 49 módulos de rota, mounts e métodos observados.
- `API-CONTRATOS-CRITICOS.md`: endpoints que merecem atenção especial.
- `FICHA-DO-CLIENTE-TECNICA.md`: composição e transições da Ficha.

### Operação e segurança

- `ARQUITETURA-E-OPERACOES-ATUAL.md`: arquitetura encontrada e divergências.
- `ARCHITECTURE-DECISIONS.md`: decisões observadas, não promessas.
- `OPERATIONS-RUNBOOK.md`: startup, logs, deploy, incidentes e recuperação.
- `RBAC-E-INTEGRACOES-TECNICO.md`: autorização, sessão, conectores e dados
  sensíveis.
- `AUTOMACOES-E-IA-TECNICO.md`: n8n, IA e o que não está no Compose.

### Qualidade e rastreabilidade

- `QA-E-GAPS-PRD-CODIGO.md`: lacunas entre expectativa, PRD e código.
- `TRACEABILITY-MATRIX.md`: PRD, spec, task, issue e superfície de código.
- `VALIDACAO-CRUZADA-SEGUNDA-PASSADA.md`: comandos e evidências executadas.
- `COMPLETION-AUDIT-SEGUNDA-PASSADA.md`: cobertura e limites da auditoria.
- `SECOND-PASS-BASELINE.md`: commit, WIP excluído e regra de evidência.

## Regras de manutenção documental

- Atualize o manual de ERP quando uma regra alterar o ciclo de peça, cliente,
  estoque ou financeiro, não apenas quando uma rota mudar.
- Atualize dossiê, contrato e banco no mesmo PR de qualquer mudança de schema,
  endpoint, role, integração ou efeito operacional.
- Nunca transforme `PARCIAL` ou `NÃO HOMOLOGADO` em pronto sem evidência
  anexável, com ambiente e escopo claros.
- Não inclua tokens, credenciais, dumps, dados de clientes, payloads reais ou
  logs com dados pessoais.
- Não descreva integração externa como disponível porque há uma variável de
  ambiente. Exija credencial, configuração, teste e observabilidade.
- Não tome o deploy atual como padrão obrigatório. Ele é uma fotografia
  documentada para permitir transição segura.

## Base Técnica no produto

A página `/base-tecnica` serve documentação allowlisted a usuários
**ADMIN**, com API que não aceita caminho livre de arquivo. Ela é uma superfície
de suporte para leitura, não um substituto de revisão de código ou homologação.
A feature foi validada com teste API isolado; navegador autenticado e produção
continuam não homologados.

## Próxima ação para quem assume

Escolha um único ciclo de negócio crítico, normalmente **venda personalizada →
produção → estoque → financeiro**, valide-o com dados sintéticos em banco
controlado e transforme cada lacuna encontrada em spec e task antes de ampliar
automação.
