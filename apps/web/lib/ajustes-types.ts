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
    plan: 'starter' | 'professional' | 'enterprise';
}

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'ATENDENTE' | 'PRODUCAO' | 'FINANCEIRO';
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

export interface WhatsAppStatusPayload {
    status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
    connected_number: string | null;
    connected_at: string | null;
}
