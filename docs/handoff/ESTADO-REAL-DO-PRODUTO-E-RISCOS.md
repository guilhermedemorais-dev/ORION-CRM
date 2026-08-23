# Estado Real do Produto, Riscos e Vulnerabilidades

## Finalidade e regra de leitura

O ORION ERP para Joalherias possui uma base ampla de telas, rotas, migrations e
serviços. A existência de uma tela, endpoint, variável de ambiente ou tabela não
prova que o ciclo de negócio está concluído, integrado ou homologado. Este
documento classifica o estado real observado para orientar manutenção e correção.

Use este documento junto com `QA-E-GAPS-PRD-CODIGO.md`,
`FLUXO-OPERACIONAL-END-TO-END.md` e
`docs/qa/reports/architecture/backend-database-audit.md`. O código é a fonte de
verdade da implementação; a produção só é evidência depois de validação no
ambiente autorizado.

## Legenda de status

| Status | Significado |
| --- | --- |
| IMPLEMENTADO | Há código e contrato identificáveis. Não significa homologação. |
| PARCIAL | Há parte do fluxo, mas faltam transições, contratos, integrações ou tratamento de erro. |
| DEMO/STUB | A interface ou rota demonstra a intenção, mas não conclui o efeito de negócio prometido. |
| NÃO HOMOLOGADO | Não há prova recente de execução ponta a ponta no ambiente real. |
| ACHADO CONFIRMADO | Auditoria ou ferramenta identificou condição concreta, com localização e impacto. |
| REQUER VALIDAÇÃO | Há risco plausível, mas falta reprodução controlada ou teste de regressão. |

## Estado por domínio

| Domínio | Estado real | Evidência e limite atual |
| --- | --- | --- |
| Leads, Pipeline, Clientes e Agenda | IMPLEMENTADO/PARCIAL | Há telas, rotas e migrations. O fluxo operacional correto é WhatsApp → n8n/Lara → Agenda → Pipeline; a integração em runtime não foi homologada. |
| Inbox e WhatsApp | PARCIAL | Inbox, webhook, worker e persistência existem. Meta/WhatsApp, entrega de mensagens e comportamento do worker exigem prova em ambiente integrado. |
| Atendimento | PARCIAL | Blocos e telas existem; fotos de referência não percorrem um upload persistido e HTML rico tem risco de XSS. |
| Propostas, pedidos e PDV | IMPLEMENTADO/PARCIAL | Há criação, status, pagamentos locais e telas. Conversão e efeitos entre módulos ainda não fecham todos os cenários. |
| Produção e OS | IMPLEMENTADO/PARCIAL | Existem ordens, etapas e telas, mas a ligação entre pedido, OS e produção não é um contrato único em todos os cenários. |
| Estoque e financeiro | IMPLEMENTADO/PARCIAL | Migrations, movimentos e telas existem. Reserva, baixa, devolução, conciliação e efeitos transacionais completos precisam de decisão e validação. |
| NF-e e comprovantes | DEMO/STUB | NF-e cria solicitação pendente; comprovante pode abrir `wa.me` ou `mailto:`. Não representam emissão ou envio rastreável. |
| IA 3D e feedback | DEMO/STUB | A IA 3D grava placeholders e o feedback não fecha persistência/leitura real. Não apresentar como funcionalidade concluída. |
| Mercado Pago | PARCIAL/NÃO HOMOLOGADO | Há criação de preferência/link e superfícies de webhook; confirmação, assinatura, idempotência e conciliação real não têm prova ponta a ponta. |
| n8n e automações | PARCIAL/NÃO HOMOLOGADO | Rotas e configuração existem; o `docker-compose.yml` não declara n8n. Workflows, credenciais e execução externa são responsabilidade de ambiente separado. |
| E-commerce e transportadoras | PARCIAL/NÃO HOMOLOGADO | Há catálogo/checkout e pontos de tracking; pagamento, frete e rastreio externos não foram comprovados. |
| Auth, RBAC e suporte | PARCIAL | JWT, refresh, roles e audit logs existem, porém a auditoria encontrou inconsistências de escopo e de tratamento de `ROOT`. |

## Achados funcionais prioritários

| Prioridade | Achado | Impacto | Evidência primária |
| --- | --- | --- | --- |
| P0 | Histórico de cliente usa `type=all`, enquanto o backend não implementa esse contrato. | Timeline pode aparecer vazia. | `backend-database-audit.md`, QA-01 |
| P0 | Histórico WhatsApp consulta schema legado e converte erro SQL em lista vazia. | Conversas existentes podem desaparecer sem diagnóstico. | `backend-database-audit.md`, QA-02 |
| P0 | Rotas de cliente aplicam escopo de carteira de forma desigual. | Dados e edição podem ficar acessíveis fora da carteira. | `backend-database-audit.md`, QA-04 |
| P0 | Conteúdo HTML de atendimento é persistido e renderizado sem sanitização comprovada. | Risco de XSS persistente em sessão autenticada. | `backend-database-audit.md`, QA-14 |
| P1 | `ROOT` não recebe tratamento uniforme em middleware, helpers e Inbox. | Acesso imprevisível, falha operacional ou privilégio desigual. | `backend-database-audit.md`, QA-03 e QA-07 |
| P1 | Painel do cliente consulta `attendance-blocks`, rota não encontrada no catálogo auditado. | Ações de entrega podem falhar silenciosamente. | `backend-database-audit.md`, QA-08 |
| P1 | UI de fotos no atendimento mantém preview, mas não envia arquivo persistível. | Perda silenciosa de referência de atendimento. | `backend-database-audit.md`, QA-09 |
| P1 | Frontend não executa o refresh token rotativo já existente no backend. | Sessão encerra no primeiro `401`. | `backend-database-audit.md`, QA-15 |

## Segurança e dependências

### Achados de código, requerem correção e teste de regressão

1. **P0, XSS persistente potencial em atendimento.** A auditoria identificou
   entrada de HTML em `attendance.routes.ts` e renderização via
   `dangerouslySetInnerHTML` em componentes de atendimento. A correção deve
   definir sanitização no limite de persistência e no ponto de renderização,
   com teste negativo de payload malicioso. Até essa prova, trate como risco
   crítico e não aceite HTML arbitrário de usuário.
2. **P0, controle de acesso inconsistente de clientes.** Algumas rotas aplicam
   ownership e outras não. É uma exposição potencial de dados de clientes até
   que a matriz de permissões seja centralizada e coberta por testes HTTP para
   `ROOT`, `ADMIN`, `GERENTE` e `ATENDENTE`.
3. **P1, política privilegiada divergente.** `ROOT` é liberado no middleware,
   mas não em helpers e serviços. Corrigir sem ampliar permissões por acidente:
   decidir a matriz única, implementá-la e cobrir caminhos negativos.

### Dependências, evidência de `npm audit`

Em 2026-08-22, `npm audit --json --package-lock-only` em `apps/api` reportou
**11 vulnerabilidades**: 1 crítica, 3 altas, 6 moderadas e 1 baixa. O resultado
é uma fotografia do lockfile e precisa ser repetido antes de qualquer release.

| Severidade | Pacotes identificados | Natureza reportada | Ação exigida |
| --- | --- | --- | --- |
| Crítica | `tar` | negação de serviço por parsing de archive; outros advisories de path traversal | atualizar cadeia transitiva, revisar uso de extração e rodar regressão |
| Alta | `brace-expansion`, `path-to-regexp`, `@mapbox/node-pre-gyp` | DoS/ReDoS e cadeia transitiva de `tar` | atualizar lockfile de forma controlada e validar build/testes |
| Moderada | `dompurify`, `express`, `qs`, `bullmq`, `uuid` | XSS/DoS/validação de entrada, conforme advisory transitivo | atualizar e verificar compatibilidade dos pontos de uso |
| Baixa | `body-parser`, `esbuild` | limites de payload ou cenário específico de ambiente | corrigir junto com atualização de dependências |

Não executar `npm audit fix --force` como resposta automática. A atualização
precisa de branch própria, diff do lockfile, typecheck, build, testes e revisão
dos contratos de Express, BullMQ, sanitização e upload.

## Integrações externas: o que existe e o que não está provado

| Integração | Código/configuração encontrada | Não comprovado |
| --- | --- | --- |
| WhatsApp/Meta | webhooks, Inbox, worker e configurações | assinatura em produção, entrega, retries, templates e observabilidade |
| n8n/Lara | endpoints de contexto, slots e criação de agenda | workflow ativo, credenciais, mapeamento de erro e execução ponta a ponta |
| Mercado Pago | preferência/link e webhook | assinatura, confirmação, idempotência, estorno e conciliação |
| SMTP | pontos de envio/configuração | entrega, retry, bounce e monitoramento |
| IA | rotas, providers e configurações | escopo de dados, custos, chave, fallback e resultado útil em produção |
| Transportadoras/ViaCEP | conectores e configurações | contrato real, limites, falhas e rastreio |

## Ordem de correção recomendada

1. Bloquear ou sanitizar HTML de atendimento e corrigir RBAC/escopo de clientes.
2. Corrigir histórico de cliente, query WhatsApp e erros silenciosos.
3. Tornar explícitas no UI as funções DEMO/STUB ou removê-las até conclusão.
4. Fechar o ciclo Agenda → Pipeline e validar WhatsApp/n8n com dados sintéticos.
5. Atualizar dependências vulneráveis em task isolada, com evidência de testes.
6. Homologar pagamento, estoque, financeiro e produção como ciclos completos,
   não como endpoints independentes.

## Limites desta documentação

Esta é uma consolidação de evidências de código, auditorias e `npm audit`; não
é pentest, certificação, aprovação de produção nem prova de que não existam
outros defeitos. Cada correção deve nascer de spec, task e testes de regressão.
