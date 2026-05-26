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

    return (
        <div style={{ background: '#0A0A0B', color: '#EDE8E0', minHeight: '100%', fontFamily: 'Inter, sans-serif' }}>
            {/* Header da aba */}
            <div className="flex items-end justify-between gap-3 px-2 pt-1 pb-4">
                <div>
                    <h2 className="text-base font-semibold text-[#EDE8E0]" style={{ fontFamily: 'Playfair Display, serif' }}>Pedidos</h2>
                    <p className="text-[11px] text-[#7A7774] mt-0.5">{orders.length} pedido(s) deste cliente</p>
                </div>
                <button onClick={handleExport} className={btnGhost}>↑ Exportar CSV</button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-2 pb-4 flex-wrap">
                <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none" style={{ color: '#4A4A52' }}>🔍</span>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por número..."
                        className="h-9 pl-8 pr-3 rounded-lg text-[13px] outline-none transition-colors placeholder:text-[#4A4A52]"
                        style={{ width: 220, background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', color: '#EDE8E0' }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
                    className="h-9 px-3 rounded-lg text-[12px] outline-none cursor-pointer"
                    style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', color: '#888480' }}
                >
                    <option value="">Todas as etapas</option>
                    {(Object.keys(STAGE_LABEL) as OrderStatus[]).map((s) => (
                        <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                    ))}
                </select>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as OrderType | '')}
                    className="h-9 px-3 rounded-lg text-[12px] outline-none cursor-pointer"
                    style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', color: '#888480' }}
                >
                    <option value="">Todos os tipos</option>
                    <option value="PRONTA_ENTREGA">Pronta entrega</option>
                    <option value="PERSONALIZADO">Personalizado</option>
                </select>
                <select
                    value={pausedFilter}
                    onChange={(e) => setPausedFilter(e.target.value as '' | '1' | '0')}
                    className="h-9 px-3 rounded-lg text-[12px] outline-none cursor-pointer"
                    style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', color: '#888480' }}
                >
                    <option value="">Pausados e ativos</option>
                    <option value="1">Só pausados</option>
                    <option value="0">Só ativos</option>
                </select>
            </div>

            {/* Table */}
            <div className="px-2 pb-2">
                <div className="flex flex-col rounded-xl overflow-hidden" style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr style={{ background: '#18181C', borderBottom: '1px solid rgba(255,255,255,0.11)' }}>
                                    {['Pedido', 'Tipo', 'Etapa', 'Valor', 'Criado em'].map((col) => (
                                        <th key={col} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.6px] whitespace-nowrap" style={{ color: '#4A4A52' }}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <tr key={i} className="border-b border-white/[0.04]">
                                            {Array.from({ length: 5 }).map((__, j) => (
                                                <td key={j} className="px-3 py-3">
                                                    <div className="h-3 bg-white/[0.04] rounded animate-pulse" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-12 text-center text-xs text-[#4A4A52]">
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
                                                className="cursor-pointer transition-colors hover:bg-white/[0.02] border-b border-white/[0.04]"
                                            >
                                                <td className="px-3 py-3 text-xs whitespace-nowrap">
                                                    <div className="font-semibold text-[#EDE8E0]">{o.order_number}</div>
                                                </td>
                                                <td className="px-3 py-3 text-xs whitespace-nowrap">
                                                    <span className="text-[#888480]">{o.type === 'PRONTA_ENTREGA' ? 'PE' : 'Person.'}</span>
                                                </td>
                                                <td className="px-3 py-3 min-w-[200px]">
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                                                        <div className="flex-1 min-w-0">
                                                            <StageBar status={o.status} paused={paused} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-xs whitespace-nowrap text-[#EDE8E0] font-medium">{fmtCurrency(o.final_amount_cents)}</td>
                                                <td className="px-3 py-3 text-xs whitespace-nowrap text-[#888480]">{fmtShortDate(o.created_at)}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
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
