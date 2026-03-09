export type AutomationBuilderGroupKey = 'triggers' | 'actions' | 'control';

export interface AutomationBuilderNodeCatalogItem {
    key: string;
    label: string;
    group: AutomationBuilderGroupKey;
    n8n_type: string;
    description: string;
    parameters: string[];
}

export interface AutomationBuilderCatalogGroup {
    key: AutomationBuilderGroupKey;
    label: string;
    description: string;
    items: AutomationBuilderNodeCatalogItem[];
}

const catalogItems: AutomationBuilderNodeCatalogItem[] = [
    {
        key: 'whatsapp-new-message',
        label: 'Nova Mensagem WhatsApp',
        group: 'triggers',
        n8n_type: 'n8n-nodes-base.webhook',
        description: 'Entrada para mensagens novas vindas do WhatsApp no ORION.',
        parameters: ['path automático', 'POST'],
    },
    {
        key: 'lead-created',
        label: 'Lead Criado',
        group: 'triggers',
        n8n_type: 'n8n-nodes-base.webhook',
        description: 'Dispara quando um lead novo entra no CRM.',
        parameters: ['path automático', 'POST'],
    },
    {
        key: 'lead-stage-changed',
        label: 'Stage de Lead Alterado',
        group: 'triggers',
        n8n_type: 'n8n-nodes-base.webhook',
        description: 'Recebe movimentações de etapa no pipeline comercial.',
        parameters: ['stageDe', 'stagePara'],
    },
    {
        key: 'order-created',
        label: 'Pedido Criado',
        group: 'triggers',
        n8n_type: 'n8n-nodes-base.webhook',
        description: 'Inicia fluxos quando um pedido é criado.',
        parameters: ['path automático'],
    },
    {
        key: 'order-status-changed',
        label: 'Status de Pedido Alterado',
        group: 'triggers',
        n8n_type: 'n8n-nodes-base.webhook',
        description: 'Observa transições de status do pedido.',
        parameters: ['statusDe', 'statusPara'],
    },
    {
        key: 'schedule',
        label: 'Agendamento',
        group: 'triggers',
        n8n_type: 'n8n-nodes-base.scheduleTrigger',
        description: 'Executa por cron para follow-ups e tarefas recorrentes.',
        parameters: ['cronExpression'],
    },
    {
        key: 'external-webhook',
        label: 'Webhook Externo',
        group: 'triggers',
        n8n_type: 'n8n-nodes-base.webhook',
        description: 'Recebe chamadas externas para iniciar o fluxo.',
        parameters: ['path customizado', 'método HTTP'],
    },
    {
        key: 'send-whatsapp',
        label: 'Enviar WhatsApp',
        group: 'actions',
        n8n_type: 'n8n-nodes-base.httpRequest',
        description: 'Envia mensagem para um contato via canal integrado.',
        parameters: ['número', 'mensagem'],
    },
    {
        key: 'update-lead',
        label: 'Atualizar Lead',
        group: 'actions',
        n8n_type: 'n8n-nodes-base.httpRequest',
        description: 'Atualiza campos operacionais do lead no CRM.',
        parameters: ['leadId', 'campos'],
    },
    {
        key: 'update-order-status',
        label: 'Atualizar Status Pedido',
        group: 'actions',
        n8n_type: 'n8n-nodes-base.httpRequest',
        description: 'Move o pedido para um novo status operacional.',
        parameters: ['pedidoId', 'novoStatus'],
    },
    {
        key: 'notify-attendant',
        label: 'Notificar Atendente',
        group: 'actions',
        n8n_type: 'n8n-nodes-base.httpRequest',
        description: 'Cria uma notificação operacional para um usuário.',
        parameters: ['userId', 'mensagem'],
    },
    {
        key: 'send-email',
        label: 'Enviar Email',
        group: 'actions',
        n8n_type: 'n8n-nodes-base.emailSend',
        description: 'Envia email com assunto e corpo customizados.',
        parameters: ['para', 'assunto', 'corpo'],
    },
    {
        key: 'http-request',
        label: 'Requisição HTTP',
        group: 'actions',
        n8n_type: 'n8n-nodes-base.httpRequest',
        description: 'Chama APIs externas ou internas durante o fluxo.',
        parameters: ['url', 'método', 'headers', 'body'],
    },
    {
        key: 'wait',
        label: 'Aguardar',
        group: 'actions',
        n8n_type: 'n8n-nodes-base.wait',
        description: 'Insere uma pausa controlada antes do próximo passo.',
        parameters: ['tempo', 'unidade'],
    },
    {
        key: 'javascript-code',
        label: 'Código JavaScript',
        group: 'actions',
        n8n_type: 'n8n-nodes-base.code',
        description: 'Executa lógica customizada em JavaScript.',
        parameters: ['code'],
    },
    {
        key: 'if',
        label: 'Condicional (SE)',
        group: 'control',
        n8n_type: 'n8n-nodes-base.if',
        description: 'Divide o fluxo em verdadeiro ou falso.',
        parameters: ['campo', 'operador', 'valor'],
    },
    {
        key: 'switch',
        label: 'Switch',
        group: 'control',
        n8n_type: 'n8n-nodes-base.switch',
        description: 'Roteia o fluxo por múltiplos casos.',
        parameters: ['campo', 'casos'],
    },
    {
        key: 'split-batches',
        label: 'Dividir em Lotes',
        group: 'control',
        n8n_type: 'n8n-nodes-base.splitInBatches',
        description: 'Processa itens em grupos menores.',
        parameters: ['tamanho do lote'],
    },
];

export function getAutomationCatalog(): AutomationBuilderCatalogGroup[] {
    const groups: Array<Omit<AutomationBuilderCatalogGroup, 'items'> & {
        items: AutomationBuilderNodeCatalogItem[];
    }> = [
        {
            key: 'triggers',
            label: 'Triggers',
            description: 'Nós de entrada que iniciam workflows do ORION.',
            items: [],
        },
        {
            key: 'actions',
            label: 'Ações',
            description: 'Nós operacionais que executam trabalho útil no fluxo.',
            items: [],
        },
        {
            key: 'control',
            label: 'Controle',
            description: 'Nós de decisão e controle de fluxo.',
            items: [],
        },
    ];

    for (const item of catalogItems) {
        const group = groups.find((candidate) => candidate.key === item.group);
        if (group) {
            group.items.push(item);
        }
    }

    return groups;
}
