// ==========================================
// ORION CRM — TypeScript Entity Types
// Generated from PRD Section 5 (Data Model)
// ==========================================

// ---- Enums ----

export type UserRole = 'ADMIN' | 'ATENDENTE' | 'PRODUCAO' | 'FINANCEIRO';
export type UserStatus = 'active' | 'inactive';

export type LeadStage = 'NOVO' | 'QUALIFICADO' | 'PROPOSTA_ENVIADA' | 'NEGOCIACAO' | 'CONVERTIDO' | 'PERDIDO';
export type LeadSource = 'WHATSAPP' | 'BALCAO' | 'INDICACAO' | 'OUTRO';

export type ConversationStatus = 'BOT' | 'AGUARDANDO_HUMANO' | 'EM_ATENDIMENTO' | 'ENCERRADA';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageType = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'TEMPLATE';
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export type OrderType = 'PRONTA_ENTREGA' | 'PERSONALIZADO';
export type OrderStatus =
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
export type DeliveryType = 'RETIRADA' | 'ENTREGA';

export type ProductionStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA' | 'REPROVADA';

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REFUNDED';

export type StockMovementType = 'ENTRADA' | 'SAIDA' | 'AJUSTE';
export type FinancialEntryType = 'ENTRADA' | 'SAIDA';

export type FlowStatus = 'draft' | 'active' | 'inactive' | 'error';
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'timeout';

export type PlanType = 'starter' | 'professional' | 'enterprise';
export type InstanceStatus = 'active' | 'suspended' | 'decommissioned';

export type OperatorAction = 'provision' | 'suspend' | 'reactivate' | 'update_plan' | 'decommission';
export type WebhookResult = 'success' | 'already_done' | 'error';

// ---- Entities ----

export interface Settings {
    id: string;
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
    plan: PlanType;
    status: InstanceStatus;
    operator_instance_id: string | null;
    provisioned_at: Date | null;
    suspended_at: Date | null;
    updated_at: Date;
}

export interface User {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    status: UserStatus;
    commission_rate: number;
    avatar_url: string | null;
    created_at: Date;
    updated_at: Date;
    last_login_at: Date | null;
}

export interface UserPublic {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    commission_rate: number;
    avatar_url: string | null;
    created_at: Date;
    last_login_at: Date | null;
}

export interface RefreshToken {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    used_at: Date | null;
    revoked: boolean;
    created_at: Date;
    ip_address: string | null;
}

export interface Lead {
    id: string;
    whatsapp_number: string;
    name: string | null;
    email: string | null;
    stage: LeadStage;
    assigned_to: string | null;
    source: LeadSource;
    notes: string | null;
    converted_customer_id: string | null;
    last_interaction_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface Customer {
    id: string;
    name: string;
    whatsapp_number: string;
    email: string | null;
    cpf: string | null;
    birth_date: Date | null;
    address: Record<string, string> | null;
    assigned_to: string | null;
    lifetime_value_cents: number;
    preferences: Record<string, string[]> | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface Conversation {
    id: string;
    whatsapp_number: string;
    lead_id: string | null;
    customer_id: string | null;
    status: ConversationStatus;
    assigned_to: string | null;
    last_message_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface Message {
    id: string;
    conversation_id: string;
    meta_message_id: string | null;
    direction: MessageDirection;
    type: MessageType;
    content: string | null;
    media_url: string | null;
    sent_by: string | null;
    status: MessageStatus;
    is_automated: boolean;
    created_at: Date;
}

export interface InboxConversationSummary {
    id: string;
    whatsapp_number: string;
    status: ConversationStatus;
    assigned_to: {
        id: string;
        name: string;
    } | null;
    lead: {
        id: string;
        name: string | null;
    } | null;
    customer: {
        id: string;
        name: string;
    } | null;
    last_message_preview: string | null;
    last_message_at: Date | null;
    unread_count: number;
}

export interface InboxMessageView {
    id: string;
    meta_message_id: string | null;
    direction: MessageDirection;
    type: MessageType;
    content: string | null;
    media_url: string | null;
    status: MessageStatus;
    is_automated: boolean;
    sent_by: {
        id: string;
        name: string;
    } | null;
    created_at: Date;
}

export interface InboxConversationThread {
    conversation: Omit<InboxConversationSummary, 'last_message_preview' | 'last_message_at' | 'unread_count'>;
    messages: InboxMessageView[];
}

export interface ParsedWhatsAppInboundEvent {
    meta_message_id: string;
    whatsapp_number: string;
    profile_name: string | null;
    type: MessageType;
    content: string | null;
    media_url: string | null;
    received_at: string;
}

export interface Product {
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
    images: string[];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Order {
    id: string;
    order_number: string;
    type: OrderType;
    status: OrderStatus;
    customer_id: string;
    assigned_to: string;
    total_amount_cents: number;
    discount_cents: number;
    final_amount_cents: number;
    notes: string | null;
    delivery_type: DeliveryType;
    delivery_address: Record<string, string> | null;
    estimated_delivery_at: Date | null;
    cancelled_at: Date | null;
    cancellation_reason: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string | null;
    description: string;
    quantity: number;
    unit_price_cents: number;
    total_price_cents: number;
}

export interface CustomOrderDetails {
    id: string;
    order_id: string;
    design_description: string;
    design_images: string[];
    metal_type: string;
    metal_weight_grams: number | null;
    stones: Record<string, unknown>[] | null;
    approved_at: Date | null;
    approved_by_customer: boolean;
    production_deadline: Date | null;
}

export interface ProductionOrder {
    id: string;
    order_id: string;
    assigned_to: string | null;
    current_step: string;
    status: ProductionStatus;
    deadline: Date | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface ProductionStep {
    id: string;
    production_order_id: string;
    step_name: string;
    completed_by: string;
    completed_at: Date;
    evidence_images: string[];
    notes: string | null;
    approved: boolean;
    rejection_reason: string | null;
}

export interface Payment {
    id: string;
    order_id: string;
    mp_payment_id: string | null;
    mp_preference_id: string | null;
    amount_cents: number;
    status: PaymentStatus;
    payment_method: string | null;
    paid_at: Date | null;
    idempotency_key: string;
    webhook_payload: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}

export interface StockMovement {
    id: string;
    product_id: string;
    type: StockMovementType;
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reason: string;
    order_id: string | null;
    created_by: string;
    created_at: Date;
}

export interface FinancialEntry {
    id: string;
    type: FinancialEntryType;
    amount_cents: number;
    category: string;
    description: string;
    order_id: string | null;
    payment_id: string | null;
    commission_user_id: string | null;
    commission_amount_cents: number | null;
    competence_date: Date;
    created_by: string;
    receipt_url: string | null;
    created_at: Date;
}

export interface AuditLog {
    id: number;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    request_id: string | null;
    created_at: Date;
}

export interface AutomationFlow {
    id: string;
    name: string;
    description: string | null;
    status: FlowStatus;
    activepieces_flow_id: string | null;
    flow_definition: Record<string, unknown>;
    trigger_type: string;
    last_deployed_at: Date | null;
    last_execution_at: Date | null;
    execution_count: number;
    error_count: number;
    created_by: string;
    created_at: Date;
    updated_at: Date;
}

export interface AutomationExecution {
    id: string;
    flow_id: string;
    activepieces_run_id: string | null;
    status: ExecutionStatus;
    trigger_payload: Record<string, unknown> | null;
    result: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
    duration_ms: number | null;
    started_at: Date;
    finished_at: Date | null;
}

export interface OperatorWebhookLog {
    id: string;
    action: OperatorAction;
    idempotency_key: string;
    payload: Record<string, unknown>;
    result: WebhookResult;
    error_message: string | null;
    received_at: Date;
}
