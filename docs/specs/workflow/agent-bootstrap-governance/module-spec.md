# Spec: Governanca do bootstrap de agentes

## Status
Discovery / SDD

## Objetivo
Conferir e transformar o prompt de governanca em um contrato operacional
executavel para agentes e devs, sem aplicar mudancas de produto nem iniciar
implementacao.

## Contexto
O repo usa `AGENTS.md`, `CODEX.md`, `CLAUDE.md` e `Gemini.md` como bootstrap
curto para agentes. O objetivo desta spec e validar se esse prompt esta forte o
suficiente para impedir implementacao por conversa solta e preparar uma task
rastreavel em GitHub Issue/Projects.

## Escopo incluido
- Conferir clareza, completude, ambiguidade e risco operacional do prompt.
- Garantir que o fluxo `demanda -> spec -> task -> aprovacao -> implementacao`
  esteja refletido no material de agente.
- Criar uma task documental para revisao futura.
- Preparar corpo de issue GitHub com status, labels sugeridas, branch e
  criterios de aceite.

## Fora de escopo
- Alterar regra de negocio do ORION CRM.
- Implementar codigo em `apps/web`, `apps/api`, migrations ou contratos.
- Reescrever PRDs canonicos em `docs/product/` ou `docs/modules/`.
- Criar endpoint, schema, webhook, tela, permissao ou integracao.

## Banco
N/A. Esta spec e documental e de workflow. Nenhuma tabela, migration ou dado
deve ser alterado.

## API/Backend
N/A. Nenhum endpoint, service, job, webhook ou contrato de API deve ser criado
ou alterado.

## Frontend/UI
N/A. Nenhuma tela ou componente deve ser alterado.

## Testes
- Revisao documental cruzada entre `AGENTS.md`, `CODEX.md`, `CLAUDE.md`,
  `Gemini.md`, `docs/README.md`, `docs/DEVELOPMENT_WORKFLOW.md` e
  `docs/tasks/README.md`.
- Verificar se a task final separa status por Banco, API/Backend,
  Frontend/UI, Validacao e Riscos/Lacunas.
- Verificar que nenhum artefato de produto foi alterado.

## Seguranca
- O prompt deve manter bloqueio explicito para auth, permissoes, dados
  sensiveis, tokens, uploads, webhooks, pagamentos e integracoes externas.
- A task deve exigir `security-standard` quando qualquer item acima entrar em
  escopo.
- Nao registrar secrets, tokens ou dados sensiveis no corpo da issue.

## Observabilidade/logs
N/A para runtime. Para rastreabilidade, a task deve registrar:
- Issue GitHub vinculada, quando criada.
- Status Kanban sugerido.
- Labels sugeridas.
- Evidencias esperadas no PR ou na revisao documental.

## Decisoes pendentes
- Confirmar se a Issue deve entrar manualmente no GitHub Projects ou se sera
  feito por automacao externa, porque a ferramenta atual disponivel cria Issue,
  mas nao expõe operacao direta para adicionar ao Project.
- Confirmar se a revisao final deve atualizar os arquivos de bootstrap ou
  apenas registrar lacunas.

## Riscos
- Criar uma task generica demais e permitir implementacao fora de escopo.
- Duplicar regras em varios arquivos e voltar a gastar contexto demais.
- Marcar como pronto no GitHub sem validacao documental real.
- Confundir "conferir prompt" com "aplicar mudanca no produto".

## Criterios de aceite
- Existe uma task executavel em `docs/tasks/` ligada a esta spec.
- A task deixa explicito que nao ha implementacao de produto autorizada.
- A task contem prompt para executor, condicoes de parada, validacao e riscos.
- A issue GitHub, se criada, aponta para a task/spec e fica pronta para
  GitHub Projects.
- Qualquer lacuna de Project/automacao e marcada como `NAO VALIDADO`, nao
  presumida.
