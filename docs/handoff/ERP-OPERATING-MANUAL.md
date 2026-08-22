# Manual de assunção do ORION ERP para Joalherias

## Objetivo deste manual

Este manual existe para que o próximo responsável assuma o ORION como um **ERP de joalheria**, não como uma coleção de telas de CRM. Ele explica onde começa e termina cada processo, qual registro sustenta cada decisão, que efeito deveria ocorrer, onde o código já executa esse efeito e onde ainda há uma lacuna.

O baseline técnico desta documentação é o commit `29c1639`. A documentação distingue:

- **Implementado em código:** rota, serviço, migration ou componente foram encontrados.
- **Parcial:** existe uma parte do ciclo, mas há elo, integração ou regra sem prova.
- **Não homologado:** não houve execução com ambiente real, credencial externa, navegador autenticado ou dado operacional.
- **Decisão necessária:** não existe uma regra única que possa ser inferida com segurança.

Nenhum desses estados autoriza mudança de negócio sem spec, task e aprovação.

## 1. O produto e sua unidade operacional

A unidade de trabalho do ORION não é apenas o lead. É a jornada de uma peça, de um cliente e de um valor financeiro:

```text
contato → oportunidade → cliente → atendimento técnico/comercial
        → proposta ou pedido → peça pronta / oficina / entrega
        → estoque e financeiro → histórico e indicadores
```

Uma mesma demanda pode percorrer caminhos diferentes:

| Situação da joalheria | Registro de entrada | Registro comercial | Registro operacional | Efeito de controle esperado |
| --- | --- | --- | --- | --- |
| Venda de peça pronta no balcão | cliente rápido ou cliente existente | pedido/PDV | separação ou entrega | pagamento, estoque, financeiro |
| Venda personalizada | lead ou cliente | proposta e pedido personalizado | produção | materiais, prazo, custo, entrega |
| Ajuste ou reparo | cliente e bloco de atendimento | ordem de serviço | oficina/etapas | materiais, mão de obra, retirada |
| Atendimento por WhatsApp | conversa e lead | ficha/proposta/pedido | depende da conversão | histórico, responsável e próxima ação |
| Venda online | pedido de loja | pagamento/pedido | expedição | catálogo, pagamento, entrega |

O código contém entidades para todos esses contextos, mas o vínculo entre elas não é universalmente automático. A manutenção correta começa perguntando **qual é o registro canônico deste caso de negócio** antes de implementar uma nova seta.

## 2. Mapa de fontes de verdade

| Assunto | Registro persistido principal | Rotas/código de referência | Cuidado prático |
| --- | --- | --- | --- |
| Identidade e acesso | `users`, refresh tokens, permissões customizadas | `auth.routes.ts`, `users.routes.ts`, RBAC | Menu oculto não é autorização; conferir guard na rota |
| Captação | `leads`, timeline, tasks, anexos | `leads.routes.ts` | Telefone, pipeline e etapa são dados que afetam conversão |
| Cliente | `customers`, tags, anexos, histórico | `customers.routes.ts` | Não duplicar cliente sem regra de deduplicação |
| Conversa | `conversations`, `messages` | `inbox.routes.ts`, `inbox.service.ts` | Canal e envio dependem de provider externo |
| Agenda | `appointments` | `appointments.routes.ts`, worker de lembrete | Agenda local não comprova sincronização externa |
| Atendimento | `attendance_blocks`, `ai_renders` | `attendance.routes.ts`, `renders.routes.ts` | Bloco não é automaticamente uma OS ou um pedido |
| Proposta | `proposals`, peças e materiais | `proposals.routes.ts`, migration 061 | Não há conversão automática comprovada para pedido |
| Pedido | `orders`, itens e detalhe personalizado | `orders.routes.ts` | Tipo e status definem os próximos efeitos possíveis |
| Ordem de serviço | `service_orders`, materiais | `service-orders.routes.ts` | Não assumir que é sinônimo de produção |
| Produção | `production_orders`, `production_steps` | `production.routes.ts` | Ordem pode nascer de pedido personalizado aprovado |
| Catálogo/estoque | `products`, `stock_movements`, categorias | `products.routes.ts` | Saldo é dado crítico, exige transação e concorrência |
| Financeiro | `financial_entries`, `payments` | `financial.routes.ts`, `order-financial.service.ts` | Valores são centavos inteiros; conciliação não homologada |
| Entrega | `deliveries`, configuração de carrier | `deliveries.routes.ts`, adapters | Transportadora é dependência externa |
| Gestão | agregados de domínios anteriores | `dashboard.routes.ts`, `analytics.routes.ts` | KPI é consequência da qualidade da operação de origem |

A estrutura detalhada de campos, FKs e migrations está em
[Banco, entidades e relacionamentos](BANCO-ENTIDADES-E-RELACIONAMENTOS.md). Para
alterar schema, use a migration como verdade primária, não a tabela deste
manual.

## 3. Ciclo de relacionamento: do contato ao cliente

### 3.1 Entrada e qualificação

O contato pode nascer no balcão, por indicação, Instagram ou WhatsApp. O ERP
registra a oportunidade como `lead`, com pipeline, stage, responsável e
timeline. A Inbox registra uma conversa separada, mas relacionada ao contato.

**O que deve ser preservado numa mudança**

1. A identificação do contato deve impedir duplicação indevida, principalmente
   por telefone.
2. Alterar etapa do pipeline é uma ação comercial, não apenas cosmética. Ela
   pode alimentar histórico, métricas e automações.
3. Conversa, lead e cliente possuem ciclos distintos. Não use o ID de um como
   se fosse sempre válido no outro domínio.
4. n8n pode chamar endpoints de criação/atualização, mas n8n não está no
   Compose atual. O fluxo externo precisa ser configurado e homologado fora
   deste snapshot.

**Estado observado:** rota e persistência existem; entrada real de canal,
eventos de automação e operação de atendentes estão **NÃO HOMOLOGADOS**.

### 3.2 Conversão em cliente

A Ficha atende clientes, e o código protege a criação de bloco de atendimento
quando o identificador ainda representa um lead. Isso é um guard útil, mas não
define por si só a regra de conversão.

A regra que ainda precisa ser formalizada pela operação é:

- quem pode converter;
- em que etapa ou evento a conversão pode ocorrer;
- como tratar telefone, CPF e dados incompletos duplicados;
- se o lead fica somente marcado como convertido ou se alguma carteira é
  transferida;
- como históricos de conversa, proposta e agenda passam a aparecer para o
  cliente.

Sem essa regra, uma automação de conversão pode gerar cadastro duplicado,
perder atribuição comercial ou dar acesso à ficha errada.

## 4. Ciclo comercial: atendimento, proposta e pedido

### 4.1 Ficha e bloco de atendimento

A Ficha do cliente é o ponto de concentração do atendimento. Os blocos
registram informações técnicas e comerciais, incluindo status, produto,
orçamento e dados que podem anteceder OS, proposta ou entrega.

O bloco é útil para organizar a conversa de venda, mas não deve ser elevado a
entidade mestre do ERP sem decisão explícita. O código mostra que:

- existe criação de blocos em `attendance.routes.ts`;
- propostas possuem tabelas e rota próprias;
- OS possui rota e tabelas próprias;
- pedidos possuem rota e tabelas próprias;
- transições entre esses objetos são apenas parcialmente provadas.

**Regra de manutenção:** antes de criar botão “gerar pedido”, “gerar OS” ou
“aprovar proposta”, definir qual objeto nasce, que campos são congelados, quem
pode editar depois e quais efeitos de estoque/financeiro podem ocorrer.

### 4.2 Proposta

A proposta suporta peças e materiais, portanto é adequada para orçamento
estruturado de joia ou encomenda. O baseline traz migrations do domínio
`proposals` e `proposal_pieces`.

Ainda não foi comprovado que aprovar uma proposta:

- cria um pedido;
- reserva metal, pedra ou peça acabada;
- cria uma ordem de produção;
- cria um lançamento financeiro;
- conserva um snapshot de preço e materiais.

Esses efeitos devem ser definidos em uma spec de conversão de proposta. Não
implementar a partir de suposição visual.

### 4.3 Pedido

O pedido divide-se em pronta-entrega e personalizado. Esse tipo é decisivo:

| Tipo | Estado inicial observado | Próximo caminho em código | Principal risco |
| --- | --- | --- | --- |
| Pronta entrega | `AGUARDANDO_PAGAMENTO` | pagamento, separação, envio/retirada | não assumir baixa automática em qualquer tela de pedido |
| Personalizado | `AGUARDANDO_APROVACAO_DESIGN` | aprovação pode criar produção | regra de aprovação e materiais precisa preservar snapshot e permissão |

Para pedido personalizado, a aprovação é um ponto crítico. O código mostra
criação de produção dentro de transação quando o pedido é aprovado e possui
detalhe customizado. A operação ainda deve homologar prazo, responsável,
reprovação, alteração pós-aprovação e reserva/baixa de materiais.

## 5. Oficina: ordem de serviço, produção e qualidade

A joalheria tem dois conceitos que não podem ser colapsados sem análise:

- **Ordem de serviço:** reparo, ajuste, manutenção ou trabalho vinculado a
  cliente/pedido/bloco, com materiais e mão de obra.
- **Ordem de produção:** fabricação de uma encomenda, com etapas de oficina e
  status de produção.

O código tem os dois domínios, com rotas e tabelas próprias. A documentação
anterior identificou que um status `OS` em bloco pode gerar somente número de
referência, sem materializar necessariamente `service_orders`. Portanto,
tratar o status de UI como criação de OS é erro de regra.

### Regras que devem ser definidas antes de automatizar oficina

1. Qual evento cria a OS e qual evento cria a ordem de produção.
2. Se um pedido personalizado sempre cria produção, ou se pode ser executado
   como serviço.
3. Como materiais são orçados, aprovados, consumidos, devolvidos ou ajustados.
4. Quem pode pausar, reprovar, concluir e liberar uma peça para entrega.
5. Como custo de material e mão de obra é congelado para margem e financeiro.
6. O que acontece quando a especificação muda depois de iniciada a oficina.

A resposta precisa virar spec, task, migration/contrato e testes. Sem isso, o
ERP corre o risco de produzir uma peça e manter estoque/financeiro divergentes.

## 6. Estoque: a fronteira que não pode ser tratada como configuração

Produtos e movimentos de estoque existem em `products` e
`stock_movements`. Há suporte a entrada, saída e ajuste. O saldo de produto é
um dado de controle e qualquer escrita concorrente deve ocorrer em transação
com o bloqueio adequado.

Existe configuração de `stock_action` em trabalho local, mas **configurar uma
ação não executa estoque**. A entrega baseline não prova uma política unificada
para:

- reserva por proposta;
- reserva por pedido aberto;
- baixa de peça pronta em PDV;
- baixa de insumo em produção/OS;
- estorno, cancelamento, devolução ou retrabalho;
- transferência entre vitrines, oficina e expedição;
- custo e inventário físico.

A primeira evolução segura é escolher, com o negócio, a semântica de cada
evento. Depois, implementar uma única camada transacional de movimento e
reconciliar todos os módulos que a chamam. Criar baixa espalhada em rotas é um
atalho que destrói rastreabilidade.

## 7. Financeiro e pagamentos

O ERP usa valores em centavos inteiros, nunca ponto flutuante. Pedidos, PDV,
pagamentos e lançamentos financeiros se relacionam, mas não são a mesma coisa:

- **Pedido** representa compromisso comercial.
- **Pagamento** representa a tentativa/confirmação de recebimento.
- **Lançamento financeiro** representa o fato financeiro da operação.
- **Comissão** é consequência de regra comercial, não apenas um campo no pedido.

O serviço `order-financial.service.ts` é o ponto de partida ao alterar essa
cadeia. Antes de alterar ou automatizar, homologar:

1. idempotência do webhook de pagamento;
2. pagamento parcial, taxa, desconto, estorno e chargeback;
3. momento de reconhecimento de receita;
4. cancelamento após baixa de estoque;
5. conciliação com Mercado Pago/caixa real;
6. autorização de FINANCEIRO, ADMIN e demais papéis.

Mercado Pago, bancos e conciliação real são **NÃO HOMOLOGADOS** no pacote.

## 8. PDV, loja e entrega

### PDV

O PDV é um caminho de venda de balcão e precisa permanecer transacional:
criação de venda, pagamento, estoque e financeiro precisam ter comportamento
atômico ou compensação explícita. Testar somente a tela não prova isso. O caso
de concorrência de duas vendas da última peça é obrigatório antes de
homologação.

### Loja

A loja expõe catálogo e checkout, com rotas próprias para loja e
configurações. Não assumir que pedido de loja tem o mesmo lifecycle do PDV ou
do pedido interno sem verificar contrato e efeitos. A sincronização de
pagamento e a entrega externa permanecem parciais.

### Entrega

O ERP persiste entregas e aceita status locais. Rastreio e transportadora usam
adapters, portanto credenciais, payloads e retornos externos não entram no
snapshot. A emissão de etiqueta, sincronização de tracking e notificação ao
cliente precisam de homologação por transportadora.

## 9. Gestão, acesso e auditoria

Os papéis declarados no tipo de entidades são `ROOT`, `ADMIN`, `GERENTE`,
`VENDEDOR`, `ATENDENTE`, `PRODUCAO` e `FINANCEIRO`. A permissão efetiva,
contudo, deve ser conferida em cada middleware/rota. A UI pode esconder uma
ação, mas isso não é uma barreira de segurança.

Auditoria existe em middleware e chamadas explícitas, mas a cobertura não foi
demonstrada como universal. Não documentar “audit log imutável em toda escrita”
como fato sem teste por domínio. Para uma mudança de alta criticidade, declarar:

- qual ação gera auditoria;
- quem executou;
- qual entidade e correlação são registradas;
- se dados sensíveis são minimizados;
- como falha de auditoria afeta, ou não, a transação principal.

Veja a matriz de roles e integrações em
[RBAC e integrações](RBAC-E-INTEGRACOES-TECNICO.md).

## 10. Operação técnica e deploy atual

A operação local declarada usa Compose com PostgreSQL, Redis, API, Web, NGINX
e Adminer. A API executa migrations no start. Volumes incluem banco, Redis e
uploads. O diretório `docs` é montado como somente leitura na API.

O fluxo de deploy observado no workflow é:

```text
push main → GitHub Actions → build Docker → GHCR
→ SSH Hostinger → docker compose pull → docker compose up --no-build
```

No deploy, a Action extrai `/app/docs` da imagem da API e atualiza os docs do
host para que o bind mount não mantenha documentação antiga. Isso é uma
característica relevante do fluxo atual.

Este processo é **referência de assunção**, não obrigação futura. O novo
responsável pode adotar outro GitFlow, CI/CD, registry, host ou mecanismo de
deploy, desde que trate migração, rollback, backup e secrets como requisitos
explícitos.

## 11. Checklist de uma mudança segura por domínio

| Tipo de mudança | Antes de codificar | Evidência mínima para encerrar |
| --- | --- | --- |
| Regra comercial | spec, dono da decisão, exceções e efeito em estoque/financeiro | teste de cenário normal, falha e autorização |
| Schema | migration reversível quando aplicável, dados existentes e índices | migration em banco limpo e banco representativo autorizado |
| API | contrato, RBAC, erros e idempotência | testes HTTP autenticado e negativo |
| UI | fluxo, estados vazio/carregando/erro e permissão | browser autenticado contra API atual |
| Integração | contrato externo, secret, timeout, retry e idempotência | sandbox/provedor real autorizado e evidência de webhook |
| Estoque/financeiro | evento canônico, transação, lock e compensação | concorrência, rollback, reconciliação e auditoria |
| Deploy | imagem, migration, backup, rollback e observabilidade | execução controlada e health checks pós-deploy |

## 12. Onde aprofundar

- [Fluxo operacional ponta a ponta](FLUXO-OPERACIONAL-END-TO-END.md): transições
  confirmadas e riscos de negócio.
- [Dossiês operacionais](MODULE-OPERATING-DOSSIERS.md): módulo, tela, rota,
  persistência, estado e permissão.
- [Banco](BANCO-ENTIDADES-E-RELACIONAMENTOS.md): entidades e relações.
- [API](API-INVENTARIO-DE-NEGOCIO.md) e [catálogo de rotas](API-ROUTE-CATALOG.md):
  contratos e superfície HTTP.
- [Estoque, financeiro e PDV](ESTOQUE-FINANCEIRO-PDV-TECNICO.md): dados críticos.
- [Runbook](OPERATIONS-RUNBOOK.md): operação, logs, deploy e recuperação.
- [QA e gaps](QA-E-GAPS-PRD-CODIGO.md): o que não pode ser promovido a pronto.

## Conclusão operacional

O ORION já possui a forma de um ERP de joalheria. O trabalho responsável agora
não é chamar todo módulo de pronto: é consolidar os eventos canônicos que ligam
CRM, venda, oficina, estoque e financeiro, e homologá-los em operação. Essa é
a diferença entre uma interface abrangente e um ERP confiável.
