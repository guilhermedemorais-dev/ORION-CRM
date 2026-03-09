import type { N8nWorkflow } from '../services/n8n.service.js';

const SYSTEM_TAG = [{ name: 'sistema' }, { name: 'orion-system' }];

export const SYSTEM_WORKFLOWS: N8nWorkflow[] = [
    {
        name: 'WF-A-novo-lead',
        active: false,
        tags: SYSTEM_TAG,
        nodes: [
            {
                parameters: {
                    httpMethod: 'POST',
                    path: 'orion-lead-captured',
                    responseMode: 'onReceived',
                },
                id: 'WebhookLead',
                name: 'Webhook Lead Capturado',
                type: 'n8n-nodes-base.webhook',
                typeVersion: 2,
                position: [260, 280],
            },
            {
                parameters: {
                    jsCode: "const body = $json.body ?? $json;\nreturn [{ json: { resumo: `Novo lead recebido: ${body.name ?? 'Sem nome'} (${body.whatsapp_number ?? 'sem telefone'})`, payload: body } }];",
                },
                id: 'NormalizeLead',
                name: 'Normalizar Lead',
                type: 'n8n-nodes-base.code',
                typeVersion: 2,
                position: [520, 280],
            },
        ],
        connections: {
            'Webhook Lead Capturado': {
                main: [[{ node: 'Normalizar Lead', type: 'main', index: 0 }]],
            },
        },
        settings: {},
    },
    {
        name: 'WF-B-bot-triagem',
        active: false,
        tags: SYSTEM_TAG,
        nodes: [
            {
                parameters: {
                    path: 'orion-bot-triagem',
                    httpMethod: 'POST',
                    responseMode: 'onReceived',
                },
                id: 'WebhookTriagem',
                name: 'Webhook Triagem',
                type: 'n8n-nodes-base.webhook',
                typeVersion: 2,
                position: [260, 280],
            },
            {
                parameters: {
                    url: 'http://api:4000/api/v1/n8n/webhook/new-message',
                    authentication: 'predefinedCredentialType',
                    nodeCredentialType: 'httpHeaderAuth',
                    sendBody: true,
                    specifyBody: 'json',
                    jsonBody: '={{$json.body ?? $json}}',
                },
                id: 'PostToApi',
                name: 'Enviar para ORION API',
                type: 'n8n-nodes-base.httpRequest',
                typeVersion: 4.2,
                position: [540, 280],
            },
        ],
        connections: {
            'Webhook Triagem': {
                main: [[{ node: 'Enviar para ORION API', type: 'main', index: 0 }]],
            },
        },
        settings: {},
    },
    {
        name: 'WF-C-handoff',
        active: false,
        tags: SYSTEM_TAG,
        nodes: [
            {
                parameters: {
                    path: 'orion-handoff',
                    httpMethod: 'POST',
                    responseMode: 'onReceived',
                },
                id: 'WebhookHandoff',
                name: 'Webhook Handoff',
                type: 'n8n-nodes-base.webhook',
                typeVersion: 2,
                position: [260, 280],
            },
            {
                parameters: {
                    method: 'POST',
                    url: '={{`http://api:4000/api/v1/inbox/conversations/${$json.body.conversation_id}/handoff`}}',
                    authentication: 'predefinedCredentialType',
                    nodeCredentialType: 'httpHeaderAuth',
                },
                id: 'CallHandoff',
                name: 'Acionar Handoff',
                type: 'n8n-nodes-base.httpRequest',
                typeVersion: 4.2,
                position: [560, 280],
            },
        ],
        connections: {
            'Webhook Handoff': {
                main: [[{ node: 'Acionar Handoff', type: 'main', index: 0 }]],
            },
        },
        settings: {},
    },
    {
        name: 'WF-D-status-pedido',
        active: false,
        tags: SYSTEM_TAG,
        nodes: [
            {
                parameters: {
                    path: 'orion-order-status',
                    httpMethod: 'POST',
                    responseMode: 'onReceived',
                },
                id: 'WebhookStatus',
                name: 'Webhook Status Pedido',
                type: 'n8n-nodes-base.webhook',
                typeVersion: 2,
                position: [260, 280],
            },
            {
                parameters: {
                    method: 'POST',
                    url: 'http://api:4000/api/v1/n8n/webhook/order-status',
                    authentication: 'predefinedCredentialType',
                    nodeCredentialType: 'httpHeaderAuth',
                    sendBody: true,
                    specifyBody: 'json',
                    jsonBody: '={{$json.body ?? $json}}',
                },
                id: 'ForwardStatus',
                name: 'Repassar Status',
                type: 'n8n-nodes-base.httpRequest',
                typeVersion: 4.2,
                position: [540, 280],
            },
        ],
        connections: {
            'Webhook Status Pedido': {
                main: [[{ node: 'Repassar Status', type: 'main', index: 0 }]],
            },
        },
        settings: {},
    },
];

