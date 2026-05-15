export const bancoDadosContent = {
    id: 'banco-dados',
    title: 'Banco de Dados (uso interno)',
    group: 'Ajustes',
    body: `
# Banco de Dados

Aba interna em **Ajustes → Banco de Dados**, restrita ao usuário **ROOT**. Serve para administrar o banco diretamente pela interface, sem precisar de acesso SSH ao servidor.

## Quando usar

- **Zerar dados** antes do cliente começar a operação real (limpar dados de teste)
- **Fazer backup** antes de uma alteração grande
- **Exportar** dados de uma tabela específica (ex: lista de clientes para Excel)

## O que aparece na tela

- Lista de todas as tabelas do banco (61 ao total no projeto atual)
- Para cada uma: nome, quantidade de registros, tamanho em disco
- Selo **PROTEGIDA** nas tabelas que são preservadas em "Apagar tudo"
- Filtro por nome e opção "Apenas com dados" (esconde tabelas vazias)

## Ações por tabela

- **CSV** — baixa arquivo CSV (abre no Excel, sem estrutura)
- **SQL** — baixa arquivo .sql com INSERTs (para restaurar no mesmo Postgres)
- **Apagar** — TRUNCATE da tabela com confirmação digitada

## Ações globais (botões no topo)

- **Exportar tudo (.sql)** — gera dump completo de todas as tabelas com INSERTs, em transação. Pode restaurar tudo rodando esse SQL.
- **Apagar tudo** — apaga registros de todas as tabelas, exceto 3 que são preservadas:
  - \`users\` — pra você não perder o login
  - \`settings\` — pra preservar config da loja
  - \`_migrations\` — pra preservar histórico de versões do banco

## Como apagar uma tabela

1. Clica no botão **Apagar** ao lado da tabela
2. Aparece um modal mostrando quantos registros vão sair
3. Digite o **nome exato da tabela** no campo (ex: \`leads\`)
4. Clica em **Apagar tabela**

A operação usa **TRUNCATE CASCADE**, então tabelas que dependem desta (via foreign key) também são zeradas. Por isso a confirmação é obrigatória.

## Como apagar tudo

1. Clica em **Apagar tudo** no topo
2. Modal explica o que vai acontecer
3. Digite **APAGAR TUDO** (exatamente assim, em maiúsculas) no campo
4. Confirma

## Boas práticas

- **Sempre exporte** antes de apagar. O dump fica salvo no seu computador.
- **Apagar tudo** é o caminho rápido pra zerar pro cliente começar a usar. Mas teste em local antes de fazer em produção.
- Cada operação fica registrada no **audit log** (você pode auditar quem fez o quê).

## Tabelas protegidas (não saem em "Apagar tudo")

| Tabela | Por quê |
|---|---|
| \`users\` | Você perderia o login |
| \`settings\` | Perderia config da loja (nome, logo, cores) |
| \`_migrations\` | Sistema acharia que precisa rodar todas as migrations de novo |

Se quiser apagar uma dessas, **clica no botão Apagar individual** da tabela. Mas pense duas vezes.

## Permissão

Aba só aparece pro ROOT. Outros perfis (ADMIN, GERENTE etc.) não veem nem o link.
`.trim(),
};
