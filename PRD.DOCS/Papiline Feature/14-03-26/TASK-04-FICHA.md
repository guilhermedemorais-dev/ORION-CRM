# TASK-04 — Aba Ficha do Cliente

**Depende de:** TASK-03
**Componente:** `components/tabs/ClientFichaTab.tsx`
**Referência:** mockup → aba "👤 Ficha"

---

## 4.1 Layout

```
Header:
  Esquerda: "Ficha do Cliente" (Playfair 16px) + subtítulo muted
  Direita: badge "✓ Apto para NF-e" (só se cpf preenchido) + botão [Salvar]

Conteúdo: 5 seções de formulário
Footer: "Última atualização" + [Descartar] [Salvar alterações]
```

---

## 4.2 Seções do formulário

**Seção 1 — Identificação Pessoal**
```
Grid 2 colunas:
  Nome completo*    | Nome social/apelido
  CPF*              | Data de nascimento
  RG                | Gênero (select: Feminino/Masculino/Outro)
```

**Seção 2 — Contatos**
```
Grid 2 colunas:
  WhatsApp*         | E-mail
  Instagram         | Telefone fixo
```

**Seção 3 — Endereço**
```
Grid 2 colunas:
  CEP (onBlur → buscar ViaCEP) | Cidade / Estado
  Endereço completo (full width)
```
ViaCEP: `GET https://viacep.com.br/ws/{cep}/json/` → preencher city/state automaticamente.

**Seção 4 — Dados Empresariais (PJ)**
```
Grid 2 colunas:
  CNPJ              | Razão social
  Endereço empresarial (full width)
```

**Seção 5 — Preferências & Remarketing**
```
Grid 2 colunas:
  Metal preferido (select) | Tamanho de anel
  Canal preferido (select) | Datas especiais
  Observações de remarketing (textarea full width)
```

---

## 4.3 Estado do formulário

```typescript
// Inicializar com dados do cliente via props
// useForm com react-hook-form ou useState simples
// isDirty: true quando qualquer campo muda → mostrar "Descartar" / "Salvar alterações"
// isDirty: false → mostrar apenas "Salvar"

// Submit: PATCH /api/v1/customers/:id
// Sucesso: toast "Ficha atualizada" + isDirty = false
// Erro: toast de erro + manter formulário
```

---

## 4.4 Badge "Apto para NF-e"

```typescript
// Mostrar se: customer.cpf !== null && customer.cpf !== ''
// Cor: verde, ícone ✓
// Se não apto: badge amarelo "CPF necessário para NF-e"
```

---

## 4.5 Rodapé de auditoria

```
"● Última atualização: DD/MM/YYYY HH:mm · {nome do usuário}"
"🤖 IA atualizou em DD/MM/YYYY" (se houver atualização automática)
```

---

## 4.6 Estilos dos inputs

```css
label: font-size 11px, font-weight 600, color var(--label), margin-bottom 4px
input/select: height 35px, bg var(--bg-3), border 1px solid var(--border-mid)
              border-radius 7px, padding 0 11px, font-size 12px, color var(--text)
input:focus → border-color var(--gold-border), bg var(--bg-4)
textarea: min-height 68px, padding 8px 11px, resize vertical
```

---

## DoD
- [ ] Formulário carrega dados do cliente
- [ ] Todos os campos editáveis
- [ ] CEP preenche cidade/estado automaticamente
- [ ] Badge NF-e condicional ao CPF
- [ ] Salvar chama PATCH e mostra toast
- [ ] Descartar reseta para valores originais
- [ ] Rodapé mostra data e autor da última edição
- [ ] `tsc --noEmit` limpo
