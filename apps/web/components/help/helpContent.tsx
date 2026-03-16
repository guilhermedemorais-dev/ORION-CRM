import React from 'react';
import {
  Bold, Italic, Underline, List, AtSign, Mic,
  MessageCircle, AlertCircle, Circle, User, MessageSquare,
  FileText, ShoppingBag, Settings, Truck, Clock,
  Search, ShoppingCart, Tag, CreditCard, CheckCircle,
  Plus, BarChart2, Download, Eye, Shield, Package,
  Gem, Monitor, Users, Globe, Edit, Bell,
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
    pageTitle: 'Pipeline',
    sections: [
      {
        title: 'Kanban de leads',
        items: [
          { icon: <MessageSquare size={13} />, label: 'Colunas de etapa', description: 'Cada coluna representa um estágio do funil. Arraste cards entre colunas para avançar o lead.' },
          { icon: <User size={13} />,          label: 'Ficha do lead',    description: 'Clique no card para ver histórico, tarefas e dados de contato do lead.' },
        ],
      },
    ],
  },

  dashboard: {
    pageTitle: 'Dashboard',
    sections: [
      {
        title: 'Painel operacional',
        items: [
          { icon: <BarChart2 size={13} />, label: 'Resumo do dia',    description: 'Visão rápida de atendimentos em aberto, OS em produção e pedidos aguardando entrega.' },
          { icon: <Bell size={13} />,      label: 'Notificações',     description: 'Alertas de estoque crítico, mensagens não lidas e tarefas pendentes.' },
        ],
      },
    ],
  },
};

