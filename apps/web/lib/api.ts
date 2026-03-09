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
    pipeline_id: string;
    stage_id?: string | null;
    stage_name?: string | null;
    stage_color?: string | null;
    stage_is_won?: boolean | null;
    stage_is_lost?: boolean | null;
    estimated_value?: number;
    quick_note?: string | null;
    custom_fields?: Record<string, unknown>;
    open_tasks_count?: number;
    last_task_at?: string | null;
    source: 'WHATSAPP' | 'BALCAO' | 'INDICACAO' | 'OUTRO';
    notes: string | null;
    converted_customer_id: string | null;
    last_interaction_at: string | null;
    created_at: string;
    updated_at: string;
    assigned_to: { id: string; name: string } | null;
}

export interface PipelineStageRecord {
    id: string;
    pipeline_id?: string;
    name: string;
    color: string;
    position: number;
    is_won: boolean;
    is_lost: boolean;
    created_at: string;
}

export interface PipelineRecord {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string;
    is_active: boolean;
    is_default: boolean;
    flow_json: Record<string, unknown>;
    published_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
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
    channel: 'whatsapp' | 'instagram' | 'telegram' | 'tiktok' | 'messenger';
    external_id: string;
    whatsapp_number: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_handle: string | null;
    status: 'BOT' | 'AGUARDANDO_HUMANO' | 'EM_ATENDIMENTO' | 'ENCERRADA';
    assigned_to: { id: string; name: string } | null;
    assigned_at: string | null;
    lead: { id: string; name: string | null } | null;
    customer: { id: string; name: string } | null;
    pipeline: { id: string; slug: string; name: string } | null;
    stage: { id: string; name: string; color: string } | null;
    last_message_preview: string | null;
    last_message_at: string | null;
    unread_count: number;
}

export interface InboxMessageRecord {
    id: string;
    meta_message_id: string | null;
    external_id: string | null;
    direction: 'INBOUND' | 'OUTBOUND';
    type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'TEMPLATE';
    content: string | null;
    media_url: string | null;
    media_mime: string | null;
    media_size: number | null;
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    is_automated: boolean;
    is_quick_reply: boolean;
    sent_by: { id: string; name: string } | null;
    created_at: string;
}

export interface InboxConversationResponse {
    conversation: Omit<InboxConversationRecord, 'unread_count'>;
    messages: InboxMessageRecord[];
}

export interface QuickReplyRecord {
    id: string;
    title: string;
    body: string;
    category: string | null;
    created_at: string;
    updated_at: string;
}

export interface ChannelIntegrationRecord {
    id: string;
    channel: 'whatsapp' | 'instagram' | 'telegram' | 'tiktok' | 'messenger';
    is_active: boolean;
    webhook_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface OrderItemRecord {
    id: string;
    order_id: string;
    product_id: string | null;
    description: string;
    quantity: number;
    unit_price_cents: number;
    total_price_cents: number;
}

export interface OrderRecord {
    id: string;
    order_number: string;
    type: 'PRONTA_ENTREGA' | 'PERSONALIZADO';
    status:
        | 'RASCUNHO'
        | 'AGUARDANDO_PAGAMENTO'
        | 'PAGO'
        | 'SEPARANDO'
        | 'ENVIADO'
        | 'RETIRADO'
        | 'CANCELADO'
        | 'AGUARDANDO_APROVACAO_DESIGN'
        | 'APROVADO'
        | 'EM_PRODUCAO'
        | 'CONTROLE_QUALIDADE';
    total_amount_cents: number;
    discount_cents: number;
    final_amount_cents: number;
    delivery_type: 'RETIRADA' | 'ENTREGA';
    estimated_delivery_at: string | null;
    created_at: string;
    updated_at: string;
    notes: string | null;
    customer: { id: string; name: string };
    assigned_to: { id: string; name: string };
    production_order_id: string | null;
    custom_details?: {
        id: string;
        design_description: string | null;
        metal_type: string | null;
        production_deadline: string | null;
        approved_at: string | null;
        approved_by_customer: boolean | null;
    } | null;
    order_items?: OrderItemRecord[];
}

export interface ProductionStepRecord {
    id: string;
    step_name: string;
    completed_at: string;
    notes: string | null;
    approved: boolean;
    rejection_reason: string | null;
    completed_by: { id: string; name: string };
}

export interface ProductionOrderRecord {
    id: string;
    order_id: string;
    current_step: string;
    status: 'PENDENTE' | 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA' | 'REPROVADA';
    deadline: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    assigned_to: { id: string; name: string } | null;
    order: {
        id: string;
        order_number: string;
        status: string;
        customer_name: string;
    };
    progress_percent: number;
    is_overdue: boolean;
    steps?: ProductionStepRecord[];
}

export interface PublicSettings {
    company_name: string;
    logo_url: string | null;
    primary_color: string;
    favicon_url: string | null;
}

export interface StockMovementRecord {
    id: string;
    type: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reason: string;
    order_id: string | null;
    created_at: string;
    created_by: { id: string; name: string };
}

export interface ProductRecord {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price_cents: number;
    stock_quantity: number;
    minimum_stock: number;
    category: string | null;
    metal: string | null;
    weight_grams: number | null;
    is_active: boolean;
    images: string[];
    created_at: string;
    updated_at: string;
    is_low_stock: boolean;
}

export interface ProductDetailRecord extends ProductRecord {
    recent_stock_movements: StockMovementRecord[];
}

export interface PaymentRecord {
    id: string;
    order_id: string;
    mp_payment_id: string | null;
    mp_preference_id: string | null;
    amount_cents: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REFUNDED';
    payment_method: string | null;
    paid_at: string | null;
    idempotency_key: string;
    created_at: string;
    updated_at: string;
    order: {
        id: string;
        order_number: string;
        status: string;
        assigned_to: { id: string; name: string };
    };
}

export interface FinancialEntryRecord {
    id: string;
    type: 'ENTRADA' | 'SAIDA';
    amount_cents: number;
    category: string;
    description: string;
    order_id: string | null;
    payment_id: string | null;
    commission_user_id: string | null;
    commission_amount_cents: number | null;
    competence_date: string;
    created_at: string;
    created_by: { id: string; name: string };
}

export interface FinancialEntriesResponse extends ApiListResponse<FinancialEntryRecord> {
    summary: {
        total_in_cents: number;
        total_out_cents: number;
        balance_cents: number;
    };
}

export interface PdvSaleResponse {
    order_id: string;
    payment_id: string;
    receipt: {
        order_number: string;
        total_cents: number;
    };
}

export interface DashboardPayload {
    role: 'ADMIN' | 'ATENDENTE' | 'PRODUCAO' | 'FINANCEIRO';
    kpis: Record<string, number>;
    alerts: Record<string, number>;
    activity: Array<{
        kind: string;
        label: string;
        created_at: string;
    }>;
}

export interface AssistantChatResponse {
    answer: string;
    tools_used: string[];
}

export interface AutomationFlowListItem {
    id: string;
    name: string;
    active: boolean;
    is_system: boolean;
    tags: string[];
    nodes_count: number;
    created_at: string | null;
    updated_at: string | null;
    execution_count: number;
    error_count: number;
    last_execution_at: string | null;
    status: 'draft' | 'active' | 'inactive' | 'error' | string;
}

export interface AutomationFlowDetail {
    id: string;
    name: string;
    active: boolean;
    is_system: boolean;
    tags: string[];
    nodes: Array<Record<string, unknown>>;
    connections: Record<string, unknown>;
    settings?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
}

export interface AutomationExecution {
    id: string;
    status?: string;
    startedAt?: string;
    stoppedAt?: string;
    finished?: boolean;
    mode?: string;
}

export interface AutomationCatalogItem {
    key: string;
    label: string;
    group: 'triggers' | 'actions' | 'control';
    n8n_type: string;
    description: string;
    parameters: string[];
}

export interface AutomationCatalogGroup {
    key: 'triggers' | 'actions' | 'control';
    label: string;
    description: string;
    items: AutomationCatalogItem[];
}

export interface PaymentLinkResponse {
    payment_id: string;
    payment_url: string;
    preference_id: string;
}

export interface PublicCatalogProduct {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price_cents: number;
    category: string | null;
    metal: string | null;
    weight_grams: number | null;
    images: string[];
    stock_quantity: number;
    minimum_stock: number;
    is_available: boolean;
    cover_image: string | null;
}

export interface LeadCapturePayload {
    name: string;
    whatsapp_number: string;
    email?: string;
    notes?: string;
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

export async function fetchPublicCatalog(params?: {
    q?: string;
    category?: string;
    limit?: number;
}): Promise<{
    data: PublicCatalogProduct[];
    meta: {
        total: number;
        limit: number;
    };
}> {
    const query = new URLSearchParams();

    if (params?.q) {
        query.set('q', params.q);
    }

    if (params?.category) {
        query.set('category', params.category);
    }

    if (params?.limit) {
        query.set('limit', String(params.limit));
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${getApiBaseUrl()}/public/catalog${suffix}`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        return {
            data: [],
            meta: {
                total: 0,
                limit: params?.limit ?? 24,
            },
        };
    }

    return parseJson<{
        data: PublicCatalogProduct[];
        meta: {
            total: number;
            limit: number;
        };
    }>(response);
}

export async function capturePublicLead(payload: LeadCapturePayload): Promise<{
    duplicate_prevented: boolean;
    automation_triggered: boolean;
    automation_failed: boolean;
    fallback_whatsapp_url: string;
}> {
    const response = await fetch(`${getApiBaseUrl()}/public/leads`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify(payload),
    });

    const data = await parseJson<Record<string, unknown>>(response);

    if (!response.ok) {
        const message = typeof data.message === 'string' ? data.message : 'Falha ao enviar seus dados.';
        throw new Error(message);
    }

    return {
        duplicate_prevented: Boolean(data.duplicate_prevented),
        automation_triggered: Boolean(data.automation_triggered),
        automation_failed: Boolean(data.automation_failed),
        fallback_whatsapp_url: typeof data.fallback_whatsapp_url === 'string' ? data.fallback_whatsapp_url : 'https://wa.me/55',
    };
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
