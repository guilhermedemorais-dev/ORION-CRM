'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, CheckCircle, AlertCircle, X, ChevronDown } from 'lucide-react';
import type { CarrierConfig, CarrierAdapterType } from '@/lib/ajustes-types';

const ADAPTER_OPTIONS: { value: CarrierAdapterType; label: string; description: string }[] = [
    { value: 'jadlog',       label: 'Jadlog',          description: 'E-commerce nacional — cobertura ampla, seguro opcional' },
    { value: 'correios',     label: 'Correios (SEDEX)', description: 'SEDEX e PAC — certificado para joias' },
    { value: 'loggi',        label: 'Loggi',            description: 'Capitais e grandes cidades — rastreio em tempo real' },
    { value: 'tnt',          label: 'TNT / FedEx',      description: 'Alto valor B2B — ideal acima de R$5.000' },
    { value: 'rapiddo',      label: 'Rapiddo',          description: 'Motoboy com seguro — entregas expressas SP' },
    { value: 'generic_rest', label: 'Personalizada',    description: 'Qualquer transportadora com API REST' },
];

interface CredentialField {
    key: string;
    label: string;
    placeholder: string;
    sensitive?: boolean;
}

const ADAPTER_CREDENTIALS: Record<CarrierAdapterType, CredentialField[]> = {
    jadlog: [
        { key: 'api_key', label: 'Token de acesso', placeholder: 'Bearer token da Jadlog', sensitive: true },
        { key: 'contract_number', label: 'Número do contrato', placeholder: 'Ex: 12345' },
    ],
    correios: [
        { key: 'api_key', label: 'Token de acesso', placeholder: 'Token dos Correios API', sensitive: true },
        { key: 'contract_number', label: 'Número do contrato', placeholder: 'Código de serviço' },
    ],
    loggi: [
        { key: 'api_key', label: 'API Key', placeholder: 'Chave de API Loggi', sensitive: true },
    ],
    tnt: [
        { key: 'api_key', label: 'API Key', placeholder: 'Chave TNT / FedEx', sensitive: true },
        { key: 'account_number', label: 'Número da conta', placeholder: 'Account number' },
    ],
    rapiddo: [
        { key: 'api_key', label: 'API Key', placeholder: 'Token Rapiddo', sensitive: true },
    ],
    generic_rest: [
        { key: 'api_key', label: 'Token / API Key', placeholder: 'Bearer token ou API key', sensitive: true },
        { key: 'auth_header', label: 'Header de autenticação', placeholder: 'Authorization (padrão)' },
        { key: 'create_shipment_url', label: 'URL de criação de despacho', placeholder: 'https://api.transportadora.com/shipments' },
        { key: 'tracking_url_template', label: 'URL de rastreio', placeholder: 'https://api.transportadora.com/track/{tracking_code}' },
        { key: 'response_tracking_code_path', label: 'Caminho do código de rastreio', placeholder: 'data.tracking_code' },
        { key: 'response_label_url_path', label: 'Caminho da URL da etiqueta', placeholder: 'data.label_url' },
    ],
};

const baseInput: React.CSSProperties = {
    width: '100%', height: '36px', padding: '0 12px',
    background: '#0D0D10',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '7px',
    color: '#F0EDE8', fontSize: '12px', outline: 'none',
    boxSizing: 'border-box',
};

interface FormState {
    name: string;
    slug: string;
    adapter_type: CarrierAdapterType;
    base_url: string;
    default_service: string;
    insurance_pct: string;
    min_insurance_cents: string;
    credentials: Record<string, string>;
}

const emptyForm = (): FormState => ({
    name: '', slug: '', adapter_type: 'generic_rest',
    base_url: '', default_service: '',
    insurance_pct: '0', min_insurance_cents: '0',
    credentials: {},
});

function slugify(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '').slice(0, 60);
}

interface AddCarrierModalProps {
    editing: CarrierConfig | null;
    onClose: () => void;
    onSaved: () => void;
    showToast: (msg: string, kind?: 'success' | 'error') => void;
}

function AddCarrierModal({ editing, onClose, onSaved, showToast }: AddCarrierModalProps) {
    const [form, setForm] = useState<FormState>(() => {
        if (editing) {
            return {
                name: editing.name, slug: editing.slug,
                adapter_type: editing.adapter_type,
                base_url: editing.base_url ?? '',
                default_service: editing.default_service ?? '',
                insurance_pct: String(editing.insurance_pct),
                min_insurance_cents: String(editing.min_insurance_cents),
                credentials: {},
            };
        }
        return emptyForm();
    });
    const [saving, setSaving] = useState(false);

    const credFields = ADAPTER_CREDENTIALS[form.adapter_type] ?? [];

    function setField(key: keyof FormState, value: string) {
        setForm((prev) => {
            const next = { ...prev, [key]: value };
            if (key === 'name' && !editing) next.slug = slugify(value);
            return next;
        });
    }

    function setCredential(key: string, value: string) {
        setForm((prev) => ({ ...prev, credentials: { ...prev.credentials, [key]: value } }));
    }

    async function handleSave() {
        if (!form.name.trim() || !form.slug.trim()) {
            showToast('Nome e slug são obrigatórios.', 'error'); return;
        }
        setSaving(true);
        try {
            const body: Record<string, unknown> = {
                name: form.name.trim(),
                slug: form.slug.trim(),
                adapter_type: form.adapter_type,
                base_url: form.base_url.trim() || null,
                default_service: form.default_service.trim() || null,
                insurance_pct: parseFloat(form.insurance_pct) || 0,
                min_insurance_cents: parseInt(form.min_insurance_cents) || 0,
                credentials: form.credentials,
                active: true,
            };

            const url = editing ? `/api/internal/carriers/${editing.id}` : '/api/internal/carriers';
            const method = editing ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!res.ok) throw new Error(await res.text());

            showToast(editing ? 'Transportadora atualizada.' : 'Transportadora adicionada.', 'success');
            onSaved();
        } catch {
            showToast('Não foi possível salvar. Verifique os dados.', 'error');
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
                            {editing ? 'Editar transportadora' : 'Adicionar transportadora'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '2px' }}>
                            Configure as credenciais e parâmetros de integração
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', color: '#7A7774', cursor: 'pointer' }}>
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 20px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* Adapter type */}
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                            Transportadora
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {ADAPTER_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setField('adapter_type', opt.value)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '10px 12px',
                                        background: form.adapter_type === opt.value ? 'rgba(200,169,122,0.08)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${form.adapter_type === opt.value ? 'rgba(200,169,122,0.30)' : 'rgba(255,255,255,0.07)'}`,
                                        borderRadius: '8px', textAlign: 'left', cursor: 'pointer', width: '100%',
                                    }}
                                >
                                    <Truck size={14} color={form.adapter_type === opt.value ? '#C8A97A' : '#7A7774'} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: form.adapter_type === opt.value ? '#C8A97A' : '#F0EDE8' }}>{opt.label}</div>
                                        <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '1px' }}>{opt.description}</div>
                                    </div>
                                    {form.adapter_type === opt.value && <CheckCircle size={14} color="#C8A97A" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name + slug */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '4px' }}>Nome exibido *</label>
                            <input style={baseInput} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Ex: Jadlog Express" />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '4px' }}>Slug (identificador) *</label>
                            <input style={baseInput} value={form.slug} onChange={(e) => setField('slug', slugify(e.target.value))} placeholder="ex: jadlog_express" disabled={!!editing} />
                        </div>
                    </div>

                    {/* Credentials */}
                    {credFields.length > 0 && (
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                Credenciais
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {credFields.map((f) => (
                                    <div key={f.key}>
                                        <label style={{ fontSize: '11px', color: '#7A7774', display: 'block', marginBottom: '3px' }}>{f.label}</label>
                                        <input
                                            type={f.sensitive ? 'password' : 'text'}
                                            style={baseInput}
                                            value={form.credentials[f.key] ?? ''}
                                            onChange={(e) => setCredential(f.key, e.target.value)}
                                            placeholder={f.placeholder}
                                            autoComplete="off"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Advanced */}
                    <details>
                        <summary style={{ fontSize: '11px', fontWeight: 600, color: '#7A7774', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                            <ChevronDown size={12} /> Configurações avançadas
                        </summary>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                            <div>
                                <label style={{ fontSize: '11px', color: '#7A7774', display: 'block', marginBottom: '3px' }}>URL base da API (opcional — substitui o padrão)</label>
                                <input style={baseInput} value={form.base_url} onChange={(e) => setField('base_url', e.target.value)} placeholder="https://api.transportadora.com/v2" />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: '#7A7774', display: 'block', marginBottom: '3px' }}>Serviço padrão</label>
                                <input style={baseInput} value={form.default_service} onChange={(e) => setField('default_service', e.target.value)} placeholder="EXPRESSO" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', color: '#7A7774', display: 'block', marginBottom: '3px' }}>Seguro (% do valor declarado)</label>
                                    <input type="number" min="0" max="100" step="0.1" style={baseInput} value={form.insurance_pct} onChange={(e) => setField('insurance_pct', e.target.value)} placeholder="0.5" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: '#7A7774', display: 'block', marginBottom: '3px' }}>Seguro mínimo (em centavos)</label>
                                    <input type="number" min="0" step="100" style={baseInput} value={form.min_insurance_cents} onChange={(e) => setField('min_insurance_cents', e.target.value)} placeholder="500" />
                                </div>
                            </div>
                        </div>
                    </details>
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <button onClick={onClose} style={{ height: '34px', padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '12px', cursor: 'pointer' }}>
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{ height: '34px', padding: '0 18px', background: saving ? 'rgba(200,169,122,0.06)' : 'rgba(200,169,122,0.14)', border: '1px solid rgba(200,169,122,0.30)', borderRadius: '7px', color: '#C8A97A', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                </div>
            </div>
        </>
    );
}

interface ToastRecord { id: number; kind: 'success' | 'error'; message: string; }

export function LogisticaTab() {
    const [carriers, setCarriers] = useState<CarrierConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<CarrierConfig | null>(null);
    const [toasts, setToasts] = useState<ToastRecord[]>([]);
    let toastId = 0;

    function showToast(message: string, kind: 'success' | 'error' = 'success') {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, kind, message }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    }

    const fetchCarriers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/internal/carriers');
            if (!res.ok) throw new Error('Erro');
            const data = await res.json();
            setCarriers(Array.isArray(data) ? data : []);
        } catch {
            setError('Erro ao carregar transportadoras.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCarriers(); }, [fetchCarriers]);

    async function handleToggle(carrier: CarrierConfig) {
        try {
            await fetch(`/api/internal/carriers/${carrier.id}/toggle`, { method: 'PATCH' });
            setCarriers((prev) => prev.map((c) => c.id === carrier.id ? { ...c, active: !c.active } : c));
        } catch {
            showToast('Não foi possível alterar o status.', 'error');
        }
    }

    async function handleDelete(carrier: CarrierConfig) {
        if (!confirm(`Excluir "${carrier.name}"? Esta ação não pode ser desfeita.`)) return;
        try {
            const res = await fetch(`/api/internal/carriers/${carrier.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({})) as { message?: string };
                showToast(data.message ?? 'Não foi possível excluir.', 'error');
                return;
            }
            setCarriers((prev) => prev.filter((c) => c.id !== carrier.id));
            showToast('Transportadora removida.', 'success');
        } catch {
            showToast('Não foi possível excluir.', 'error');
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Toasts */}
            <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 200, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {toasts.map((t) => (
                    <div key={t.id} style={{
                        padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                        background: t.kind === 'success' ? 'rgba(63,184,122,0.15)' : 'rgba(224,82,82,0.15)',
                        border: `1px solid ${t.kind === 'success' ? 'rgba(63,184,122,0.30)' : 'rgba(224,82,82,0.30)'}`,
                        color: t.kind === 'success' ? '#3FB87A' : '#E05252',
                    }}>
                        {t.message}
                    </div>
                ))}
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#F0EDE8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Truck size={16} color="#C8A97A" /> Logística & Transportadoras
                    </div>
                    <div style={{ fontSize: '12px', color: '#7A7774', marginTop: '4px' }}>
                        Configure as transportadoras disponíveis para despacho de pedidos. O atendente vê apenas as ativas.
                    </div>
                </div>
                <button
                    onClick={() => { setEditing(null); setShowModal(true); }}
                    style={{ height: '34px', padding: '0 14px', background: 'rgba(200,169,122,0.12)', border: '1px solid rgba(200,169,122,0.25)', borderRadius: '7px', color: '#C8A97A', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
                >
                    <Plus size={13} /> Adicionar
                </button>
            </div>

            {/* List */}
            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[1, 2].map((i) => <div key={i} style={{ height: '68px', borderRadius: '10px', background: '#202026', animation: 'pulse 1.4s ease-in-out infinite' }} />)}
                </div>
            )}

            {!loading && error && (
                <div style={{ padding: '16px', background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ color: '#E05252', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
                    <button onClick={fetchCarriers} style={{ height: '28px', padding: '0 14px', background: 'transparent', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '6px', color: '#E05252', fontSize: '11px', cursor: 'pointer' }}>Tentar novamente</button>
                </div>
            )}

            {!loading && !error && carriers.length === 0 && (
                <div style={{ border: '2px dashed rgba(255,255,255,0.07)', borderRadius: '10px', padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(200,169,122,0.08)', border: '1px solid rgba(200,169,122,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <Truck size={20} color="#C8A97A" />
                    </div>
                    <p style={{ color: '#C8C4BE', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Nenhuma transportadora configurada</p>
                    <p style={{ color: '#7A7774', fontSize: '12px', marginBottom: '14px' }}>Adicione a primeira para habilitar o módulo de despacho.</p>
                    <button onClick={() => { setEditing(null); setShowModal(true); }} style={{ height: '30px', padding: '0 16px', background: 'rgba(200,169,122,0.10)', border: '1px solid rgba(200,169,122,0.22)', borderRadius: '6px', color: '#C8A97A', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={12} /> Adicionar transportadora
                    </button>
                </div>
            )}

            {!loading && !error && carriers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {carriers.map((carrier) => (
                        <div key={carrier.id} style={{ background: '#141417', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {/* Icon */}
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(200,169,122,0.08)', border: '1px solid rgba(200,169,122,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Truck size={18} color="#C8A97A" />
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F0EDE8', marginBottom: '2px' }}>{carrier.name}</div>
                                <div style={{ fontSize: '11px', color: '#7A7774', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontFamily: 'monospace', background: '#0D0D10', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '0 5px' }}>{carrier.slug}</span>
                                    <span>{ADAPTER_OPTIONS.find((a) => a.value === carrier.adapter_type)?.label ?? carrier.adapter_type}</span>
                                </div>
                            </div>
                            {/* Status badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                {carrier.active
                                    ? <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3FB87A', display: 'inline-block' }} /><span style={{ fontSize: '11px', color: '#3FB87A', fontWeight: 600 }}>Ativo</span></>
                                    : <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7A7774', display: 'inline-block' }} /><span style={{ fontSize: '11px', color: '#7A7774', fontWeight: 600 }}>Inativo</span></>
                                }
                            </div>
                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <button title={carrier.active ? 'Desativar' : 'Ativar'} onClick={() => handleToggle(carrier)} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '6px', color: carrier.active ? '#3FB87A' : '#7A7774', cursor: 'pointer' }}>
                                    {carrier.active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                                </button>
                                <button title="Editar" onClick={() => { setEditing(carrier); setShowModal(true); }} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '6px', color: '#C8C4BE', cursor: 'pointer' }}>
                                    <Pencil size={13} />
                                </button>
                                <button title="Excluir" onClick={() => handleDelete(carrier)} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(224,82,82,0.06)', border: '1px solid rgba(224,82,82,0.15)', borderRadius: '6px', color: '#E05252', cursor: 'pointer' }}>
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info box */}
            <div style={{ padding: '12px 14px', background: 'rgba(91,156,246,0.06)', border: '1px solid rgba(91,156,246,0.15)', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <AlertCircle size={14} color="#5B9CF6" style={{ flexShrink: 0, marginTop: '1px' }} />
                <div style={{ fontSize: '11px', color: '#7A7774', lineHeight: 1.6 }}>
                    <strong style={{ color: '#5B9CF6' }}>Como funciona:</strong> O botão "+ Nova Entrega" na ficha do cliente só fica disponível após a OS ser concluída e quando ao menos uma transportadora estiver ativa. As credenciais são armazenadas criptografadas e nunca expostas na interface.
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <AddCarrierModal
                    editing={editing}
                    onClose={() => { setShowModal(false); setEditing(null); }}
                    onSaved={() => { setShowModal(false); setEditing(null); fetchCarriers(); }}
                    showToast={showToast}
                />
            )}
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </div>
    );
}
