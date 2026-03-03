import 'server-only';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export interface ApiListResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}

export interface LeadRecord {
    id: string;
    name: string | null;
    whatsapp_number: string;
    email: string | null;
    stage: 'NOVO' | 'QUALIFICADO' | 'PROPOSTA_ENVIADA' | 'NEGOCIACAO' | 'CONVERTIDO' | 'PERDIDO';
    source: 'WHATSAPP' | 'BALCAO' | 'INDICACAO' | 'OUTRO';
    notes: string | null;
    converted_customer_id: string | null;
    last_interaction_at: string | null;
    created_at: string;
    updated_at: string;
    assigned_to: { id: string; name: string } | null;
}

export interface CustomerRecord {
    id: string;
    name: string;
    whatsapp_number: string;
    email: string | null;
    cpf?: string | null;
    notes?: string | null;
    total_orders?: number;
    lifetime_value_cents: number;
    created_at: string;
    updated_at: string;
    assigned_to: { id: string; name: string } | null;
}

export interface InboxConversationRecord {
    id: string;
    whatsapp_number: string;
    status: 'BOT' | 'AGUARDANDO_HUMANO' | 'EM_ATENDIMENTO' | 'ENCERRADA';
    assigned_to: { id: string; name: string } | null;
    lead: { id: string; name: string | null } | null;
    customer: { id: string; name: string } | null;
    last_message_preview: string | null;
    last_message_at: string | null;
    unread_count: number;
}

export interface InboxMessageRecord {
    id: string;
    meta_message_id: string | null;
    direction: 'INBOUND' | 'OUTBOUND';
    type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'TEMPLATE';
    content: string | null;
    media_url: string | null;
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    is_automated: boolean;
    sent_by: { id: string; name: string } | null;
    created_at: string;
}

export interface InboxConversationResponse {
    conversation: Omit<InboxConversationRecord, 'unread_count'>;
    messages: InboxMessageRecord[];
}

export interface PublicSettings {
    company_name: string;
    logo_url: string | null;
    primary_color: string;
    favicon_url: string | null;
}

function getApiBaseUrl(): string {
    return process.env.ORION_API_URL ?? 'http://localhost:4000/api/v1';
}

async function parseJson<T>(response: Response): Promise<T> {
    const payload = await response.text();

    if (!payload) {
        return {} as T;
    }

    return JSON.parse(payload) as T;
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
    const response = await fetch(`${getApiBaseUrl()}/settings/public`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        return {
            company_name: 'ORION CRM',
            logo_url: null,
            primary_color: '#C8A97A',
            favicon_url: null,
        };
    }

    return parseJson<PublicSettings>(response);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const session = getSession();
    const headers = new Headers(init?.headers);

    if (session?.accessToken) {
        headers.set('Authorization', `Bearer ${session.accessToken}`);
    }

    if (init?.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
    });

    if (response.status === 401) {
        redirect('/login');
    }

    const data = await parseJson<Record<string, unknown>>(response);

    if (!response.ok) {
        const message = typeof data.message === 'string' ? data.message : 'Falha ao processar a solicitação.';
        throw new Error(message);
    }

    return data as T;
}
