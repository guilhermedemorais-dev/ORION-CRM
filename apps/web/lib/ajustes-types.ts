export interface AdminSettings {
    company_name: string;
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string;
    secondary_color: string | null;
    cnpj: string | null;
    phone: string | null;
    address: Record<string, string> | null;
    instagram: string | null;
    whatsapp_greeting: string | null;
    email_from_name: string | null;
    notify_new_lead_whatsapp: boolean;
    notify_order_paid: boolean;
    notify_production_delayed: boolean;
    notify_low_stock: boolean;
    security_login_protection: boolean;
    security_session_timeout_minutes: number;
    plan: 'starter' | 'professional' | 'enterprise';
}

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: 'ROOT' | 'ADMIN' | 'GERENTE' | 'VENDEDOR' | 'PRODUCAO' | 'FINANCEIRO' | 'ATENDENTE';
    status: 'active' | 'inactive';
    commission_rate: number;
    personal_whatsapp: string | null;
    created_at: string;
    updated_at: string;
    last_login_at: string | null;
}

export interface AdminUsersResponse {
    data: AdminUser[];
    meta: {
        total: number;
    };
}

export interface NotificationPreferences {
    user_id?: string;
    notify_new_lead_whatsapp: boolean;
    notify_order_paid: boolean;
    notify_production_delayed: boolean;
    notify_low_stock?: boolean;
    notify_lead_inactive: boolean;
    notify_goal_reached: boolean;
    quiet_hours_enabled: boolean;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
}

export interface WhatsAppStatusPayload {
    status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
    connected_number: string | null;
    connected_at: string | null;
}

export type AjustesTab =
    | 'empresa'
    | 'usuarios'
    | 'notificacoes'
    | 'seguranca'
    | 'integracoes'
    | 'ia-copiloto';

// ── IA Copiloto ───────────────────────────────────────────────────────────────

export type AiSkillCategory = 'global' | 'atendimento' | 'vendas' | 'meta' | 'geral';

export interface AiSkill {
    id: string;
    name: string;
    description: string;
    category: AiSkillCategory;
    system_prompt: string;
    is_global: boolean;
    is_active: boolean;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface AiCopilotConfig {
    id: string;
    is_enabled: boolean;
    provider: 'qwen' | 'openai' | 'anthropic';
    base_url: string;
    has_api_key: boolean;
    api_key_masked: string | null;
    model: string;
    temperature: number;
    max_tokens: number;
    system_prompt: string | null;
    created_at: string;
    updated_at: string;
}

export interface GeneratedSkill {
    name: string;
    description: string;
    category: AiSkillCategory;
    system_prompt: string;
}

export type CarrierAdapterType = 'generic_rest' | 'jadlog' | 'correios' | 'loggi' | 'tnt' | 'rapiddo';

export interface CarrierConfig {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    adapter_type: CarrierAdapterType;
    base_url: string | null;
    default_service: string | null;
    insurance_pct: number;
    min_insurance_cents: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface IntegrationWorkflowSnapshot {
    id: string;
    label: string;
    status: 'active' | 'paused';
}

export interface MetaIntegrationSnapshot {
    status: 'connected' | 'pending' | 'error';
    access_token_masked: string | null;
    phone_number_id: string | null;
    waba_id: string | null;
    verify_token: string | null;
    webhook_url: string;
    docs_url: string;
}

export interface N8nIntegrationSnapshot {
    status: 'connected' | 'pending' | 'error';
    base_url: string | null;
    api_key_masked: string | null;
    webhook_url: string | null;
    workflows: IntegrationWorkflowSnapshot[];
}

export interface MercadoPagoIntegrationSnapshot {
    status: 'connected' | 'pending' | 'error';
    access_token_masked: string | null;
    public_key_masked: string | null;
    sandbox_access_token_masked: string | null;
    sandbox_mode: boolean;
    webhook_url: string;
}

export interface IntegrationsSnapshot {
    meta: MetaIntegrationSnapshot;
    n8n: N8nIntegrationSnapshot;
    mercadopago: MercadoPagoIntegrationSnapshot;
}
