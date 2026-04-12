import React from 'react';
import {
  Bold, Italic, Underline, List, AtSign, Mic,
  MessageCircle, AlertCircle, Circle, User, MessageSquare,
  FileText, ShoppingBag, Settings, Truck, Clock,
  Search, ShoppingCart, Tag, CreditCard, CheckCircle,
  Plus, BarChart2, Download, Eye, Shield, Package,
  Gem, Monitor, Users, Globe, Edit, Bell,
  Phone, Instagram, Send, Calendar, Zap,
  Store, Wrench, Play, Pause, Square, Trash2,
  Save, RotateCcw, Camera, MapPin, DollarSign,
  PieChart, TrendingUp, Key, Lock, Palette,
  Database, Workflow, Bot, Sparkles, Headphones,
  Printer, QrCode, Receipt, Percent, ArrowUpRight,
  ArrowDownRight, XCircle, Filter, SortAsc,
  Link2, Copy, ExternalLink, Info, BookOpen,
  LifeBuoy, ChevronRight, CheckSquare,
} from 'lucide-react';
import type { HelpContext } from '@/hooks/useHelpContext';

export interface HelpItem {
  icon: React.ReactNode;
  label: string;
  description: string;
}

export interface HelpSectionData {
  title: string;
  items: HelpItem[];
}

export interface HelpContextData {
  pageTitle: string;
  sections: HelpSectionData[];
}

export const HELP_CONTENT: Record<HelpContext, HelpContextData> = {
  'ficha-cliente': {
    pageTitle: 'Ficha do Cliente',
    sections: [
      {
        title: 'Toolbar do Bloco de Nota',
        items: [
          { icon: <Bold size={13} />,         label: 'Negrito (B)',                  description: 'Deixa o texto selecionado em negrito. Atalho: Ctrl+B' },
          { icon: <Italic size={13} />,       label: 'Itálico (I)',                  description: 'Deixa o texto selecionado em itálico. Atalho: Ctrl+I' },
          { icon: <Underline size={13} />,    label: 'Sublinhado (U)',               description: 'Sublinha o texto selecionado. Atalho: Ctrl+U' },
          { icon: <List size={13} />,         label: 'Lista',                        description: 'Cria uma lista com marcadores. Útil para listar preferências do cliente.' },
          { icon: <AtSign size={13} />,       label: 'Mencionar (@)',                description: 'Menciona um colega de equipe na nota. Ele receberá uma notificação.' },
          { icon: <Mic size={13} />,          label: 'Gravar voz',                   description: 'Grava áudio e transcreve automaticamente para texto na nota. Clique para iniciar, clique novamente para parar.' },
          { icon: <MessageCircle size={13} />, label: 'Canal (WhatsApp / Presencial / E-mail)', description: 'Define por qual canal este atendimento aconteceu. Fica registrado no histórico.' },
          { icon: <AlertCircle size={13} />,  label: 'Prioridade (Normal / Urgente)', description: 'Define a prioridade deste bloco. Blocos urgentes aparecem com destaque na lista.' },
        ],
      },
      {
        title: 'Status do Atendimento (Mini Kanban)',
        items: [
          { icon: <Circle size={13} color="#C8A97A" />, label: 'Atendimento', description: 'Estágio inicial. O cliente está sendo atendido, informações sendo coletadas.' },
          { icon: <Circle size={13} color="#A78BFA" />, label: 'Proposta',    description: 'Uma proposta foi gerada e enviada ao cliente. Aguardando resposta.' },
          { icon: <Circle size={13} color="#5B9CF6" />, label: 'Pedido',      description: 'Cliente aprovou. Pedido confirmado com sinal ou pagamento.' },
          { icon: <Circle size={13} color="#2DD4BF" />, label: 'OS (Ordem de Serviço)', description: 'Peça aprovada para fabricação. O fabricante recebe as especificações técnicas.' },
          { icon: <Circle size={13} color="#3FB87A" />, label: 'Entrega',     description: 'Peça pronta. Aguardando retirada na loja ou envio ao cliente.' },
        ],
      },
      {
        title: 'Abas do Painel',
        items: [
          { icon: <User size={13} />,         label: 'Ficha',       description: 'Cadastro completo do cliente: dados pessoais, contatos, endereço, preferências e dados para emissão de NF-e.' },
          { icon: <MessageSquare size={13} />, label: 'Atendimento', description: 'Blocos de atendimento que ainda não chegaram à fabricação. Cada bloco registra uma conversa, preferência ou orçamento do cliente.' },
          { icon: <FileText size={13} />,     label: 'Proposta',    description: 'Propostas comerciais geradas para este cliente, com QR Code PIX e status de pagamento.' },
          { icon: <ShoppingBag size={13} />,  label: 'Pedidos',     description: 'Pedidos confirmados: produtos de pronta entrega comprados no PDV ou catálogo.' },
          { icon: <Settings size={13} />,     label: 'OS (Ordem de Serviço)', description: 'Ordens de serviço aprovadas para fabricação. Visível pelo fabricante e designer 3D. Aqui não é possível criar novas OS — elas vêm da aba Atendimento.' },
          { icon: <Truck size={13} />,        label: 'Entrega',     description: 'Acompanhamento de entrega: retirada na loja ou envio. Histórico de rastreio.' },
          { icon: <Clock size={13} />,        label: 'Histórico',   description: 'Log completo de tudo que aconteceu: atendimentos, mudanças de etapa, mensagens WhatsApp, e-mails e avaliações do cliente.' },
        ],
      },
    ],
  },

  pdv: {
    pageTitle: 'PDV — Ponto de Venda',
    sections: [
      {
        title: 'Como usar o PDV',
        items: [
          { icon: <Search size={13} />,       label: 'Buscar produto (F2)',      description: 'Pressione F2 ou clique na barra de busca para encontrar produtos por nome ou código.' },
          { icon: <ShoppingCart size={13} />, label: 'Carrinho',                 description: 'Clique em um produto para adicioná-lo ao carrinho. Use + e - para ajustar a quantidade.' },
          { icon: <User size={13} />,         label: 'Vincular cliente (opcional)', description: 'Busque o cliente por nome, CPF ou WhatsApp. Se não tiver cadastro, use "+ Cadastro rápido". Necessário para emitir NF-e e enviar comprovante.' },
          { icon: <Tag size={13} />,          label: 'Desconto',                 description: 'Aplique desconto em R$ ou %. O desconto é aplicado no total do carrinho.' },
          { icon: <CreditCard size={13} />,   label: 'Formas de pagamento',      description: 'Dinheiro (calcula troco automaticamente), PIX, Débito, Crédito (escolha as parcelas) ou Link Mercado Pago.' },
          { icon: <CheckCircle size={13} />,  label: 'Venda Concluída',          description: 'O estoque só é baixado ao clicar em "Venda Concluída". Antes disso, nada é registrado.' },
          { icon: <FileText size={13} />,     label: 'Proposta',                 description: 'Gera uma proposta com QR Code PIX para o cliente pagar depois. O estoque não é reservado.' },
        ],
      },
    ],
  },

  estoque: {
    pageTitle: 'Estoque',
    sections: [
      {
        title: 'Controle de estoque',
        items: [
          { icon: <Plus size={13} />,          label: 'Adicionar Produto',      description: 'Cadastra um novo produto no estoque. O estoque inicial cria uma movimentação "Entrada Inicial" no histórico.' },
          { icon: <AlertCircle size={13} />,   label: 'Estoque Crítico',        description: 'Produtos com quantidade abaixo do mínimo configurado. Administradores recebem notificação automática.' },
          { icon: <BarChart2 size={13} />,     label: 'Ajustar Estoque',        description: 'Use para registrar entradas, saídas, perdas ou devoluções manuais. Todo ajuste fica no histórico com responsável.' },
          { icon: <Download size={13} />,      label: 'Exportar / Importar CSV', description: 'Exporte a lista completa em CSV. Para importar, use o modelo padrão — campos obrigatórios: internal_code, name, price_cents, stock_quantity.' },
          { icon: <Eye size={13} />,           label: 'Painel lateral',         description: 'Clique em qualquer linha para ver os detalhes do produto e as últimas 5 movimentações de estoque.' },
          { icon: <Shield size={13} />,        label: 'pdv_enabled',            description: 'Se desativado, o produto não aparece no PDV mesmo com estoque disponível.' },
        ],
      },
    ],
  },

  pedidos: {
    pageTitle: 'Pedidos',
    sections: [
      {
        title: 'Tipos de pedido',
        items: [
          { icon: <Package size={13} />,  label: 'Pronta entrega', description: 'Produtos do estoque comprados no PDV ou catálogo. Estoque baixado na hora da venda.' },
          { icon: <Gem size={13} />,      label: 'Personalizado',  description: 'Joias sob encomenda. Criadas na aba Atendimento do cliente ao avançar para status "OS".' },
          { icon: <Monitor size={13} />,  label: 'PDV',            description: 'Vendas realizadas diretamente pelo Ponto de Venda. Aparecem aqui automaticamente após conclusão.' },
        ],
      },
      {
        title: 'Ações',
        items: [
          { icon: <User size={13} />,         label: 'Ver ficha (ícone pessoa)', description: 'Abre a ficha completa do cliente vinculado ao pedido.' },
          { icon: <FileText size={13} />,     label: 'NF-e (ícone nota)',        description: 'Solicita emissão de nota fiscal. Requer CPF/CNPJ cadastrado na ficha do cliente.' },
          { icon: <MessageCircle size={13} />, label: 'WhatsApp (ícone mensagem)', description: 'Envia o comprovante do pedido diretamente para o WhatsApp do cliente.' },
        ],
      },
    ],
  },

  clientes: {
    pageTitle: 'Clientes',
    sections: [
      {
        title: 'Base unificada',
        items: [
          { icon: <Users size={13} />,        label: 'Uma ficha, múltiplas origens', description: 'O mesmo cliente cadastrado no PDV, pelo WhatsApp ou pela landing page é sempre o mesmo registro. Não há duplicatas entre canais.' },
          { icon: <AlertCircle size={13} />,  label: 'Deduplicação automática',      description: 'Ao criar um cliente, o sistema verifica se o telefone já existe. Se sim, vincula ao cadastro existente.' },
        ],
      },
      {
        title: 'Badges de origem',
        items: [
          { icon: <MessageCircle size={13} />, label: 'WhatsApp',    description: 'Cliente que entrou via atendimento automático ou humano pelo WhatsApp.' },
          { icon: <Monitor size={13} />,       label: 'PDV / Balcão', description: 'Cliente cadastrado durante uma venda presencial.' },
          { icon: <Globe size={13} />,         label: 'Online',       description: 'Cliente que veio pelo catálogo ou formulário online.' },
          { icon: <Edit size={13} />,          label: 'Manual',       description: 'Cadastro feito diretamente nesta tela pela equipe.' },
        ],
      },
    ],
  },

  financeiro: {
    pageTitle: 'Financeiro',
    sections: [
      {
        title: 'Módulo financeiro',
        items: [
          { icon: <CreditCard size={13} />,  label: 'Entradas',  description: 'Receitas registradas automaticamente a partir de pagamentos confirmados no PDV e via Mercado Pago.' },
          { icon: <FileText size={13} />,    label: 'Despesas',  description: 'Custos operacionais lançados manualmente pela equipe administrativa.' },
          { icon: <BarChart2 size={13} />,   label: 'Relatórios', description: 'Extratos por período com totais de receita, despesa e margem. Filtre por data ou categoria.' },
        ],
      },
    ],
  },

  analytics: {
    pageTitle: 'Analytics',
    sections: [
      {
        title: 'Leitura executiva',
        items: [
          { icon: <BarChart2 size={13} />,  label: 'Painel de métricas', description: 'Visão consolidada de vendas, ticket médio, conversão de leads e produção em andamento.' },
          { icon: <Users size={13} />,      label: 'Análise de clientes', description: 'Segmentação por frequência de compra, valor médio e canal de origem.' },
        ],
      },
    ],
  },

  pipeline: {
    pageTitle: 'Pipeline — Kanban de Leads',
    sections: [
      {
        title: 'Como usar o Pipeline',
        items: [
          { icon: <MessageSquare size={13} />, label: 'Colunas de etapa',  description: 'Cada coluna representa um estágio do funil: Novo → Qualificado → Proposta Enviada → Negociação → Convertido/Perdido.' },
          { icon: <User size={13} />,          label: 'Cards de lead',     description: 'Cada card é um lead. Mostra nome, telefone, fonte e tempo na etapa atual.' },
          { icon: <Plus size={13} />,          label: 'Novo lead',         description: 'Clique em "+ Novo Lead" para cadastrar manualmente. Leads do WhatsApp e Instagram chegam automaticamente.' },
        ],
      },
      {
        title: 'Ações no Kanban',
        items: [
          { icon: <ChevronRight size={13} />,  label: 'Arrastar entre colunas', description: 'Drag & drop para mover o lead de etapa. Atualiza o status automaticamente e registra no histórico.' },
          { icon: <Eye size={13} />,           label: 'Ver detalhes',      description: 'Clique no card para abrir ficha completa: dados, notas, tarefas, histórico e conversas vinculadas.' },
          { icon: <CheckCircle size={13} />,   label: 'Converter lead',    description: 'Arraste para "Convertido" para transformar em cliente. Sistema cria o cadastro automaticamente.' },
          { icon: <XCircle size={13} />,       label: 'Perder lead',       description: 'Arraste para "Perdido" e informe o motivo: preço, concorrente, desistiu, etc. Fica registrado para análise.' },
          { icon: <Filter size={13} />,        label: 'Filtrar leads',     description: 'Filtre por fonte, atendente responsável, data de criação ou tags. Use a busca para encontrar por nome.' },
        ],
      },
      {
        title: 'Funil de Vendas',
        items: [
          { icon: <Circle size={13} color="#C8A97A" />, label: 'Novo',          description: 'Lead acabou de chegar. Primeira interação pendente. Priorize atendimento rápido.' },
          { icon: <Circle size={13} color="#A78BFA" />, label: 'Qualificado',   description: 'Lead com perfil e interesse confirmados. Próximo passo: enviar proposta.' },
          { icon: <Circle size={13} color="#5B9CF6" />, label: 'Proposta',      description: 'Proposta comercial enviada ao cliente. Aguardando resposta ou negociação.' },
          { icon: <Circle size={13} color="#F59E0B" />, label: 'Negociação',    description: 'Cliente está negociando termos: preço, parcelamento, detalhes da peça.' },
          { icon: <Circle size={13} color="#2DD4BF" />, label: 'Convertido',    description: 'Venda concretizada! Lead virou cliente e vai para a base. Pedido registrado.' },
          { icon: <Circle size={13} color="#EF4444" />, label: 'Perdido',       description: 'Lead não converteu. Motivo registrado. Pode ser reativado no futuro com nova abordagem.' },
        ],
      },
      {
        title: 'Métricas do Pipeline',
        items: [
          { icon: <TrendingUp size={13} />,    label: 'Taxa de conversão', description: 'Percentual de leads que viraram clientes. Meta ideal: acima de 30%.' },
          { icon: <Clock size={13} />,         label: 'Tempo médio',       description: 'Quantos dias um lead leva de "Novo" a "Convertido". Busque reduzir este tempo.' },
          { icon: <BarChart2 size={13} />,     label: 'Leads por fonte',   description: 'De onde vêm seus leads: WhatsApp, Instagram, Indicação, Balcão. Invista nos canais mais eficientes.' },
        ],
      },
    ],
  },

  dashboard: {
    pageTitle: 'Dashboard — Painel de Controle',
    sections: [
      {
        title: 'Painel operacional',
        items: [
          { icon: <BarChart2 size={13} />, label: 'KPIs do dia',        description: 'Cards com métricas principais: leads novos, pedidos abertos, receita do mês, ticket médio. Clique para ver detalhes.' },
          { icon: <Bell size={13} />,      label: 'Alertas',            description: 'Notificações de estoque crítico, mensagens não lidas, produção atrasada e tarefas pendentes.' },
          { icon: <TrendingUp size={13} />, label: 'Gráficos de tendência', description: 'Evolução de receita, leads por fonte, top produtos e métodos de pagamento. Filtre por período.' },
        ],
      },
      {
        title: 'Alertas e Ações Rápidas',
        items: [
          { icon: <AlertCircle size={13} />, label: 'Estoque baixo',    description: 'Produtos abaixo do mínimo configurado. Clique para reabastecer ou ajustar o estoque.' },
          { icon: <Clock size={13} />,       label: 'Produção atrasada', description: 'Ordens de serviço com prazo vencido. Verifique com a equipe de produção.' },
          { icon: <MessageCircle size={13} />, label: 'Inbox aguardando', description: 'Conversas sem atendente. Clique para assumir e responder o cliente.' },
          { icon: <CreditCard size={13} />,  label: 'Pagamentos pendentes', description: 'Pedidos aguardando pagamento. Envie lembrete ao cliente.' },
        ],
      },
      {
        title: 'Atividade recente',
        items: [
          { icon: <Users size={13} />,       label: 'Novos leads',       description: 'Timeline de leads criados recentemente com fonte e atendente responsável.' },
          { icon: <ShoppingBag size={13} />, label: 'Pedidos atualizados', description: 'Mudanças de status, pagamentos confirmados e novas OS criadas.' },
          { icon: <CheckCircle size={13} />, label: 'Produção concluída', description: 'Peças finalizadas e prontas para entrega. Notifique o cliente.' },
        ],
      },
    ],
  },

  inbox: {
    pageTitle: 'Inbox — Atendimento Omnichannel',
    sections: [
      {
        title: 'Como usar o Inbox',
        items: [
          { icon: <Phone size={13} />,       label: 'WhatsApp',             description: 'Conversas do WhatsApp integradas via Meta Cloud API. Mensagens chegam em tempo real. Responda diretamente pelo chat.' },
          { icon: <Instagram size={13} />,   label: 'Instagram',            description: 'DMs e mensagens do Instagram centralizadas aqui. Responda sem sair do sistema.' },
          { icon: <Send size={13} />,        label: 'Telegram',             description: 'Mensagens do Telegram unificadas na mesma fila de atendimento.' },
        ],
      },
      {
        title: 'Status de Atendimento',
        items: [
          { icon: <Circle size={13} color="#2DD4BF" />, label: 'Em Atendimento', description: 'Você está ativo nesta conversa. Ninguém mais deve responder para não confundir o cliente.' },
          { icon: <Circle size={13} color="#F59E0B" />, label: 'Aguardando Humano', description: 'Cliente enviou mensagem e nenhum atendente assumiu. Clique para assumir.' },
          { icon: <Circle size={13} color="#6366F1" />, label: 'Bot',          description: 'Automação do n8n está respondendo o cliente com fluxo automático.' },
          { icon: <Circle size={13} color="#6B7280" />, label: 'Encerrada',    description: 'Conversa finalizada. Arquivada no histórico para consulta futura.' },
        ],
      },
      {
        title: 'Funcionalidades do Chat',
        items: [
          { icon: <MessageSquare size={13} />, label: 'Enviar mensagem',     description: 'Digite no campo inferior e pressione Enter ou clique em Enviar. Suporta emojis e formatação básica.' },
          { icon: <Camera size={13} />,        label: 'Enviar mídia',        description: 'Anexe fotos, vídeos ou documentos. Arraste e solte na área de chat para enviar.' },
          { icon: <BookOpen size={13} />,      label: 'Respostas rápidas',   description: 'Templates pré-configurados para respostas frequentes. Clique no ícone de livro para acessar.' },
          { icon: <Edit size={13} />,          label: 'Nota interna',        description: 'Adicione uma nota visível apenas pela equipe. Útil para registrar contexto do atendimento.' },
          { icon: <User size={13} />,          label: 'Assumir conversa',    description: 'Clique em "Assumir" para se designar como responsável. O status muda para "Em Atendimento".' },
          { icon: <XCircle size={13} />,       label: 'Encerrar conversa',   description: 'Finaliza o atendimento. A conversa vai para o histórico e libera a fila.' },
        ],
      },
      {
        title: 'Regras do WhatsApp',
        items: [
          { icon: <Clock size={13} />,   label: 'Janela de 24h',        description: 'Após a mensagem do cliente, você tem 24h para responder livremente. Depois disso, só com template aprovado.' },
          { icon: <FileText size={13} />, label: 'Templates',            description: 'Mensagens padronizadas aprovadas pela Meta. Use quando a janela de 24h expirar.' },
          { icon: <AlertCircle size={13} />, label: 'Limite de envio', description: '80 mensagens/segundo (limite da Meta). O sistema gerencia automaticamente.' },
        ],
      },
    ],
  },

  producao: {
    pageTitle: 'Produção — Controle de Ordens de Serviço',
    sections: [
      {
        title: 'Como usar o módulo de Produção',
        items: [
          { icon: <Gem size={13} />,       label: 'Ordens de Serviço (OS)',   description: 'Joias sob encomenda criadas a partir da ficha do cliente. Cada OS tem especificações técnicas, prazo e etapas.' },
          { icon: <Package size={13} />,   label: 'Lista de OS',              description: 'Todas as ordens de serviço com status, prazo e responsável. Use filtros para encontrar rapidamente.' },
        ],
      },
      {
        title: 'Etapas de Produção',
        items: [
          { icon: <Circle size={13} color="#C8A97A" />, label: 'Modelagem',     description: 'Criação do modelo 3D ou físico da joia. O designer 3D recebe as especificações técnicas.' },
          { icon: <Circle size={13} color="#A78BFA" />, label: 'Fundição',      description: 'Derretimento e molde do metal. Etapa registrada com fotos de evidência.' },
          { icon: <Circle size={13} color="#5B9CF6" />, label: 'Cravação',      description: 'Incrustação de pedras e gemas. Registrado com fotos para controle de qualidade.' },
          { icon: <Circle size={13} color="#2DD4BF" />, label: 'Acabamento',    description: 'Polimento, limpeza e revisão final. Última etapa antes da entrega.' },
          { icon: <Circle size={13} color="#3FB87A" />, label: 'Concluída',     description: 'Peça finalizada e aprovada. Aguardando retirada ou envio ao cliente.' },
        ],
      },
      {
        title: 'Ações na OS',
        items: [
          { icon: <Camera size={13} />,      label: 'Registrar evidência',  description: 'Tire foto da peça na etapa atual. As fotos ficam no histórico para controle de qualidade.' },
          { icon: <ChevronRight size={13} />, label: 'Avançar etapa',       description: 'Move a OS para a próxima etapa de produção. Registra automaticamente quem fez e quando.' },
          { icon: <MessageSquare size={13} />, label: 'Observação',         description: 'Adicione uma nota interna na OS. Útil para comunicar detalhes ao próximo joalheiro.' },
          { icon: <Eye size={13} />,         label: 'Detalhes da OS',       description: 'Veja especificações técnicas, metal, pedras, tamanho, peso estimado e fotos de cada etapa.' },
        ],
      },
    ],
  },

  agenda: {
    pageTitle: 'Agenda — Compromissos e Lembretes',
    sections: [
      {
        title: 'Como usar a Agenda',
        items: [
          { icon: <Calendar size={13} />,    label: 'Criar compromisso',    description: 'Clique em um horário ou no botão "+ Novo". Defina título, data, hora, duração e participantes.' },
          { icon: <Bell size={13} />,        label: 'Lembretes',            description: 'Configure alertas antes do compromisso: 5min, 15min, 1h, 1 dia antes. Notificação aparece no sistema.' },
          { icon: <User size={13} />,        label: 'Vincular cliente',     description: 'Associe um compromisso a um cliente existente. Aparece na ficha do cliente automaticamente.' },
        ],
      },
      {
        title: 'Tipos de compromisso',
        items: [
          { icon: <Circle size={13} color="#2DD4BF" />, label: 'Reunião',       description: 'Encontro com cliente ou equipe. Pode ser presencial ou online.' },
          { icon: <Circle size={13} color="#F59E0B" />, label: 'Lembrete',      description: 'Alerta pessoal para tarefas importantes: ligar cliente, enviar proposta, etc.' },
          { icon: <Circle size={13} color="#A78BFA" />, label: 'Entrega',       description: 'Data de entrega de peça ou pedido. Vinculado automaticamente à OS ou pedido.' },
          { icon: <Circle size={13} color="#5B9CF6" />, label: 'Follow-up',     description: 'Retorno com cliente após proposta ou venda. Importante para conversão.' },
        ],
      },
      {
        title: 'Visualizações',
        items: [
          { icon: <Calendar size={13} />,    label: 'Dia',                description: 'Visão horária do dia atual. Ideal para agenda cheia.' },
          { icon: <SortAsc size={13} />,     label: 'Semana',             description: 'Visão semanal. Bom para planejar a semana e ver conflitos.' },
          { icon: <List size={13} />,        label: 'Lista',              description: 'Lista cronológica de compromissos. Útil para ver tudo de uma vez.' },
        ],
      },
    ],
  },

  automacoes: {
    pageTitle: 'Automações — Workflows Visuais com n8n',
    sections: [
      {
        title: 'Como usar as Automações',
        items: [
          { icon: <Zap size={13} />,         label: 'Criar automação',      description: 'Clique em "+ Nova Automação". Use o builder visual para montar gatilhos, condições e ações.' },
          { icon: <Workflow size={13} />,    label: 'Builder visual',       description: 'Arraste nós de gatilho, condição, ação e delay. Conecte-os para criar o fluxo. Teste antes de ativar.' },
          { icon: <Play size={13} />,        label: 'Ativar/Desativar',     description: 'Toggle para ligar ou pausar uma automação. Automações desativadas não consomem recursos.' },
        ],
      },
      {
        title: 'Automações prontas',
        items: [
          { icon: <MessageCircle size={13} />, label: 'Boas-vindas WhatsApp', description: 'Quando um novo número escreve, envia mensagem automática de saudação e cria lead no CRM.' },
          { icon: <Calendar size={13} />,    label: 'Lembrete de follow-up', description: 'X dias após proposta enviada, envia lembrete ao atendente para cobrar resposta.' },
          { icon: <Bell size={13} />,        label: 'Alerta estoque baixo',  description: 'Quando produto atinge quantidade mínima, notifica administrador por WhatsApp e email.' },
          { icon: <DollarSign size={13} />,  label: 'Confirmação de pagamento', description: 'Ao detectar pagamento confirmado, envia comprovante ao cliente e atualiza pedido.' },
          { icon: <Camera size={13} />,      label: 'Atualização de produção', description: 'Ao avançar etapa de OS, envia foto ao cliente com status da produção.' },
        ],
      },
      {
        title: 'Componentes do Builder',
        items: [
          { icon: <Zap size={13} />,         label: 'Gatilho (Trigger)',    description: 'Evento que inicia o fluxo: novo lead, mensagem recebida, pagamento confirmado, etc.' },
          { icon: <Filter size={13} />,      label: 'Condição (If/Else)',   description: 'Ramifica o fluxo baseado em regra: valor do pedido, tipo de cliente, horário, etc.' },
          { icon: <Send size={13} />,        label: 'Ação (Send Message)',  description: 'Envia WhatsApp, email ou notificação no sistema. Use variáveis do contexto.' },
          { icon: <Clock size={13} />,       label: 'Delay (Espera)',       description: 'Aguarda X minutos/horas/dias antes de continuar. Útil para sequências de follow-up.' },
          { icon: <Database size={13} />,    label: 'Ação (Update Record)', description: 'Atualiza dados no banco: muda status de lead, cria tarefa, registra evento, etc.' },
        ],
      },
    ],
  },

  loja: {
    pageTitle: 'Loja Virtual — E-commerce',
    sections: [
      {
        title: 'Como usar a Loja',
        items: [
          { icon: <Store size={13} />,       label: 'Catálogo público',     description: 'Sua vitrine online acessível em /catalogo. Clientes navegam produtos, adicionam ao carrinho e fazem pedido.' },
          { icon: <Edit size={13} />,        label: 'Gerenciar produtos',   description: 'Selecione quais produtos do estoque aparecem na loja. Defina fotos, descrições e destaque.' },
        ],
      },
      {
        title: 'Funcionalidades da Loja',
        items: [
          { icon: <ShoppingCart size={13} />, label: 'Carrinho online',     description: 'Cliente adiciona produtos, define quantidades e envia pedido. Estoque não é reservado automaticamente.' },
          { icon: <MessageCircle size={13} />, label: 'Pedido via WhatsApp', description: 'O pedido do cliente chega como mensagem no Inbox. Atendente confirma disponibilidade e fecha venda.' },
          { icon: <QrCode size={13} />,      label: 'Pagamento PIX',        description: 'Gere QR Code PIX para o cliente pagar. Confirmação automática via webhook do Mercado Pago.' },
          { icon: <Link2 size={13} />,       label: 'Link de pagamento',    description: 'Link do Mercado Pago enviado ao cliente. Suporta cartão, boleto e PIX.' },
        ],
      },
      {
        title: 'Configurações da Loja',
        items: [
          { icon: <Palette size={13} />,     label: 'Personalização',       description: 'Defina cores, logo e banner da vitrine para combinar com a identidade visual da joalheria.' },
          { icon: <MapPin size={13} />,      label: 'Retirada/Entrega',     description: 'Configure opções: retirada na loja, delivery local ou envio por transportadora.' },
          { icon: <Info size={13} />,        label: 'Dados da empresa',     description: 'CNPJ, endereço e informações exibidas no rodapé da loja e no comprovante.' },
        ],
      },
    ],
  },

  ajustes: {
    pageTitle: 'Ajustes — Configurações Avançadas',
    sections: [
      {
        title: 'Módulo de Ajustes',
        items: [
          { icon: <Wrench size={13} />,      label: 'Configurações gerais', description: 'Nome da empresa, CNPJ, endereço, telefone e email de contato usados em documentos e NF-e.' },
          { icon: <Truck size={13} />,       label: 'Transportadoras',      description: 'Cadastre transportadoras parceiras com taxa, prazo e áreas de entrega.' },
          { icon: <Percent size={13} />,     label: 'Impostos e taxas',     description: 'Configure alíquotas de ICMS, IPI e outras taxas para emissão de NF-e.' },
        ],
      },
      {
        title: 'Integrações',
        items: [
          { icon: <Phone size={13} />,       label: 'WhatsApp/Evolution',   description: 'URL e chave da Evolution API para conectar WhatsApp. Teste a conexão após configurar.' },
          { icon: <CreditCard size={13} />,  label: 'Mercado Pago',         description: 'Access Token e Public Key para processar pagamentos e gerar PIX/links.' },
          { icon: <Bot size={13} />,         label: 'n8n',                  description: 'URL e credenciais do n8n para automações. Teste a conexão antes de criar workflows.' },
          { icon: <Sparkles size={13} />,    label: 'IA (Anthropic)',       description: 'API Key do Claude para assistente IA. Necessário para consultas inteligentes e sugestões.' },
        ],
      },
      {
        title: 'Importação/Exportação',
        items: [
          { icon: <Download size={13} />,    label: 'Exportar dados',       description: 'Baixe clientes, produtos e pedidos em CSV ou JSON. Útil para backup ou migração.' },
          { icon: <Plus size={13} />,        label: 'Importar CSV',         description: 'Importe produtos ou clientes em massa. Use o modelo padrão — campos obrigatórios marcados.' },
        ],
      },
    ],
  },

  settings: {
    pageTitle: 'Configurações do Sistema',
    sections: [
      {
        title: 'Configurações gerais',
        items: [
          { icon: <User size={13} />,        label: 'Minha conta',          description: 'Edite seu nome, email, foto e senha. Ative autenticação em dois fatores para mais segurança.' },
          { icon: <Bell size={13} />,        label: 'Notificações',         description: 'Configure quais alertas receber: novas mensagens, pedidos, produção, estoque. Por email, WhatsApp ou push.' },
          { icon: <Palette size={13} />,     label: 'Aparência',            description: 'Tema claro/escuro. Defina cores personalizadas para o sistema.' },
        ],
      },
      {
        title: 'Administração (somente ADMIN)',
        items: [
          { icon: <Users size={13} />,       label: 'Usuários e perfis',    description: 'Crie, edite e remova usuários. Atribua perfis: ADMIN, ATENDENTE, PRODUCAO, FINANCEIRO, MESTRE, DESIGNER_3D.' },
          { icon: <Lock size={13} />,        label: 'Permissões',           description: 'Defina o que cada perfil pode ver e fazer. Granular por módulo e ação (ler, criar, editar, excluir).' },
          { icon: <Database size={13} />,    label: 'Backup',               description: 'Agende backups automáticos do banco. Baixe backups manuais a qualquer momento.' },
          { icon: <Key size={13} />,         label: 'API Keys',             description: 'Gere chaves de API para integrações externas. Revogue chaves comprometidas.' },
          { icon: <FileText size={13} />,    label: 'Audit Log',            description: 'Log imutável de todas as ações: quem fez, o quê, quando e onde. Não pode ser editado ou excluído.' },
        ],
      },
      {
        title: 'Dados da empresa',
        items: [
          { icon: <Store size={13} />,       label: 'Dados fiscais',        description: 'CNPJ, razão social, IE, IM. Usados para emissão de NF-e e relatórios fiscais.' },
          { icon: <MapPin size={13} />,      label: 'Endereço',             description: 'Endereço completo da loja. Usado em NF-e, comprovantes e na loja virtual.' },
          { icon: <Printer size={13} />,     label: 'Impressão',            description: 'Configure modelo de recibo, tamanho de papel (80mm, A4) e impressora padrão.' },
        ],
      },
    ],
  },
};

