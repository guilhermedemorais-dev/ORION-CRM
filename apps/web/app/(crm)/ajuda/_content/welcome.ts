export const welcomeContent = {
    id: 'bem-vindo',
    title: 'Bem-vindo',
    group: 'Início',
    body: `
# Central de Ajuda

Esta é a sua referência rápida para usar o sistema. Cada módulo do CRM tem uma seção aqui explicando **o que faz, como usar e as regras importantes**.

## Como navegar
- Use a lista à esquerda para escolher o módulo.
- Cada seção é independente: leia só o que precisa no momento.
- Quando uma tela tiver o ícone **?**, ele abre a explicação contextual daquele módulo direto.

## Sobre o sistema
O CRM é organizado em **setores** (pipelines) que conversam entre si:

- **Comercial (Leads)**: onde o lead chega pelo WhatsApp ou cadastro manual e passa pelas etapas do funil até virar venda.
- **Produção**: recebe automaticamente o que o Comercial fecha, para fazer a peça.
- **Entrega**: recebe a peça pronta e despacha pro cliente.

Cada setor tem **seu próprio kanban** com etapas internas. As regras de pipeline ligam um setor ao outro: quando um card chega numa etapa final do Comercial, um card novo aparece automaticamente em Produção.

## Conceito-chave: a ficha do cliente é a verdade
O kanban mostra **tarefas visuais** (cards). A informação real do cliente vive na **ficha do cliente** — agenda, atendimento, proposta, pedidos, OS, entrega, histórico, caixa. Sempre que precisar de detalhes, clique no card e abra a ficha.

## Para quem é cada coisa
- **Atendente**: comercial — atende WhatsApp, marca agenda, envia proposta, fecha venda no caixa.
- **Produção**: oficina — vê OS, atualiza etapas, baixa matéria-prima.
- **Gerente**: tem acesso ao financeiro e ao "cofre" (caixa primário que confere os caixas dos atendentes).
- **Admin / Root**: configura tudo (usuários, pipelines, regras, integrações).
`.trim(),
};
