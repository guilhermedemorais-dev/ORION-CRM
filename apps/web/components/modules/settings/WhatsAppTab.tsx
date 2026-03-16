'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Check,
    ChevronDown,
    Loader2,
    Plus,
    Power,
    QrCode,
    RefreshCw,
    Save,
    Star,
    Trash2,
    X,
    Zap,
    Wifi,
    WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderType = 'evolution' | 'uazapi' | 'meta' | 'baileys' | 'zapi' | 'twilio' | 'generic_rest';

interface WhatsAppProvider {
    id: string;
    name: string;
    provider_type: ProviderType;
    base_url: string | null;
    instance_name: string | null;
    is_primary: boolean;
    active: boolean;
    status: 'connected' | 'disconnected' | 'connecting';
    connected_number: string | null;
    connected_at: string | null;
    created_at: string;
}

// ─── Provider metadata ────────────────────────────────────────────────────────

const PROVIDER_META: Record<ProviderType, {
    label: string;
    description: string;
    color: string;
    bg: string;
    fields: Array<{ key: string; label: string; placeholder: string; secret?: boolean; hint?: string }>;
}> = {
    evolution: {
        label: 'Evolution API',
        description: 'Self-hosted · instância WhatsApp via Baileys',
        color: '#3FB87A',
        bg: 'rgba(63,184,122,0.10)',
        fields: [
            { key: 'api_key', label: 'API Key', placeholder: 'Sua API Key', secret: true },
            { key: 'instance_name', label: 'Nome da instância', placeholder: 'Ex: orion-prod' },
        ],
    },
    uazapi: {
        label: 'UazAPI',
        description: 'Cloud/Self-hosted · WhatsApp multi-device',
        color: '#60A5FA',
        bg: 'rgba(96,165,250,0.10)',
        fields: [
            { key: 'api_key', label: 'API Key', placeholder: 'Sua API Key', secret: true },
            { key: 'instance_id', label: 'Instance ID', placeholder: 'ID da instância' },
        ],
    },
    meta: {
        label: 'Meta Cloud API',
        description: 'WhatsApp Business oficial · número verificado',
        color: '#1877F2',
        bg: 'rgba(24,119,242,0.10)',
        fields: [
            { key: 'access_token', label: 'Access Token permanente', placeholder: 'EAAxxxxx', secret: true },
            { key: 'phone_number_id', label: 'Phone Number ID', placeholder: '102648374921847' },
            { key: 'waba_id', label: 'WABA ID', placeholder: '198473920847362' },
            { key: 'verify_token', label: 'Verify Token', placeholder: 'orion_verify_xxx', secret: true },
        ],
    },
    baileys: {
        label: 'Baileys / WPPConnect',
        description: 'Self-hosted · biblioteca open-source',
        color: '#A78BFA',
        bg: 'rgba(167,139,250,0.10)',
        fields: [
            { key: 'server_url', label: 'URL do servidor', placeholder: 'https://wpp.seudominio.com' },
            { key: 'secret_key', label: 'Secret Key', placeholder: 'Chave de autenticação', secret: true },
            { key: 'session_name', label: 'Nome da sessão', placeholder: 'orion-session' },
        ],
    },
    zapi: {
        label: 'Z-API',
        description: 'Cloud · API brasileira com painel web',
        color: '#F59E0B',
        bg: 'rgba(245,158,11,0.10)',
        fields: [
            { key: 'instance_id', label: 'Instance ID', placeholder: 'Seu instance ID' },
            { key: 'client_token', label: 'Client Token', placeholder: 'Seu client token', secret: true },
            { key: 'security_token', label: 'Security Token', placeholder: 'Seu security token', secret: true },
        ],
    },
    twilio: {
        label: 'Twilio',
        description: 'Cloud · SMS + WhatsApp Business',
        color: '#F22F46',
        bg: 'rgba(242,47,70,0.10)',
        fields: [
            { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
            { key: 'auth_token', label: 'Auth Token', placeholder: 'Seu auth token', secret: true },
            { key: 'phone_number', label: 'Número Twilio', placeholder: '+14155238886' },
        ],
    },
    generic_rest: {
        label: 'REST Genérico',
        description: 'Qualquer API REST com autenticação por header',
        color: '#9CA3AF',
        bg: 'rgba(156,163,175,0.10)',
        fields: [
            { key: 'api_key', label: 'API Key / Token', placeholder: 'Sua chave de autenticação', secret: true },
            { key: 'auth_header', label: 'Header de auth', placeholder: 'Authorization', hint: 'Nome do header. Ex: Authorization, X-Api-Key' },
            { key: 'send_url', label: 'URL envio de mensagem', placeholder: 'https://api.provedor.com/send' },
        ],
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cls = {
    panel: 'rounded-2xl border border-white/10 bg-[#111114] shadow-[0_4px_32px_rgba(0,0,0,.4)]',
    field: 'h-10 w-full rounded-[10px] border border-white/10 bg-[#0A0A0C] px-3 text-[13px] text-[#F0EDE8] outline-none transition placeholder:text-[#555] focus:border-[#C8A97A]/40 focus:ring-2 focus:ring-[#C8A97A]/10',
    btn: {
        primary: 'inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border border-[#C8A97A] bg-[#C8A97A] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0A0A0C] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60',
        secondary: 'inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border border-white/10 bg-white/5 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C8C4BE] transition hover:border-[#C8A97A]/40 hover:text-[#C8A97A]',
        danger: 'inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border border-red-500/20 bg-red-500/10 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-400 transition hover:border-red-500/40',
    },
};

function statusBadge(status: WhatsAppProvider['status']) {
    if (status === 'connected') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
    if (status === 'connecting') return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
    return 'border-white/10 bg-white/5 text-[#7A7774]';
}

function statusLabel(status: WhatsAppProvider['status']) {
    if (status === 'connected') return 'Conectado';
    if (status === 'connecting') return 'Conectando';
    return 'Desconectado';
}

// ─── Add/Edit Modal ──────────────────────────────────────────────────────────

interface ModalProps {
    provider?: WhatsAppProvider;
    onClose: () => void;
    onSaved: () => void;
    onToast: (kind: 'success' | 'error', msg: string) => void;
}

function ProviderModal({ provider, onClose, onSaved, onToast }: ModalProps) {
    const isEdit = Boolean(provider);
    const [name, setName] = useState(provider?.name ?? '');
    const [type, setType] = useState<ProviderType>(provider?.provider_type ?? 'evolution');
    const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? '');
    const [instanceName, setInstanceName] = useState(provider?.instance_name ?? '');
    const [isPrimary, setIsPrimary] = useState(provider?.is_primary ?? false);
    const [active, setActive] = useState(provider?.active ?? true);
    const [credentials, setCredentials] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const meta = PROVIDER_META[type];

    function setCredField(key: string, value: string) {
        setCredentials((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSave() {
        if (!name.trim()) { onToast('error', 'Informe o nome do provedor.'); return; }
        setSaving(true);
        try {
            const body = {
                name: name.trim(),
                provider_type: type,
                credentials,
                base_url: baseUrl.trim() || null,
                instance_name: instanceName.trim() || null,
                is_primary: isPrimary,
                active,
            };
            const res = await fetch(
                isEdit ? `/api/internal/whatsapp-providers/${provider!.id}` : '/api/internal/whatsapp-providers',
                { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { message?: string };
                throw new Error(err.message ?? 'Erro ao salvar');
            }
            onToast('success', isEdit ? 'Provedor atualizado.' : 'Provedor adicionado.');
            onSaved();
            onClose();
        } catch (err) {
            onToast('error', err instanceof Error ? err.message : 'Erro ao salvar provedor.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className={cn(cls.panel, 'w-full max-w-lg max-h-[90vh] overflow-y-auto')}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F0EDE8]">
                        {isEdit ? 'Editar Provedor' : 'Adicionar Provedor WhatsApp'}
                    </div>
                    <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-[#7A7774] hover:text-[#F0EDE8]">
                        <X size={13} />
                    </button>
                </div>

                <div className="space-y-5 px-5 py-5">
                    {/* Provider type selector */}
                    <div className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7774]">Provedor</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {(Object.keys(PROVIDER_META) as ProviderType[]).map((pt) => {
                                const m = PROVIDER_META[pt];
                                const sel = type === pt;
                                return (
                                    <button
                                        key={pt}
                                        type="button"
                                        onClick={() => setType(pt)}
                                        className={cn(
                                            'flex flex-col items-start rounded-[10px] border px-3 py-2.5 text-left transition',
                                            sel
                                                ? 'border-[#C8A97A]/40 bg-[#C8A97A]/08 ring-1 ring-[#C8A97A]/20'
                                                : 'border-white/08 bg-white/03 hover:border-white/15'
                                        )}
                                        style={sel ? { background: 'rgba(200,169,122,0.07)' } : {}}
                                    >
                                        <div className="text-[11px] font-semibold" style={{ color: sel ? m.color : '#C8C4BE' }}>{m.label}</div>
                                        <div className="mt-0.5 text-[9px] leading-tight text-[#555]">{m.description}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7774]">Nome</div>
                        <input
                            className={cls.field}
                            placeholder={`Ex: ${meta.label} Principal`}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* Base URL (if applicable) */}
                    {['evolution', 'uazapi', 'baileys', 'generic_rest'].includes(type) && (
                        <div className="space-y-2">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7774]">URL Base da API</div>
                            <input
                                className={cls.field}
                                placeholder="https://api.seudominio.com"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Instance name */}
                    {['evolution', 'baileys'].includes(type) && (
                        <div className="space-y-2">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7774]">Nome da instância</div>
                            <input
                                className={cls.field}
                                placeholder="Ex: orion-prod"
                                value={instanceName}
                                onChange={(e) => setInstanceName(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Credential fields per provider type */}
                    {meta.fields.length > 0 && (
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7774]">Credenciais</div>
                            {meta.fields.map((f) => (
                                <div key={f.key} className="space-y-1.5">
                                    <div className="text-[10px] font-medium text-[#9A9591]">
                                        {f.label}
                                        {f.hint && <span className="ml-2 text-[#555]">· {f.hint}</span>}
                                    </div>
                                    <input
                                        type={f.secret ? 'password' : 'text'}
                                        className={cls.field}
                                        placeholder={f.placeholder}
                                        value={credentials[f.key] ?? ''}
                                        onChange={(e) => setCredField(f.key, e.target.value)}
                                        autoComplete="off"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Flags */}
                    <div className="flex flex-col gap-2">
                        <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-white/08 bg-white/03 px-3 py-2.5">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-white/20 bg-[#0A0A0C] accent-[#C8A97A]"
                                checked={isPrimary}
                                onChange={(e) => setIsPrimary(e.target.checked)}
                            />
                            <div>
                                <div className="text-[12px] font-medium text-[#F0EDE8]">Provedor primário</div>
                                <div className="text-[10px] text-[#7A7774]">Usado para envio de mensagens ativas</div>
                            </div>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-white/08 bg-white/03 px-3 py-2.5">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-white/20 bg-[#0A0A0C] accent-[#C8A97A]"
                                checked={active}
                                onChange={(e) => setActive(e.target.checked)}
                            />
                            <div>
                                <div className="text-[12px] font-medium text-[#F0EDE8]">Ativo</div>
                                <div className="text-[10px] text-[#7A7774]">Provedor visível para o sistema</div>
                            </div>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                        <button type="button" onClick={onClose} className={cls.btn.secondary}>Cancelar</button>
                        <button type="button" onClick={handleSave} disabled={saving} className={cls.btn.primary}>
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            {isEdit ? 'Salvar' : 'Adicionar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Provider Card ─────────────────────────────────────────────────────────────

interface CardProps {
    provider: WhatsAppProvider;
    onEdit: () => void;
    onToggle: () => void;
    onSetPrimary: () => void;
    onDelete: () => void;
}

function ProviderCard({ provider, onEdit, onToggle, onSetPrimary, onDelete }: CardProps) {
    const meta = PROVIDER_META[provider.provider_type];

    return (
        <div className={cn(
            'rounded-[14px] border transition',
            provider.active ? 'border-white/10 bg-[#141417]' : 'border-white/05 bg-[#0F0F11] opacity-60',
        )}>
            <div className="flex items-center gap-3 px-4 py-3">
                {/* Color dot + type badge */}
                <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold"
                    style={{ background: meta.bg, color: meta.color }}
                >
                    <Zap size={15} />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#F0EDE8]">{provider.name}</span>
                        {provider.is_primary && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#C8A97A]/25 bg-[#C8A97A]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#C8A97A]">
                                <Star size={8} fill="currentColor" />
                                Primário
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[#7A7774]">
                        <span style={{ color: meta.color }}>{meta.label}</span>
                        {provider.base_url && <span className="truncate max-w-[160px]">{provider.base_url}</span>}
                        {provider.instance_name && <span>· {provider.instance_name}</span>}
                    </div>
                </div>

                {/* Status + actions */}
                <div className="flex flex-shrink-0 items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]', statusBadge(provider.status))}>
                        {provider.status === 'connected'
                            ? <Wifi size={9} />
                            : provider.status === 'connecting'
                            ? <Loader2 size={9} className="animate-spin" />
                            : <WifiOff size={9} />}
                        {statusLabel(provider.status)}
                    </span>

                    {!provider.is_primary && (
                        <button
                            type="button"
                            title="Definir como primário"
                            onClick={onSetPrimary}
                            className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-white/08 text-[#7A7774] transition hover:border-[#C8A97A]/30 hover:text-[#C8A97A]"
                        >
                            <Star size={12} />
                        </button>
                    )}
                    <button
                        type="button"
                        title={provider.active ? 'Desativar' : 'Ativar'}
                        onClick={onToggle}
                        className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-[7px] border transition',
                            provider.active
                                ? 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
                                : 'border-white/08 text-[#7A7774] hover:border-white/20'
                        )}
                    >
                        <Power size={12} />
                    </button>
                    <button
                        type="button"
                        title="Editar"
                        onClick={onEdit}
                        className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-white/08 text-[#7A7774] transition hover:border-white/20 hover:text-[#F0EDE8]"
                    >
                        <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />
                    </button>
                    <button
                        type="button"
                        title="Remover"
                        onClick={onDelete}
                        className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-red-500/10 text-red-500/50 transition hover:border-red-500/30 hover:text-red-400"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Connected info */}
            {provider.status === 'connected' && provider.connected_number && (
                <div className="border-t border-white/05 px-4 py-2">
                    <div className="flex items-center gap-2 text-[11px] text-[#7A7774]">
                        <Check size={10} className="text-emerald-400" />
                        <span>Número: <span className="font-mono text-[#C8C4BE]">{provider.connected_number}</span></span>
                        {provider.connected_at && (
                            <span className="ml-auto text-[10px]">desde {new Date(provider.connected_at).toLocaleDateString('pt-BR')}</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── QR Panel (for Evolution / Baileys / UazAPI) ──────────────────────────────

interface QrPanelProps {
    provider: WhatsAppProvider;
    onToast: (kind: 'success' | 'error', msg: string) => void;
}

function QrPanel({ provider, onToast }: QrPanelProps) {
    const [qr, setQr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function loadQr() {
        setLoading(true);
        try {
            // Calls existing Evolution API QR endpoint via proxy
            const res = await fetch('/api/internal/whatsapp/qr-code');
            if (!res.ok) throw new Error('Falha ao gerar QR');
            const data = await res.json() as { qr_code_base64?: string; qrCode?: string };
            setQr(data.qr_code_base64 ?? data.qrCode ?? null);
        } catch {
            onToast('error', 'Não foi possível gerar o QR Code.');
        } finally {
            setLoading(false);
        }
    }

    const showQr = ['evolution', 'uazapi', 'baileys'].includes(provider.provider_type);
    if (!showQr) return null;

    return (
        <div className="rounded-[14px] border border-white/10 bg-[#141417] p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7774]">
                    QR Code — {provider.name}
                </div>
                {provider.status !== 'connected' && (
                    <button type="button" className={cls.btn.secondary} onClick={loadQr} disabled={loading}>
                        {loading ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />}
                        Gerar QR
                    </button>
                )}
            </div>
            <div className="mt-4 flex min-h-[200px] items-center justify-center rounded-[10px] border border-dashed border-white/10 bg-[#0A0A0C] p-4">
                {provider.status === 'connected' ? (
                    <div className="text-center">
                        <Check className="mx-auto h-8 w-8 text-emerald-400" />
                        <p className="mt-2 text-sm font-medium text-[#F0EDE8]">{provider.connected_number ?? 'Conectado'}</p>
                    </div>
                ) : qr ? (
                    <img src={qr} alt="QR Code" className="h-48 w-48 rounded-lg bg-white p-2" />
                ) : (
                    <p className="text-[12px] text-[#555]">Clique em "Gerar QR" para conectar a instância.</p>
                )}
            </div>
            {provider.status !== 'connected' && (
                <div className="mt-3 space-y-1 text-[11px] text-[#7A7774]">
                    <p>1. Abra o WhatsApp no celular e vá em Dispositivos vinculados.</p>
                    <p>2. Escaneie o QR Code acima.</p>
                    <p>3. O status muda automaticamente para conectado.</p>
                </div>
            )}
        </div>
    );
}

// ─── Main Tab Component ───────────────────────────────────────────────────────

interface TabProps {
    onToast: (kind: 'success' | 'error', msg: string) => void;
}

export function WhatsAppTab({ onToast }: TabProps) {
    const [providers, setProviders] = useState<WhatsAppProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingProvider, setEditingProvider] = useState<WhatsAppProvider | undefined>();
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const res = await fetch('/api/internal/whatsapp-providers');
            if (!res.ok) throw new Error();
            const data = await res.json() as WhatsAppProvider[];
            setProviders(Array.isArray(data) ? data : []);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function handleToggle(id: string) {
        try {
            const res = await fetch(`/api/internal/whatsapp-providers/${id}/toggle`, { method: 'PATCH' });
            if (!res.ok) throw new Error();
            const data = await res.json() as { active: boolean };
            setProviders((prev) => prev.map((p) => p.id === id ? { ...p, active: data.active } : p));
            onToast('success', 'Status atualizado.');
        } catch { onToast('error', 'Não foi possível atualizar.'); }
    }

    async function handleSetPrimary(id: string) {
        try {
            const res = await fetch(`/api/internal/whatsapp-providers/${id}/set-primary`, { method: 'PATCH' });
            if (!res.ok) throw new Error();
            setProviders((prev) => prev.map((p) => ({ ...p, is_primary: p.id === id })));
            onToast('success', 'Provedor primário atualizado.');
        } catch { onToast('error', 'Não foi possível atualizar.'); }
    }

    async function handleDelete(id: string) {
        try {
            const res = await fetch(`/api/internal/whatsapp-providers/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            setProviders((prev) => prev.filter((p) => p.id !== id));
            onToast('success', 'Provedor removido.');
        } catch { onToast('error', 'Não foi possível remover o provedor.'); }
        setConfirmDeleteId(null);
    }

    const primaryProvider = providers.find((p) => p.is_primary && p.active);

    return (
        <div className="space-y-5">
            {/* Header card */}
            <div className={cn(cls.panel, 'p-5')}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F0EDE8]">
                            Provedores WhatsApp
                        </div>
                        <div className="mt-1 text-[11px] text-[#7A7774]">
                            Configure um ou mais provedores. O primário é usado para envio de mensagens ativas e notificações.
                        </div>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                        <button type="button" className={cls.btn.secondary} onClick={() => void load()}>
                            <RefreshCw size={13} />
                            Atualizar
                        </button>
                        <button type="button" className={cls.btn.primary} onClick={() => { setEditingProvider(undefined); setShowModal(true); }}>
                            <Plus size={13} />
                            Adicionar
                        </button>
                    </div>
                </div>

                {/* Skeleton */}
                {loading && (
                    <div className="mt-5 space-y-3">
                        <div className="h-14 animate-pulse rounded-[14px] bg-white/5" />
                        <div className="h-14 animate-pulse rounded-[14px] bg-white/5" />
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="mt-5 rounded-[12px] border border-red-500/20 bg-red-500/08 p-4 text-center">
                        <p className="text-[12px] text-red-400">Erro ao carregar provedores.</p>
                        <button type="button" className={cn(cls.btn.secondary, 'mt-3')} onClick={() => void load()}>
                            Tentar novamente
                        </button>
                    </div>
                )}

                {/* Empty */}
                {!loading && !error && providers.length === 0 && (
                    <div className="mt-5 rounded-[12px] border border-dashed border-white/10 p-8 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/5">
                            <Zap size={20} className="text-[#7A7774]" />
                        </div>
                        <p className="mt-3 text-[13px] font-medium text-[#C8C4BE]">Nenhum provedor configurado</p>
                        <p className="mt-1 text-[11px] text-[#7A7774]">Adicione Evolution API, UazAPI, Meta Cloud API e outros.</p>
                        <button
                            type="button"
                            className={cn(cls.btn.primary, 'mt-4')}
                            onClick={() => { setEditingProvider(undefined); setShowModal(true); }}
                        >
                            <Plus size={13} />
                            Adicionar primeiro provedor
                        </button>
                    </div>
                )}

                {/* List */}
                {!loading && !error && providers.length > 0 && (
                    <div className="mt-5 space-y-3">
                        {providers.map((p) => (
                            <ProviderCard
                                key={p.id}
                                provider={p}
                                onEdit={() => { setEditingProvider(p); setShowModal(true); }}
                                onToggle={() => void handleToggle(p.id)}
                                onSetPrimary={() => void handleSetPrimary(p.id)}
                                onDelete={() => setConfirmDeleteId(p.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* QR Code panel for primary provider */}
            {primaryProvider && (
                <div className={cls.panel}>
                    <div className="border-b border-white/5 px-5 py-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F0EDE8]">
                            Conexão — {primaryProvider.name}
                        </div>
                        <div className="mt-1 text-[11px] text-[#7A7774]">
                            Escaneie o QR Code ou verifique o status da instância primária.
                        </div>
                    </div>
                    <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-[12px] border border-white/10 bg-[#141417] p-3">
                                    <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#7A7774]">Número conectado</div>
                                    <div className="mt-2 text-[15px] font-semibold text-[#F0EDE8]">
                                        {primaryProvider.connected_number ?? 'Não conectado'}
                                    </div>
                                </div>
                                <div className="rounded-[12px] border border-white/10 bg-[#141417] p-3">
                                    <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#7A7774]">Status</div>
                                    <div className="mt-2">
                                        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]', statusBadge(primaryProvider.status))}>
                                            {statusLabel(primaryProvider.status)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-[12px] border border-white/10 bg-[#141417] p-3 text-[11px] leading-6 text-[#7A7774]">
                                <p>1. Abra o WhatsApp no celular oficial da operação.</p>
                                <p>2. Entre em Dispositivos vinculados e escaneie o QR.</p>
                                <p>3. O status muda automaticamente para conectado.</p>
                            </div>
                        </div>
                        <QrPanel provider={primaryProvider} onToast={onToast} />
                    </div>
                </div>
            )}

            {/* Info box */}
            <div className="rounded-[12px] border border-[#C8A97A]/15 bg-[#C8A97A]/05 px-4 py-3 text-[11px] leading-6 text-[#9A8A6A]">
                <span className="font-bold text-[#C8A97A]">Como funciona: </span>
                Cada provedor tem suas próprias credenciais e instância. O provedor marcado como{' '}
                <span className="font-semibold text-[#C8A97A]">primário</span> é usado para envio de
                mensagens ativas, notificações e atendimento automático. Provedores adicionais podem
                receber mensagens de diferentes números/contas.
            </div>

            {/* Add/Edit modal */}
            {showModal && (
                <ProviderModal
                    provider={editingProvider}
                    onClose={() => { setShowModal(false); setEditingProvider(undefined); }}
                    onSaved={() => void load()}
                    onToast={onToast}
                />
            )}

            {/* Delete confirm */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className={cn(cls.panel, 'w-full max-w-sm p-6 text-center')}>
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
                            <Trash2 size={20} className="text-red-400" />
                        </div>
                        <div className="mt-4 text-[14px] font-semibold text-[#F0EDE8]">Remover provedor?</div>
                        <div className="mt-2 text-[12px] text-[#7A7774]">Esta ação não pode ser desfeita.</div>
                        <div className="mt-5 flex justify-center gap-3">
                            <button type="button" className={cls.btn.secondary} onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                            <button type="button" className={cls.btn.danger} onClick={() => void handleDelete(confirmDeleteId)}>Remover</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
