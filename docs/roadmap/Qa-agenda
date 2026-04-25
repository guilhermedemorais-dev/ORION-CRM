🔍 AUDITORIA COMPLETA — MÓDULO: AGENDA
ORION CRM | crm.orinjoias.com | 24/04/2026

1️⃣ TESTES FUNCIONAIS (DESKTOP)

[BUG-FUNCIONAL-001]
Descrição: Ação "Concluir Atendimento" é irreversível e executa sem qualquer confirmação. Um clique acidental finaliza permanentemente o atendimento.
Passos para reproduzir:

Abrir qualquer agendamento com status "EM ATENDIMENTO"
Clicar em "Concluir Atendimento"
Resultado esperado: Modal/dialog de confirmação — "Deseja marcar este atendimento como concluído? Esta ação não pode ser desfeita."
Resultado atual: Status muda imediatamente para "CONCLUÍDO" sem nenhuma confirmação. Nenhum botão de undo ou reversão disponível na UI.
Impacto: Operador pode concluir agendamentos por engano, sem possibilidade de correção pela interface.
Severidade: Crítica


[BUG-FUNCIONAL-002]
Descrição: Botão "Semana" na barra de visualização não executa nenhuma ação funcional. Visualmente parece um botão ativo mas está desabilitado sem sinalizá-lo claramente.
Passos para reproduzir:

Acessar a Agenda
Clicar no botão "Semana" ao lado de "Mês"
Resultado esperado: Troca de visualização para visão semanal.
Resultado atual: Nada acontece. O botão possui cursor-not-allowed via CSS e title="Em breve" no HTML, mas visualmente não há nenhum estado disabled, badge "Em breve" ou opacidade reduzida. O usuário clica repetidamente sem entender o motivo.
Impacto: Fricção severa; usuário não compreende que a funcionalidade não está disponível.
Severidade: Alta


[BUG-FUNCIONAL-003]
Descrição: Eventos duplicados sendo renderizados no calendário. O evento "10:00 VISITA_PRESENCIAL" aparece duas vezes no dia 25/04/2026 (mesmo evento, renderizado em duplicata).
Passos para reproduzir:

Acessar a Agenda em Abril de 2026
Observar o dia 25 (Sábado)
Resultado esperado: Cada evento deve aparecer uma única vez na célula do dia correspondente.
Resultado atual: "10:00 VISITA_PRESENCIAL" aparece duplicado. Confirmado via DOM: dois button refs com mesmo conteúdo na mesma célula.
Impacto: Confusão de dados, usuário pode agendar em cima de slot já ocupado acreditando que há dois eventos distintos.
Severidade: Alta


[BUG-FUNCIONAL-004]
Descrição: Cor do evento no calendário não atualiza corretamente após mudança de status. Evento marcado como "CONCLUÍDO" continua sendo renderizado com a cor cinza (border-l-gray-500, bg-gray-500/10), que segundo a legenda corresponde a "Cancelado/Reagendado", não a "Confirmado/Concluído" (verde).
Passos para reproduzir:

Clicar em um evento com status "EM ATENDIMENTO"
Clicar em "Concluir Atendimento"
Fechar o painel e observar a cor do evento no calendário
Resultado esperado: Evento deve ser verde (Confirmado/Concluído) conforme legenda.
Resultado atual: Evento permanece cinza, idêntico ao estado "Cancelado/Reagendado".
Impacto: Operadores perdem a capacidade de distinguir visualmente agendamentos concluídos de cancelados.
Severidade: Alta


[BUG-FUNCIONAL-005]
Descrição: Ausência total de funcionalidades de Editar e Cancelar/Excluir agendamento. O painel de detalhes oferece apenas "Enviar lembrete via Bot" e "Concluir Atendimento". Não há forma de corrigir um agendamento criado com dados errados.
Passos para reproduzir:

Criar um agendamento com dados incorretos
Clicar no evento para abrir o painel de detalhes
Procurar botão de edição ou cancelamento
Resultado esperado: Botões de "Editar", "Cancelar Agendamento" e/ou "Remarcar".
Resultado atual: Nenhum desses botões existe. O único caminho seria excluir via banco de dados.
Impacto: Impossível corrigir agendamentos errados sem acesso ao backend. Dados corrompidos se acumulam.
Severidade: Crítica


[BUG-FUNCIONAL-006]
Descrição: Campo WhatsApp aceita qualquer texto, incluindo letras e caracteres especiais, sem máscara de input ou rejeição em tempo real. A validação só ocorre no submit e verifica apenas a quantidade mínima de caracteres (10), não o formato de número.
Passos para reproduzir:

Abrir modal "Novo Agendamento"
Digitar "abcdefghijk" (11 letras) no campo WhatsApp
Preencher demais campos obrigatórios
Clicar "Confirmar e Agendar"
Resultado esperado: Campo deve aceitar apenas dígitos, com máscara (XX) XXXXX-XXXX ou validação de formato de número de telefone.
Resultado atual: Texto com letras é aceito sem nenhuma rejeição em tempo real. A validação de submit verifica apenas o tamanho (mín. 10 caracteres), então "abcdefghijk" passaria.
Impacto: Número de telefone inválido salvo no banco; bot de WhatsApp falha silenciosamente.
Severidade: Alta


[BUG-FUNCIONAL-007]
Descrição: O campo "Responsável" no formulário de criação tem como opção padrão selecionada "Atendente Atual", que não corresponde a um usuário real e não é validada como obrigatória. Agendamentos podem ser criados sem atribuição a nenhum responsável real.
Passos para reproduzir:

Abrir modal "Novo Agendamento"
Deixar campo "Responsável" em "Atendente Atual"
Preencher demais campos e submeter
Resultado esperado: Campo com validação obrigatória ou, ao submeter com "Atendente Atual", atribuir automaticamente ao usuário logado com seu ID real.
Resultado atual: Agendamento é criado com "Responsável" indefinido. O valor "Atendente Atual" parece ser um placeholder, não um valor válido de usuário.
Impacto: Agendamentos órfãos sem responsável atribuído; impacta relatórios e notificações.
Severidade: Média


[BUG-FUNCIONAL-008]
Descrição: Modal "Novo Agendamento" abre fora da viewport ao ser clicado — o usuário precisa rolar a página para baixo para visualizar o modal. O scroll do body não é travado quando o modal está aberto.
Passos para reproduzir:

Estar na posição de scroll padrão (topo da página)
Clicar em "Novo Agendamento"
Resultado esperado: Modal centralizado na viewport, body scroll travado.
Resultado atual: URL muda para ?create=true mas o modal aparece parcialmente fora da tela. Requer scroll para visualizar o formulário completo. Confirmado em viewport 928x614.
Impacto: Confusão severa — usuário pode achar que o botão não funcionou.
Severidade: Alta


[BUG-FUNCIONAL-009]
Descrição: Evento com nome em ALL_CAPS_COM_UNDERSCORE ("VISITA_PRESENCIAL") renderizado no calendário. Indica dado vindo do banco sem sanitização/formatação, expondo convenção técnica de nomenclatura ao usuário final.
Passos para reproduzir:

Observar o dia 25/04 no calendário
Resultado esperado: "Visita Presencial" (formatado para o usuário).
Resultado atual: "10:00 VISITA_PRESENCIAL" — formato técnico/raw database.
Impacto: Aparência não-profissional; evidencia falta de camada de apresentação.
Severidade: Média


[BUG-FUNCIONAL-010]
Descrição: Evento com "Cliente Não Informado" no painel de detalhes — agendamentos sem cliente vinculado são permitidos e exibem dados vazios sem qualquer alerta ou indicativo de ação corretiva.
Passos para reproduzir:

Clicar no evento "07:00 Visita Showroom" de 01/04/2026
Resultado esperado: Se não houver cliente, exibir aviso e link para "Vincular cliente".
Resultado atual: Exibe apenas "Cliente Não Informado" sem nenhuma ação disponível.
Impacto: Dados incompletos persistem sem prompts de correção.
Severidade: Baixa


2️⃣ RESPONSIVIDADE

[RESPONSIVIDADE-001]
Dispositivo: Mobile (< 640px / < sm breakpoint)
Problema: O toggle "Mês / Semana" desaparece completamente em mobile (hidden sm:flex). Não há substituto funcional — o usuário em mobile não tem como trocar a visualização nem saber que existe tal opção.
Impacto: Perda de controle de navegação em dispositivos móveis.
Severidade: Alta

[RESPONSIVIDADE-002]
Dispositivo: Desktop (com painel lateral de detalhes aberto)
Problema: Ao abrir o painel "Detalhes do Agendamento", o cabeçalho do calendário comprime drasticamente. O título "Abril De 2026" quebra em 3 linhas, o botão "Novo Agendamento" fica truncado ("+ Nov") e os controles de navegação ficam sobrepostos.
Impacto: Interface inutilizável no estado de detalhe aberto. Usuário perde o contexto de qual mês está visualizando.
Severidade: Alta

[RESPONSIVIDADE-003]
Dispositivo: Todos os dispositivos
Problema: Botões de evento no calendário possuem apenas 22.5px de altura — muito abaixo do tap target mínimo de 44px recomendado (WCAG 2.5.5 / Apple HIG / Material Design). Em mobile, clicar no evento correto se torna impossível sem zoom.
Impacto: Inacessibilidade em touch devices; usuário clica no evento errado constantemente.
Severidade: Alta

[RESPONSIVIDADE-004]
Dispositivo: Mobile/Tablet (< 1024px / < lg breakpoint)
Problema: A sidebar não possui backdrop/overlay ao ser aberta via hamburger. Abre por cima do conteúdo sem dimir o fundo. Não há área de dismiss clicável ao redor da sidebar — o usuário precisa clicar no conteúdo principal para fechar (comportamento não-óbvio).
Impacto: Usuário fica "preso" na sidebar sem saber como fechá-la.
Severidade: Média

[RESPONSIVIDADE-005]
Dispositivo: Tablet (768px–1024px)
Problema: O layout geral não possui breakpoints específicos para tablet. A transição é diretamente de mobile (sidebar oculta, sem toggle de visualização) para desktop (sidebar sempre visível). No range de 640px–1023px, a interface exibe o toggle Mês/Semana mas sem sidebar, criando uma experiência híbrida sem coerência.
Impacto: Experiência inconsistente em tablets — elementos aparecem/desaparecem sem padrão claro.
Severidade: Média

[RESPONSIVIDADE-006]
Dispositivo: Desktop (viewport reduzida / janela pequena)
Problema: O calendário usa overflow-y: auto no grid de dias, fazendo com que semanas fiquem ocultas sem indicação visual de scroll. Em viewports abaixo de ~900px de altura, os últimos dias do mês ficam inacessíveis visualmente (o usuário não percebe que pode rolar a grade).
Impacto: Dias do mês ficam invisíveis; agendamentos passam despercebidos.
Severidade: Alta

[RESPONSIVIDADE-007]
Dispositivo: Mobile (< 640px)
Problema: O modal "Novo Agendamento" possui campos em layout grid 2 colunas (Tipo de Agendamento + Pipeline lado a lado; Nome do Contato + WhatsApp lado a lado; Data + Horário lado a lado). Em telas estreitas esse layout não colapsa para 1 coluna, resultando em campos muito estreitos.
Impacto: Inputs inutilizáveis em mobile; texto placeholder cortado.
Severidade: Alta

3️⃣ UX/UI PROFISSIONAL

[UX-PROBLEMA-001]
Descrição: O botão "Semana" não possui nenhum estado visual de "desabilitado" ou badge "Em breve". Visualmente idêntico a um botão funcional, apenas com texto muted. Usuários clicam repetidamente sem feedback.
Impacto na experiência: Frustração imediata; sensação de sistema quebrado.
Sugestão de melhoria: Adicionar tag/badge "Em breve" sobreposta ao botão, opacity: 0.4, cursor-not-allowed visível + tooltip ao hover. Ou remover o botão até a funcionalidade existir.
Prioridade: Alta

[UX-PROBLEMA-002]
Descrição: O painel de detalhes do agendamento é extremamente pobre em informações e ações. Exibe apenas: tipo, status, data/hora, cliente, observações. Não exibe: pipeline, responsável, histórico de mudanças de status, ações de editar/cancelar/remarcar.
Impacto na experiência: Operadores precisam abrir o agendamento sem poder tomar nenhuma ação gerencial relevante.
Sugestão de melhoria: Adicionar seção de metadados (pipeline, responsável), histórico de status e botões de ação secundários (Editar, Cancelar, Remarcar).
Prioridade: Crítica

[UX-PROBLEMA-003]
Descrição: Não há indicação visual do dia atual como destaque no calendário quando a visão do mês está totalmente visível. O número "24" aparece destacado apenas com um círculo pequeno e pouco contrastante.
Impacto na experiência: Orientação temporal fraca; usuário não encontra o "hoje" rapidamente.
Sugestão de melhoria: Aplicar highlight mais pronunciado na célula do dia atual (background sutil diferenciado na célula inteira, não apenas no número).
Prioridade: Média

[UX-PROBLEMA-004]
Descrição: A legenda de cores (Agendado, Confirmado/Concluído, No Show, Cancelado/Reagendado) fica na parte inferior da página, fora da viewport na maioria das configurações. Novos usuários não encontram a legenda.
Impacto na experiência: Usuários não entendem o significado das cores dos eventos.
Sugestão de melhoria: Mover legenda para o header da agenda, próximo aos controles de navegação, ou incluí-la como tooltip nos próprios status badges.
Prioridade: Média

[UX-PROBLEMA-005]
Descrição: O sucesso ao criar um agendamento exibe um modal com pergunta "Deseja enviar uma mensagem ao cliente via WhatsApp Bot?". Porém, o botão "Enviar Mensagem via Bot" não retorna ao modal o status da mensagem (sucesso/falha de envio). O estado muda para "Mensagem Enviada" mas não há confirmação real de entrega.
Impacto na experiência: Operador não sabe se a mensagem chegou ao cliente, gerando insegurança.
Sugestão de melhoria: Exibir o status real do envio (enviado/falha) com timestamp, ou ao menos um toast de confirmação.
Prioridade: Média

[UX-PROBLEMA-006]
Descrição: Eventos truncados no calendário (ex: "07:00 Visita...") não oferecem tooltip com o nome completo ao passar o mouse. O usuário precisa clicar para ver o nome completo do agendamento.
Impacto na experiência: Navegação no calendário lenta; precisa abrir detalhes para informações básicas.
Sugestão de melhoria: Adicionar title ou tooltip customizado ao hover nos eventos do calendário.
Prioridade: Baixa

[UX-PROBLEMA-007]
Descrição: O modal de sucesso de agendamento ("Agendamento Criado ✓") fecha ao clicar "Fechar" mas o calendário não navega automaticamente para a data do novo agendamento. Se o agendamento foi para outro mês, o usuário precisa navegar manualmente para encontrá-lo.
Impacto na experiência: Fricção pós-criação; usuário não tem confirmação visual imediata do evento no calendário.
Sugestão de melhoria: Após fechar o modal de sucesso, rolar o calendário para o mês do novo agendamento e destacar o evento criado.
Prioridade: Média

4️⃣ CONSISTÊNCIA DE DESIGN SYSTEM

[INCONSISTÊNCIA-001]
Descrição: O botão "Semana" usa classe px-3 py-1.5 text-xs com estilo manual inline, enquanto o botão "Mês" usa o design system do componente (wrapper hidden sm:flex items-center bg-surface-sidebar rounded-md p-1 border border-white/5). Os dois botões têm estilos completamente diferentes, sem consistência.
Onde ocorre: Header da Agenda, toggle Mês/Semana.
Impacto: Visual inconsistente que indica implementação ad-hoc; design system não seguido.

[INCONSISTÊNCIA-002]
Descrição: O status badge "EM ATENDIMENTO" no painel de detalhes usa fundo laranja com texto branco; "CANCELADO" usa fundo vermelho; "CONCLUÍDO" usa fundo verde. Porém, os eventos no calendário usam uma paleta diferente: orange para "EM ATENDIMENTO", gray para "CONCLUÍDO" (deveria ser verde), rose para "CANCELADO". A cor no calendário para CONCLUÍDO não bate com a cor do badge no painel.
Onde ocorre: Calendário (eventos) vs. Painel de Detalhes (status badge).
Impacto: Sistema de cores incoerente; a legenda da página não corresponde às cores reais dos eventos.

[INCONSISTÊNCIA-003]
Descrição: Dois componentes de barra de navegação são renderizados na página (um no topo e um no rodapé/bottom bar). O top bar e o bottom bar são idênticos em conteúdo (mesmo menu hamburger, search bar, botões de ajuda/notificação/AI).
Onde ocorre: header.sticky.top-0 e um segundo componente idêntico no bottom da viewport.
Impacto: Duplicação de UI, desperdício de espaço em mobile, confusão do usuário.

[INCONSISTÊNCIA-004]
Descrição: O título do módulo exibe "GESTÃO DE HORÁRIOS" (maiúsculas) no top bar como subtítulo, mas o label no menu lateral e o H1 da página exibem "Agenda". Nomenclatura dupla para o mesmo módulo.
Onde ocorre: Top bar (breadcrumb) vs. sidebar nav vs. H1 da página.
Impacto: Usuário não sabe como referenciar o módulo; inconsistência de UX writing.

[INCONSISTÊNCIA-005]
Descrição: Botões de ação primária usam dois padrões distintos: bg-[color:var(--orion-gold)] (design system token) para "Novo Agendamento" e "Confirmar e Agendar", mas "Concluir Atendimento" também usa gold apesar de ser uma ação destrutiva/irreversível. Ações destrutivas deveriam usar cor de alerta (vermelho/laranja).
Onde ocorre: Botão "Concluir Atendimento" no painel de detalhes.
Impacto: Ausência de distinção visual entre ações positivas e ações críticas/irreversíveis.

5️⃣ RISCOS DE PRODUTO

[RISCO-PRODUTO-001]
Descrição: Ausência de funcionalidade de edição/cancelamento de agendamentos. Um SaaS de CRM operacional sem CRUD completo no módulo de agenda é inoperante para uso real em produção.
Impacto estratégico: Alta chance de abandono imediato por novos usuários ao descobrirem que não podem editar agendamentos errados. Risco de reclamação crítica de clientes pagantes.
Recomendação: Implementar urgentemente: editar agendamento (mesma modal de criação pré-populada) e cancelar com confirmação e campo de motivo.

[RISCO-PRODUTO-002]
Descrição: "Concluir Atendimento" sem confirmação é uma ação irreversível de alto risco. Em ambiente de produção com múltiplos operadores, erros acidentais serão frequentes.
Impacto estratégico: Dados de atendimento corrompidos; métricas de conversão distorcidas; suporte recorrente para reverter status via banco de dados.
Recomendação: Dialog de confirmação obrigatório com detalhes do agendamento + campo opcional de observação de conclusão.

[RISCO-PRODUTO-003]
Descrição: A visualização "Semana" está prometida como "Em breve" mas não há nenhuma indicação de prazo ou roadmap visível ao usuário. Em SaaS B2B, features prometidas sem entrega criam desconfiança.
Impacto estratégico: Usuários que precisam de visão semanal (a maioria em uso diário de agenda) abandonam o módulo ou o produto inteiro.
Recomendação: Ou entregar a view semanal (alta prioridade), ou remover completamente o botão até estar pronto.

[RISCO-PRODUTO-004]
Descrição: Ausência de filtragem/busca de agendamentos. Com o crescimento de dados (meses com muitos eventos), o usuário não tem como filtrar por responsável, tipo de agendamento, status ou período.
Impacto estratégico: O módulo se torna inutilizável em escala; clientes com alto volume de agendamentos abandonarão o produto.
Recomendação: Adicionar filtros por status, tipo, responsável e range de datas.

[RISCO-PRODUTO-005]
Descrição: O campo WhatsApp sem máscara/validação real permite criação de agendamentos com números inválidos. O bot de envio de mensagem falha silenciosamente nestes casos — o operador clica em "Enviar Mensagem" e não sabe que falhou.
Impacto estratégico: Clientes não recebem confirmação de agendamento; taxa de no-show aumenta; operador culpa o sistema.
Recomendação: Máscara de input, validação de formato E2E, e feedback claro de status de envio do bot.

6️⃣ RESUMO EXECUTIVO
MétricaAvaliaçãoNota Geral4.5 / 10Nota Mobile3.0 / 10Nota Tablet4.5 / 10Nota Desktop5.5 / 10Risco Geral🔴 ALTOPronto para Produção?NÃO
Top 5 Problemas Críticos

Ausência de Editar/Cancelar Agendamento — CRUD incompleto. Módulo não é operacional.
"Concluir Atendimento" sem confirmação — Ação irreversível executada com um clique. Risco de corrupção de dados.
Modal abre fora da viewport — Botão principal do módulo parece não funcionar.
Cor de evento CONCLUÍDO incorreta — Sistema de cores quebrado; legenda contradiz a realidade.
Eventos duplicados no calendário — Bug de renderização que cria dados fantasmas.


7️⃣ TASKS PARA PIPELINE


 [CRÍTICO] Implementar confirmação antes de "Concluir Atendimento"
Tipo: Bug | Severidade: Crítica | Dispositivo: Todos
Adicionar dialog modal de confirmação antes de executar a ação de conclusão. O dialog deve exibir nome do cliente e data/hora do agendamento. Incluir campo opcional "Observações de conclusão". Botão de confirmação com cor de destaque diferente do padrão (success green, não gold).
 [CRÍTICO] Implementar Editar Agendamento
Tipo: Bug / Melhoria UX | Severidade: Crítica | Dispositivo: Todos
Adicionar botão "Editar" no painel de detalhes do agendamento. Ao clicar, abrir o mesmo modal de criação pré-populado com os dados do agendamento. Permitir edição de todos os campos exceto ID. Salvar via PATCH na API.
 [CRÍTICO] Implementar Cancelar/Remarcar Agendamento
Tipo: Bug / Melhoria UX | Severidade: Crítica | Dispositivo: Todos
Adicionar botão "Cancelar" com dialog de confirmação exigindo motivo (campo obrigatório). Adicionar opção "Remarcar" que abre modal de criação com dados pré-populados e data/hora vazias. Status deve mudar para "Cancelado/Reagendado" com o motivo registrado.
 [ALTA] Corrigir modal "Novo Agendamento" abrindo fora da viewport
Tipo: Bug | Severidade: Alta | Dispositivo: Desktop/Mobile
O modal deve abrir centralizado na viewport com position: fixed, top: 50%, left: 50%, transform: translate(-50%, -50%). O body deve ter overflow: hidden enquanto o modal está aberto. Verificar z-index em relação ao header sticky.
 [ALTA] Corrigir mapeamento de cor para status CONCLUÍDO no calendário
Tipo: Bug | Severidade: Alta | Dispositivo: Todos
O evento com status "CONCLUÍDO" deve usar border-l-green-500 bg-green-500/15 text-green-400 (ou equivalente) de acordo com a legenda da página ("Confirmado/Concluído" = verde). Auditar todos os mapeamentos de status → cor e garantir consistência entre os eventos do calendário e os badges do painel de detalhes.
 [ALTA] Corrigir eventos duplicados no calendário
Tipo: Bug | Severidade: Alta | Dispositivo: Todos
Investigar a causa da renderização duplicada de eventos (ex: "VISITA_PRESENCIAL" em 25/04). Verificar se há deduplica de IDs na query/mapeamento de dados antes de renderizar os botões de evento. Adicionar deduplicação por ID de evento antes do render.
 [ALTA] Adicionar estado visual correto para botão "Semana" (Em breve)
Tipo: Melhoria UX | Severidade: Alta | Dispositivo: Todos
Aplicar ao botão "Semana": opacity: 0.4, cursor-not-allowed, adicionar badge/chip "Em breve" sobreposto (ou texto "(em breve)" ao lado). Alternativa: remover o botão completamente da interface até a feature estar disponível.
 [ALTA] Implementar máscara e validação real de número de telefone no campo WhatsApp
Tipo: Bug | Severidade: Alta | Dispositivo: Todos
Aplicar máscara (XX) XXXXX-XXXX com inputMode="numeric". Rejeitar caracteres não-numéricos em tempo real (onInput). Validar formato completo no submit (regex: ^\+?[1-9]\d{10,14}$). O campo deve ser do tipo tel para abrir teclado numérico em mobile.
 [ALTA] Corrigir layout do cabeçalho ao abrir painel de detalhes
Tipo: Responsividade | Severidade: Alta | Dispositivo: Desktop (viewport < 1400px)
Quando o painel lateral de detalhes está aberto, o título do mês ("Abril De 2026") quebra em múltiplas linhas e o botão "Novo Agendamento" é truncado. Usar flex-shrink-0 no título, min-width nos controles, ou reduzir o tamanho do título dinamicamente com text-sm quando o painel está aberto.
 [ALTA] Aumentar área de toque dos eventos no calendário para mínimo 44px
Tipo: Responsividade | Severidade: Alta | Dispositivo: Mobile/Tablet
Os botões de evento possuem apenas 22.5px de altura. Aumentar min-height: 44px ou adicionar padding vertical para garantir área de toque adequada, especialmente para uso em dispositivos touch. Ajustar a grade de células para acomodar a nova altura.
 [ALTA] Adicionar backdrop/overlay na sidebar mobile
Tipo: Responsividade / Bug | Severidade: Alta | Dispositivo: Mobile/Tablet
Quando a sidebar é aberta via hamburger em telas < 1024px, adicionar overlay escurecido (bg-black/50 z-30) cobrindo o conteúdo principal. Clicar no overlay deve fechar a sidebar. Implementar o comportamento padrão de "drawer" com backdrop dismissível.
 [MÉDIA] Sanitizar nomes de eventos — remover ALL_CAPS e underscores
Tipo: Bug / Melhoria UX | Severidade: Média | Dispositivo: Todos
Adicionar função de formatação nos nomes de agendamentos: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()). Aplicar tanto na renderização do calendário quanto no painel de detalhes. Verificar se o problema é no dado em si (banco) ou apenas na exibição.
 [MÉDIA] Validar campo "Responsável" e atribuir usuário logado como padrão
Tipo: Bug | Severidade: Média | Dispositivo: Todos
O valor padrão "Atendente Atual" não deve ser um placeholder — deve ser pré-selecionado com o usuário atualmente autenticado (via sessão/JWT). Se não for possível, marcar o campo como obrigatório e remover a opção "Atendente Atual" da lista.
 [MÉDIA] Mover legenda de cores para a área visível do calendário
Tipo: Melhoria UX | Severidade: Média | Dispositivo: Todos
Reposicionar a legenda (Agendado, Confirmado/Concluído, No Show, Cancelado/Reagendado) para o cabeçalho da Agenda, próximo aos botões de navegação, ou incluir como ícones/chips nos status do painel de detalhes. A legenda atual fica fora da viewport na maioria das telas.
 [MÉDIA] Adicionar modal "Novo Agendamento" responsivo para mobile (1 coluna)
Tipo: Responsividade | Severidade: Média | Dispositivo: Mobile
O grid de 2 colunas do modal (Tipo+Pipeline, Nome+WhatsApp, Data+Horário) deve colapsar para 1 coluna em telas < 640px (sm:grid-cols-2 grid-cols-1). Garantir que o modal seja scrollável internamente e não seja maior que 90vh.
 [BAIXA] Adicionar tooltip com nome completo ao hover nos eventos do calendário
Tipo: Melhoria UX | Severidade: Baixa | Dispositivo: Desktop
Adicionar atributo title ou componente Tooltip nos botões de evento do calendário com o nome completo do cliente e o tipo de agendamento. Evita necessidade de clicar para ver informação básica.
 [BAIXA] Padronizar nomenclatura do módulo: "Agenda" vs "Gestão de Horários"
Tipo: Refatoração UI | Severidade: Baixa | Dispositivo: Todos
Escolher um único nome para o módulo e aplicar consistentemente em: breadcrumb do top bar, label do menu lateral, H1 da página e title da aba do browser. Recomendação: manter "Agenda" como nome principal e "Gestão de Horários" como subtítulo apenas no breadcrumb se necessário.
 [BAIXA] Remover barra de navegação duplicada no rodapé
Tipo: Bug / Refatoração UI | Severidade: Baixa | Dispositivo: Mobile
Existe um segundo top bar (header idêntico ao principal) renderizado no bottom da viewport em algumas resoluções. Identificar e remover o componente duplicado. Verificar se não é um componente de bottom navigation mobile intencional que está sendo renderizado incorretamente.

---

8️⃣ FEATURE — VISUALIZAÇÕES MÚLTIPLAS (PARIDADE GOOGLE CALENDAR)

[FEATURE-AGENDA-001] — Implementar seletor de visualizações Dia / Semana / Mês / Ano / Programação / 4 dias
Tipo: Feature crítica | Severidade: Crítica (substitui BUG-FUNCIONAL-002, UX-PROBLEMA-001, RISCO-PRODUTO-003) | Dispositivo: Todos
Referência visual: Google Calendar (prints anexados em 2026-04-24).

Contexto:
A agenda atual oferece apenas a visão de Mês. O botão "Semana" existe mas está marcado como "Em breve" (cursor-not-allowed). O usuário não tem como navegar pelo dia, semana, ano ou programação. Em produção, isto torna a agenda inutilizável para uso diário (a maioria dos operadores trabalha em visão diária ou semanal).

Comportamento esperado (funcional, NÃO mockup):
1. Seletor único de view — dropdown ou toggle group no header com as opções:
   - Dia (atalho D)
   - Semana (atalho W)
   - Mês (atalho M) — atual padrão
   - Ano (atalho Y)
   - Programação (atalho A) — lista de próximos eventos
   - 4 dias (atalho X)
2. View persistida via querystring (?view=day|week|month|year|schedule|4days) e em localStorage como preferência do usuário.
3. Navegação Anterior/Próximo/Hoje deve respeitar a granularidade da view ativa (ex.: em Semana, "Próximo" avança 7 dias; em Ano, avança 1 ano).
4. Toggle "Mostrar fins de semana" — afeta Semana/Mês/4 dias (oculta colunas sáb/dom). Persistir em localStorage.
5. Toggle "Mostrar concluídos" — filtra eventos com status CONCLUIDO/CANCELADO. Persistir em localStorage.
6. Backend já aceita range arbitrário em GET /appointments?start_date=&end_date= — não requer mudança de API, apenas calcular o range no client por view.

Especificação por view:
- Dia: 1 coluna, grid horário 00h–23h com slots de 30min, eventos posicionados pela hora de início e altura proporcional à duração. Indicador visual da hora atual (linha vermelha).
- Semana: 7 colunas (ou 5 se "fins de semana" off), mesma grid horária da Dia. Header sticky com os dias da semana e número.
- Mês: visão atual mantida. Continuar usando getDaysInMonthView.
- Ano: 12 mini-grids (3 colunas × 4 linhas) com mês compacto. Click no dia → navega para Dia.
- Programação: lista vertical agrupada por dia, mostrando todos os eventos do range (próximos 30 dias por padrão). Empty state se não houver eventos.
- 4 dias: igual à Semana, mas com 4 colunas a partir do dia atual.

Arquitetura sugerida:
- apps/web/app/(crm)/agenda/components/views/DayView.tsx
- apps/web/app/(crm)/agenda/components/views/WeekView.tsx (parametrizada por número de dias para reuso em 4 dias)
- apps/web/app/(crm)/agenda/components/views/YearView.tsx
- apps/web/app/(crm)/agenda/components/views/ScheduleView.tsx
- apps/web/app/(crm)/agenda/components/ViewSelector.tsx (dropdown com atalhos)
- apps/web/app/(crm)/agenda/lib/dateRange.ts (extrair getDateRange para suportar todas as views)
- apps/web/app/(crm)/agenda/lib/usePreferences.ts (hook para localStorage: weekends, completed, lastView)
- apps/web/app/(crm)/agenda/page.tsx (substituir <MonthView /> hardcoded por switch de view)
- apps/web/app/(crm)/agenda/components/CalendarHeader.tsx (substituir botão "Semana" disabled pelo ViewSelector; remover badge "Em breve")

Critérios de aceitação:
- [ ] Todas as 6 views renderizam dados reais da API (não mocks).
- [ ] Atalhos de teclado D/W/M/Y/A/X funcionam quando o foco não está em input.
- [ ] Toggles de fins de semana e concluídos persistem entre reloads.
- [ ] Navegação Anterior/Próximo/Hoje respeita a granularidade da view.
- [ ] Click em evento abre o AppointmentSheet em qualquer view (manter ?selected= na URL).
- [ ] Click em dia da view Ano/Mês navega para a view Dia daquele dia.
- [ ] Linha de "agora" aparece em Dia/Semana/4 dias quando o range inclui hoje.
- [ ] Mobile: ViewSelector como dropdown nativo (não toggle horizontal); Dia/Semana scrolláveis.
- [ ] tsc --noEmit limpo.
- [ ] Empty state em todas as views.

Substitui as tasks: BUG-FUNCIONAL-002, UX-PROBLEMA-001, RISCO-PRODUTO-003 (já resolvidas parcialmente como "estado disabled", agora ficam obsoletas com a entrega da feature completa).

---

- [ ] **[BAIXA] Ocultar label "ORION CRM" no topo da sidebar**
  Tipo: Refatoração UI | Severidade: Baixa | Dispositivo: Todos
  O texto "ORION CRM" exibido acima do nome da empresa ("ORIN JOIAS") na sidebar expõe o nome da plataforma white-label ao usuário final, o que pode conflitar com a identidade da marca do cliente. Remover ou ocultar esse elemento com `hidden` / `display: none`. Manter apenas o nome/logo do cliente ("ORIN JOIAS") no topo da sidebar.