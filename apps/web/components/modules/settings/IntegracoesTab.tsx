'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    AlertCircle,
    Check,
    ChevronRight,
    ChevronDown,
    Copy,
    FlaskConical,
    Key,
    Loader2,
    Plus,
    Power,
    ReceiptText,
    RefreshCw,
    ShieldCheck,
    Star,
    Trash2,
    X,
    Zap,
} from 'lucide-react';
import { LogisticaTab } from './LogisticaTab';

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationCategory = 'payment' | 'automation' | 'ai' | 'erp' | 'logistica' | 'fiscal';

type IntegrationType =
    | 'mercadopago' | 'stripe' | 'pagarme' | 'asaas' | 'iugu'
    | 'n8n' | 'activepieces' | 'zapier' | 'make' | 'generic_webhook'
    | 'openai' | 'anthropic' | 'groq' | 'together_ai' | 'ollama'
    | 'bling' | 'tiny_erp' | 'shopify' | 'omie' | 'generic_rest';

interface IntegrationProvider {
    id: string;
    name: string;
    provider_type: IntegrationType;
    category: IntegrationCategory;
    config: Record<string, unknown>;
    is_primary: boolean;
    active: boolean;
    status: 'pending' | 'connected' | 'error';
    last_tested_at: string | null;
    created_at: string;
}

interface IntegrationMeta {
    label: string;
    description: string;
    color: string;
    bg: string;
    logoText: string;
    fields: Array<{ key: string; label: string; placeholder: string; secret?: boolean; hint?: string }>;
    webhookUrlHint?: string;
}

// ─── Integration metadata ─────────────────────────────────────────────────────

const INTEGRATION_META: Record<IntegrationType, IntegrationMeta> = {
    mercadopago: {
        label: 'Mercado Pago', description: 'Checkout e pagamentos · webhook IPN',
        color: '#00B1EA', bg: 'rgba(0,177,234,0.10)', logoText: 'MP',
        fields: [
            { key: 'access_token', label: 'Access Token (produção)', placeholder: 'APP_USR-...', secret: true },
            { key: 'public_key', label: 'Public Key (produção)', placeholder: 'APP_USR-...' },
            { key: 'sandbox_access_token', label: 'Access Token (sandbox)', placeholder: 'TEST-...', secret: true },
        ],
        webhookUrlHint: '/api/v1/webhooks/mercadopago',
    },
    stripe: {
        label: 'Stripe', description: 'Pagamentos internacionais · cartão e PIX',
        color: '#635BFF', bg: 'rgba(99,91,255,0.10)', logoText: 'ST',
        fields: [
            { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_xxx', secret: true },
            { key: 'publishable_key', label: 'Publishable Key', placeholder: 'pk_live_xxx' },
            { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_xxx', secret: true },
        ],
    },
    pagarme: {
        label: 'Pagar.me', description: 'Pagamentos brasileiros · boleto + cartão',
        color: '#07C37E', bg: 'rgba(7,195,126,0.10)', logoText: 'PM',
        fields: [
            { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_xxx', secret: true },
            { key: 'public_key', label: 'Public Key', placeholder: 'pk_xxx' },
        ],
    },
    asaas: {
        label: 'Asaas', description: 'Cobrança brasileira · boleto, PIX, cartão',
        color: '#1A73E8', bg: 'rgba(26,115,232,0.10)', logoText: 'AS',
        fields: [
            { key: 'api_key', label: 'API Key', placeholder: '$aact_xxx', secret: true },
            { key: 'sandbox', label: 'Sandbox', placeholder: 'true ou false', hint: 'Use "true" para testes' },
        ],
    },
    iugu: {
        label: 'Iugu', description: 'Cobrança recorrente · assinaturas e boletos',
        color: '#FF6B35', bg: 'rgba(255,107,53,0.10)', logoText: 'IU',
        fields: [
            { key: 'api_token', label: 'API Token (live)', placeholder: 'Seu token de produção', secret: true },
            { key: 'account_id', label: 'Account ID', placeholder: 'Seu account ID' },
        ],
    },
    n8n: {
        label: 'n8n', description: 'Automações e workflows · self-hosted ou cloud',
        color: '#EA4B71', bg: 'rgba(234,75,113,0.10)', logoText: 'n8n',
        fields: [
            { key: 'base_url', label: 'URL da instância', placeholder: 'https://n8n.seudominio.com' },
            { key: 'api_key', label: 'API Key', placeholder: 'n8n_api_xxx', secret: true },
            { key: 'webhook_url', label: 'Webhook URL (opcional)', placeholder: 'https://n8n.seudominio.com/webhook/orion' },
        ],
    },
    activepieces: {
        label: 'Activepieces', description: 'Automações open-source · self-hosted',
        color: '#6E41E2', bg: 'rgba(110,65,226,0.10)', logoText: 'AP',
        fields: [
            { key: 'base_url', label: 'URL da instância', placeholder: 'https://flows.seudominio.com' },
            { key: 'api_key', label: 'API Key', placeholder: 'ap_xxx', secret: true },
        ],
    },
    zapier: {
        label: 'Zapier', description: 'Automações cloud · 7.000+ apps',
        color: '#FF4A00', bg: 'rgba(255,74,0,0.10)', logoText: 'ZP',
        fields: [
            { key: 'webhook_url', label: 'Webhook URL do Zap', placeholder: 'https://hooks.zapier.com/hooks/catch/xxx/yyy' },
            { key: 'api_key', label: 'API Key (opcional)', placeholder: 'Para REST API do Zapier', secret: true },
        ],
    },
    make: {
        label: 'Make (Integromat)', description: 'Automações visuais · cenários avançados',
        color: '#6D00CC', bg: 'rgba(109,0,204,0.10)', logoText: 'MK',
        fields: [
            { key: 'webhook_url', label: 'Webhook URL do cenário', placeholder: 'https://hook.eu1.make.com/xxx' },
            { key: 'api_key', label: 'API Key (opcional)', placeholder: 'Para usar a Make API', secret: true },
        ],
    },
    generic_webhook: {
        label: 'Webhook Genérico', description: 'Endpoint externo para eventos do ORION',
        color: '#9CA3AF', bg: 'rgba(156,163,175,0.10)', logoText: 'WH',
        fields: [
            { key: 'webhook_url', label: 'URL do Webhook', placeholder: 'https://hooks.seuapp.com/orion' },
            { key: 'secret', label: 'Secret (HMAC)', placeholder: 'Chave para validação HMAC-SHA256', secret: true, hint: 'Opcional' },
            { key: 'events', label: 'Eventos (vírgula)', placeholder: 'order.paid,lead.created', hint: 'Vazio = todos' },
        ],
    },
    openai: {
        label: 'OpenAI', description: 'GPT-4o · assistente e geração de conteúdo',
        color: '#10A37F', bg: 'rgba(16,163,127,0.10)', logoText: 'AI',
        fields: [
            { key: 'api_key', label: 'API Key', placeholder: 'sk-xxx', secret: true },
            { key: 'org_id', label: 'Organization ID (opcional)', placeholder: 'org-xxx' },
            { key: 'model', label: 'Modelo padrão', placeholder: 'gpt-4o', hint: 'Ex: gpt-4o, gpt-4-turbo' },
        ],
    },
    anthropic: {
        label: 'Anthropic (Claude)', description: 'Claude 3.5/4 · raciocínio avançado e código',
        color: '#C8A97A', bg: 'rgba(200,169,122,0.10)', logoText: 'CL',
        fields: [
            { key: 'api_key', label: 'API Key', placeholder: 'sk-ant-xxx', secret: true },
            { key: 'model', label: 'Modelo padrão', placeholder: 'claude-sonnet-4-6', hint: 'Ex: claude-opus-4-6, claude-sonnet-4-6' },
        ],
    },
    groq: {
        label: 'Groq', description: 'Inferência ultrarrápida · Llama, Mixtral',
        color: '#F55036', bg: 'rgba(245,80,54,0.10)', logoText: 'GQ',
        fields: [
            { key: 'api_key', label: 'API Key', placeholder: 'gsk_xxx', secret: true },
            { key: 'model', label: 'Modelo padrão', placeholder: 'llama-3.3-70b-versatile' },
        ],
    },
    together_ai: {
        label: 'Together AI', description: 'Modelos open-source · DeepSeek, Llama',
        color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', logoText: 'TO',
        fields: [
            { key: 'api_key', label: 'API Key', placeholder: 'Sua Together AI key', secret: true },
            { key: 'model', label: 'Modelo padrão', placeholder: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
        ],
    },
    ollama: {
        label: 'Ollama', description: 'LLMs self-hosted · Llama, Mistral local',
        color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', logoText: 'OL',
        fields: [
            { key: 'base_url', label: 'URL do servidor', placeholder: 'http://localhost:11434' },
            { key: 'model', label: 'Modelo padrão', placeholder: 'llama3.2:latest', hint: 'Nome do modelo instalado' },
        ],
    },
    bling: {
        label: 'Bling ERP', description: 'NF-e e sincronização com marketplaces',
        color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', logoText: 'BL',
        fields: [
            { key: 'api_key', label: 'API Key Bling v3', placeholder: 'Disponível em Configurações → API', secret: true },
            { key: 'client_id', label: 'Client ID (OAuth)', placeholder: 'Para OAuth 2.0', hint: 'Opcional' },
            { key: 'client_secret', label: 'Client Secret (OAuth)', placeholder: 'Para OAuth 2.0', secret: true, hint: 'Opcional' },
        ],
    },
    tiny_erp: {
        label: 'Tiny ERP', description: 'Gestão fiscal · NF-e, pedidos e estoque',
        color: '#16A34A', bg: 'rgba(22,163,74,0.10)', logoText: 'TE',
        fields: [
            { key: 'api_token', label: 'Token da API', placeholder: 'Disponível em Tiny → Configurações', secret: true },
        ],
    },
    shopify: {
        label: 'Shopify', description: 'E-commerce · pedidos e clientes',
        color: '#96BF48', bg: 'rgba(150,191,72,0.10)', logoText: 'SH',
        fields: [
            { key: 'shop_domain', label: 'Domínio da loja', placeholder: 'sua-loja.myshopify.com' },
            { key: 'access_token', label: 'Access Token (Admin API)', placeholder: 'shpat_xxx', secret: true },
            { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'Para validar webhooks', secret: true },
        ],
    },
    omie: {
        label: 'Omie ERP', description: 'ERP nacional · NF-e, contas e integrações',
        color: '#E11D48', bg: 'rgba(225,29,72,0.10)', logoText: 'OM',
        fields: [
            { key: 'app_key', label: 'App Key', placeholder: 'Sua App Key do Omie', secret: true },
            { key: 'app_secret', label: 'App Secret', placeholder: 'Seu App Secret do Omie', secret: true },
        ],
    },
    generic_rest: {
        label: 'REST Genérico', description: 'Qualquer API REST com autenticação por header',
        color: '#9CA3AF', bg: 'rgba(156,163,175,0.10)', logoText: 'RS',
        fields: [
            { key: 'base_url', label: 'URL base da API', placeholder: 'https://api.seuapp.com' },
            { key: 'api_key', label: 'Chave de autenticação', placeholder: 'Seu token ou API key', secret: true },
            { key: 'auth_header', label: 'Nome do header', placeholder: 'Authorization', hint: 'Ex: Authorization, X-Api-Key' },
        ],
    },
};

const CATEGORY_TYPES: Record<IntegrationCategory, IntegrationType[]> = {
    payment:    ['mercadopago', 'stripe', 'pagarme', 'asaas', 'iugu'],
    automation: ['n8n', 'activepieces', 'zapier', 'make', 'generic_webhook'],
    ai:         ['openai', 'anthropic', 'groq', 'together_ai', 'ollama'],
    erp:        ['bling', 'tiny_erp', 'shopify', 'omie', 'generic_rest'],
    logistica:  [],
    fiscal:     [],
};

const CATEGORY_TABS: Array<{ id: IntegrationCategory; label: string }> = [
    { id: 'payment',    label: 'Pagamentos' },
    { id: 'automation', label: 'Automações' },
    { id: 'ai',         label: 'IA & LLMs' },
    { id: 'erp',        label: 'ERP & Outros' },
    { id: 'logistica',  label: 'Logística' },
    { id: 'fiscal',     label: 'Fiscal' },
];

// ─── Shared input style ───────────────────────────────────────────────────────

const baseInput: React.CSSProperties = {
    width: '100%', height: '36px', padding: '0 12px',
    background: '#0D0D10',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '7px',
    color: '#F0EDE8', fontSize: '12px', outline: 'none',
    boxSizing: 'border-box',
};

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface ModalProps {
    category: IntegrationCategory;
    provider?: IntegrationProvider;
    onClose: () => void;
    onSaved: () => void;
    onToast: (kind: 'success' | 'error', msg: string) => void;
}

function ProviderModal({ category, provider, onClose, onSaved, onToast }: ModalProps) {
    const isEdit = Boolean(provider);
    const availableTypes = CATEGORY_TYPES[category];
    const [name, setName] = useState(provider?.name ?? '');
    const [type, setType] = useState<IntegrationType>(provider?.provider_type ?? availableTypes[0]!);
    const [isPrimary, setIsPrimary] = useState(provider?.is_primary ?? false);
    const [active, setActive] = useState(provider?.active ?? true);
    const [credentials, setCredentials] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const meta = INTEGRATION_META[type];

    async function handleSave() {
        if (!name.trim()) { onToast('error', 'Informe o nome da integração.'); return; }
        setSaving(true);
        try {
            const body = { name: name.trim(), provider_type: type, category, credentials, is_primary: isPrimary, active };
            const res = await fetch(
                isEdit ? `/api/internal/integration-providers/${provider!.id}` : '/api/internal/integration-providers',
                { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { message?: string };
                throw new Error(err.message ?? 'Erro ao salvar');
            }
            onToast('success', isEdit ? 'Integração atualizada.' : 'Integração adicionada.');
            onSaved();
            onClose();
        } catch (err) {
            onToast('error', err instanceof Error ? err.message : 'Erro ao salvar integração.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 149, background: 'rgba(0,0,0,0.5)' }} />
            <div style={{
                position: 'fixed', left: '50%', top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '520px', maxWidth: '96vw', maxHeight: '90vh',
                zIndex: 150,
                background: '#111114',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                boxShadow: '0 24px 64px rgba(0,0,0,.7)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#F0EDE8' }}>
                            {isEdit ? 'Editar integração' : `Adicionar — ${CATEGORY_TABS.find(c => c.id === category)?.label}`}
                        </div>
                        <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '2px' }}>
                            Configure as credenciais e parâmetros da integração
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Fechar"
                        aria-label="Fechar"
                        style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', color: '#7A7774', cursor: 'pointer' }}
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 20px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* Type selector (only on add) */}
                    {!isEdit && (
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                Serviço
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {availableTypes.map((t) => {
                                    const m = INTEGRATION_META[t];
                                    const sel = type === t;
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setType(t)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '10px 12px',
                                                background: sel ? 'rgba(200,169,122,0.08)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${sel ? 'rgba(200,169,122,0.30)' : 'rgba(255,255,255,0.07)'}`,
                                                borderRadius: '8px', textAlign: 'left', cursor: 'pointer', width: '100%',
                                            }}
                                        >
                                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, color: m.color, flexShrink: 0 }}>
                                                {m.logoText}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: sel ? '#C8A97A' : '#F0EDE8' }}>{m.label}</div>
                                                <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '1px' }}>{m.description.split('·')[0]?.trim()}</div>
                                            </div>
                                            {sel && <Check size={14} color="#C8A97A" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '4px' }}>Nome exibido *</label>
                        <input style={baseInput} value={name} onChange={(e) => setName(e.target.value)} placeholder={`Ex: ${meta.label} Principal`} />
                    </div>

                    {/* Credential fields */}
                    {meta.fields.length > 0 && (
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                Credenciais
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {meta.fields.map((f) => (
                                    <div key={f.key}>
                                        <label style={{ fontSize: '11px', color: '#7A7774', display: 'block', marginBottom: '3px' }}>
                                            {f.label}
                                            {f.hint && <span style={{ marginLeft: '6px', color: '#555' }}>· {f.hint}</span>}
                                        </label>
                                        <input
                                            type={f.secret ? 'password' : 'text'}
                                            style={baseInput}
                                            value={credentials[f.key] ?? ''}
                                            onChange={(e) => setCredentials(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={f.placeholder}
                                            autoComplete="off"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Webhook hint */}
                    {meta.webhookUrlHint && (
                        <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', fontSize: '11px', color: '#7A7774' }}>
                            <strong style={{ color: '#9A9591' }}>Webhook URL: </strong>
                            <span style={{ fontFamily: 'monospace' }}>{meta.webhookUrlHint}</span>
                            <span style={{ marginLeft: '8px', color: '#555' }}>— configure no painel do serviço</span>
                        </div>
                    )}

                    {/* Flags */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[
                            { checked: isPrimary, onChange: setIsPrimary, label: 'Integração primária', hint: 'Usada por padrão quando esta categoria é necessária' },
                            { checked: active, onChange: setActive, label: 'Ativa', hint: 'Integração visível para o sistema' },
                        ].map((item) => (
                            <label key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={(e) => item.onChange(e.target.checked)}
                                    style={{ width: '14px', height: '14px', accentColor: '#C8A97A', cursor: 'pointer' }}
                                />
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#F0EDE8' }}>{item.label}</div>
                                    <div style={{ fontSize: '10px', color: '#7A7774', marginTop: '1px' }}>{item.hint}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ height: '34px', padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '12px', cursor: 'pointer' }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        style={{ height: '34px', padding: '0 18px', background: saving ? 'rgba(200,169,122,0.06)' : 'rgba(200,169,122,0.14)', border: '1px solid rgba(200,169,122,0.30)', borderRadius: '7px', color: '#C8A97A', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        {saving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                        {isEdit ? 'Salvar' : 'Adicionar'}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Provider Card ────────────────────────────────────────────────────────────

interface CardProps {
    provider: IntegrationProvider;
    onEdit: () => void;
    onToggle: () => void;
    onSetPrimary: () => void;
    onDelete: () => void;
    onTest: () => void;
    testing: boolean;
}

function ProviderCard({ provider, onEdit, onToggle, onSetPrimary, onDelete, onTest, testing }: CardProps) {
    const meta = INTEGRATION_META[provider.provider_type];

    return (
        <div style={{
            background: provider.active ? '#141417' : '#111113',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            opacity: provider.active ? 1 : 0.65,
        }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Logo badge */}
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: meta.color, flexShrink: 0 }}>
                    {meta.logoText}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#F0EDE8' }}>{provider.name}</span>
                        {provider.is_primary && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 700, color: '#C8A97A', background: 'rgba(200,169,122,0.10)', border: '1px solid rgba(200,169,122,0.25)', borderRadius: '99px', padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                <Star size={8} fill="currentColor" /> Primário
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: '11px', color: meta.color, marginTop: '2px' }}>{meta.label}</div>
                </div>

                {/* Status badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {provider.status === 'connected'
                        ? <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3FB87A', display: 'inline-block' }} /><span style={{ fontSize: '11px', color: '#3FB87A', fontWeight: 600 }}>Conectado</span></>
                        : provider.status === 'error'
                        ? <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E05252', display: 'inline-block' }} /><span style={{ fontSize: '11px', color: '#E05252', fontWeight: 600 }}>Erro</span></>
                        : <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7A7774', display: 'inline-block' }} /><span style={{ fontSize: '11px', color: '#7A7774', fontWeight: 600 }}>Pendente</span></>
                    }
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {/* Test */}
                    <button
                        type="button"
                        title="Testar conexão"
                        onClick={onTest}
                        disabled={testing}
                        style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '6px', color: '#7A7774', cursor: testing ? 'not-allowed' : 'pointer', opacity: testing ? 0.5 : 1 }}
                    >
                        {testing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FlaskConical size={13} />}
                    </button>

                    {/* Set primary */}
                    {!provider.is_primary && (
                        <button
                            type="button"
                            title="Definir como primário"
                            onClick={onSetPrimary}
                            style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '6px', color: '#7A7774', cursor: 'pointer' }}
                        >
                            <Star size={13} />
                        </button>
                    )}

                    {/* Toggle */}
                    <button
                        type="button"
                        title={provider.active ? 'Desativar' : 'Ativar'}
                        onClick={onToggle}
                        style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: provider.active ? 'rgba(63,184,122,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${provider.active ? 'rgba(63,184,122,0.20)' : 'rgba(255,255,255,0.09)'}`, borderRadius: '6px', color: provider.active ? '#3FB87A' : '#7A7774', cursor: 'pointer' }}
                    >
                        <Power size={13} />
                    </button>

                    {/* Edit */}
                    <button
                        type="button"
                        title="Editar"
                        onClick={onEdit}
                        style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '6px', color: '#C8C4BE', cursor: 'pointer' }}
                    >
                        <ChevronRight size={13} />
                    </button>

                    {/* Delete */}
                    <button
                        type="button"
                        title="Remover"
                        onClick={onDelete}
                        style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(224,82,82,0.06)', border: '1px solid rgba(224,82,82,0.15)', borderRadius: '6px', color: '#E05252', cursor: 'pointer' }}
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {provider.last_tested_at && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '6px 16px', fontSize: '10px', color: '#555' }}>
                    Último teste: {new Date(provider.last_tested_at).toLocaleString('pt-BR')}
                </div>
            )}
        </div>
    );
}

// ─── Fiscal Section ───────────────────────────────────────────────────────────

const MARKETPLACE_ITEMS = [
    { label: 'Mercado Livre', badge: 'ML', bg: 'linear-gradient(135deg,#ffe600,#ffcf00)', color: '#333' },
    { label: 'Shopee',        badge: 'SH', bg: 'linear-gradient(135deg,#ee4d2d,#f55c3e)', color: '#fff' },
    { label: 'TikTok Shop',   badge: 'TT', bg: '#000',                                     color: '#fff' },
    { label: 'Amazon',        badge: 'AMZ', bg: 'linear-gradient(135deg,#ff9900,#ff6600)', color: '#fff' },
];

function FiscalSection() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#F0EDE8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ReceiptText size={16} color="#C8A97A" /> Fiscal & NF-e
                    </div>
                    <div style={{ fontSize: '12px', color: '#7A7774', marginTop: '4px' }}>
                        Integração com Bling ERP para emissão de NF-e e sincronização com marketplaces.
                    </div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', background: 'rgba(200,169,122,0.08)', border: '1px solid rgba(200,169,122,0.20)', borderRadius: '99px', fontSize: '10px', fontWeight: 700, color: '#C8A97A', textTransform: 'uppercase', letterSpacing: '.5px', flexShrink: 0 }}>
                    <ShieldCheck size={11} /> Em breve
                </div>
            </div>

            {/* Bling ERP card */}
            <div style={{ background: '#141417', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(7,195,126,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: '#07C37E', flexShrink: 0 }}>
                        BL
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#F0EDE8' }}>Bling ERP</div>
                        <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '2px' }}>Emissão de NF-e e sincronização com marketplaces</div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#7A7774', background: '#0D0D10', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '99px', padding: '2px 10px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        Não configurado
                    </span>
                </div>
                <div style={{ padding: '14px 16px', opacity: 0.5 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {[
                            { label: 'API Key Bling', hint: 'Bling → Configurações → API', value: '••••••••••••••••••••••••' },
                            { label: 'CNPJ emissor', value: 'Não preenchido' },
                            { label: 'Regime tributário', value: 'Simples Nacional', icon: true },
                            { label: 'Ambiente NF-e', value: 'Homologação (teste)', icon: true },
                        ].map((f) => (
                            <div key={f.label}>
                                <div style={{ fontSize: '11px', color: '#7A7774', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                    {f.label}
                                    {f.hint && <span style={{ fontSize: '10px', color: '#555' }}>{f.hint}</span>}
                                </div>
                                <div style={{ height: '34px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.05)', background: '#0A0A0C', padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#7A7774' }}>
                                    <span>{f.value}</span>
                                    {f.icon && <ChevronDown size={13} color="#555" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Marketplaces */}
            <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#C8C4BE', marginBottom: '10px' }}>Marketplaces via Bling</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {MARKETPLACE_ITEMS.map((item) => (
                        <div key={item.label} style={{ background: '#141417', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px 10px', textAlign: 'center', opacity: 0.55 }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: item.color, margin: '0 auto 10px' }}>
                                {item.badge}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#F0EDE8', marginBottom: '2px' }}>{item.label}</div>
                            <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>via Bling</div>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#7A7774', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '99px', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                                Futuro
                            </span>
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '11px', color: '#7A7774', lineHeight: 1.6 }}>
                    O Bling centraliza a emissão de NF-e e sincroniza automaticamente catálogo, estoque e pedidos com cada marketplace. Nenhuma integração adicional é necessária.
                </div>
            </div>

            {/* Fiscal settings (locked) */}
            <div style={{ opacity: 0.45 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#C8C4BE', marginBottom: '10px' }}>Configurações Fiscais</div>
                <div style={{ background: '#141417', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {[
                            { label: 'CFOP padrão (venda presencial)', value: '5.102 — Venda de mercadoria adquirida' },
                            { label: 'CFOP padrão (venda online)',     value: '6.108 — Venda à ordem' },
                            { label: 'Série da NF-e',                  value: '1' },
                            { label: 'NCM padrão (joias)',              value: '7113.19.00 — Joias e suas partes' },
                        ].map((f) => (
                            <div key={f.label}>
                                <div style={{ fontSize: '11px', color: '#7A7774', marginBottom: '4px' }}>{f.label}</div>
                                <div style={{ height: '34px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.05)', background: '#0A0A0C', padding: '0 10px', display: 'flex', alignItems: 'center', fontSize: '12px', color: '#7A7774' }}>
                                    {f.value}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '11px', color: '#555', textAlign: 'center' }}>
                        Disponível após a conexão do Bling.
                    </div>
                </div>
            </div>

            {/* Info box */}
            <div style={{ padding: '12px 14px', background: 'rgba(91,156,246,0.06)', border: '1px solid rgba(91,156,246,0.15)', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <AlertCircle size={14} color="#5B9CF6" style={{ flexShrink: 0, marginTop: '1px' }} />
                <div style={{ fontSize: '11px', color: '#7A7774', lineHeight: 1.6 }}>
                    <strong style={{ color: '#5B9CF6' }}>Emissão automática:</strong> Após conectar o Bling, os pedidos finalizados no PDV poderão gerar NF-e automaticamente com CFOP e NCM configurados acima.
                </div>
            </div>
        </div>
    );
}

// ─── Main Tab Component ───────────────────────────────────────────────────────

interface TabProps {
    onToast: (kind: 'success' | 'error', msg: string) => void;
}

// ─── Webhook Key Card ─────────────────────────────────────────────────────────

function WebhookKeyCard({ onToast }: TabProps) {
    const [hasKey, setHasKey] = useState(false);
    const [maskedKey, setMaskedKey] = useState<string | null>(null);
    const [plainKey, setPlainKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/internal/settings/webhook-key');
            if (!res.ok) throw new Error();
            const data = await res.json() as { has_key: boolean; masked_key: string | null };
            setHasKey(data.has_key);
            setMaskedKey(data.masked_key);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function handleRegenerate() {
        setRegenerating(true);
        setPlainKey(null);
        try {
            const res = await fetch('/api/internal/settings/webhook-key/regenerate', { method: 'POST' });
            if (!res.ok) throw new Error();
            const data = await res.json() as { key: string };
            setPlainKey(data.key);
            setHasKey(true);
            setMaskedKey(`${data.key.slice(0, 8)}${'•'.repeat(24)}`);
            onToast('success', 'Chave gerada. Copie agora — ela não será exibida novamente.');
        } catch {
            onToast('error', 'Não foi possível gerar a chave.');
        } finally {
            setRegenerating(false);
        }
    }

    function handleCopy(text: string) {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        if (copyTimeout.current) clearTimeout(copyTimeout.current);
        copyTimeout.current = setTimeout(() => setCopied(false), 2000);
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const webhookBase = `${baseUrl}/api/v1/n8n`;

    return (
        <div style={{ background: 'rgba(200,169,122,0.05)', border: '1px solid rgba(200,169,122,0.18)', borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(200,169,122,0.12)', border: '1px solid rgba(200,169,122,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Key size={15} color="#C8A97A" />
                </div>
                <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#F0EDE8' }}>Chave de Webhook do ORION</div>
                    <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '2px' }}>Use esta chave no header <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>Authorization: Bearer &lt;chave&gt;</code> para autenticar o n8n, Zapier ou qualquer automação.</div>
                </div>
            </div>

            {/* Key display */}
            {loading ? (
                <div style={{ height: '36px', borderRadius: '7px', background: '#202026', animation: 'pulse 1.4s ease-in-out infinite' }} />
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, padding: '8px 12px', background: '#111114', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', fontSize: '12px', fontFamily: 'monospace', color: plainKey ? '#C8A97A' : '#7A7774', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {plainKey ?? maskedKey ?? 'Nenhuma chave gerada'}
                    </div>
                    {(plainKey ?? maskedKey) && (
                        <button
                            type="button"
                            onClick={() => handleCopy(plainKey ?? maskedKey ?? '')}
                            title="Copiar"
                            style={{ height: '36px', width: '36px', background: copied ? 'rgba(86,197,150,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${copied ? 'rgba(86,197,150,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '7px', color: copied ? '#56C596' : '#9E9A94', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => void handleRegenerate()}
                        disabled={regenerating}
                        title={hasKey ? 'Revogar e gerar nova chave' : 'Gerar chave'}
                        style={{ height: '36px', padding: '0 14px', background: 'rgba(200,169,122,0.10)', border: '1px solid rgba(200,169,122,0.22)', borderRadius: '7px', color: '#C8A97A', fontSize: '11px', fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, opacity: regenerating ? 0.6 : 1 }}
                    >
                        {regenerating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
                        {hasKey ? 'Revogar e gerar nova' : 'Gerar chave'}
                    </button>
                </div>
            )}

            {plainKey && (
                <div style={{ padding: '10px 12px', background: 'rgba(255,193,7,0.07)', border: '1px solid rgba(255,193,7,0.2)', borderRadius: '7px', fontSize: '11px', color: '#F5C842' }}>
                    Salve esta chave agora — ela não será exibida novamente após sair desta página.
                </div>
            )}

            {/* Webhook base URL */}
            <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '11px', color: '#7A7774', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>URL base dos webhooks</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, padding: '7px 12px', background: '#111114', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', fontSize: '11px', fontFamily: 'monospace', color: '#9E9A94', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {webhookBase}
                    </div>
                    <button type="button" onClick={() => handleCopy(webhookBase)} title="Copiar URL" style={{ height: '32px', width: '32px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#7A7774', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Copy size={12} />
                    </button>
                </div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {[
                        ['POST', '/webhook/new-message', 'Receber mensagem'],
                        ['POST', '/webhook/bot-reply', 'Registrar resposta do bot'],
                        ['POST', '/webhook/update-lead', 'Atualizar lead'],
                        ['POST', '/webhook/handoff', 'Passar para humano'],
                        ['POST', '/webhook/order-status', 'Atualizar status do pedido'],
                        ['GET',  '/webhook/conversation-status', 'Consultar conversa'],
                    ].map(([method, path, label]) => (
                        <div key={path} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                            <span style={{ width: '36px', textAlign: 'center', padding: '2px 0', background: method === 'GET' ? 'rgba(91,156,246,0.12)' : 'rgba(86,197,150,0.10)', border: `1px solid ${method === 'GET' ? 'rgba(91,156,246,0.2)' : 'rgba(86,197,150,0.2)'}`, borderRadius: '4px', color: method === 'GET' ? '#5B9CF6' : '#56C596', fontWeight: 700, flexShrink: 0 }}>{method}</span>
                            <code style={{ color: '#9E9A94', fontFamily: 'monospace', fontSize: '11px' }}>{path}</code>
                            <span style={{ color: '#5A5754' }}>—</span>
                            <span style={{ color: '#7A7774' }}>{label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function IntegracoesTab({ onToast }: TabProps) {
    const [activeCategory, setActiveCategory] = useState<IntegrationCategory>('payment');
    const [providers, setProviders] = useState<IntegrationProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingProvider, setEditingProvider] = useState<IntegrationProvider | undefined>();
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const res = await fetch('/api/internal/integration-providers');
            if (!res.ok) throw new Error();
            const data = await res.json() as IntegrationProvider[];
            setProviders(Array.isArray(data) ? data : []);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const categoryProviders = providers.filter(p => p.category === activeCategory);
    const categoryLabel = CATEGORY_TABS.find(c => c.id === activeCategory)?.label ?? '';
    const categoryTypes = CATEGORY_TYPES[activeCategory];

    async function handleToggle(id: string) {
        try {
            const res = await fetch(`/api/internal/integration-providers/${id}/toggle`, { method: 'PATCH' });
            if (!res.ok) throw new Error();
            const data = await res.json() as { active: boolean };
            setProviders(prev => prev.map(p => p.id === id ? { ...p, active: data.active } : p));
            onToast('success', 'Status atualizado.');
        } catch { onToast('error', 'Não foi possível atualizar.'); }
    }

    async function handleSetPrimary(id: string) {
        const target = providers.find(p => p.id === id);
        if (!target) return;
        try {
            const res = await fetch(`/api/internal/integration-providers/${id}/set-primary`, { method: 'PATCH' });
            if (!res.ok) throw new Error();
            setProviders(prev => prev.map(p => ({
                ...p,
                is_primary: p.id === id ? true : (p.category === target.category ? false : p.is_primary),
            })));
            onToast('success', 'Integração primária atualizada.');
        } catch { onToast('error', 'Não foi possível atualizar.'); }
    }

    async function handleDelete(id: string) {
        try {
            const res = await fetch(`/api/internal/integration-providers/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            setProviders(prev => prev.filter(p => p.id !== id));
            onToast('success', 'Integração removida.');
        } catch { onToast('error', 'Não foi possível remover.'); }
        setConfirmDeleteId(null);
    }

    async function handleTest(id: string) {
        setTestingId(id);
        try {
            const res = await fetch(`/api/internal/integration-providers/${id}/test`, { method: 'PATCH' });
            if (!res.ok) throw new Error();
            const data = await res.json() as { tested_at: string };
            setProviders(prev => prev.map(p => p.id === id ? { ...p, last_tested_at: data.tested_at } : p));
            onToast('success', 'Teste registrado.');
        } catch { onToast('error', 'Não foi possível testar.'); }
        setTestingId(null);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Webhook Key */}
            <WebhookKeyCard onToast={onToast} />

            {/* Category sub-tabs — underline style */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {CATEGORY_TABS.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveCategory(tab.id)}
                        style={{
                            padding: '8px 18px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeCategory === tab.id ? '2px solid #C8A97A' : '2px solid transparent',
                            color: activeCategory === tab.id ? '#C8A97A' : '#7A7774',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginBottom: '-1px',
                            transition: 'color 0.15s',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Logística section */}
            {activeCategory === 'logistica' && <LogisticaTab />}

            {/* Fiscal section */}
            {activeCategory === 'fiscal' && <FiscalSection />}

            {/* Integration providers section (payment / automation / ai / erp) */}
            {activeCategory !== 'logistica' && activeCategory !== 'fiscal' && (
                <>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#F0EDE8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={16} color="#C8A97A" /> {categoryLabel}
                            </div>
                            <div style={{ fontSize: '12px', color: '#7A7774', marginTop: '4px' }}>
                                Registre quantas instâncias precisar. A marcada como primária é usada por padrão.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setEditingProvider(undefined); setShowModal(true); }}
                            style={{ height: '34px', padding: '0 14px', background: 'rgba(200,169,122,0.12)', border: '1px solid rgba(200,169,122,0.25)', borderRadius: '7px', color: '#C8A97A', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
                        >
                            <Plus size={13} /> Adicionar
                        </button>
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[1, 2].map((i) => (
                                <div key={i} style={{ height: '68px', borderRadius: '10px', background: '#202026', animation: 'pulse 1.4s ease-in-out infinite' }} />
                            ))}
                        </div>
                    )}

                    {/* Error */}
                    {!loading && error && (
                        <div style={{ padding: '16px', background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '8px', textAlign: 'center' }}>
                            <p style={{ color: '#E05252', fontSize: '13px', marginBottom: '8px' }}>Erro ao carregar integrações.</p>
                            <button
                                type="button"
                                onClick={() => void load()}
                                style={{ height: '28px', padding: '0 14px', background: 'transparent', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '6px', color: '#E05252', fontSize: '11px', cursor: 'pointer' }}
                            >
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {/* Empty */}
                    {!loading && !error && categoryProviders.length === 0 && (
                        <div style={{ border: '2px dashed rgba(255,255,255,0.07)', borderRadius: '10px', padding: '40px 20px', textAlign: 'center' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(200,169,122,0.08)', border: '1px solid rgba(200,169,122,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                <Zap size={20} color="#C8A97A" />
                            </div>
                            <p style={{ color: '#C8C4BE', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Nenhuma integração configurada</p>
                            <p style={{ color: '#7A7774', fontSize: '12px', marginBottom: '14px' }}>
                                Adicione {categoryTypes.map(t => INTEGRATION_META[t].label).join(', ')}.
                            </p>
                            <button
                                type="button"
                                onClick={() => { setEditingProvider(undefined); setShowModal(true); }}
                                style={{ height: '30px', padding: '0 16px', background: 'rgba(200,169,122,0.10)', border: '1px solid rgba(200,169,122,0.22)', borderRadius: '6px', color: '#C8A97A', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Plus size={12} /> Adicionar integração
                            </button>
                        </div>
                    )}

                    {/* List */}
                    {!loading && !error && categoryProviders.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {categoryProviders.map(p => (
                                <ProviderCard
                                    key={p.id}
                                    provider={p}
                                    onEdit={() => { setEditingProvider(p); setShowModal(true); }}
                                    onToggle={() => void handleToggle(p.id)}
                                    onSetPrimary={() => void handleSetPrimary(p.id)}
                                    onDelete={() => setConfirmDeleteId(p.id)}
                                    onTest={() => void handleTest(p.id)}
                                    testing={testingId === p.id}
                                />
                            ))}
                        </div>
                    )}

                    {/* Info box */}
                    <div style={{ padding: '12px 14px', background: 'rgba(91,156,246,0.06)', border: '1px solid rgba(91,156,246,0.15)', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <AlertCircle size={14} color="#5B9CF6" style={{ flexShrink: 0, marginTop: '1px' }} />
                        <div style={{ fontSize: '11px', color: '#7A7774', lineHeight: 1.6 }}>
                            <strong style={{ color: '#5B9CF6' }}>Credenciais seguras:</strong> Todas as chaves são armazenadas criptografadas e nunca expostas após salvas. A integração marcada como <strong style={{ color: '#5B9CF6' }}>primária</strong> em cada categoria é usada automaticamente pelo sistema.
                        </div>
                    </div>

                    {/* Add/Edit modal */}
                    {showModal && (
                        <ProviderModal
                            category={activeCategory}
                            provider={editingProvider}
                            onClose={() => { setShowModal(false); setEditingProvider(undefined); }}
                            onSaved={() => void load()}
                            onToast={onToast}
                        />
                    )}

                    {/* Delete confirm */}
                    {confirmDeleteId && (
                        <>
                            <div onClick={() => setConfirmDeleteId(null)} style={{ position: 'fixed', inset: 0, zIndex: 149, background: 'rgba(0,0,0,0.5)' }} />
                            <div style={{
                                position: 'fixed', left: '50%', top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '360px', maxWidth: '96vw',
                                zIndex: 150,
                                background: '#111114',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '14px',
                                boxShadow: '0 24px 64px rgba(0,0,0,.7)',
                                padding: '28px 24px',
                                textAlign: 'center',
                            }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                    <Trash2 size={20} color="#E05252" />
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#F0EDE8', marginBottom: '8px' }}>Remover integração?</div>
                                <div style={{ fontSize: '12px', color: '#7A7774', marginBottom: '20px' }}>As credenciais serão excluídas permanentemente.</div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(null)}
                                        style={{ height: '34px', padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '12px', cursor: 'pointer' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(confirmDeleteId)}
                                        style={{ height: '34px', padding: '0 16px', background: 'rgba(224,82,82,0.12)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '7px', color: '#E05252', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Remover
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
