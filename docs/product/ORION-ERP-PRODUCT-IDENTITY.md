# Identidade de Produto e Terminologia, ORION ERP para Joalherias

## Decisão vigente

A partir desta decisão, o nome do produto é **ORION ERP para Joalherias**.

O ORION é um ERP vertical que integra relacionamento, atendimento, venda, pedido, oficina, produção, estoque, financeiro, entrega, gestão e suporte. **CRM é um módulo do ERP**, responsável pela captação, pipeline, clientes, relacionamento e parte da agenda e Inbox. CRM não descreve o produto inteiro.

## Terminologia obrigatória em documentação ativa

| Contexto | Termo correto |
| --- | --- |
| Nome do produto | ORION ERP para Joalherias |
| Forma curta | ORION ERP |
| Domínio comercial/relacionamento | CRM |
| Sistema em sentido amplo | ERP |

Exemplos:

- Correto: “O ORION ERP possui o módulo CRM.”
- Incorreto: “O ORION CRM é o sistema completo de produção, estoque e financeiro.”

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
- commit SHA, schemas e rotas que fazem parte da evidência técnica.

Quando uma referência histórica puder confundir o leitor, o documento ativo deve apontar esta política. Preservar o texto histórico não significa manter o produto posicionado como CRM.

## Governança para mudanças futuras

1. Todo novo documento usa “ORION ERP para Joalherias” no título ou “ORION ERP” quando o contexto já estiver definido.
2. Um documento de módulo pode usar CRM somente para o módulo CRM.
3. Uma mudança de regra de negócio continua exigindo spec, task e aprovação; esta correção altera nomenclatura e documentação, não contratos de negócio.
4. Relatórios e arquivos históricos permanecem rastreáveis; não devem ser apresentados como a documentação vigente sem seu contexto temporal.

## Fonte de decisão

Correção explícita do responsável do produto em 2026-08-22: o ORION não deve ser apresentado como CRM, e sim como ERP completo para gestão de joalheria.
