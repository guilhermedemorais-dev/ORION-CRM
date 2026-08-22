# Spec: Base Técnica de Suporte

## Status

`IMPLEMENTADA, NÃO HOMOLOGADA`. A documentação Markdown é fonte canônica. A
execução está vinculada à task `docs/tasks/TASK-062-support-base-tecnica.md` e
à issue #62; o escopo é limitado à leitura allowlisted, busca server-side e
proteção exclusiva para ADMIN. A matriz HTTP da exportação confirmou backend;
browser autenticado e produção permanecem pendentes.

## Objetivo

Permitir que desenvolvedores de suporte autorizados consultem arquitetura,
fluxos, API, banco, módulos, RBAC, operações, QA e riscos sem depender de
conhecimento oral, renderizando documentos canônicos do repositório.

## Escopo incluído

- Entrada de navegação Suporte → Base Técnica.
- Leitura de documentos allowlisted em `docs/handoff/` e documentação canônica
  referenciada, sem duplicar conteúdo em banco.
- Busca por módulo, endpoint, tabela, service, rota, erro e integração.
- Proteção frontend e backend exclusivamente para `ADMIN`.

## Fora de escopo

- Editar documentação pela UI.
- Indexar arquivos fora da allowlist ou dados de clientes.
- Expor secrets, paths do host, logs brutos ou artefatos de produção.
- Alterar fluxos de suporte/incidentes existentes.

## Banco

N/A inicialmente. Índice em memória/arquivo derivado somente pode ser incluído
se a performance exigir e se a spec derivada definir rebuild, autorização e
retenção. Não persistir cópia da documentação em banco sem decisão humana.

## API/Backend

Contratos implementados:

| Entrada | Auth | Resposta | Controle obrigatório |
| --- | --- | --- | --- |
| `GET /api/v1/support/technical/docs/:id` | ADMIN | Markdown metadados + conteúdo seguro | id allowlisted, sem path fornecido pelo usuário |
| `GET /api/v1/support/technical/search?q=` | ADMIN | hits com id/título/trecho | índice allowlisted, limite, sem leitura arbitrária |

Erros: 401 sem token, 403 role inválida, 404 id permitido inexistente, 400 query
inválida. A implementação registra metadados pelo logger de requisição e não
persiste conteúdo. Não há evidência de escrita específica em `audit_logs` para
essa leitura; caso auditoria persistente seja requisito, ela exige nova task.

## Frontend/UI

Página com índice, busca, conteúdo Markdown, loading, vazio, erro com retry e
estado 403 seguro. Não renderizar HTML arbitrário de Markdown. O menu não é
controle de acesso: página e API devem negar inclusive `ROOT` e demais usuários
não `ADMIN`.

Mockup de referência: `docs/design/mockups/suporte/base-tecnica.html`. Ele
estabelece shell de três colunas no desktop, índice responsivo, busca, conteúdo
e estado proibido. Reutilizar os componentes/tokens existentes; o CSS do mockup
não é código de produção.

## Matriz de interação

| Interação | Quem | Chamada | Sucesso | Erro/negativo |
| --- | --- | --- | --- | --- |
| Abrir Base Técnica | ADMIN | carregar índice | primeiro doc ou vazio | 403/erro sem conteúdo |
| Escolher documento | ADMIN | GET doc allowlisted | renderer atualizado | 404/retry |
| Buscar | ADMIN | GET search | hits navegáveis | query inválida/sem resultados |

## Segurança

| Surface | Asset | Regra | Controle | Teste obrigatório |
| --- | --- | --- | --- | --- |
| UI | documentação técnica | apenas ADMIN | guard de sessão/role explícito | ROOT/ATENDENTE/GERENTE/FINANCEIRO recebem estado proibido |
| API | conteúdo Markdown | apenas ADMIN | `authenticate` + guarda que não herda bypass ROOT | 403 sem payload |
| Leitor | filesystem | nenhuma entrada vira caminho | allowlist fechada | `../`, absoluto e symlink recusados |
| Render | browser | Markdown confiável, sem HTML executável | sanitização/desabilitar HTML | script não executa |

## Observabilidade

Registrar usuário, id lógico do documento, termo de busca normalizado, status e
request ID. Nunca registrar conteúdo integral, tokens ou dados de cliente.

## Riscos e decisões pendentes

- O `requireRole` atual libera ROOT globalmente; a Base Técnica exige guarda
  específica para ADMIN, caso contrário o requisito explícito é violado.
- Busca deve começar server-side sem índice persistente, sobre allowlist pequena;
  índice derivado é decisão futura se houver evidência de performance.
- **REQUIRED:** revisar UI com `ui-ux-standard` e segurança com
  `security-standard` antes de Ready for Dev.

## Gates de implementação

| Gate | Status | Evidência | Bloqueia |
| --- | --- | --- | --- |
| Ambiguidade | PASS | IDs allowlisted, papéis e fontes estão definidos | não |
| Completude da spec | PASS | escopo, exclusões, contratos, estados e aceite definidos | não |
| UI Interaction Contract | PASS | matriz abaixo e mockup de suporte | não |
| Backend Contract | PASS | índice, doc e busca com entradas/erros definidos | não |
| Security Spec Contract | PASS | matriz de superfície e testes negativos abaixo | não |
| Traceability | PASS | TASK-062, issue #62 e documentos canônicos vinculados | não |
| Minimal Implementation Gate | EXCEÇÃO HUMANA | solicitação explícita do usuário; somente dependências existentes | não |

## UI Interaction Matrix

| ID | Tela/elemento | Ação | Condição | Efeito/estados | Segurança | Runtime |
| --- | --- | --- | --- | --- | --- | --- |
| UI-01 | Sidebar | abrir Base Técnica | ADMIN | navega; loading/erro | item não aparece para não-ADMIN | NÃO VALIDADO |
| UI-02 | Índice | selecionar documento | ADMIN | conteúdo, skeleton, 404/retry | usa apenas ID lógico | NÃO VALIDADO |
| UI-03 | Busca | digitar termo válido | ADMIN | resultados, vazio, erro/retry | termo não vira path/HTML | NÃO VALIDADO |
| UI-04 | Página | acessar sem ADMIN | ROOT e demais | estado 403 seguro | nenhum conteúdo no DOM | NÃO VALIDADO |

## Security Spec Contract

| Surface | Asset | Input controlado | Regra de ator | Controle obrigatório | Teste negativo | Bloqueia |
| --- | --- | --- | --- | --- | --- | --- |
| API docs | Markdown técnico | `:id` | somente ADMIN | mapa fechado de IDs, sem path | `..`, absoluto e id inválido sem conteúdo | sim |
| API busca | índice/documentos | `q` | somente ADMIN | tamanho, normalização, allowlist | busca curta/malformada e sem resultado | sim |
| Autorização | conteúdo interno | JWT/role | ROOT não é ADMIN aqui | guarda explícita `role === 'ADMIN'` | 401 e 403 por role | sim |
| Renderer | browser | Markdown | ADMIN | HTML bruto desativado/sanitizado | script/HTML não executa | sim |
| Observabilidade | request/log | query/id | sem conteúdo sensível | logs apenas de metadados | revisão de saída | sim |

## Critérios de aceite futuros

- Usuário não autorizado não vê nem recebe documentos ou resultados.
- Toda página vem de documento canônico allowlisted, sem cópia em banco.
- Busca encontra termos técnicos autorizados e não permite path traversal.
- Estado de documento ausente, busca vazia e erro de leitura são compreensíveis.
