import React from 'react';
import type { HelpContext } from '@/hooks/useHelpContext';

export interface TutorialStep {
  /** Título do passo */
  title: string;
  /** Ícone representativo (emoji ou string) */
  icon: string;
  /** Descrição do que o elemento faz */
  description: string;
  /** Dica prática de uso */
  tip?: string;
  /** Cor de destaque para o card */
  color?: string;
}

export interface TutorialSection {
  /** Nome da seção (ex: "Painel Esquerdo") */
  sectionName: string;
  steps: TutorialStep[];
}

export interface ModuleTutorialData {
  moduleName: string;
  /** Breve descrição do módulo */
  overview: string;
  /** Passos iniciais para começar */
  quickStart: string[];
  /** Seções visuais do módulo */
  sections: TutorialSection[];
}

export const MODULE_TUTORIALS: Record<HelpContext, ModuleTutorialData> = {
  dashboard: {
    moduleName: 'Dashboard',
    overview: 'O Dashboard é o painel central de controle do Orion CRM. Aqui você vê métricas do dia, alertas operacionais e a atividade recente da equipe em tempo real.',
    quickStart: [
      'Verifique os KPIs do dia no topo para ter uma visão rápida da operação',
      'Confira os alertas — estoque baixo, produção atrasada, conversas sem atendimento',
      'Acompanhe os gráficos de tendência para entender a evolução de receita e leads',
      'Use a atividade recente para ver o que aconteceu nos últimos minutos',
    ],
    sections: [
      {
        sectionName: 'KPIs do Dia',
        steps: [
          {
            title: 'Cards de métricas',
            icon: '📊',
            description: 'No topo do dashboard, cards mostram números chave: leads novos do dia, pedidos em aberto, receita acumulada no mês e ticket médio.',
            tip: 'Clique em um card para ver o detalhamento completo daquela métrica.',
            color: '#C8A97A',
          },
          {
            title: 'Comparativo com ontem',
            icon: '📈',
            description: 'Cada KPI mostra uma seta (↑ ou ↓) indicando se melhorou ou piorou em relação ao dia anterior.',
            tip: 'Setas verdes = bom, vermelhas = atenção. Use isso para identificar tendências rapidamente.',
            color: '#2DD4BF',
          },
        ],
      },
      {
        sectionName: 'Alertas e Ações Rápidas',
        steps: [
          {
            title: 'Estoque baixo',
            icon: '⚠️',
            description: 'Lista produtos que estão abaixo do mínimo configurado. Clique para ir direto ao ajuste de estoque.',
            tip: 'Administradores recebem notificação automática. Não ignore — produto sem estoque = venda perdida.',
            color: '#F59E0B',
          },
          {
            title: 'Produção atrasada',
            icon: '🔨',
            description: 'Mostra ordens de serviço com prazo vencido. Clique para verificar com a equipe de produção.',
            tip: 'Priorize as OS com maior atraso. Comunique o cliente proativamente.',
            color: '#EF4444',
          },
          {
            title: 'Inbox aguardando',
            icon: '💬',
            description: 'Conversas que chegaram e nenhum atendente assumiu ainda. Clique para assumir e responder.',
            tip: 'Atendimento rápido = maior taxa de conversão. Responda nos primeiros 5 minutos.',
            color: '#5B9CF6',
          },
          {
            title: 'Pagamentos pendentes',
            icon: '💰',
            description: 'Pedidos que estão aguardando pagamento. Envie lembrete ao cliente.',
            tip: 'Use o WhatsApp para cobrar — taxa de abertura de 95% vs 20% do email.',
            color: '#2DD4BF',
          },
        ],
      },
      {
        sectionName: 'Gráficos de Tendência',
        steps: [
          {
            title: 'Evolução de receita',
            icon: '📉',
            description: 'Gráfico de linha mostrando a receita ao longo do tempo. Identifique picos e quedas.',
            tip: 'Filtre por período (7d, 30d, 90d) para ver tendências de curto e longo prazo.',
            color: '#A78BFA',
          },
          {
            title: 'Leads por fonte',
            icon: '🎯',
            description: 'Gráfico de rosca mostrando de onde vêm seus leads: WhatsApp, Instagram, Indicação, Balcão.',
            tip: 'Invista nos canais que trazem mais leads qualificados. Corte os que não convertem.',
            color: '#F59E0B',
          },
        ],
      },
      {
        sectionName: 'Atividade Recente',
        steps: [
          {
            title: 'Timeline de eventos',
            icon: '🕐',
            description: 'Lista cronológica de tudo que aconteceu: novos leads, pedidos atualizados, produção concluída.',
            tip: 'Use para ficar por dentro do que a equipe fez enquanto você estava fora.',
            color: '#6366F1',
          },
        ],
      },
    ],
  },

  pdv: {
    moduleName: 'PDV — Ponto de Venda',
    overview: 'O PDV é onde as vendas de pronta-entrega acontecem. Busque produtos, monte o carrinho, vincule o cliente e finalize a venda em poucos cliques.',
    quickStart: [
      'Pressione F2 para focar na busca de produtos',
      'Clique em um produto para adicionar ao carrinho',
      'Vincule um cliente (opcional mas recomendado para NF-e)',
      'Escolha a forma de pagamento e finalize',
    ],
    sections: [
      {
        sectionName: 'Painel Esquerdo — Catálogo',
        steps: [
          {
            title: 'Barra de busca',
            icon: '🔍',
            description: 'Busque produtos por nome ou código. A busca é instantânea com debounce de 300ms.',
            tip: 'Atalho: pressione F2 para focar aqui direto. Esc para limpar.',
            color: '#C8A97A',
          },
          {
            title: 'Filtro de categorias',
            icon: '🏷️',
            description: 'Pílulas de categoria (Todos, Anel, Colar, Brinco, Pulseira, Outro) filtram a grade de produtos.',
            tip: 'Use para encontrar rápido um tipo específico de joia.',
            color: '#A78BFA',
          },
          {
            title: 'Grade de produtos',
            icon: '💎',
            description: 'Cards com foto, código, nome, preço e estoque. Clique para adicionar ao carrinho. O botão + adiciona direto.',
            tip: 'Cards dourados = já estão no carrinho. Vermelhos = sem estoque.',
            color: '#5B9CF6',
          },
          {
            title: 'Indicador de estoque',
            icon: '📦',
            description: 'Badge verde (disponível), amarelo (último) ou vermelho (sem estoque).',
            tip: 'Produtos sem estoque ficam opacos e não podem ser adicionados.',
            color: '#2DD4BF',
          },
        ],
      },
      {
        sectionName: 'Painel Direito — Carrinho e Pagamento',
        steps: [
          {
            title: 'Carrinho de compras',
            icon: '🛒',
            description: 'Lista de itens adicionados com quantidade e preço. Use + e - para ajustar. X para remover.',
            tip: 'O subtotal é calculado automaticamente. O estoque só baixa ao finalizar.',
            color: '#C8A97A',
          },
          {
            title: 'Vincular cliente',
            icon: '👤',
            description: 'Busque por nome, CPF ou WhatsApp. Se não tiver cadastro, use "+ Cadastro rápido" para criar na hora.',
            tip: 'Necessário para emitir NF-e e enviar comprovante. Sempre vincule!',
            color: '#5B9CF6',
          },
          {
            title: 'Desconto',
            icon: '🏷️',
            description: 'Aplique desconto em valor fixo (R$) ou percentual (%). O desconto é aplicado no total do carrinho.',
            tip: 'Use % para descontos proporcionais. Use R$ para valores fixos de negociação.',
            color: '#F59E0B',
          },
          {
            title: 'Formas de pagamento',
            icon: '💳',
            description: 'Dinheiro (calcula troco), PIX, Débito, Crédito (escolha parcelas) ou Link Mercado Pago.',
            tip: 'PIX e Dinheiro = recebimento instantâneo. Crédito = parcelado com taxa.',
            color: '#2DD4BF',
          },
          {
            title: 'Venda Concluída',
            icon: '✅',
            description: 'Botão final. Ao clicar, o estoque é baixado, o pedido é criado e o comprovante é gerado.',
            tip: 'Antes disso, nada é registrado. Pode cancelar à vontade.',
            color: '#22C55E',
          },
          {
            title: 'Gerar proposta',
            icon: '📄',
            description: 'Gera uma proposta com QR Code PIX para o cliente pagar depois. O estoque NÃO é reservado.',
            tip: 'Ideal para quando o cliente quer levar mas não pode pagar agora.',
            color: '#A78BFA',
          },
        ],
      },
    ],
  },

  estoque: {
    moduleName: 'Estoque',
    overview: 'O módulo de Estoque gerencia todos os produtos do sistema. Cadastre, ajuste quantidades, exporte/importe e monitore níveis críticos.',
    quickStart: [
      'Clique em "+ Adicionar Produto" para cadastrar o primeiro item',
      'Configure o estoque mínimo para receber alertas automáticos',
      'Use "Ajustar Estoque" para registrar entradas, saídas ou perdas',
      'Exporte em CSV para backup ou importe em lote',
    ],
    sections: [
      {
        sectionName: 'Lista de Produtos',
        steps: [
          {
            title: 'Tabela de produtos',
            icon: '📋',
            description: 'Lista completa com código, nome, categoria, preço, estoque e status. Clique em uma linha para ver detalhes.',
            tip: 'Use a busca no topo para encontrar rápido.',
            color: '#C8A97A',
          },
          {
            title: 'Adicionar Produto',
            icon: '➕',
            description: 'Botão principal. Preencha: código interno, nome, categoria, preço, estoque inicial e estoque mínimo.',
            tip: 'O estoque inicial cria automaticamente uma movimentação "Entrada Inicial" no histórico.',
            color: '#22C55E',
          },
          {
            title: 'Badge de estoque crítico',
            icon: '🔴',
            description: 'Produtos abaixo do mínimo aparecem com badge vermelho e ícone de alerta. Administradores são notificados.',
            tip: 'Configure o mínimo corretamente — é sua rede de segurança contra rupturas.',
            color: '#EF4444',
          },
          {
            title: 'Toggle pdv_enabled',
            icon: '🏪',
            description: 'Se desativado, o produto NÃO aparece no PDV mesmo com estoque disponível. Útil para produtos em falta temporária.',
            tip: 'Desative ao invés de deletar — mantém o histórico intacto.',
            color: '#5B9CF6',
          },
        ],
      },
      {
        sectionName: 'Ações em Lote',
        steps: [
          {
            title: 'Ajustar Estoque',
            icon: '⚖️',
            description: 'Registre entradas, saídas, perdas ou devoluções. Informe quantidade, motivo e responsável.',
            tip: 'Todo ajuste fica no histórico. Use motivos claros para auditoria.',
            color: '#F59E0B',
          },
          {
            title: 'Exportar CSV',
            icon: '📤',
            description: 'Baixa a lista completa em formato CSV. Ideal para backup ou análise em planilha.',
            tip: 'Use para auditoria mensal de inventário.',
            color: '#A78BFA',
          },
          {
            title: 'Importar CSV',
            icon: '📥',
            description: 'Carregue produtos em lote. Use o modelo padrão — campos obrigatórios: internal_code, name, price_cents, stock_quantity.',
            tip: 'Baixe o modelo primeiro. Não altere os cabeçalhos.',
            color: '#2DD4BF',
          },
        ],
      },
      {
        sectionName: 'Painel Lateral de Detalhes',
        steps: [
          {
            title: 'Detalhes do produto',
            icon: '👁️',
            description: 'Ao clicar em um produto, o painel lateral mostra todas as informações: código, categoria, metal, peso, preço.',
            tip: 'Útil para verificar dados sem sair da lista.',
            color: '#6366F1',
          },
          {
            title: 'Histórico de movimentações',
            icon: '📜',
            description: 'Últimas 5 movimentações: entrada, saída, ajuste, venda. Cada registro mostra data, responsável e motivo.',
            tip: 'Para ver mais, vá ao relatório completo de estoque.',
            color: '#C8A97A',
          },
        ],
      },
    ],
  },

  pedidos: {
    moduleName: 'Pedidos',
    overview: 'Gerencie pedidos de pronta-entrega e personalizados. Crie novos pedidos, acompanhe o status e gere links de pagamento.',
    quickStart: [
      'Use "Novo pedido · Pronta entrega" para vendas rápidas do estoque',
      'Use "Novo pedido · Personalizado" para joias sob medida',
      'Filtre por status ou tipo para encontrar pedidos específicos',
      'Clique em um pedido para ver detalhes e atualizar status',
    ],
    sections: [
      {
        sectionName: 'Criação de Pedidos',
        steps: [
          {
            title: 'Pronta entrega',
            icon: '📦',
            description: 'Venda rápida de produto do estoque. Selecione cliente, descreva o item, preço e tipo de entrega.',
            tip: 'Estoque é baixado na hora da criação do pedido.',
            color: '#2DD4BF',
          },
          {
            title: 'Personalizado',
            icon: '💎',
            description: 'Joia sob encomenda. Preencha: cliente, descrição, metal, design, prazo e valor. Vai para a fila de produção.',
            tip: 'A descrição do design é crucial — o joalheiro usa isso como especificação.',
            color: '#C8A97A',
          },
        ],
      },
      {
        sectionName: 'Pipeline de Pedidos',
        steps: [
          {
            title: 'Lista de pedidos',
            icon: '📋',
            description: 'Todos os pedidos com número, cliente, status, valor, responsável e data. Clique para ver detalhes.',
            tip: 'Use os filtros no topo para narrowed down por status ou tipo.',
            color: '#5B9CF6',
          },
          {
            title: 'Filtros rápidos',
            icon: '🔽',
            description: 'Pílulas: Todos, Aguard. Pag., Em Produção, Prontos. Clique para filtrar instantaneamente.',
            tip: 'Use "Aguard. Pag." para cobrar clientes pendentes.',
            color: '#F59E0B',
          },
          {
            title: 'Badge de status',
            icon: '🏷️',
            description: 'Coloridos por status: Rascunho (cinza), Aguardando Pagamento (amarelo), Pago (verde), Em Produção (azul), Enviado (roxo).',
            tip: 'A cor ajuda a identificar o estado do pedido de relance.',
            color: '#A78BFA',
          },
        ],
      },
      {
        sectionName: 'Painel Lateral — Detalhes do Pedido',
        steps: [
          {
            title: 'Detalhes completos',
            icon: '👁️',
            description: 'Cliente, tipo, valor, responsável, itens, observações e detalhes do personalizado (se aplicável).',
            tip: 'Tudo que precisa para tomar decisão sobre o pedido.',
            color: '#6366F1',
          },
          {
            title: 'Atualizar status',
            icon: '🔄',
            description: 'Dropdown com todos os status possíveis. Selecione e clique em "Atualizar status" para avançar.',
            tip: 'O cliente pode ser notificado automaticamente dependendo da configuração.',
            color: '#22C55E',
          },
          {
            title: 'Gerar link Mercado Pago',
            icon: '🔗',
            description: 'Cria um link de pagamento para o cliente. Disponível enquanto o pedido estiver em rascunho ou aguardando pagamento.',
            tip: 'Envie por WhatsApp — o cliente paga em 1 clique.',
            color: '#5B9CF6',
          },
        ],
      },
    ],
  },

  clientes: {
    moduleName: 'Clientes',
    overview: 'Base unificada de clientes. Um mesmo cliente cadastrado no PDV, WhatsApp ou landing page é sempre o mesmo registro — sem duplicatas.',
    quickStart: [
      'Busque por nome, CPF ou WhatsApp para encontrar um cliente',
      'Clique em um cliente para abrir a ficha completa',
      'Use "+ Novo Cliente" para cadastro manual',
      'Filtre por origem (WhatsApp, PDV, Online, Manual)',
    ],
    sections: [
      {
        sectionName: 'Lista de Clientes',
        steps: [
          {
            title: 'Busca de clientes',
            icon: '🔍',
            description: 'Pesquise por nome, CPF ou WhatsApp. A busca é rápida e encontra parcial.',
            tip: 'Use o WhatsApp — é o identificador mais único.',
            color: '#C8A97A',
          },
          {
            title: 'Badges de origem',
            icon: '🏷️',
            description: 'WhatsApp (verde), PDV/Balcão (azul), Online (roxo), Manual (cinza). Mostra como o cliente chegou.',
            tip: 'Use para entender qual canal traz mais clientes.',
            color: '#2DD4BF',
          },
          {
            title: 'Deduplicação automática',
            icon: '🔄',
            description: 'Ao criar um cliente, o sistema verifica se o telefone já existe. Se sim, vincula ao cadastro existente.',
            tip: 'Não se preocupe com duplicatas — o sistema cuida disso.',
            color: '#A78BFA',
          },
        ],
      },
      {
        sectionName: 'Ficha do Cliente',
        steps: [
          {
            title: 'Abas da ficha',
            icon: '📑',
            description: 'Ficha (dados), Atendimento, Proposta, Pedidos, OS, Entrega, Histórico. Cada aba mostra um aspecto do relacionamento.',
            tip: 'A aba Histórico é o log completo — tudo que aconteceu com este cliente.',
            color: '#5B9CF6',
          },
          {
            title: 'Bloco de Atendimento',
            icon: '📝',
            description: 'Notas livres com formatação (negrito, itálico, lista), menção de colegas, gravação de voz e transcrição.',
            tip: 'Use para registrar preferências do cliente — ajuda no atendimento personalizado.',
            color: '#F59E0B',
          },
          {
            title: 'Mini Kanban de Status',
            icon: '📊',
            description: '5 etapas visuais: Atendimento → Proposta → Pedido → OS → Entrega. Arraste blocos entre etapas.',
            tip: 'Cada avanço registra automaticamente no histórico e pode notificar o cliente.',
            color: '#22C55E',
          },
        ],
      },
    ],
  },

  financeiro: {
    moduleName: 'Financeiro',
    overview: 'Módulo financeiro com visão de entradas, despesas e relatórios. Dados de pagamento do PDV e Mercado Pago entram automaticamente.',
    quickStart: [
      'Confira as entradas automáticas do PDV e Mercado Pago',
      'Registre despesas operacionais manualmente',
      'Use os relatórios por período para análise financeira',
      'Filtre por data ou categoria para análises específicas',
    ],
    sections: [
      {
        sectionName: 'Visão Financeira',
        steps: [
          {
            title: 'Entradas',
            icon: '💰',
            description: 'Receitas registradas automaticamente a partir de pagamentos confirmados no PDV e via Mercado Pago.',
            tip: 'Não precisa registrar manualmente — o sistema faz isso por você.',
            color: '#2DD4BF',
          },
          {
            title: 'Despesas',
            icon: '📤',
            description: 'Custos operacionais lançados manualmente pela equipe administrativa: aluguel, materiais, etc.',
            tip: 'Categorize corretamente para relatórios precisos.',
            color: '#EF4444',
          },
          {
            title: 'Relatórios por período',
            icon: '📊',
            description: 'Extratos com totais de receita, despesa e margem. Filtre por período ou categoria.',
            tip: 'Use para fechamento mensal e análise de lucratividade.',
            color: '#C8A97A',
          },
        ],
      },
    ],
  },

  analytics: {
    moduleName: 'Analytics',
    overview: 'Visão executiva com métricas consolidadas, análise de clientes e gráficos de tendência. Ideal para tomada de decisão estratégica.',
    quickStart: [
      'Selecione o período de análise (7d, 30d, 90d, personalizado)',
      'Verifique as métricas principais no topo',
      'Explore a análise de clientes por segmento',
      'Use os gráficos para identificar tendências',
    ],
    sections: [
      {
        sectionName: 'Painel de Métricas',
        steps: [
          {
            title: 'KPIs consolidados',
            icon: '📈',
            description: 'Vendas totais, ticket médio, conversão de leads e produção em andamento em uma só tela.',
            tip: 'Compare períodos diferentes para medir progresso.',
            color: '#C8A97A',
          },
          {
            title: 'Análise de clientes',
            icon: '👥',
            description: 'Segmentação por frequência de compra, valor médio e canal de origem.',
            tip: 'Identifique seus clientes VIP — compre mais de X vezes ou gaste mais de Y.',
            color: '#5B9CF6',
          },
          {
            title: 'Gráficos de tendência',
            icon: '📉',
            description: 'Evolução temporal de métricas chave. Filtre por período para ver curto ou longo prazo.',
            tip: 'Queda consistente = sinal de alerta. Ação imediata necessária.',
            color: '#A78BFA',
          },
        ],
      },
    ],
  },

  pipeline: {
    moduleName: 'Pipeline — Kanban de Leads',
    overview: 'Gerencie leads em um funil visual tipo Kanban. Arraste cards entre colunas para acompanhar o progresso de vendas.',
    quickStart: [
      'Clique em "+ Novo Lead" para cadastrar manualmente',
      'Arraste cards entre colunas para avançar etapas',
      'Clique em um card para ver detalhes completos do lead',
      'Use filtros para encontrar leads específicos',
    ],
    sections: [
      {
        sectionName: 'Quadro Kanban',
        steps: [
          {
            title: 'Colunas de etapa',
            icon: '📊',
            description: 'Cada coluna é um estágio do funil: Novo → Qualificado → Proposta Enviada → Negociação → Convertido/Perdido.',
            tip: 'Personalize as colunas nas configurações do pipeline.',
            color: '#C8A97A',
          },
          {
            title: 'Cards de lead',
            icon: '🃏',
            description: 'Cada card mostra: nome, telefone, fonte, tempo na etapa atual e tags. Arraste para mudar de etapa.',
            tip: 'Cards há muito tempo na mesma etapa precisam de ação imediata.',
            color: '#5B9CF6',
          },
          {
            title: 'Drag & Drop',
            icon: '↔️',
            description: 'Arraste um card de uma coluna para outra. O status atualiza automaticamente e registra no histórico.',
            tip: 'O sistema registra quem moveu, quando e para qual etapa.',
            color: '#2DD4BF',
          },
        ],
      },
      {
        sectionName: 'Funil de Vendas',
        steps: [
          {
            title: 'Novo',
            icon: '🟡',
            description: 'Lead acabou de chegar. Primeira interação pendente. Priorize atendimento rápido.',
            tip: 'Responder nos primeiros 5 minutos aumenta conversão em 9x.',
            color: '#F59E0B',
          },
          {
            title: 'Qualificado',
            icon: '🟣',
            description: 'Lead com perfil e interesse confirmados. Próximo passo: enviar proposta.',
            tip: 'Não pule esta etapa — qualificação ruim = proposta ruim.',
            color: '#A78BFA',
          },
          {
            title: 'Convertido',
            icon: '🟢',
            description: 'Venda concretizada! Lead virou cliente e vai para a base. Pedido registrado automaticamente.',
            tip: 'Comemore! E peça indicação — cliente satisfeito indica 3x mais.',
            color: '#22C55E',
          },
          {
            title: 'Perdido',
            icon: '🔴',
            description: 'Lead não converteu. Informe o motivo: preço, concorrente, desistiu. Fica registrado para análise.',
            tip: 'Analise os motivos de perda mensalmente — é ouro para ajustar estratégia.',
            color: '#EF4444',
          },
        ],
      },
      {
        sectionName: 'Métricas do Pipeline',
        steps: [
          {
            title: 'Taxa de conversão',
            icon: '📈',
            description: 'Percentual de leads que viraram clientes. Meta ideal: acima de 30%.',
            tip: 'Se estiver abaixo de 20%, revele sua qualificação e abordagem.',
            color: '#C8A97A',
          },
          {
            title: 'Tempo médio',
            icon: '⏱️',
            description: 'Quantos dias um lead leva de "Novo" a "Convertido". Busque reduzir este tempo.',
            tip: 'Follow-up rápido reduz tempo médio em 40%.',
            color: '#5B9CF6',
          },
        ],
      },
    ],
  },

  inbox: {
    moduleName: 'Inbox — Atendimento Omnichannel',
    overview: 'Central de atendimento unificada. WhatsApp, Instagram e Telegram em uma só fila. Responda sem sair do sistema.',
    quickStart: [
      'Clique em uma conversa na lista lateral para abrir',
      'Verifique o status: Em Atendimento, Aguardando Humano, Bot, Encerrada',
      'Responda pelo campo de texto na parte inferior',
      'Use "Assumir" para se designar como responsável',
    ],
    sections: [
      {
        sectionName: 'Lista de Conversas',
        steps: [
          {
            title: 'Sidebar de conversas',
            icon: '💬',
            description: 'Lista de todas as conversas com nome, última mensagem, tempo e status. Clique para abrir.',
            tip: 'Use a busca para encontrar conversas por nome ou telefone.',
            color: '#C8A97A',
          },
          {
            title: 'Filtro por canal',
            icon: '📱',
            description: 'Filtre por WhatsApp, Instagram ou Telegram. Cada canal tem seu ícone e cor.',
            tip: 'WhatsApp = volume maior. Instagram = leads mais jovens.',
            color: '#5B9CF6',
          },
          {
            title: 'Status de atendimento',
            icon: '🏷️',
            description: 'Em Atendimento (verde), Aguardando Humano (amarelo), Bot (roxo), Encerrada (cinza).',
            tip: 'Aguardando Humano = cliente mandou msg e ninguém assumiu. Seja rápido!',
            color: '#2DD4TF',
          },
        ],
      },
      {
        sectionName: 'Thread de Chat',
        steps: [
          {
            title: 'Campo de mensagem',
            icon: '✏️',
            description: 'Digite sua mensagem e pressione Enter ou clique em Enviar. Suporta emojis e formatação básica.',
            tip: 'Use as respostas rápidas (ícone de livro) para mensagens frequentes.',
            color: '#C8A97A',
          },
          {
            title: 'Enviar mídia',
            icon: '📷',
            description: 'Anexe fotos, vídeos ou documentos. Arraste e solte na área de chat para enviar.',
            tip: 'Fotos de produtos aumentam conversão em 60%.',
            color: '#A78BFA',
          },
          {
            title: 'Nota interna',
            icon: '📝',
            description: 'Adicione uma nota visível apenas pela equipe. Útil para registrar contexto do atendimento.',
            tip: 'Use para registrar informações que o próximo atendente precisa saber.',
            color: '#F59E0B',
          },
          {
            title: 'Assumir conversa',
            icon: '🙋',
            description: 'Clique em "Assumir" para se designar como responsável. O status muda para "Em Atendimento".',
            tip: 'Evite que dois atendentes respondam o mesmo cliente.',
            color: '#22C55E',
          },
          {
            title: 'Encerrar conversa',
            icon: '🔚',
            description: 'Finaliza o atendimento. A conversa vai para o histórico e libera a fila.',
            tip: 'Sempre encerre conversas finalizadas — mantém a fila limpa.',
            color: '#6366F1',
          },
        ],
      },
    ],
  },

  producao: {
    moduleName: 'Produção — Controle de Ordens de Serviço',
    overview: 'Gerencie ordens de serviço de joias personalizadas. Acompanhe etapas: Modelagem → Fundição → Cravação → Acabamento → Concluída.',
    quickStart: [
      'Veja todas as OS na lista com status, prazo e responsável',
      'Clique em uma OS para ver especificações técnicas',
      'Avance etapas conforme o trabalho progride',
      'Registre evidências fotográficas em cada etapa',
    ],
    sections: [
      {
        sectionName: 'Lista de OS',
        steps: [
          {
            title: 'Lista de ordens de serviço',
            icon: '📋',
            description: 'Todas as OS com cliente, especificações, etapa atual, prazo e responsável. Use filtros para encontrar rápido.',
            tip: 'Filtre por etapa para ver o que está em cada fase.',
            color: '#C8A97A',
          },
          {
            title: 'Badge de etapa',
            icon: '🏷️',
            description: 'Modelagem (dourado), Fundição (roxo), Cravação (azul), Acabamento (verde-água), Concluída (verde).',
            tip: 'A cor identifica a etapa de relance.',
            color: '#5B9CF6',
          },
        ],
      },
      {
        sectionName: 'Etapas de Produção',
        steps: [
          {
            title: 'Modelagem',
            icon: '🎨',
            description: 'Criação do modelo 3D ou físico da joia. O designer 3D recebe as especificações técnicas.',
            tip: 'A qualidade do modelo define o resultado final. Capriche.',
            color: '#C8A97A',
          },
          {
            title: 'Fundição',
            icon: '🔥',
            description: 'Derretimento e molde do metal. Etapa registrada com fotos de evidência.',
            tip: 'Fotos são obrigatórias — controle de qualidade.',
            color: '#A78BFA',
          },
          {
            title: 'Cravação',
            icon: '💎',
            description: 'Incrustação de pedras e gemas. Registrado com fotos para controle de qualidade.',
            tip: 'Verifique o tamanho e posição das pedras contra o modelo.',
            color: '#5B9CF6',
          },
          {
            title: 'Acabamento',
            icon: '✨',
            description: 'Polimento, limpeza e revisão final. Última etapa antes da entrega.',
            tip: 'Última chance de corrigir detalhes antes do cliente ver.',
            color: '#2DD4BF',
          },
          {
            title: 'Concluída',
            icon: '✅',
            description: 'Peça finalizada e aprovada. Aguardando retirada ou envio ao cliente.',
            tip: 'Notifique o cliente com foto da peça pronta.',
            color: '#22C55E',
          },
        ],
      },
      {
        sectionName: 'Ações na OS',
        steps: [
          {
            title: 'Registrar evidência',
            icon: '📷',
            description: 'Tire foto da peça na etapa atual. As fotos ficam no histórico para controle de qualidade.',
            tip: 'Boa iluminação = foto de qualidade. Use fundo branco.',
            color: '#F59E0B',
          },
          {
            title: 'Avançar etapa',
            icon: '➡️',
            description: 'Move a OS para a próxima etapa de produção. Registra automaticamente quem fez e quando.',
            tip: 'Não pule etapas — cada uma é um checkpoint de qualidade.',
            color: '#2DD4BF',
          },
          {
            title: 'Observação',
            icon: '📝',
            description: 'Adicione uma nota interna na OS. Útil para comunicar detalhes ao próximo joalheiro.',
            tip: 'Comunicação clara entre etapas evita retrabalho.',
            color: '#6366F1',
          },
        ],
      },
    ],
  },

  agenda: {
    moduleName: 'Agenda — Compromissos e Lembretes',
    overview: 'Gerencie compromissos, lembretes e follow-ups. Visualize por dia, semana ou lista. Vincule compromissos a clientes.',
    quickStart: [
      'Clique em um horário ou "+ Novo" para criar compromisso',
      'Alterne entre visualizações: Dia, Semana, Lista',
      'Vincule clientes para ver na ficha deles',
      'Configure lembretes para não esquecer',
    ],
    sections: [
      {
        sectionName: 'Visualizações',
        steps: [
          {
            title: 'Dia',
            icon: '📅',
            description: 'Visão horária do dia atual. Ideal para agenda cheia e ver lacunas entre compromissos.',
            tip: 'Use para planejar o dia com precisão.',
            color: '#C8A97A',
          },
          {
            title: 'Semana',
            icon: '📆',
            description: 'Visão semanal. Bom para planejar a semana e ver conflitos de horário.',
            tip: 'Use segunda-feira para planejar a semana toda.',
            color: '#5B9CF6',
          },
          {
            title: 'Lista',
            icon: '📋',
            description: 'Lista cronológica de compromissos. Útil para ver tudo de uma vez sem distracão visual.',
            tip: 'Melhor para telas menores ou quando tem muitos compromissos.',
            color: '#A78BFA',
          },
        ],
      },
      {
        sectionName: 'Tipos de Compromisso',
        steps: [
          {
            title: 'Reunião',
            icon: '🤝',
            description: 'Encontro com cliente ou equipe. Pode ser presencial ou online. Defina participantes e local.',
            tip: 'Envie lembrete 1h antes — reduz no-show em 50%.',
            color: '#2DD4BF',
          },
          {
            title: 'Lembrete',
            icon: '🔔',
            description: 'Alerta pessoal para tarefas importantes: ligar cliente, enviar proposta, etc.',
            tip: 'Use para coisas que não podem ser esquecidas.',
            color: '#F59E0B',
          },
          {
            title: 'Entrega',
            icon: '📦',
            description: 'Data de entrega de peça ou pedido. Vinculado automaticamente à OS ou pedido.',
            tip: 'Configure lembrete 1 dia antes — evita atrasos.',
            color: '#A78BFA',
          },
          {
            title: 'Follow-up',
            icon: '🔄',
            description: 'Retorno com cliente após proposta ou venda. Importante para conversão.',
            tip: 'Follow-up em 48h após proposta aumenta conversão em 35%.',
            color: '#5B9CF6',
          },
        ],
      },
    ],
  },

  automacoes: {
    moduleName: 'Automações — Workflows Visuais com n8n',
    overview: 'Crie automações visuais com gatilhos, condições e ações. Use automações prontas ou crie suas próprias do zero.',
    quickStart: [
      'Ative uma automação pronta com 1 clique',
      'Crie do zero com o builder visual',
      'Conecte gatilhos → condições → ações',
      'Teste antes de ativar',
    ],
    sections: [
      {
        sectionName: 'Catálogo de Automações',
        steps: [
          {
            title: 'Automações prontas',
            icon: '⚡',
            description: 'Boas-vindas WhatsApp, Lembrete de follow-up, Alerta estoque baixo, Confirmação de pagamento, Atualização de produção.',
            tip: 'Comece pelas prontas — cobrem 80% dos casos de uso.',
            color: '#C8A97A',
          },
          {
            title: 'Toggle Ativar/Desativar',
            icon: '🔘',
            description: 'Ligue ou pause uma automação. Automações desativadas não consomem recursos.',
            tip: 'Desative automações que não está usando — economiza processamento.',
            color: '#22C55E',
          },
        ],
      },
      {
        sectionName: 'Builder Visual',
        steps: [
          {
            title: 'Gatilho (Trigger)',
            icon: '⚡',
            description: 'Evento que inicia o fluxo: novo lead, mensagem recebida, pagamento confirmado, etc.',
            tip: 'Escolha o gatilho certo — é o ponto de partida de tudo.',
            color: '#F59E0B',
          },
          {
            title: 'Condição (If/Else)',
            icon: '🔀',
            description: 'Ramifica o fluxo baseado em regra: valor do pedido, tipo de cliente, horário, etc.',
            tip: 'Use para personalizar o comportamento baseado em contexto.',
            color: '#5B9CF6',
          },
          {
            title: 'Ação (Send Message)',
            icon: '📤',
            description: 'Envia WhatsApp, email ou notificação no sistema. Use variáveis do contexto para personalizar.',
            tip: 'Use {{cliente.nome}} para personalizar — aumenta engajamento.',
            color: '#A78BFA',
          },
          {
            title: 'Delay (Espera)',
            icon: '⏳',
            description: 'Aguarda X minutos/horas/dias antes de continuar. Útil para sequências de follow-up.',
            tip: 'Não exagere nos delays — follow-up rápido é mais eficaz.',
            color: '#2DD4BF',
          },
          {
            title: 'Update Record',
            icon: '🗄️',
            description: 'Atualiza dados no banco: muda status de lead, cria tarefa, registra evento, etc.',
            tip: 'Use para manter o CRM sincronizado com as automações.',
            color: '#6366F1',
          },
        ],
      },
    ],
  },

  loja: {
    moduleName: 'Loja Virtual — E-commerce',
    overview: 'Gerencie sua vitrine online. Selecione produtos, defina fotos e descrições. Clientes navegam, adicionam ao carrinho e enviam pedidos.',
    quickStart: [
      'Selecione quais produtos aparecem na loja',
      'Defina fotos e descrições atrativas',
      'Acompanhe pedidos que chegam pelo Inbox',
      'Confirme disponibilidade e feche a venda',
    ],
    sections: [
      {
        sectionName: 'Gerenciamento da Loja',
        steps: [
          {
            title: 'Catálogo público',
            icon: '🏪',
            description: 'Sua vitrine online acessível em /catalogo. Clientes navegam produtos, adicionam ao carrinho e fazem pedido.',
            tip: 'Mantenha o catálogo atualizado — clientes esperam produtos disponíveis.',
            color: '#C8A97A',
          },
          {
            title: 'Gerenciar produtos',
            icon: '✏️',
            description: 'Selecione quais produtos do estoque aparecem na loja. Defina fotos, descrições e destaque.',
            tip: 'Fotos de qualidade = mais vendas. Invista em boas fotos.',
            color: '#5B9CF6',
          },
          {
            title: 'Carrinho online',
            icon: '🛒',
            description: 'Cliente adiciona produtos, define quantidades e envia pedido. Estoque NÃO é reservado automaticamente.',
            tip: 'Confirme disponibilidade antes de fechar — evita frustração.',
            color: '#2DD4BF',
          },
          {
            title: 'Pedido via WhatsApp',
            icon: '💬',
            description: 'O pedido do cliente chega como mensagem no Inbox. Atendente confirma disponibilidade e fecha venda.',
            tip: 'Responda rápido — cliente pode desistir se esperar muito.',
            color: '#22C55E',
          },
          {
            title: 'Pagamento PIX',
            icon: '📱',
            description: 'Gere QR Code PIX para o cliente pagar. Confirmação automática via webhook do Mercado Pago.',
            tip: 'PIX = pagamento instantâneo. Sem espera de compensação.',
            color: '#A78BFA',
          },
        ],
      },
    ],
  },

  ajustes: {
    moduleName: 'Ajustes — Configurações Avançadas',
    overview: 'Configurações do sistema: dados da empresa, usuários, notificações, segurança, integrações e IA Copiloto.',
    quickStart: [
      'Configure os dados da empresa (nome, CNPJ, logo)',
      'Adicione usuários e defina permissões',
      'Configure integrações com Meta, n8n e Mercado Pago',
      'Ajuste notificações e preferências de segurança',
    ],
    sections: [
      {
        sectionName: 'Abas de Configuração',
        steps: [
          {
            title: 'Empresa',
            icon: '🏢',
            description: 'Nome, CNPJ, telefone, endereço, logo e cor primária da marca. Essas informações aparecem em recibos e NF-e.',
            tip: 'Mantenha atualizado — dados errados = problemas fiscais.',
            color: '#C8A97A',
          },
          {
            title: 'Usuários',
            icon: '👥',
            description: 'Adicione, edite e remova usuários. Defina roles (Root, Admin, Gerente, Vendedor, etc.) e permissões por módulo.',
            tip: 'Siga o princípio do menor privilégio — dê apenas o acesso necessário.',
            color: '#5B9CF6',
          },
          {
            title: 'Notificações',
            icon: '🔔',
            description: 'Configure quais notificações receber: novo lead, pedido pago, produção atrasada, lead inativo, meta atingida.',
            tip: 'Não desative notificações críticas — você pode perder oportunidades.',
            color: '#F59E0B',
          },
          {
            title: 'Segurança',
            icon: '🔒',
            description: 'Alterar senha, sessões ativas, 2FA (se disponível). Mantenha sua conta segura.',
            tip: 'Use senhas fortes e únicas. Ative 2FA se disponível.',
            color: '#EF4444',
          },
          {
            title: 'Integrações',
            icon: '🔗',
            description: 'Meta (WhatsApp Cloud API), n8n (automações), Mercado Pago (pagamentos). Configure cada uma com suas credenciais.',
            tip: 'Siga o guia de integração passo a passo — não pule etapas.',
            color: '#A78BFA',
          },
          {
            title: 'IA Copiloto',
            icon: '🤖',
            description: 'Configure o assistente IA: modelo, temperatura, prompts do sistema e permissões de acesso.',
            tip: 'Ajuste a temperatura: baixa = respostas precisas, alta = mais criativas.',
            color: '#2DD4BF',
          },
        ],
      },
    ],
  },

  settings: {
    moduleName: 'Configurações',
    overview: 'Configurações gerais do sistema. Inclui dados da empresa, preferências de usuário e integrações.',
    quickStart: [
      'Navegue pelas abas laterais para encontrar a configuração desejada',
      'Sempre salve após fazer alterações',
      'Verifique as integrações ativas',
    ],
    sections: [
      {
        sectionName: 'Configurações Gerais',
        steps: [
          {
            title: 'Endereço da empresa',
            icon: '📍',
            description: 'Endereço completo usado em NF-e e documentos fiscais.',
            tip: 'Mantenha atualizado — endereço errado = NF-e inválida.',
            color: '#C8A97A',
          },
        ],
      },
    ],
  },

  'ficha-cliente': {
    moduleName: 'Ficha do Cliente',
    overview: 'Cadastro completo do cliente com dados pessoais, histórico de atendimentos, propostas, pedidos, OS e entregas.',
    quickStart: [
      'Preencha os dados pessoais e de contato',
      'Use o bloco de atendimento para registrar interações',
      'Avance o status no Mini Kanban conforme o atendimento progride',
      'Navegue pelas abas para ver propostas, pedidos e OS',
    ],
    sections: [
      {
        sectionName: 'Toolbar do Bloco de Nota',
        steps: [
          {
            title: 'Negrito (Ctrl+B)',
            icon: '𝐁',
            description: 'Deixa o texto selecionado em negrito. Use para destacar informações importantes.',
            color: '#C8A97A',
          },
          {
            title: 'Itálico (Ctrl+I)',
            icon: '𝐼',
            description: 'Deixa o texto selecionado em itálico. Use para observações ou citações.',
            color: '#5B9CF6',
          },
          {
            title: 'Lista',
            icon: '📝',
            description: 'Cria uma lista com marcadores. Útil para listar preferências do cliente.',
            color: '#A78BFA',
          },
          {
            title: 'Mencionar (@)',
            icon: '@',
            description: 'Menciona um colega de equipe na nota. Ele receberá uma notificação.',
            tip: 'Use para delegar tarefas ou pedir ajuda.',
            color: '#F59E0B',
          },
          {
            title: 'Gravar voz',
            icon: '🎙️',
            description: 'Grava áudio e transcreve automaticamente para texto na nota.',
            tip: 'Útil quando está atendendo e não pode digitar.',
            color: '#2DD4BF',
          },
          {
            title: 'Canal do atendimento',
            icon: '📱',
            description: 'Define por qual canal este atendimento aconteceu: WhatsApp, Presencial ou E-mail.',
            tip: 'Sempre registre — ajuda a entender os canais mais usados.',
            color: '#6366F1',
          },
        ],
      },
      {
        sectionName: 'Abas do Painel',
        steps: [
          {
            title: 'Ficha',
            icon: '👤',
            description: 'Cadastro completo: dados pessoais, contatos, endereço, preferências e dados para NF-e.',
            color: '#C8A97A',
          },
          {
            title: 'Atendimento',
            icon: '💬',
            description: 'Blocos de atendimento que ainda não chegaram à fabricação. Cada bloco registra uma conversa.',
            color: '#5B9CF6',
          },
          {
            title: 'Proposta',
            icon: '📄',
            description: 'Propostas comerciais geradas, com QR Code PIX e status de pagamento.',
            color: '#A78BFA',
          },
          {
            title: 'Pedidos',
            icon: '🛍️',
            description: 'Pedidos confirmados: produtos de pronta entrega ou catálogo.',
            color: '#2DD4TF',
          },
          {
            title: 'OS (Ordem de Serviço)',
            icon: '⚙️',
            description: 'Ordens de serviço aprovadas para fabricação. Visível pelo fabricante e designer 3D.',
            color: '#F59E0B',
          },
          {
            title: 'Histórico',
            icon: '📜',
            description: 'Log completo de tudo que aconteceu com este cliente.',
            tip: 'Use para entender toda a jornada do cliente.',
            color: '#6366F1',
          },
        ],
      },
    ],
  },
};
