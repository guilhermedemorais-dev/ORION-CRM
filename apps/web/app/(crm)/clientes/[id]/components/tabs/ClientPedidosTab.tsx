'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/system/ToastProvider';
import {
    OrderDrawer,
    STAGE_LABEL,
    StageBar,
    btnGhost,
    fmtCurrency,
    fmtShortDate,
    statusColor,
    type OrderStatus,
    type OrderType,
} from '@/components/modules/pedidos/shared';
import type { OrderRecord } from '@/lib/api';

interface Props {
    customerId: string;
    canCommercial?: boolean;
}

export default function ClientPedidosTab({ customerId, canCommercial = true }: Props) {
    const [orders, setOrders] = useState<OrderRecord[]>([]);
    const [statusFilter, setStatusFilter] = useState<'' | OrderStatus>('');
    const [typeFilter, setTypeFilter] = useState<'' | OrderType>('');
    const [pausedFilter, setPausedFilter] = useState<'' | '1' | '0'>('');
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const toast = useToast();
    const searchTimer = useRef<ReturnType<typeof setTimeout>>();

    const fetchOrderDetail = useCallback(async (id: string): Promise<OrderRecord | null> => {
        try {
            const res = await fetch(`/api/internal/orders/${id}`, { cache: 'no-store' });
            if (!res.ok) return null;
            return (await res.json()) as OrderRecord;
        } catch { return null; }
    }, []);

    const refreshList = useCallback(async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams({ customer_id: customerId, limit: '100' });
            if (statusFilter) qs.set('status', statusFilter);
            if (typeFilter) qs.set('type', typeFilter);
            if (pausedFilter) qs.set('paused', pausedFilter);
            if (search.trim()) qs.set('q', search.trim());

            const res = await fetch(`/api/internal/orders?${qs}`, { cache: 'no-store' });
            if (res.ok) {
                const d = await res.json();
                setOrders(d.data ?? []);
            }
            if (selectedOrder) {
                const fresh = await fetchOrderDetail(selectedOrder.id);
                if (fresh) setSelectedOrder(fresh);
            }
        } finally { setLoading(false); }
    }, [customerId, statusFilter, typeFilter, pausedFilter, search, selectedOrder, fetchOrderDetail]);

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { void refreshList(); }, 250);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId, statusFilter, typeFilter, pausedFilter, search]);

    const handleSelectOrder = async (order: OrderRecord) => {
        const fresh = await fetchOrderDetail(order.id);
        setSelectedOrder(fresh ?? order);
    };

    const handleExport = async () => {
        try {
            const qs = new URLSearchParams({ customer_id: customerId, limit: '500' });
            const res = await fetch(`/api/internal/orders?${qs}`, { cache: 'no-store' });
            if (!res.ok) { toast.push('error', 'Falha ao exportar'); return; }
            const data = await res.json();
            const rows: OrderRecord[] = data.data ?? [];
            if (rows.length === 0) { toast.push('warning', 'Sem pedidos para exportar'); return; }

            const escape = (v: string | number | null | undefined) => {
                const s = v === null || v === undefined ? '' : String(v);
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            };
            const header = 'Pedido,Tipo,Status,Valor,Pausado em,Cancelado em,Criado em';
            const lines = rows.map((o) => [
                escape(o.order_number),
                escape(o.type),
                escape(o.status),
                escape(fmtCurrency(o.final_amount_cents)),
                escape(o.paused_at ?? ''),
                escape(o.cancelled_at ?? ''),
                escape(o.created_at),
            ].join(','));
            const csv = [header, ...lines].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pedidos-cliente-${customerId}-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.push('success', 'CSV exportado');
        } catch { toast.push('error', 'Erro ao exportar'); }
    };

    const ctrlStyle: React.CSSProperties = {
        height: '35px',
        background: '#1A1A1E',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '7px',
        padding: '0 11px',
        fontSize: '12px',
        color: '#F0EDE8',
        fontFamily: "'DM Sans', sans-serif",
        outline: 'none',
        boxSizing: 'border-box',
    };

    return (
        <div style={{ color: '#F0EDE8', fontFamily: "'DM Sans', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#7A7774', marginBottom: '4px' }}>Pedidos</div>
                    <div style={{ fontSize: '11px', color: '#7A7774' }}>{orders.length} pedido(s) deste cliente</div>
                </div>
                <button
                    onClick={handleExport}
                    style={{
                        height: '32px',
                        padding: '0 14px',
                        background: 'rgba(200,169,122,0.10)',
                        border: '1px solid rgba(200,169,122,0.25)',
                        borderRadius: '7px',
                        color: '#C8A97A',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    ↑ Exportar CSV
                </button>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#7A7774', pointerEvents: 'none' }}>🔍</span>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por número..."
                        style={{ ...ctrlStyle, width: 200, padding: '0 11px 0 30px' }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
                    style={{ ...ctrlStyle, cursor: 'pointer' }}
                >
                    <option value="">Todas as etapas</option>
                    {(Object.keys(STAGE_LABEL) as OrderStatus[]).map((s) => (
                        <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                    ))}
                </select>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as OrderType | '')}
                    style={{ ...ctrlStyle, cursor: 'pointer' }}
                >
                    <option value="">Todos os tipos</option>
                    <option value="PRONTA_ENTREGA">Pronta entrega</option>
                    <option value="PERSONALIZADO">Personalizado</option>
                </select>
                <select
                    value={pausedFilter}
                    onChange={(e) => setPausedFilter(e.target.value as '' | '1' | '0')}
                    style={{ ...ctrlStyle, cursor: 'pointer' }}
                >
                    <option value="">Pausados e ativos</option>
                    <option value="1">Só pausados</option>
                    <option value="0">Só ativos</option>
                </select>
            </div>

            {/* Table */}
            <div style={{ background: '#141417', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                            <tr style={{ background: '#1A1A1E', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                                {['Pedido', 'Tipo', 'Etapa', 'Valor', 'Criado em'].map((col) => (
                                    <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#7A7774', whiteSpace: 'nowrap' }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        {Array.from({ length: 5 }).map((__, j) => (
                                            <td key={j} style={{ padding: '14px' }}>
                                                <div style={{ height: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '48px 14px', textAlign: 'center', fontSize: '12px', color: '#7A7774' }}>
                                        Nenhum pedido encontrado para este cliente.{' '}
                                        {(statusFilter || typeFilter || pausedFilter || search) && 'Ajuste os filtros acima.'}
                                    </td>
                                </tr>
                            ) : (
                                orders.map((o) => {
                                    const paused = Boolean(o.paused_at);
                                    const sc = statusColor(o.status, paused);
                                    return (
                                        <tr
                                            key={o.id}
                                            onClick={() => handleSelectOrder(o)}
                                            style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            <td style={{ padding: '14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                <div style={{ fontWeight: 600, color: '#F0EDE8' }}>{o.order_number}</div>
                                            </td>
                                            <td style={{ padding: '14px', fontSize: '12px', whiteSpace: 'nowrap', color: '#7A7774' }}>
                                                {o.type === 'PRONTA_ENTREGA' ? 'PE' : 'Person.'}
                                            </td>
                                            <td style={{ padding: '14px', minWidth: '200px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: sc.dot }} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <StageBar status={o.status} paused={paused} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '14px', fontSize: '12px', whiteSpace: 'nowrap', color: '#F0EDE8', fontWeight: 500 }}>{fmtCurrency(o.final_amount_cents)}</td>
                                            <td style={{ padding: '14px', fontSize: '12px', whiteSpace: 'nowrap', color: '#7A7774' }}>{fmtShortDate(o.created_at)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedOrder && (
                <OrderDrawer
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onChanged={() => { void refreshList(); router.refresh(); }}
                    canCommercial={canCommercial}
                    showCustomer={false}
                />
            )}
        </div>
    );
}
