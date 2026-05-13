export const ordemServicoContent = {
    id: 'ordem-servico',
    title: 'Ordem de Serviço (OS) e materiais',
    group: 'Operação',
    body: `
# Ordem de Serviço (OS)

A **Ordem de Serviço** é o documento de produção de uma peça sob encomenda. Ela registra:

- Quem é o cliente, qual peça vai ser feita, prazo e responsáveis
- Quais matérias-primas e peças prontas do estoque vão ser usadas
- O valor total (materiais + mão de obra)

## Como criar uma OS

1. Na ficha do cliente, clique em **Nova OS** (botão na barra direita) ou avance um atendimento para o status **OS** na aba Atendimento.
2. Preencha **Produto**: nome da peça, prioridade e prazo.
3. Em **Especificações**, descreva metal, pedra, aro, peso estimado.
4. Em **Materiais**, adicione cada item que vai ser consumido:
   - Use os filtros **Tudo / Matéria-prima / Peças prontas** para encontrar mais rápido.
   - Digite o nome ou código no campo de busca.
   - Clique no item desejado e ajuste a **quantidade**.
   - O subtotal aparece automaticamente abaixo da lista.
5. Em **Valores**, informe a **Mão de obra** (separada do preço dos materiais — padrão de joalheria).
6. O **Total calculado** mostra subtotal materiais + mão de obra. Você pode digitar um **Total** diferente se quiser cobrar markup adicional.
7. Clique em **Criar OS**.

## Materiais — como funciona

Cada material adicionado guarda **snapshot do preço de venda** no momento da inclusão. Isso significa que se você repreçar o produto no estoque depois, a OS antiga mantém o valor original — protege o cliente e o histórico.

**Estoque ainda não baixa quando você cria a OS.** A baixa real só acontece quando o cliente paga a peça no PDV. Isso evita que você gaste estoque com uma OS que o cliente pode cancelar.

Se a quantidade pedida for maior que o estoque disponível, o material fica destacado em **vermelho** — você pode mesmo assim adicionar (será preciso comprar/produzir mais matéria-prima antes de concluir a OS).

## Fluxo completo (visão geral)

1. **Atendente cria OS** com materiais + mão de obra → OS fica em "Aberta".
2. **Joalheiro produz a peça** seguindo as etapas (design → modelagem → fundição → cravação → polimento → QC → embalagem → pronta).
3. **Cliente vem pagar** → atendente vai no **PDV**, digita o **código da OS** (ex: OS-20260511-1234) e o sistema puxa todos os itens automaticamente para o carrinho.
4. **Atendente finaliza** o pagamento → o estoque baixa cada material da OS → a OS muda para "Entregue".

## Botão "Faturar no PDV" na ficha

Para acelerar, há um botão **Faturar no PDV** na barra direita da ficha. Ele abre o PDV já com o cliente pré-selecionado, pronto para você digitar o código da OS e fechar a venda sem precisar buscar o cliente de novo.

## Quem pode mexer

- **Criar/editar OS**: ADMIN, GERENTE, ATENDENTE.
- **Adicionar materiais e ajustar mão de obra**: ADMIN, GERENTE, ATENDENTE.
- **Atualizar etapas de produção**: ADMIN, GERENTE, PRODUÇÃO.
- **Visualizar OS**: ADMIN, GERENTE, ATENDENTE, PRODUÇÃO (cada cargo vê o que precisa — configurável por usuário).
`.trim(),
};
