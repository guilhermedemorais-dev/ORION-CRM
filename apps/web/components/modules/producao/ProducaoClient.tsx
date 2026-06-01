'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/system/ToastProvider';
import type { ProductionOrderRecord } from '@/lib/api';

// ─── Constantes / labels ──────────────────────────────────────────────────────

const PRODUCTION_STEPS = ['SOLDA', 'MODELAGEM', 'CRAVACAO', 'POLIMENTO', 'CONTROLE_QUALIDADE', 'CONCLUIDO'] as const;
type ProductionStep = typeof PRODUCTION_STEPS[number];

const STEP_LABEL: Record<string, string> = {
    SOLDA: 'Solda',
    MODELAGEM: 'Modelagem',
    CRAVACAO: 'Cravação',
    POLIMENTO: 'Polimento',
    CONTROLE_QUALIDADE: 'Controle de qualidade',
    CONCLUIDO: 'Concluído',
};

const STATUS_LABEL: Record<string, string> = {
    PENDENTE: 'Pendente',
    EM_ANDAMENTO: 'Em andamento',
    PAUSADA: 'Pausada',
    CONCLUIDA: 'Concluída',
    REPROVADA: 'Reprovada',
};

interface Ourives { id: string; name: string }

interface ProducaoClientProps {
    initialOrders: ProductionOrderRecord[];
    ourives: Ourives[];
    canManage: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(value: string | null): string {
    if (!value) return '—';
    try { return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
}

function fmtWeight(grams: number | null): string {
    if (grams === null || grams === undefined) return '—';
    return `${grams.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} g`;
}

interface EffStatus { label: string; color: string; dot: string }
function effectiveStatus(o: ProductionOrderRecord): EffStatus {
    if (o.paused_at) return { label: 'Pausada', color: '#F0A040', dot: '#F0A040' };
    if (o.is_overdue) return { label: 'Atrasada', color: '#E05252', dot: '#E05252' };
    if (o.status === 'CONCLUIDA') return { label: 'Concluída', color: '#4CAF82', dot: '#4CAF82' };
    if (o.status === 'REPROVADA') return { label: 'Reprovada', color: '#E05252', dot: '#E05252' };
    if (o.status === 'PENDENTE') return { label: 'Pendente', color: '#888480', dot: '#888480' };
    return { label: STATUS_LABEL[o.status] ?? o.status, color: '#4A9EFF', dot: '#4A9EFF' };
}

const btnGhost = 'h-9 px-3 rounded-lg text-[12px] font-medium cursor-pointer transition-colors';

// ─── Stones renderer ──────────────────────────────────────────────────────────

function describeStones(stones: unknown): string {
    if (!stones) return '—';
    if (Array.isArray(stones)) {
        if (stones.length === 0) return '—';
        return stones
            .map((s) => {
                if (s && typeof s === 'object') {
                    const o = s as Record<string, unknown>;
                    const tipo = o['tipo'] ?? o['type'] ?? o['nome'] ?? 'Pedra';
                    const qtd = o['qtd'] ?? o['quantidade'] ?? o['quantity'];
                    return qtd ? `${String(tipo)} (${String(qtd)})` : String(tipo);
                }
                return String(s);
            })
            .join(', ');
    }
    if (typeof stones === 'object') return JSON.stringify(stones);
    return String(stones);
}

// ─── Production Drawer ─────────────────────────────────────────────────────────

function ProductionDrawer({
    order,
    ourives,
    canManage,
    onClose,
    onChanged,
}: {
    order: ProductionOrderRecord;
    ourives: Ourives[];
    canManage: boolean;
    onClose: () => void;
    onChanged: (fresh: ProductionOrderRecord) => void;
}) {
    const toast = useToast();
    const [tab, setTab] = useState<'specs' | 'etapas'>('specs');
    const [busy, setBusy] = useState(false);
    const [notes, setNotes] = useState('');
    const [decision, setDecision] = useState<'advance' | 'reject'>('advance');
    const [rejectionReason, setRejectionReason] = useState('');

    const eff = effectiveStatus(order);
    const paused = Boolean(order.paused_at);
    const isDone = order.status === 'CONCLUIDA' || order.current_step === 'CONCLUIDO';

    async function call(path: string, method: string, body?: unknown): Promise<void> {
        setBusy(true);
        try {
            const res = await fetch(`/api/internal/production-orders/${order.id}${path}`, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.push('error', data?.message ?? 'Falha na operação.');
                return;
            }
            toast.push('success', 'Atualizado.');
            onChanged(data as ProductionOrderRecord);
        } catch {
            toast.push('error', 'Erro de rede.');
        } finally {
            setBusy(false);
        }
    }

    function handleAdvance() {
        if (decision === 'reject' && rejectionReason.trim().length < 5) {
            toast.push('error', 'Informe o motivo da reprovação (mín. 5 caracteres).');
            return;
        }
        void call('/advance', 'POST', {
            notes: notes.trim() || undefined,
            approved: decision === 'advance',
            rejection_reason: decision === 'reject' ? rejectionReason.trim() : undefined,
        }).then(() => { setNotes(''); setRejectionReason(''); setDecision('advance'); });
    }

    function handlePause() {
        const reason = window.prompt('Motivo da pausa:');
        if (reason === null) return;
        if (reason.trim().length < 3) { toast.push('error', 'Motivo muito curto.'); return; }
        void call('/pause', 'POST', { reason: reason.trim() });
    }

    const inputStyle: React.CSSProperties = {
        background: '#0F0F11', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8,
        color: '#EDE8E0', fontSize: 13, padding: '8px 10px', width: '100%', outline: 'none',
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
            <div
                className="h-full w-full max-w-[460px] flex flex-col"
                style={{ background: '#111113', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="min-w-0">
                        <div className="text-[15px] font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#EDE8E0' }}>
                            {order.order.order_number}
                        </div>
                        <div className="text-[12px] mt-0.5 truncate" style={{ color: '#888480' }}>{order.order.customer_name}</div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: `${eff.color}1A`, color: eff.color, border: `1px solid ${eff.color}40` }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: eff.dot }} /> {eff.label}
                            </span>
                            <span className="text-[11px]" style={{ color: '#888480' }}>Etapa: {STEP_LABEL[order.current_step] ?? order.current_step}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[#888480] hover:text-[#EDE8E0] text-xl leading-none px-1">×</button>
                </div>

                {/* Progresso */}
                <div className="px-5 pt-4">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${order.progress_percent}%`, background: paused ? '#F0A040' : '#C8A97A' }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px]" style={{ color: '#888480' }}>
                        <span>{order.progress_percent}% concluído</span>
                        <span>Prazo: {fmtDate(order.deadline)}</span>
                    </div>
                    {paused && order.paused_reason && (
                        <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: 'rgba(240,160,64,0.10)', border: '1px solid rgba(240,160,64,0.25)', color: '#F0A040' }}>
                            ⏸ Pausada — {order.paused_reason}{order.paused_by ? ` · ${order.paused_by.name}` : ''}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-5 pt-4">
                    {(['specs', 'etapas'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                            style={tab === t
                                ? { background: '#1A1A1E', color: '#EDE8E0', border: '1px solid rgba(255,255,255,0.10)' }
                                : { background: 'transparent', color: '#888480', border: '1px solid transparent' }}
                        >
                            {t === 'specs' ? 'Especificações' : 'Etapas'}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {tab === 'specs' ? (
                        <div className="space-y-3">
                            {order.specs ? (
                                <>
                                    <SpecRow label="Descrição do design" value={order.specs.design_description ?? '—'} />
                                    <SpecRow label="Metal" value={order.specs.metal_type ?? '—'} />
                                    <SpecRow label="Peso do metal" value={fmtWeight(order.specs.metal_weight_grams)} />
                                    <SpecRow label="Pedras" value={describeStones(order.specs.stones)} />
                                    {order.specs.design_images?.length ? (
                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.6px] mb-1.5" style={{ color: '#4A4A52' }}>Imagens do design</div>
                                            <div className="flex flex-wrap gap-2">
                                                {order.specs.design_images.map((src, i) => (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img key={i} src={src} alt={`design ${i + 1}`} className="w-16 h-16 rounded-lg object-cover" style={{ border: '1px solid rgba(255,255,255,0.10)' }} />
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </>
                            ) : (
                                <p className="text-[13px]" style={{ color: '#888480' }}>Sem especificações cadastradas para este pedido.</p>
                            )}
                            {order.notes && <SpecRow label="Observações da produção" value={order.notes} />}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {order.steps?.length ? (
                                order.steps.map((s) => (
                                    <div key={s.id} className="rounded-lg px-3 py-2.5" style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)' }}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[13px] font-medium" style={{ color: '#EDE8E0' }}>{STEP_LABEL[s.step_name] ?? s.step_name}</span>
                                            <span className="text-[11px]" style={{ color: s.approved ? '#4CAF82' : '#E05252' }}>{s.approved ? 'Aprovada' : 'Reprovada'}</span>
                                        </div>
                                        <div className="text-[11px] mt-1" style={{ color: '#888480' }}>{s.completed_by.name} · {fmtDate(s.completed_at)}</div>
                                        {s.notes && <p className="text-[12px] mt-1.5" style={{ color: '#C8C4BE' }}>{s.notes}</p>}
                                        {s.rejection_reason && <p className="text-[12px] mt-1.5" style={{ color: '#E05252' }}>{s.rejection_reason}</p>}
                                    </div>
                                ))
                            ) : (
                                <p className="text-[13px]" style={{ color: '#888480' }}>Nenhuma etapa registrada ainda.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Operações */}
                <div className="px-5 py-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {canManage && (
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] whitespace-nowrap" style={{ color: '#888480' }}>Ourives:</span>
                            <select
                                value={order.assigned_to?.id ?? ''}
                                disabled={busy}
                                onChange={(e) => void call('/assign', 'PATCH', { assigned_to: e.target.value || null })}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                                <option value="">Sem responsável</option>
                                {ourives.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    )}

                    {!isDone && !paused && (
                        <div className="space-y-2">
                            <select value={decision} disabled={busy} onChange={(e) => setDecision(e.target.value as 'advance' | 'reject')} style={{ ...inputStyle, cursor: 'pointer' }}>
                                <option value="advance">Avançar etapa</option>
                                <option value="reject">Reprovar e voltar etapa</option>
                            </select>
                            <textarea value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observações da bancada (opcional)" style={inputStyle} />
                            {decision === 'reject' && (
                                <textarea value={rejectionReason} disabled={busy} onChange={(e) => setRejectionReason(e.target.value)} rows={2} placeholder="Motivo da reprovação" style={inputStyle} />
                            )}
                            <button onClick={handleAdvance} disabled={busy} className={btnGhost} style={{ width: '100%', background: 'rgba(200,169,122,0.15)', border: '1px solid rgba(200,169,122,0.30)', color: '#C8A97A' }}>
                                {busy ? 'Processando…' : 'Registrar etapa'}
                            </button>
                        </div>
                    )}

                    {!isDone && (
                        paused ? (
                            <button onClick={() => void call('/resume', 'POST')} disabled={busy} className={btnGhost} style={{ width: '100%', background: 'rgba(76,175,130,0.12)', border: '1px solid rgba(76,175,130,0.30)', color: '#4CAF82' }}>
                                ▶ Retomar produção
                            </button>
                        ) : (
                            <button onClick={handlePause} disabled={busy} className={btnGhost} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(240,160,64,0.30)', color: '#F0A040' }}>
                                ⏸ Pausar produção
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

function SpecRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-[0.6px] mb-0.5" style={{ color: '#4A4A52' }}>{label}</div>
            <div className="text-[13px]" style={{ color: '#EDE8E0', whiteSpace: 'pre-wrap' }}>{value}</div>
        </div>
    );
}

// ─── Main client ────────────────────────────────────────────────────────────────

export default function ProducaoClient({ initialOrders, ourives, canManage }: ProducaoClientProps) {
    const [orders, setOrders] = useState<ProductionOrderRecord[]>(initialOrders);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'' | 'EM_ANDAMENTO' | 'ATRASADA' | 'PAUSADA' | 'CONCLUIDA' | 'PENDENTE'>('');
    const [selected, setSelected] = useState<ProductionOrderRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/internal/production-orders?limit=100', { cache: 'no-store' });
            if (res.ok) {
                const d = await res.json();
                setOrders(d.data ?? []);
            }
        } finally { setLoading(false); }
    }, []);

    const handleSelect = useCallback(async (o: ProductionOrderRecord) => {
        try {
            const res = await fetch(`/api/internal/production-orders/${o.id}`, { cache: 'no-store' });
            setSelected(res.ok ? ((await res.json()) as ProductionOrderRecord) : o);
        } catch { setSelected(o); }
    }, []);

    const kpis = useMemo(() => {
        const emAndamento = orders.filter((o) => !o.paused_at && !o.is_overdue && (o.status === 'EM_ANDAMENTO' || o.status === 'PENDENTE')).length;
        const atrasadas = orders.filter((o) => o.is_overdue).length;
        const pausadas = orders.filter((o) => o.paused_at).length;
        const concluidas = orders.filter((o) => o.status === 'CONCLUIDA').length;
        return [
            { label: 'Em andamento', value: String(emAndamento), sub: 'Na bancada (não pausadas)', color: '#4A9EFF' },
            { label: 'Atrasadas', value: String(atrasadas), sub: 'Prazo estourado', color: '#E05252' },
            { label: 'Pausadas', value: String(pausadas), sub: 'Aguardando retomada', color: '#F0A040' },
            { label: 'Concluídas', value: String(concluidas), sub: 'Produção finalizada', color: '#4CAF82' },
        ];
    }, [orders]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return orders.filter((o) => {
            if (q && !o.order.order_number.toLowerCase().includes(q) && !o.order.customer_name.toLowerCase().includes(q)) return false;
            if (statusFilter === 'ATRASADA') return o.is_overdue;
            if (statusFilter === 'PAUSADA') return Boolean(o.paused_at);
            if (statusFilter === 'EM_ANDAMENTO') return !o.paused_at && o.status === 'EM_ANDAMENTO';
            if (statusFilter === 'PENDENTE') return o.status === 'PENDENTE';
            if (statusFilter === 'CONCLUIDA') return o.status === 'CONCLUIDA';
            return true;
        });
    }, [orders, search, statusFilter]);

    const onChanged = (fresh: ProductionOrderRecord) => {
        setSelected(fresh);
        void refresh();
        router.refresh();
    };

    return (
        <div className="-m-6" style={{ background: '#0A0A0B', color: '#EDE8E0', minHeight: 'calc(100% + 48px)', fontFamily: 'Inter, sans-serif' }}>
            {/* KPIs */}
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
            <div className="flex items-center gap-2 px-6 pb-4 flex-wrap">
                <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none" style={{ color: '#4A4A52' }}>🔍</span>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por número ou cliente..."
                        className="h-9 pl-8 pr-3 rounded-lg text-[13px] outline-none placeholder:text-[#4A4A52]"
                        style={{ width: 240, background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', color: '#EDE8E0' }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="h-9 px-3 rounded-lg text-[12px] outline-none cursor-pointer"
                    style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)', color: '#888480' }}
                >
                    <option value="">Todos os status</option>
                    <option value="EM_ANDAMENTO">Em andamento</option>
                    <option value="ATRASADA">Atrasadas</option>
                    <option value="PAUSADA">Pausadas</option>
                    <option value="PENDENTE">Pendentes</option>
                    <option value="CONCLUIDA">Concluídas</option>
                </select>
            </div>

            {/* Tabela */}
            <div className="px-6 pb-6">
                <div className="flex flex-col rounded-xl overflow-hidden" style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr style={{ background: '#18181C', borderBottom: '1px solid rgba(255,255,255,0.11)' }}>
                                    {['Pedido', 'Cliente', 'Etapa', 'Progresso', 'Ourives', 'Prazo', 'Status'].map((col) => (
                                        <th key={col} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.6px] whitespace-nowrap" style={{ color: '#4A4A52' }}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && !loading ? (
                                    <tr><td colSpan={7} className="px-3 py-12 text-center text-xs text-[#4A4A52]">
                                        Nenhuma ordem de produção encontrada.{(search || statusFilter) ? ' Ajuste os filtros.' : ''}
                                    </td></tr>
                                ) : (
                                    filtered.map((o) => {
                                        const eff = effectiveStatus(o);
                                        return (
                                            <tr key={o.id} onClick={() => handleSelect(o)} className="cursor-pointer transition-colors hover:bg-white/[0.02] border-b border-white/[0.04]">
                                                <td className="px-3 py-3 text-xs whitespace-nowrap"><span className="font-semibold text-[#EDE8E0]">{o.order.order_number}</span></td>
                                                <td className="px-3 py-3 text-xs"><span className="text-[#EDE8E0] truncate max-w-[180px] inline-block align-middle">{o.order.customer_name}</span></td>
                                                <td className="px-3 py-3 text-xs whitespace-nowrap text-[#888480]">{STEP_LABEL[o.current_step] ?? o.current_step}</td>
                                                <td className="px-3 py-3 min-w-[140px]">
                                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                                        <div className="h-full rounded-full" style={{ width: `${o.progress_percent}%`, background: o.paused_at ? '#F0A040' : o.is_overdue ? '#E05252' : '#C8A97A' }} />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-xs whitespace-nowrap text-[#888480]">{o.assigned_to?.name ?? 'Sem ourives'}</td>
                                                <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: o.is_overdue ? '#E05252' : '#888480' }}>{fmtDate(o.deadline)}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: eff.color }}>
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: eff.dot }} />{eff.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-2 text-[11px] text-[#4A4A52] border-t border-white/[0.05]">
                        {loading ? 'Carregando…' : `Exibindo ${filtered.length} ordem(ns) de produção`}
                    </div>
                </div>
            </div>

            {selected && (
                <ProductionDrawer
                    order={selected}
                    ourives={ourives}
                    canManage={canManage}
                    onClose={() => setSelected(null)}
                    onChanged={onChanged}
                />
            )}
        </div>
    );
}
