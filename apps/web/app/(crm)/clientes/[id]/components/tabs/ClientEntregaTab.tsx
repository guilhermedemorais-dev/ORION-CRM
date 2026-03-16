'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Package, ExternalLink, Download, CheckCircle, AlertCircle } from 'lucide-react';
import type { Delivery, CustomerFull } from '../types';
import { NovaEntregaModal } from './NovaEntregaModal';

interface Props {
    customerId: string;
    customer: CustomerFull;
    /** OS concluída ou pipeline_status = ENTREGA — habilita o botão */
    canCreateDelivery: boolean;
}

function fmtDate(d: string | null): string {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    pending:          { label: 'Aguardando',      color: '#7A7774' },
    posted:           { label: 'Postado',          color: '#5B9CF6' },
    in_transit:       { label: 'Em trânsito',      color: '#C8A97A' },
    out_for_delivery: { label: 'Saiu p/ entrega',  color: '#A78BFA' },
    delivered:        { label: 'Entregue',         color: '#3FB87A' },
    failed:           { label: 'Falhou',           color: '#E05252' },
    cancelled:        { label: 'Cancelado',        color: '#7A7774' },
};

const TIMELINE_STEPS = [
    { key: 'pending',          label: 'Preparação' },
    { key: 'posted',           label: 'Postado' },
    { key: 'in_transit',       label: 'Em trânsito' },
    { key: 'out_for_delivery', label: 'Saiu p/ entrega' },
    { key: 'delivered',        label: 'Entregue' },
];

const STATUS_IDX: Record<string, number> = {
    pending: 0, posted: 1, in_transit: 2, out_for_delivery: 3, delivered: 4,
};

interface DeliveryCardProps {
    delivery: Delivery & {
        carrier_name?: string | null;
        carrier_slug?: string | null;
        tracking_events?: Array<{ timestamp: string; status: string; description: string; location: string | null }>;
    };
    onMarkDelivered: (id: string) => void;
}

function DeliveryCard({ delivery, onMarkDelivered }: DeliveryCardProps) {
    const statusInfo = STATUS_LABEL[delivery.status] ?? STATUS_LABEL['pending'];
    const activeIdx = STATUS_IDX[delivery.status] ?? 0;
    const isDelivered = delivery.status === 'delivered';
    const isCancelled = delivery.status === 'cancelled';

    return (
        <div style={{ background: '#141417', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                        {delivery.order_number && (
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', fontWeight: 700, color: '#C8A97A' }}>
                                Pedido {delivery.order_number}
                            </span>
                        )}
                        {delivery.so_number && (
                            <span style={{ fontSize: '11px', color: '#7A7774' }}>OS {delivery.so_number}</span>
                        )}
                        <span style={{ padding: '1px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, background: `${statusInfo.color}18`, border: `1px solid ${statusInfo.color}44`, color: statusInfo.color }}>
                            {statusInfo.label}
                        </span>
                    </div>
                    {delivery.carrier_name && (
                        <div style={{ fontSize: '11px', color: '#7A7774', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Truck size={11} /> {delivery.carrier_name}
                        </div>
                    )}
                    {delivery.address && (
                        <div style={{ fontSize: '11px', color: '#7A7774', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            📍 {delivery.address}
                        </div>
                    )}
                </div>

                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {delivery.tracking_code && (
                        <span style={{ background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 7px', fontSize: '10px', color: '#7A7774', fontFamily: 'monospace' }}>
                            {delivery.tracking_code}
                        </span>
                    )}
                    {delivery.scheduled_at && (
                        <div style={{ fontSize: '11px', color: '#7A7774' }}>Prev: {fmtDate(delivery.scheduled_at)}</div>
                    )}
                </div>
            </div>

            {/* Timeline */}
            {!isCancelled && (
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    {TIMELINE_STEPS.map((step, idx) => {
                        const isDone = idx <= activeIdx && !isCancelled;
                        const isActive = idx === activeIdx && !isDelivered && !isCancelled;
                        return (
                            <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                {idx > 0 && <div style={{ position: 'absolute', top: '11px', left: 0, right: '50%', height: '2px', background: idx <= activeIdx ? '#3FB87A' : 'rgba(255,255,255,0.07)', zIndex: 0 }} />}
                                {idx < TIMELINE_STEPS.length - 1 && <div style={{ position: 'absolute', top: '11px', left: '50%', right: 0, height: '2px', background: idx < activeIdx ? '#3FB87A' : 'rgba(255,255,255,0.07)', zIndex: 0 }} />}
                                <div style={{
                                    width: '23px', height: '23px', borderRadius: '50%', zIndex: 1, position: 'relative',
                                    background: isDone ? '#3FB87A' : '#1A1A1E',
                                    border: `2px solid ${isDone ? '#3FB87A' : isActive ? '#C8A97A' : 'rgba(255,255,255,0.12)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '9px', fontWeight: 700,
                                    color: isDone ? '#070708' : '#7A7774',
                                    boxShadow: isActive ? '0 0 8px rgba(200,169,122,0.5)' : 'none',
                                }}>
                                    {isDone ? '✓' : idx + 1}
                                </div>
                                <div style={{ fontSize: '8px', color: isDone ? '#3FB87A' : '#7A7774', marginTop: '3px', textAlign: 'center', fontWeight: isDone ? 600 : 400 }}>
                                    {step.label}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Tracking events */}
            {delivery.tracking_events && delivery.tracking_events.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    {delivery.tracking_events.slice(-3).reverse().map((ev, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C8A97A', flexShrink: 0, marginTop: '4px' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '11px', color: '#C8C4BE' }}>{ev.description}</div>
                                {ev.location && <div style={{ fontSize: '10px', color: '#7A7774' }}>{ev.location}</div>}
                            </div>
                            <div style={{ fontSize: '10px', color: '#7A7774', flexShrink: 0 }}>
                                {fmtDate(ev.timestamp)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Action row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {delivery.label_url && (
                    <a href={delivery.label_url} download title="Baixar etiqueta" style={{ height: '28px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(91,156,246,0.08)', border: '1px solid rgba(91,156,246,0.20)', borderRadius: '5px', color: '#5B9CF6', fontSize: '11px', textDecoration: 'none' }}>
                        <Download size={12} /> Etiqueta
                    </a>
                )}
                {delivery.tracking_code && (
                    <button
                        type="button"
                        onClick={async () => {
                            const res = await fetch(`/api/internal/deliveries/${delivery.id}/tracking`);
                            if (res.ok) window.location.reload();
                        }}
                        style={{ height: '28px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '5px', color: '#C8C4BE', fontSize: '11px', cursor: 'pointer' }}
                        title="Atualizar rastreio"
                    >
                        <ExternalLink size={12} /> Rastrear
                    </button>
                )}
                {!isDelivered && !isCancelled && (
                    <button
                        type="button"
                        onClick={() => onMarkDelivered(delivery.id)}
                        style={{ height: '28px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(63,184,122,0.08)', border: '1px solid rgba(63,184,122,0.22)', borderRadius: '5px', color: '#3FB87A', fontSize: '11px', cursor: 'pointer' }}
                        title="Marcar como entregue"
                    >
                        <CheckCircle size={12} /> Entregue
                    </button>
                )}
                {isDelivered && delivery.delivered_at && (
                    <div style={{ fontSize: '11px', color: '#3FB87A' }}>✓ Entregue em {fmtDate(delivery.delivered_at)}</div>
                )}
            </div>
        </div>
    );
}

function Skeleton() {
    return <div style={{ background: '#202026', borderRadius: '10px', height: '160px', animation: 'pulse 1.4s ease-in-out infinite' }} />;
}

export default function ClientEntregaTab({ customerId, customer, canCreateDelivery }: Props) {
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    const fetchDeliveries = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/internal/customers/${customerId}/deliveries`);
            if (!res.ok) throw new Error('Erro');
            const data = await res.json();
            setDeliveries(Array.isArray(data) ? data : (data.data ?? []));
        } catch {
            setError('Erro ao carregar entregas.');
        } finally {
            setLoading(false);
        }
    }, [customerId]);

    useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

    async function handleMarkDelivered(id: string) {
        try {
            await fetch(`/api/internal/deliveries/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'delivered' }),
            });
            fetchDeliveries();
        } catch { /* ignore */ }
    }

    const hasActiveDelivery = deliveries.some((d) => !['delivered', 'cancelled'].includes(d.status));
    const buttonEnabled = canCreateDelivery && !hasActiveDelivery;
    const buttonTooltip = !canCreateDelivery
        ? 'Disponível após conclusão da fabricação'
        : hasActiveDelivery
            ? 'Entrega já em andamento'
            : 'Criar nova entrega';

    return (
        <>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: '#F0EDE8', fontWeight: 600, margin: 0 }}>
                    Entregas
                </h2>
                <button
                    type="button"
                    title={buttonTooltip}
                    disabled={!buttonEnabled}
                    onClick={() => setShowModal(true)}
                    style={{
                        height: '32px', padding: '0 14px',
                        background: buttonEnabled ? 'rgba(45,212,191,0.10)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${buttonEnabled ? 'rgba(45,212,191,0.25)' : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: '7px',
                        color: buttonEnabled ? '#2DD4BF' : '#7A7774',
                        fontSize: '12px', fontWeight: 600,
                        cursor: buttonEnabled ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                >
                    <Truck size={13} /> + Nova Entrega
                </button>
            </div>

            {/* Aviso se botão desabilitado */}
            {!canCreateDelivery && (
                <div style={{ marginBottom: '14px', padding: '8px 12px', background: 'rgba(240,160,64,0.07)', border: '1px solid rgba(240,160,64,0.18)', borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#F0A040' }}>
                    <AlertCircle size={13} />
                    Despacho disponível após a conclusão da fabricação (status OS → Entrega).
                </div>
            )}

            {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}><Skeleton /><Skeleton /></div>}

            {!loading && error && (
                <div style={{ background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                    <p style={{ color: '#E05252', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
                    <button type="button" onClick={fetchDeliveries} style={{ height: '30px', padding: '0 14px', background: 'transparent', border: '1px solid rgba(224,82,82,0.25)', borderRadius: '6px', color: '#E05252', fontSize: '12px', cursor: 'pointer' }}>Tentar novamente</button>
                </div>
            )}

            {!loading && !error && deliveries.length === 0 && (
                <div style={{ border: '2px dashed rgba(255,255,255,0.08)', borderRadius: '10px', padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <Package size={22} color="#2DD4BF" />
                    </div>
                    <p style={{ color: '#C8C4BE', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Nenhuma entrega registrada</p>
                    <p style={{ color: '#7A7774', fontSize: '12px' }}>As entregas programadas aparecerão aqui com rastreio em tempo real.</p>
                </div>
            )}

            {!loading && !error && deliveries.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {deliveries.map((d) => (
                        <DeliveryCard key={d.id} delivery={d} onMarkDelivered={handleMarkDelivered} />
                    ))}
                </div>
            )}

            {showModal && (
                <NovaEntregaModal
                    customerId={customerId}
                    customer={customer}
                    onClose={() => setShowModal(false)}
                    onCreated={() => { setShowModal(false); fetchDeliveries(); }}
                />
            )}
        </>
    );
}
