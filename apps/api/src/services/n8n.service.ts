import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

export interface N8nTag {
    id?: string;
    name: string;
}

export interface N8nNode {
    id: string;
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, unknown>;
    credentials?: Record<string, { id: string; name: string }>;
}

export interface N8nConnections {
    [sourceNode: string]: {
        main?: Array<Array<{ node: string; type: string; index: number }>>;
    };
}

export interface N8nWorkflow {
    id?: string;
    name: string;
    active: boolean;
    nodes: N8nNode[];
    connections: N8nConnections;
    settings?: Record<string, unknown>;
    staticData?: Record<string, unknown>;
    tags?: Array<N8nTag | string>;
    createdAt?: string;
    updatedAt?: string;
}

export interface N8nExecution {
    id: string;
    workflowId?: string;
    status?: string;
    startedAt?: string;
    stoppedAt?: string;
    finished?: boolean;
    mode?: string;
}

interface PaginatedResponse<T> {
    data: T[];
    nextCursor?: string | null;
}

function extractErrorMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    if ('message' in payload && typeof payload.message === 'string') return payload.message;
    if ('error' in payload && typeof payload.error === 'string') return payload.error;
    return null;
}

function parsePaginatedData<T>(payload: unknown): PaginatedResponse<T> {
    if (Array.isArray(payload)) {
        return { data: payload as T[] };
    }

    if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown[] }).data)) {
        return {
            data: (payload as { data: T[] }).data,
            nextCursor: typeof (payload as { nextCursor?: unknown }).nextCursor === 'string'
                ? (payload as { nextCursor: string }).nextCursor
                : null,
        };
    }

    return { data: [] };
}

function assertN8nConfigured() {
    const config = env();
    const baseUrl = config.N8N_URL ?? 'http://n8n:5678';
    const apiKey = config.N8N_API_KEY;

    if (!apiKey) {
        throw AppError.serviceUnavailable(
            'N8N_NOT_CONFIGURED',
            'Integração n8n indisponível neste ambiente.'
        );
    }

    return { baseUrl, apiKey };
}

export class N8nService {
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor() {
        const config = assertN8nConfigured();
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey;
    }

    private async request<T>(path: string, init?: RequestInit): Promise<T> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers: {
                'X-N8N-API-KEY': this.apiKey,
                'Content-Type': 'application/json',
                ...(init?.headers ?? {}),
            },
        }).catch(() => {
            throw AppError.serviceUnavailable(
                'N8N_UNAVAILABLE',
                'n8n temporariamente indisponível.'
            );
        });

        const bodyText = await response.text();
        let payload: unknown = null;

        if (bodyText) {
            try {
                payload = JSON.parse(bodyText) as unknown;
            } catch {
                payload = { message: bodyText };
            }
        }

        if (!response.ok) {
            if (response.status === 404) {
                throw AppError.notFound('Workflow não encontrado no n8n.');
            }

            const message = extractErrorMessage(payload) ?? 'Falha ao comunicar com n8n.';
            throw AppError.serviceUnavailable('N8N_REQUEST_FAILED', message);
        }

        return payload as T;
    }

    async listWorkflows(limit = 100): Promise<N8nWorkflow[]> {
        const workflows: N8nWorkflow[] = [];
        let cursor: string | null = null;
        let loops = 0;

        do {
            const qs = new URLSearchParams();
            qs.set('limit', String(limit));
            if (cursor) qs.set('cursor', cursor);

            const payload = await this.request<unknown>(`/api/v1/workflows?${qs.toString()}`, {
                method: 'GET',
            });
            const parsed = parsePaginatedData<N8nWorkflow>(payload);
            workflows.push(...parsed.data);
            cursor = parsed.nextCursor ?? null;
            loops += 1;
        } while (cursor && loops < 20);

        return workflows;
    }

    async getWorkflow(workflowId: string): Promise<N8nWorkflow> {
        return this.request<N8nWorkflow>(`/api/v1/workflows/${workflowId}`, {
            method: 'GET',
        });
    }

    async createWorkflow(payload: N8nWorkflow): Promise<N8nWorkflow> {
        return this.request<N8nWorkflow>('/api/v1/workflows', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async updateWorkflow(workflowId: string, payload: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
        return this.request<N8nWorkflow>(`/api/v1/workflows/${workflowId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    }

    async deleteWorkflow(workflowId: string): Promise<void> {
        await this.request<unknown>(`/api/v1/workflows/${workflowId}`, {
            method: 'DELETE',
        });
    }

    async toggleWorkflow(workflowId: string, active: boolean): Promise<N8nWorkflow> {
        const action = active ? 'activate' : 'deactivate';
        const payload = await this.request<unknown>(`/api/v1/workflows/${workflowId}/${action}`, {
            method: 'POST',
        });

        if (payload && typeof payload === 'object' && 'id' in payload) {
            return payload as N8nWorkflow;
        }

        return this.getWorkflow(workflowId);
    }

    async listExecutions(workflowId: string, limit = 20): Promise<N8nExecution[]> {
        const qs = new URLSearchParams();
        qs.set('workflowId', workflowId);
        qs.set('limit', String(limit));

        const payload = await this.request<unknown>(`/api/v1/executions?${qs.toString()}`, {
            method: 'GET',
        });

        return parsePaginatedData<N8nExecution>(payload).data;
    }
}
