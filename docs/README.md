# Documentação do ORION ERP para Joalherias

Este diretório é a única raiz canônica da documentação do projeto. O produto é
**ORION ERP para Joalherias**, com CRM como um de seus domínios.

Para entender os processos de negócio antes de ler documentos de requisito
históricos, consulte [`handoff/ERP-OPERATING-MANUAL.md`](handoff/ERP-OPERATING-MANUAL.md).
Para a regra de nomenclatura, identificadores legados e limite entre ERP e CRM,
consulte [`product/ORION-ERP-PRODUCT-IDENTITY.md`](product/ORION-ERP-PRODUCT-IDENTITY.md).

## Ordem de Leitura Obrigatória

1. [`product/ORION-CRM-PRD-v1.2.md`](product/ORION-CRM-PRD-v1.2.md)
2. [`product/ORION-BUILD-GUIDE.md`](product/ORION-BUILD-GUIDE.md)
3. [`product/ORION-Fase0-PRD.md`](product/ORION-Fase0-PRD.md)
4. PRD canônico do módulo em `modules/<module>/`
5. Specs aprovadas em `specs/<module>/<feature>/`
6. Task executável correspondente em `tasks/`
7. Mockups correspondentes em `design/mockups/<module>/`

## Fluxo Oficial de Trabalho

O projeto usa o fluxo do plugin
[`Dev-workflow`](https://github.com/guilhermedemorais-dev/Dev-workflow):

```text
demanda -> spec -> task -> aprovação -> implementação -> PR -> QA/revisão
```

Papéis:

- `dev-workflow-standard`: orquestra escopo, riscos, delegação e revisão final.
- `sdd-spec-factory`: cria specs e task executável.
- `dev-implementation-standard`: implementa somente a task aprovada.
- `ui-ux-standard`: valida UI quando houver tela, componente ou estado visual.
- `security-standard`: valida auth, permissões, dados sensíveis, uploads,
  pagamentos, webhooks, tenant, tokens e integrações externas.

Qualquer pessoa que for trabalhar neste projeto deve baixar o repositório completo
do plugin acima antes de executar tasks que dependem desse fluxo.

## Índice

- `product/`: PRDs gerais e guia central de construção.
- `modules/`: requisitos, especificações e planos por domínio.
- `specs/`: specs novas por módulo e feature, geradas antes da task.
- `tasks/`: tarefas executáveis para devs/agentes, sempre ligadas a specs.
- `design/`: design system e mockups obrigatórios.
- `architecture/`: visão arquitetural e decisões técnicas.
- `qa/reports/`: auditorias e evidências de validação.
- `roadmap/`: planejamento e rastreabilidade.
- `operations/`: ambiente, deploy e runbooks.
- `.project-ai/`: instruções e prompts para agentes de IA.

## Regras

- Consulte [`DEVELOPMENT_STANDARDS.md`](DEVELOPMENT_STANDARDS.md) antes de desenvolver.
- Siga [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md) para features.
- Siga [`BUG_FIX_PROTOCOL.md`](BUG_FIX_PROTOCOL.md) para correções.
- Use [`COMPONENT_STANDARDS.md`](COMPONENT_STANDARDS.md) em mudanças de UI.
- Não implemente trabalho não trivial sem spec em `specs/` e task em `tasks/`.
- Não altere requisitos de PRD durante reorganizações documentais.
- Um módulo deve declarar explicitamente seu documento canônico.
