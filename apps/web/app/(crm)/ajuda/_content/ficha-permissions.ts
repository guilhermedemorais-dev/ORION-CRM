export const fichaPermissionsContent = {
    id: 'ficha-permissoes',
    title: 'Permissões da ficha do cliente',
    group: 'Ajustes',
    body: `
# Permissões da ficha do cliente

A **ficha do cliente** concentra todas as informações de um cliente — agenda, atendimento, proposta, pedidos, OS, entrega, caixa e histórico. Cada uma dessas seções pode ser ligada ou desligada por usuário.

## Por que isso existe
Nem todo mundo precisa ver tudo:
- O **atendente** comercial precisa ver agenda, atendimento, proposta e caixa.
- O **pessoal da produção** só precisa ver dados básicos do cliente, OS e entrega — não precisa saber quanto a peça custou.
- O **financeiro** vê pedidos, caixa e histórico, mas não precisa ver os detalhes do atendimento.

## Como configurar
1. Vá em **Ajustes**.
2. Abra o usuário que quer editar (ou clique em **Convidar novo usuário**).
3. Role até a seção **Visibilidade da Ficha do Cliente**.
4. Ligue ou desligue cada aba:
   - **Agenda** — calendário e compromissos
   - **Ficha** — dados básicos (nome, telefone, endereço, CPF)
   - **Atendimento** — histórico de conversas e blocos de atendimento
   - **Proposta** — propostas comerciais enviadas
   - **Pedidos** — pedidos formais e status de pagamento
   - **OS** — ordens de serviço de produção
   - **Entrega** — entregas em andamento e concluídas
   - **Histórico** — linha do tempo completa
5. Clique em **Salvar** no fim do formulário.

## Defaults por cargo
Cada cargo já vem com defaults razoáveis:
- **ATENDENTE**: vê tudo, exceto OS e Entrega (depende da loja).
- **PRODUÇÃO**: vê só Ficha, OS e Entrega.
- **FINANCEIRO**: vê Ficha, Pedidos e Histórico.
- **GERENTE / ADMIN / ROOT**: veem tudo.

Para **faturar uma venda** com cliente já cadastrado, use o botão **Faturar no PDV** na barra direita da ficha — ele abre o PDV com cliente pré-selecionado.

Você pode sobrescrever qualquer default desligando o toggle.

## Importante
- O usuário ROOT sempre vê tudo, mesmo se você desligar os toggles. É proposital — pra você não se trancar fora do sistema.
- Se uma aba está desligada e o usuário tenta acessar via URL direta, ela simplesmente não aparece. Não é erro, é como se a aba não existisse pra ele.
- As permissões são por **usuário individual**, não por cargo. Você pode ter dois atendentes com permissões diferentes.
`.trim(),
};
