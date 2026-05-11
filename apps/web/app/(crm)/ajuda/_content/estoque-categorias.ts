export const estoqueCategoriasContent = {
    id: 'estoque-categorias',
    title: 'Estoque, categorias e matéria-prima',
    group: 'Operação',
    body: `
# Estoque, categorias e matéria-prima

O **Estoque** concentra tudo que pode ser vendido na loja: joias prontas e matéria-prima (ouro, pedras, embalagens, insumos). Aqui você organiza por categoria e marca quais itens são consumidos em produção.

## Tipos de produto

Cada produto tem uma flag: **é matéria-prima ou não?**

- **Joia pronta** (flag desligada): peça acabada que vai pro PDV e venda direta. Ex: anel, colar, brinco prontos pra venda.
- **Matéria-prima** (flag ligada): item que serve pra **produzir** outra joia. Ex: ouro 18k em gramas, diamantes, pedras, embalagens. **Também pode ser vendida no balcão** se o cliente quiser comprar matéria-prima avulsa.

A diferença prática:
- Toda matéria-prima recebe um selo **MP** (etiqueta dourada) na lista do estoque e no PDV.
- Na hora de criar uma OS (ordem de serviço), o sistema mostra **apenas** matérias-primas pra escolher o que vai ser consumido.
- Quando a OS é concluída, o sistema dá baixa automática dessas matérias-primas no estoque.

## Categorias

Categorias servem pra **organizar** o estoque. Você cria livremente conforme a loja precisa.

### Como criar uma categoria
1. No **Estoque**, clique no botão **Categorias** no topo da página.
2. Digite o nome (ex: "Anéis", "Ouro 18k", "Embalagem") e clique em **Adicionar**.
3. Se quiser fazer uma **subcategoria**, escolha a categoria pai antes de clicar em adicionar. Ex: "Anéis" como pai e "Aliança" como subcategoria.

### Como usar a categoria num produto
Ao criar ou editar um produto, escolha no campo **Categoria**. As subcategorias aparecem agrupadas dentro do nome do pai.

### Limites
- Não dá pra criar duas categorias com o mesmo nome no mesmo nível (ex: duas "Anéis" na raiz). Mas pode ter "Anéis" na raiz e "Anéis" dentro de outra categoria.
- Pra **excluir** uma categoria que está em uso, primeiro reatribua os produtos que dependem dela.

## Como cadastrar um produto
1. Em **Estoque**, clique em **Adicionar Produto**.
2. Preencha **Código** (único), **Nome** e **Preço de venda**.
3. Escolha uma **Categoria** (ou crie uma nova pelo botão **+ Gerenciar** ao lado do campo).
4. Em **Configurações**, marque os toggles conforme o caso:
   - **Produto ativo**: aparece no estoque e nas buscas.
   - **Disponível no PDV**: aparece pra vender no caixa.
   - **Requer produção**: precisa de OS pra ser entregue.
   - **Matéria-prima**: marque se este item vai ser consumido em OS de outra joia.

## Boas práticas
- Sempre cadastre o **custo de aquisição** — sem isso, a margem não calcula e relatórios financeiros ficam imprecisos.
- Cadastre joias com **estoque mínimo > 0** pra receber alerta antes de zerar.
- Matéria-prima costuma ser cadastrada em **gramas** (ouro) ou unidade (pedra, embalagem). Use o campo de peso pra metais.

## Quem pode mexer
- **Cadastrar/editar produto**: ADMIN, GERENTE, ATENDENTE (configurável por usuário).
- **Gerenciar categorias** (criar, renomear, excluir): ROOT, ADMIN, GERENTE.
- **Visualizar estoque**: todos os cargos.
`.trim(),
};
