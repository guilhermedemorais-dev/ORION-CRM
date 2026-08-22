# Identidade de Produto e Terminologia, ORION ERP para Joalherias

## Decisão vigente

A partir desta entrega, o nome do produto é **ORION ERP para Joalherias**.

O ORION é um ERP vertical que integra relacionamento, atendimento, venda, pedido, oficina, produção, estoque, financeiro, entrega, gestão e suporte. **CRM é um módulo do ERP**, responsável pela captação, pipeline, clientes, relacionamento e parte da agenda e Inbox. CRM não descreve o produto inteiro.

## Terminologia obrigatória em documentação ativa

| Contexto | Termo correto |
| --- | --- |
| Nome do produto | ORION ERP para Joalherias |
| Forma curta | ORION ERP |
| Domínio comercial/relacionamento | CRM |
| Sistema em sentido amplo | ERP |
| Nome do repositório, imagens e identificadores legados | `ORION-CRM`, somente quando for identificador técnico/histórico |
| URL e namespace existentes | preservar até decisão de migração de infraestrutura |

Exemplos:

- Correto: “O ORION ERP possui o módulo CRM.”
- Incorreto: “O ORION CRM é o sistema completo de produção, estoque e financeiro.”
- Correto: “A imagem histórica é `ghcr.io/.../orion-crm/api`.”
- Incorreto: renomear URL, imagem, schema ou branch apenas por alteração de marca documental.

## Escopo desta correção

A correção alcança documentos **ativos e canônicos**:

- `README.md`, `README-DEPLOY.md` e índices de `docs/`;
- PRDs e guias em `docs/product/`;
- módulos ativos em `docs/modules/`;
- arquitetura, operações, releases e roadmap ativos.

Ela não reescreve evidência histórica de forma silenciosa:

- documentos em diretórios `archive/`;
- relatórios de QA e auditorias datados;
- tasks, specs e handoffs que citam uma evidência antiga;
- nomes de arquivos, commit SHA, repositório, imagens, URLs, schemas e rotas.

Quando uma referência histórica puder confundir o leitor, o documento ativo deve apontar esta política. Preservar o texto histórico não significa manter o produto posicionado como CRM.

## Governança para mudanças futuras

1. Todo novo documento usa “ORION ERP para Joalherias” no título ou “ORION ERP” quando o contexto já estiver definido.
2. Um documento de módulo pode usar CRM somente para o módulo CRM.
3. Uma mudança de regra de negócio continua exigindo spec, task e aprovação; esta correção altera nomenclatura e documentação, não contratos de negócio.
4. Mudança de identificadores técnicos exige decisão específica de migração, plano de compatibilidade e validação de CI/CD, deploy e integrações.
5. Relatórios e arquivos históricos permanecem rastreáveis; não devem ser apresentados como a documentação vigente sem seu contexto temporal.

## Fonte de decisão

Correção explícita do responsável do produto em 2026-08-22: o ORION não deve ser apresentado como CRM, e sim como ERP completo para gestão de joalheria.
