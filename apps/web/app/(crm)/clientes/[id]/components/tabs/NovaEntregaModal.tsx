'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Truck, Package, MapPin, CheckCircle } from 'lucide-react';
import type { CustomerFull } from '../types';
import { parseCurrencyToCents } from '@/lib/financeiro';

function formatCentsBRInput(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CarrierOption {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    default_service: string | null;
    insurance_pct: number;
    min_insurance_cents: number;
}

interface Props {
    customerId: string;
    customer: CustomerFull;
    orderId?: string;
    soId?: string;
    orderNumber?: string;
    declaredValueCents?: number;
    balanceCents?: number;
    onClose: () => void;
    onCreated: () => void;
}

const baseInput: React.CSSProperties = {
    width: '100%', height: '36px', padding: '0 12px',
    background: '#0D0D10',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '7px',
    color: '#F0EDE8', fontSize: '12px', outline: 'none',
    boxSizing: 'border-box',
};

const baseTextarea: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: '#0D0D10',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '7px',
    color: '#F0EDE8', fontSize: '12px', outline: 'none',
    resize: 'vertical', minHeight: '60px',
    boxSizing: 'border-box',
};

export function NovaEntregaModal({
    customerId, customer, orderId, soId, orderNumber,
    declaredValueCents = 0, balanceCents = 0,
    onClose, onCreated,
}: Props) {
    const [carriers, setCarriers] = useState<CarrierOption[]>([]);
    const [loadingCarriers, setLoadingCarriers] = useState(true);

    const [type, setType] = useState<'store_pickup' | 'shipping'>('store_pickup');
    const [carrierId, setCarrierId] = useState('');
    const [service, setService] = useState('');
    const [address, setAddress] = useState(customer.address_full ?? '');
    const [declaredValue, setDeclaredValue] = useState(declaredValueCents > 0 ? formatCentsBRInput(declaredValueCents) : '');
    const [pickupDate, setPickupDate] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCarriers = useCallback(async () => {
        try {
            const res = await fetch('/api/internal/carriers/active');
            if (!res.ok) return;
            const data = await res.json();
            setCarriers(Array.isArray(data) ? data : []);
        } finally {
            setLoadingCarriers(false);
        }
    }, []);

    useEffect(() => { fetchCarriers(); }, [fetchCarriers]);

    const safeClose = useCallback(() => {
        if (saving) return;
        onClose();
    }, [saving, onClose]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') safeClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [safeClose]);

    const selectedCarrier = carriers.find((c) => c.id === carrierId);

    // Estimated insurance — uses pt-BR-safe parser
    const declaredCents = parseCurrencyToCents(declaredValue) ?? 0;
    const estInsurance = selectedCarrier
        ? Math.max(
            selectedCarrier.min_insurance_cents,
            Math.round((declaredCents * selectedCarrier.insurance_pct) / 100),
          )
        : 0;

    async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
        e?.preventDefault();
        if (saving) return;
        if (type === 'shipping' && !carrierId) {
            setError('Selecione uma transportadora.'); return;
        }
        setSaving(true);
        setError(null);
        try {
            const body: Record<string, unknown> = {
                customer_id: customerId,
                order_id: orderId ?? undefined,
                so_id: soId ?? undefined,
                type,
                carrier_config_id: type === 'shipping' ? carrierId || undefined : undefined,
                service: service || undefined,
                address: address || undefined,
                declared_value_cents: declaredCents,
                balance_cents: balanceCents,
                pickup_scheduled_at: pickupDate || undefined,
                notes: notes || undefined,
            };
            const res = await fetch('/api/internal/deliveries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({})) as { message?: string };
                throw new Error(data.message ?? 'Erro ao criar entrega.');
            }
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível criar a entrega.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <div onClick={safeClose} style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.55)' }} />
            <form onSubmit={handleSubmit} style={{
                position: 'fixed', left: '50%', top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '480px', maxWidth: '96vw', maxHeight: '92vh',
                zIndex: 200,
                background: '#111114',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                boxShadow: '0 24px 64px rgba(0,0,0,.8)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#F0EDE8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Truck size={15} color="#2DD4BF" /> Nova Entrega
                        </div>
                        {orderNumber && (
                            <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '2px' }}>
                                Pedido / OS: <span style={{ color: '#C8A97A', fontWeight: 600 }}>{orderNumber}</span>
                            </div>
                        )}
                    </div>
                    <button type="button" aria-label="Fechar" onClick={safeClose} disabled={saving} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', color: '#7A7774', cursor: 'pointer' }}>
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 20px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Cliente info */}
                    <div style={{ padding: '10px 12px', background: 'rgba(200,169,122,0.06)', border: '1px solid rgba(200,169,122,0.14)', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <MapPin size={13} color="#C8A97A" style={{ flexShrink: 0, marginTop: '1px' }} />
                        <div style={{ fontSize: '12px', color: '#C8C4BE', lineHeight: 1.5 }}>
                            <strong style={{ color: '#F0EDE8' }}>{customer.name}</strong>
                            {customer.address_full && <><br />{customer.address_full}</>}
                            {customer.city && <>, {customer.city}/{customer.state}</>}
                        </div>
                    </div>

                    {/* Modalidade */}
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                            Modalidade
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {([
                                { value: 'store_pickup', label: 'Retirada na loja', icon: <Package size={13} /> },
                                { value: 'shipping',     label: 'Envio',            icon: <Truck size={13} /> },
                            ] as const).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setType(opt.value)}
                                    style={{
                                        flex: 1, height: '40px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        background: type === opt.value ? 'rgba(45,212,191,0.10)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${type === opt.value ? 'rgba(45,212,191,0.30)' : 'rgba(255,255,255,0.07)'}`,
                                        borderRadius: '8px', cursor: 'pointer',
                                        fontSize: '12px', fontWeight: 600,
                                        color: type === opt.value ? '#2DD4BF' : '#7A7774',
                                    }}
                                >
                                    {opt.icon} {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Transportadora (somente envio) */}
                    {type === 'shipping' && (
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                Transportadora
                            </label>
                            {loadingCarriers ? (
                                <div style={{ height: '36px', background: '#202026', borderRadius: '7px', animation: 'pulse 1.4s ease-in-out infinite' }} />
                            ) : carriers.length === 0 ? (
                                <div style={{ padding: '10px 12px', background: 'rgba(240,160,64,0.08)', border: '1px solid rgba(240,160,64,0.20)', borderRadius: '7px', fontSize: '12px', color: '#F0A040' }}>
                                    Nenhuma transportadora ativa. Configure em <strong>Ajustes → Logística</strong>.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {carriers.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => { setCarrierId(c.id); setService(c.default_service ?? ''); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '8px 12px',
                                                background: carrierId === c.id ? 'rgba(45,212,191,0.08)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${carrierId === c.id ? 'rgba(45,212,191,0.28)' : 'rgba(255,255,255,0.07)'}`,
                                                borderRadius: '8px', cursor: 'pointer', width: '100%', textAlign: 'left',
                                            }}
                                        >
                                            <Truck size={14} color={carrierId === c.id ? '#2DD4BF' : '#7A7774'} />
                                            <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: carrierId === c.id ? '#2DD4BF' : '#F0EDE8' }}>{c.name}</span>
                                            {carrierId === c.id && <CheckCircle size={13} color="#2DD4BF" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Serviço (quando carrier selecionada) */}
                    {type === 'shipping' && carrierId && (
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '4px' }}>Serviço</label>
                            <input
                                style={baseInput}
                                value={service}
                                onChange={(e) => setService(e.target.value)}
                                placeholder="Ex: EXPRESSO, ECONOMICO, PAC"
                                title="Tipo de serviço da transportadora"
                            />
                        </div>
                    )}

                    {/* Endereço */}
                    {type === 'shipping' && (
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '4px' }}>Endereço de entrega</label>
                            <input
                                style={baseInput}
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Rua, número, bairro, cidade/UF"
                                title="Endereço completo de entrega"
                            />
                        </div>
                    )}

                    {/* Valor declarado + coleta */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '4px' }}>Valor declarado (R$)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                style={baseInput}
                                value={declaredValue}
                                onChange={(e) => {
                                    const onlyNums = e.target.value.replace(/\D/g, '');
                                    if (!onlyNums) { setDeclaredValue(''); return; }
                                    setDeclaredValue(formatCentsBRInput(Number(onlyNums)));
                                }}
                                placeholder="0,00"
                                title="Valor declarado do pacote (em reais)"
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '4px' }}>
                                {type === 'store_pickup' ? 'Data de retirada' : 'Data de coleta'}
                            </label>
                            <input
                                type="datetime-local"
                                style={baseInput}
                                value={pickupDate}
                                onChange={(e) => setPickupDate(e.target.value)}
                                title="Data e hora programada"
                            />
                        </div>
                    </div>

                    {/* Seguro estimado */}
                    {type === 'shipping' && selectedCarrier && estInsurance > 0 && (
                        <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px', fontSize: '11px', color: '#7A7774', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Seguro estimado ({selectedCarrier.insurance_pct}% do valor declarado)</span>
                            <span style={{ color: '#C8A97A', fontWeight: 600 }}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estInsurance / 100)}
                            </span>
                        </div>
                    )}

                    {/* Observações */}
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#C8C4BE', display: 'block', marginBottom: '4px' }}>Observações</label>
                        <textarea
                            style={baseTextarea}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ex: Embrulho para presente, frágil, entregar só a titular..."
                            title="Observações adicionais para a entrega"
                        />
                    </div>

                    {error && (
                        <div style={{ padding: '8px 12px', background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '7px', fontSize: '12px', color: '#E05252' }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <button type="button" onClick={safeClose} disabled={saving} style={{ height: '34px', padding: '0 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '7px', color: '#C8C4BE', fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving || (type === 'shipping' && carriers.length === 0)}
                        style={{
                            height: '34px', padding: '0 20px',
                            background: 'rgba(45,212,191,0.12)',
                            border: '1px solid rgba(45,212,191,0.28)',
                            borderRadius: '7px', color: '#2DD4BF',
                            fontSize: '12px', fontWeight: 600,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1,
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        <Truck size={13} />
                        {saving ? 'Despachando…' : 'Despachar'}
                    </button>
                </div>
            </form>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        </>
    );
}
