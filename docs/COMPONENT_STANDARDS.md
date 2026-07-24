# Padrões de Componentes

## Reutilização

- Procurar componente existente antes de criar outro.
- Componentes compartilhados devem representar comportamento recorrente real.
- Não abstrair componentes usados uma única vez sem ganho claro.

## Layout e Estados

- Todo `flex-1` deve usar `min-w-0` quando puder transbordar.
- Colunas fixas devem usar `flex-shrink-0`.
- Fetch deve possuir skeleton, estado vazio e estado de erro com nova tentativa.
- Componentes devem respeitar permissões e responsividade previstas no PRD.

## Formulários e Dados

- Usar React Hook Form e Zod.
- Usar React Query para dados remotos.
- Não usar CSS inline; usar Tailwind e os tokens do design system.
- Formatar moeda, telefone e datas pelos utilitários comuns do projeto.

## Validação Visual

O mockup em `docs/design/mockups/<module>/` é obrigatório quando existir. Uma
tela só pode ser declarada pronta após verificação no browser contra a referência.

