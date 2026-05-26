'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/system/ToastProvider';
import type { OrderRecord } from '@/lib/api';
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

interface OrderStats {
    active: number;
    awaiting_payment: number;
    in_production: number;
    paused: number;
    open_value_cents: number;
}

interface PedidosClientProps {
    initialOrders: OrderRecord[];
    initialStats: OrderStats;
    canCommercial: boolean;
}

export default function PedidosClient({ initialOrders, initialStats, canCommercial }: PedidosClientProps) {
    const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
    const [stats, setStats] = useState<OrderStats>(initialStats);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'' | OrderStatus>('');
    const [typeFilter, setTypeFilter] = useState<'' | OrderType>('');
    const [pausedFilter, setPausedFilter] = useState<'' | '1' | '0'>('');
    const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
    const [loading, setLoading] = useState(false);
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

    const refreshAll = useCallback(async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams({ limit: '100' });
            if (statusFilter) qs.set('status', statusFilter);
            if (typeFilter) qs.set('type', typeFilter);
            if (pausedFilter) qs.set('paused', pausedFilter);
            if (search.trim()) qs.set('q', search.trim());

            const [ordersRes, statsRes] = await Promise.all([
                fetch(`/api/internal/orders?${qs}`, { cache: 'no-store' }),
                fetch('/api/internal/orders/stats', { cache: 'no-store' }),
            ]);
            if (ordersRes.ok) {
                const d = await ordersRes.json();
                setOrders(d.data ?? []);
            }
            if (statsRes.ok) {
                const d = await statsRes.json();
                setStats(d);
            }
            if (selectedOrder) {
                const fresh = await fetchOrderDetail(selectedOrder.id);
                if (fresh) setSelectedOrder(fresh);
            }
        } finally { setLoading(false); }
    }, [statusFilter, typeFilter, pausedFilter, search, selectedOrder, fetchOrderDetail]);

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { void refreshAll(); }, 250);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, typeFilter, pausedFilter, search]);

    const handleSelectOrder = async (order: OrderRecord) => {
        const fresh = await fetchOrderDetail(order.id);
        setSelectedOrder(fresh ?? order);
    };

    const handleExport = async () => {
        try {
            const res = await fetch('/api/internal/orders/export', { cache: 'no-store' });
            if (!res.ok) { toast.push('error', 'Falha ao exportar CSV'); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.push('success', 'CSV exportado');
        } catch { toast.push('error', 'Erro ao exportar'); }
    };

    const kpis = useMemo(() => ([
        { label: 'Pedidos ativos', value: String(stats.active), sub: 'Em andamento (não pausados)', color: '#4CAF82' },
        { label: 'Aguardando pagamento', value: String(stats.awaiting_payment), sub: 'Pedidos não pagos', color: '#F0A040' },
        { label: 'Em produção', value: String(stats.in_production), sub: 'Produção + Controle de qualidade', color: '#4A9EFF' },
        { label: 'Valor em aberto', value: fmtCurrency(stats.open_value_cents), sub: 'Todos pedidos não finalizados', color: '#C8A97A' },
    ]), [stats]);

    return (
        <div style={{ background: '#0A0A0B', color: '#EDE8E0', minHeight: '100%', fontFamily: 'Inter, sans-serif' }}>
            {/* KPI Row */}
            <div className="grid grid-cols-4 gap-3 p-6 pb-4">
                {kpis.map((k) => (
                    <div key={k.label} className="relative rounded-[10px] overflow-hidden" style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px' }}>
                        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: k.color }} />
                        <div className="text-[10px] font-semibold uppercase tracking-[0.6px] mb-1.5" style={{ color: '#4A4A52' }}>{k.label}</div>
                        <div className="text-[22px] font-bold" style={{ fontFamily: 'Playfair Display, serif', color: k.color }}>{k.value}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: '#4A4A52' }}>{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 px-6 pb-4">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none" style={{ color: '#4A4A52' }}>🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por número ou cliente..."
                            className="h-9 pl-8 pr-3 rounded-lg text-[13px] outline-none transition-colors placeholder:text-[#4A4A52]"
                            style={{ width: 240, background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', color: '#EDE8E0' }}
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
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleExport} className={btnGhost}>↑ Exportar CSV</button>
                </div>
            </div>

            {/* Table */}
            <div className="px-6 pb-6">
                <div className="flex flex-col rounded-xl overflow-hidden" style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr style={{ background: '#18181C', borderBottom: '1px solid rgba(255,255,255,0.11)' }}>
                                    {['Pedido', 'Cliente', 'Tipo', 'Etapa', 'Responsável', 'Valor', 'Criado em'].map((col) => (
                                        <th key={col} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.6px] whitespace-nowrap" style={{ color: '#4A4A52' }}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {orders.length === 0 && !loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-12 text-center text-xs text-[#4A4A52]">
                                            Nenhum pedido encontrado.{' '}
                                            {(statusFilter || typeFilter || pausedFilter || search)
                                                ? 'Ajuste os filtros acima.'
                                                : 'Pedidos novos são criados na ficha do cliente, aba Atendimento.'}
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
                                                <td className="px-3 py-3 text-xs">
                                                    <div className="text-[#EDE8E0] truncate max-w-[200px]">{o.customer.name}</div>
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
                                                <td className="px-3 py-3 text-xs whitespace-nowrap text-[#888480]">{o.assigned_to.name}</td>
                                                <td className="px-3 py-3 text-xs whitespace-nowrap text-[#EDE8E0] font-medium">{fmtCurrency(o.final_amount_cents)}</td>
                                                <td className="px-3 py-3 text-xs whitespace-nowrap text-[#888480]">{fmtShortDate(o.created_at)}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-2 text-[11px] text-[#4A4A52] border-t border-white/[0.05]">
                        {loading ? 'Carregando…' : `Exibindo ${orders.length} pedido(s)`}
                    </div>
                </div>
            </div>

            {selectedOrder && (
                <OrderDrawer
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onChanged={() => { void refreshAll(); router.refresh(); }}
                    canCommercial={canCommercial}
                />
            )}
        </div>
    );
}
