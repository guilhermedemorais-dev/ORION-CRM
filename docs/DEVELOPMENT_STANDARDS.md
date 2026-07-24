# Padrões de Desenvolvimento

Este arquivo é o índice das regras de engenharia. Regras detalhadas permanecem
em `AGENTS.md`, nos PRDs e nas instruções locais em `.project-ai/`.

## Fontes de Verdade

1. PRD geral e PRD do módulo.
2. Mockup aprovado, quando houver interface.
3. Decisões arquiteturais registradas.
4. Código e testes existentes, desde que não contrariem os documentos acima.

Conflitos entre essas fontes devem ser reportados antes da implementação.

## Regras Obrigatórias

- TypeScript estrito, sem `any` ou `@ts-ignore`.
- Valores monetários em inteiros de centavos.
- SQL parametrizado e transações nas operações críticas.
- RBAC e audit log em operações protegidas e de escrita.
- Webhooks validados e processados de forma assíncrona com BullMQ.
- React Query para dados remotos e Zod com React Hook Form para formulários.
- Estados de loading, vazio e erro em toda interface orientada a dados.
- Secrets somente em variáveis de ambiente e dados sensíveis fora dos logs.
- Runtime canônico: `docker compose` a partir da raiz.

## Definition of Done

- Critérios de aceitação atendidos.
- Testes permitidos e negados de RBAC quando aplicável.
- Typecheck e testes relevantes aprovados.
- UI verificada em runtime e contra o mockup, quando alterada.
- Documentação e rastreabilidade atualizadas.
- Lacunas não validadas declaradas explicitamente.

