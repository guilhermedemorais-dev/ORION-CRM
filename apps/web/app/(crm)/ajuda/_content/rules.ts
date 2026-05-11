export const rulesContent = {
    id: 'regras',
    title: 'Regras de pipeline (handoff entre setores)',
    group: 'Operação',
    body: `
# Regras de pipeline

As **regras** automatizam o handoff entre setores. Quando um card entra numa etapa específica, a regra dispara e algo acontece em outro pipeline.

## Exemplo prático
"Quando um lead em **Comercial** entrar na etapa **Convertido**, crie automaticamente um card em **Produção / Backlog**."

Resultado: o atendente arrasta o card pra "Convertido", e em segundos a produção já vê uma tarefa nova no quadro deles. O card original fica no Comercial como histórico daquele atendimento.

## Como criar uma regra
1. Abra a configuração de pipeline (lápis na barra lateral).
2. Vá na aba **Regras**.
3. No formulário à direita, preencha:
   - **Nome**: descreva a regra. Ex: "Convertido → Produção"
   - **QUANDO**: pipeline atual (já vem preenchido) + etapa de origem.
   - **Ação**: escolha o que fazer (ver tipos abaixo).
   - **Pipeline destino** + **Stage destino**: onde a regra age.
4. Clique em **Criar regra**.

## Tipos de ação
- **Gerar card no setor destino (recomendado)**: mantém o card aqui como histórico e cria um novo card vinculado no destino. **Use para handoff entre setores.**
- **Mover card (sai daqui)**: o card sai deste pipeline e vai para o destino. Use quando o card só faz sentido em um lugar de cada vez.
- **Espelhar card (sincronizado)**: cópia sincronizada. Alterações refletem nos dois.

## Quando a regra dispara
- Quando um card **entra** numa etapa que é origem da regra. Ou seja: você arrasta o card ou move ele via WhatsApp/automação para a etapa de origem → a regra dispara.
- **Não dispara retroativamente.** Se você criou a regra agora e o card já estava na etapa, a regra não vai disparar até alguém mover o card pra fora e voltar.
- **Não dispara em loop.** O sistema lembra que aquela regra já agiu naquele card e não cria card duplicado.

## Como testar
1. Crie a regra.
2. Pegue um card existente, arraste pra fora da etapa de origem, depois arraste de volta pra dentro.
3. Vá no pipeline destino — deve aparecer um card novo (ou o card movido, conforme a ação).

## Regras importantes
- Um card no Comercial só gera **um** card em cada destino, mesmo que volte várias vezes à etapa. Isso evita pedidos duplicados.
- O card criado no destino traz o **mesmo cliente, nome, WhatsApp, valor estimado e observações** do card original.
- Se você desativar uma regra (botão de energia), ela para de disparar mas as conexões antigas continuam funcionando.

## Quem pode criar regras
ROOT, ADMIN e usuários com permissão "configurar pipeline".
`.trim(),
};
