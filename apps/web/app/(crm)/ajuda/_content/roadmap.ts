export const roadmapContent = {
    id: 'roadmap',
    title: 'Roadmap do Projeto',
    group: 'Acompanhamento',
    body: `
# Roadmap do Projeto

A aba **Roadmap** dentro de Suporte é onde o desenvolvimento do sistema é planejado, acompanhado e aprovado. Trabalha em conjunto com a aba **Linha do Tempo** (que mostra o gráfico de atividade e o histórico técnico de versões).

## Para que serve

- **Antes de construir uma funcionalidade**, ela é registrada aqui como um plano com prazo previsto.
- O **cliente** (perfil ADMIN) lê, aprova ou reprova a proposta — sem isso, o desenvolvedor não começa.
- Durante o desenvolvimento, o status muda automaticamente conforme o avanço.
- Quando concluído, o item fica registrado como histórico — mostra o que já foi entregue.

Isso evita retrabalho: o cliente conferiu o plano antes, então sabe que o resultado bate com o que pediu.

## Estrutura de um item

Cada item tem:

- **Título** — frase curta do que é (ex: "Materiais e custo da peça na OS")
- **Descrição** — texto em linguagem simples, explicando para o cliente final
- **Status** — situação atual (planejado / em andamento / concluído / etc.)
- **Prazo previsto** — quando deve ficar pronto
- **Detalhes técnicos** (dropdown opcional) — para quem quiser ver a parte técnica
- **Anexos** — imagens, vídeos ou PDFs (referências, exemplos de design)
- **Comentários** — qualquer pessoa autenticada pode comentar; cliente pode responder, desenvolvedor pode responder de volta (threading)

## Estados possíveis (status)

- **📋 Planejado** — ideia anotada, ainda não foi enviada para aprovação
- **⏳ Aguardando aprovação** — cliente precisa revisar e aprovar
- **✅ Aprovado** — cliente aprovou o plano, desenvolvimento pode começar
- **🔨 Em andamento** — está sendo construído agora
- **⏸️ Parado** — pausado por algum motivo (espera de definição, prioridade, etc.)
- **🎉 Concluído** — entregue e funcionando
- **❌ Reprovado** — cliente reprovou o plano, precisa rever

Quem **muda status manualmente**: apenas ROOT (desenvolvedor).
Quem **aprova ou reprova** o item: ROOT ou ADMIN (cliente).

## Comentários e reações

Cada item tem uma área de comentários. Você (cliente) pode:

- Escrever um comentário simples ("Pode incluir suporte a X?")
- Anexar uma imagem ou vídeo de referência
- Responder a um comentário específico — gera uma resposta indentada

O desenvolvedor pode:

- Responder seus comentários (também em threading)
- **Marcar com 👍 (concordo)** — significa "vou acatar essa sugestão"
- **Marcar com 👎 (não vou seguir)** — significa "essa sugestão não cabe agora ou não faz sentido tecnicamente"

A reação 👎 não é uma ofensa — é uma forma honesta de dizer que aquela ideia não vai entrar. Geralmente vem acompanhada de uma resposta explicando o motivo.

## Badge de notificação

Quando há items **Aguardando aprovação**, aparece um número pequeno dourado ao lado de "Suporte" no menu lateral. É o seu lembrete pra entrar lá e dar OK.

## Itens criados pela IA

Quando o desenvolvedor pede para a IA (Claude) registrar um plano direto no sistema, o item ganha um selo **IA** roxo. Não muda nada na operação — é só pra distinguir do que foi criado manualmente.

## Como o ciclo funciona na prática

1. Desenvolvedor (ou IA) cria um item explicando o que vai fazer → status **⏳ Aguardando aprovação**
2. Você (cliente) lê, comenta dúvidas se tiver, e clica **Aprovar**
3. Status muda para **✅ Aprovado**, desenvolvedor começa
4. Conforme avança, status muda para **🔨 Em andamento**
5. Quando entrega, status muda para **🎉 Concluído**
6. Item fica no histórico, sempre acessível
`.trim(),
};
