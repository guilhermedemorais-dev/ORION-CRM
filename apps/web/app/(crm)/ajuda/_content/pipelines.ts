export const pipelinesContent = {
    id: 'pipelines',
    title: 'Pipelines (setores)',
    group: 'Operação',
    body: `
# Pipelines

Cada **pipeline** representa um **setor** da operação da loja. Você decide quais setores existem e quais etapas tem cada um.

## O que é uma pipeline
É um quadro estilo Kanban com listas (chamadas de **etapas**). Cada card é uma tarefa — geralmente representa um cliente passando por aquele setor.

Exemplos típicos:
- **Leads**: Novo → Qualificado → Proposta Enviada → Negociação → Convertido → Perdido
- **Produção**: Backlog → Em Desenho → Em Produção → Pronto
- **Entrega**: Aguardando → Em Rota → Entregue

Cada pipeline funciona separado. Quem trabalha em Produção não precisa ver os leads do Comercial.

## Como criar uma pipeline
1. Na barra lateral, clique em **Configurar kanban** (ou no lápis ao lado de uma pipeline existente).
2. Na aba **Etapas**, dê um nome para a etapa, escolha a cor e clique em **Adicionar etapa**.
3. Marque **Ganho** ou **Perda** na etapa final (etapa de Ganho fecha a venda; etapa de Perda arquiva o card).
4. Use as setinhas ↑ ↓ para reordenar.
5. Clique em **Salvar ordem** quando terminar de mexer na ordem.

## Como editar uma etapa
Mesma aba **Etapas**. Mude nome ou cor no campo, clique em **Salvar** ao lado.

## Quem pode configurar
Só usuários **ROOT** e **ADMIN** veem o ícone do lápis e a opção **Configurar kanban**. Os outros usuários apenas visualizam e usam os cards.

## Dicas
- Não exclua a etapa de Ganho ou Perda — elas são usadas pelas regras de automação.
- O nome da etapa aparece no card e nos relatórios. Use nomes curtos e claros.
- Se duas pipelines têm a mesma etapa "Novo", tudo bem — etapas pertencem ao pipeline, não são globais.
`.trim(),
};
