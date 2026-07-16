# Spec: Exportacao de incidentes do suporte

## Status
Aprovada para implementacao no escopo minimo.

## Objetivo
Permitir que usuarios `ROOT` ou `ADMIN` baixem incidentes registrados em
Suporte, individualmente ou em lote, com descricoes e prints/anexos, para
revisao externa e conversao em tasks de backlog.

## Escopo incluido
- Selecionar incidentes individualmente na aba `Suporte -> Incidentes`.
- Selecionar todos os incidentes carregados na lista.
- Baixar todos os relatos do tipo `BUG` tambem pela aba `Suporte -> Debug ao vivo`.
- Baixar um pacote `.zip`.
- Incluir no pacote:
  - `incidents.md`, com todos os relatos em Markdown.
  - pasta `attachments/`, com os arquivos anexados aos incidentes.
- Registrar auditoria da exportacao.

## Fora de escopo
- Criar tasks automaticamente no GitHub/board.
- Alterar o modelo da tabela `system_tickets`.
- Exportar comentarios do roadmap.
- Gerar PDF.
- Exportar incidentes de outros tenants, porque o runtime do CRM e single-tenant.

## Banco
Sem migration. Usa `system_tickets.attachments` existente.

## API/Backend
Novo endpoint:

```text
POST /api/v1/tickets/export
Auth: ROOT ou ADMIN
Body:
  { "mode": "all" }
  ou
  { "mode": "selected", "ticketIds": ["uuid"] }
  ou
  { "mode": "all", "type": "BUG" }
Response:
  application/zip
```

## Frontend/UI
Na aba `Incidentes`, usuarios `ROOT` ou `ADMIN` veem:
- checkbox por incidente;
- checkbox/acao de selecionar todos;
- botao `Baixar selecionados`;
- botao `Baixar tudo`;
- estado de carregamento e erro.

Na aba `Debug ao vivo`, usuario `ROOT` ve:
- botao `Baixar bugs relatados`, que exporta apenas tickets `BUG`.

## Seguranca
- Endpoint protegido por `authenticate` + `requireRole(['ROOT', 'ADMIN'])`.
- Caminhos de anexos devem ser resolvidos dentro de `UPLOAD_PATH`.
- Nao aceitar path traversal.
- Nao exportar arquivos inexistentes como erro fatal; registrar no Markdown como anexo ausente.

## Criterios de aceite
- Baixar selecionados gera `.zip` com `incidents.md` e anexos dos incidentes escolhidos.
- Baixar tudo gera `.zip` com todos os incidentes visiveis para admin/root.
- Baixar bugs relatados gera `.zip` apenas com tickets de tipo `BUG`.
- Markdown referencia os anexos locais dentro do pacote.
- Anexos inexistentes nao quebram a exportacao.
- Resposta preserva `Content-Disposition` para download no browser.
