'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatCurrencyFromCents, formatPhone, getInitials, daysSince as daysSinceUtil } from '@/lib/utils';

interface CustomerRecord {
    id: string;
    name: string;
    whatsapp_number: string;
    email: string | null;
    origin: string | null;
    is_converted: boolean;
    ltv_cents: number;
    lifetime_value_cents: number;
    preferred_metal: string | null;
    created_at: string;
    updated_at: string;
    assigned_to: { id: string; name: string } | null;
}

function fmtPhone(raw: string | null | undefined): string {
    if (!raw) return '—';
    return formatPhone(raw);
}


const AVATAR_COLORS = [
    { bg: 'linear-gradient(135deg,#2a1a0a,#3d3020)', color: '#C8A97A' },
    { bg: 'linear-gradient(135deg,#1a2a1a,#2a3a20)', color: '#3FB87A' },
    { bg: 'linear-gradient(135deg,#1a1a2a,#20202a)', color: '#5B9CF6' },
    { bg: 'linear-gradient(135deg,#2a1a2a,#3a2030)', color: '#A78BFA' },
    { bg: 'linear-gradient(135deg,#1a2a2a,#202a30)', color: '#2DD4BF' },
];

function avatarColor(name: string) {
    const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx] ?? AVATAR_COLORS[0]!;
}

function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || !whatsapp.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/internal/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), whatsapp_number: whatsapp.trim(), email: email.trim() || undefined }),
            });
            if (!res.ok) throw new Error('Erro ao criar cliente');
            onCreated();
            onClose();
        } catch {
            alert('Erro ao criar cliente.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ width: '100%', maxWidth: '480px', background: '#141417', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.9)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 700, color: '#F0EDE8' }}>Novo Cliente</div>
                    <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', color: '#7A7774', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
                <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { label: 'Nome completo *', value: name, onChange: setName, placeholder: 'Maria Fernanda Costa', required: true },
                            { label: 'WhatsApp *', value: whatsapp, onChange: setWhatsapp, placeholder: '+5511999999999', required: true },
                            { label: 'E-mail', value: email, onChange: setEmail, placeholder: 'email@cliente.com', required: false },
                        ].map((f) => (
                            <div key={f.label}>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#E8E4DE', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                                <input
                                    value={f.value}
                                    onChange={(e) => f.onChange(e.target.value)}
                                    placeholder={f.placeholder}
                                    required={f.required}
                                    style={{ width: '100%', height: '35px', background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', padding: '0 11px', fontSize: '12px', color: '#F0EDE8', boxSizing: 'border-box', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                                />
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button type="button" onClick={onClose} style={{ height: '34px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: '#C8C4BE', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancelar</button>
                        <button type="submit" disabled={saving} style={{ height: '34px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#C8A97A', border: 'none', color: '#000', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: saving ? 0.6 : 1 }}>
                            {saving ? 'Salvando...' : 'Criar cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ClientesPage() {
    const [customers, setCustomers] = useState<CustomerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [showModal, setShowModal] = useState(false);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}&limit=100` : '?limit=100';
            const res = await fetch(`/api/internal/customers${qs}`);
            if (!res.ok) throw new Error('Erro');
            const data = await res.json();
            setCustomers(Array.isArray(data) ? data : (data.data ?? []));
        } catch {
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        const t = setTimeout(fetchCustomers, 300);
        return () => clearTimeout(t);
    }, [fetchCustomers]);

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');
                .cl-row:hover { background: #141417 !important; }
                .cl-link:hover { color: #C8A97A !important; }
                .cl-btn:hover { background: #E8D5B0 !important; }
                .cl-search:focus { border-color: rgba(200,169,122,0.35) !important; }
            `}</style>

            <div style={{ minHeight: '100vh', background: '#070708', color: '#F0EDE8', fontFamily: "'DM Sans', sans-serif", padding: '28px 32px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 700, color: '#F0EDE8', marginBottom: '4px' }}>Clientes</div>
                        <div style={{ fontSize: '12px', color: '#7A7774' }}>Base de relacionamento consolidada, com acesso ao perfil completo.</div>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="cl-btn"
                        style={{ height: '34px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#C8A97A', border: 'none', color: '#000', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '6px', transition: 'background .15s' }}
                    >
                        + Novo cliente
                    </button>
                </div>

                {/* Search */}
                <div style={{ marginBottom: '20px' }}>
                    <input
                        className="cl-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por nome, WhatsApp ou e-mail..."
                        style={{ width: '100%', maxWidth: '420px', height: '36px', background: '#141417', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '8px', padding: '0 12px 0 36px', fontSize: '12px', color: '#F0EDE8', boxSizing: 'border-box', outline: 'none', fontFamily: "'DM Sans', sans-serif", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237A7774' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: '12px center', transition: 'border-color .15s' }}
                    />
                </div>

                {/* Table */}
                <div style={{ background: '#0F0F11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Cliente', 'WhatsApp', 'Responsável', 'LTV', 'Atualizado'].map((h) => (
                            <div key={h} style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#7A7774' }}>{h}</div>
                        ))}
                    </div>

                    {/* Loading skeletons */}
                    {loading && Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: '12px' }}>
                            {[180, 120, 100, 80, 80].map((w, j) => (
                                <div key={j} style={{ height: '12px', background: '#1A1A1E', borderRadius: '6px', width: `${w}px`, animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.05}s` }} />
                            ))}
                        </div>
                    ))}

                    {/* Empty state */}
                    {!loading && customers.length === 0 && (
                        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                            <div style={{ fontSize: '32px', marginBottom: '10px' }}>👥</div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#C8C4BE', marginBottom: '4px' }}>Nenhum cliente encontrado</div>
                            <div style={{ fontSize: '12px', color: '#7A7774' }}>Crie um cliente ou converta um lead para começar.</div>
                        </div>
                    )}

                    {/* Rows */}
                    {!loading && customers.map((c) => {
                        const av = avatarColor(c.name);
                        const ltv = c.ltv_cents || c.lifetime_value_cents || 0;
                        return (
                            <div
                                key={c.id}
                                className="cl-row"
                                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', transition: 'background .12s' }}
                            >
                                {/* Cliente */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: av.bg, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'Playfair Display', serif", fontSize: '11px', fontWeight: 700, color: av.color }}>
                                        {getInitials(c.name)}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <Link href={`/clientes/${c.id}`} className="cl-link" style={{ fontSize: '13px', fontWeight: 600, color: '#F0EDE8', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color .15s' }}>
                                            {c.name}
                                        </Link>
                                        <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {c.email ?? 'Sem e-mail'}
                                        </div>
                                    </div>
                                </div>

                                {/* WhatsApp */}
                                <div style={{ fontSize: '12px', color: '#C8C4BE' }}>{fmtPhone(c.whatsapp_number)}</div>

                                {/* Responsável */}
                                <div style={{ fontSize: '12px', color: '#C8C4BE' }}>{c.assigned_to?.name ?? <span style={{ color: '#7A7774' }}>—</span>}</div>

                                {/* LTV */}
                                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '13px', fontWeight: 700, color: ltv > 0 ? '#C8A97A' : '#7A7774' }}>
                                    {ltv > 0 ? formatCurrencyFromCents(ltv) : '—'}
                                </div>

                                {/* Atualizado */}
                                <div style={{ fontSize: '11px', color: '#7A7774' }}>{daysSinceUtil(c.updated_at)}</div>
                            </div>
                        );
                    })}
                </div>

                {!loading && customers.length > 0 && (
                    <div style={{ marginTop: '12px', fontSize: '11px', color: '#7A7774', textAlign: 'right' }}>
                        {customers.length} cliente{customers.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>

            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

            {showModal && (
                <NewClientModal
                    onClose={() => setShowModal(false)}
                    onCreated={fetchCustomers}
                />
            )}
        </>
    );
}
