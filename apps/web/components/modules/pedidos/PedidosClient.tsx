'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    createMercadoPagoPaymentLinkAction,
    requestOrderNfeAction,
    sendOrderReceiptAction,
    updateOrderStatusAction,
} from '@/app/(crm)/pedidos/actions';
import { useConfirm } from '@/components/system/ConfirmDialog';
import { useToast } from '@/components/system/ToastProvider';
import type { OrderRecord } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = OrderRecord['status'];
type OrderType = OrderRecord['type'];

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

// ─── Format helpers ───────────────────────────────────────────────────────────

const fmtCurrency = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const fmtDateTime = (d: string | null | undefined) =>
    d
        ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
        : '—';

const fmtShortDate = (d: string | null | undefined) =>
    d ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(d)) : '—';

// ─── Stage / progress mapping ─────────────────────────────────────────────────
// 6 etapas universais que o usuário aprovou.
// (CANCELADO é estado terminal à parte; PAUSADO é sobreposição visual)
const STAGE_ORDER: OrderStatus[] = [
    'RASCUNHO',
    'AGUARDANDO_PAGAMENTO',
    'PAGO',
    'EM_PRODUCAO',
    'CONTROLE_QUALIDADE',
    'RETIRADO',
];

const STAGE_LABEL: Record<OrderStatus, string> = {
    RASCUNHO: 'Rascunho',
    AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
    PAGO: 'Pago',
    SEPARANDO: 'Separando',
    ENVIADO: 'Enviado',
    RETIRADO: 'Pronto / Retirado',
    CANCELADO: 'Cancelado',
    AGUARDANDO_APROVACAO_DESIGN: 'Aguardando aprovação',
    APROVADO: 'Aprovado',
    EM_PRODUCAO: 'Em produção',
    CONTROLE_QUALIDADE: 'Controle de qualidade',
};

function stageProgress(status: OrderStatus): number {
    if (status === 'CANCELADO') return 0;
    const fallbackByStatus: Partial<Record<OrderStatus, number>> = {
        AGUARDANDO_APROVACAO_DESIGN: 1,
        APROVADO: 2,
        SEPARANDO: 3,
        ENVIADO: 5,
    };
    if (fallbackByStatus[status] !== undefined) return fallbackByStatus[status]!;
    const idx = STAGE_ORDER.indexOf(status);
    return idx >= 0 ? idx : 0;
}

function progressPercent(status: OrderStatus): number {
    if (status === 'CANCELADO') return 0;
    const total = STAGE_ORDER.length - 1;
    return Math.min(100, Math.round((stageProgress(status) / total) * 100));
}

function statusColor(status: OrderStatus, paused: boolean): { dot: string; bg: string; text: string } {
    if (paused) return { dot: '#F0A040', bg: 'rgba(240,160,64,0.12)', text: '#F0A040' };
    if (status === 'CANCELADO') return { dot: '#E05252', bg: 'rgba(224,82,82,0.12)', text: '#E05252' };
    if (status === 'RETIRADO') return { dot: '#4CAF82', bg: 'rgba(76,175,130,0.12)', text: '#4CAF82' };
    if (status === 'AGUARDANDO_PAGAMENTO') return { dot: '#F0A040', bg: 'rgba(240,160,64,0.10)', text: '#F0A040' };
    if (status === 'EM_PRODUCAO' || status === 'CONTROLE_QUALIDADE') return { dot: '#4A9EFF', bg: 'rgba(74,158,255,0.10)', text: '#4A9EFF' };
    return { dot: '#C8A97A', bg: 'rgba(200,169,122,0.10)', text: '#C8A97A' };
}

// ─── Style tokens (matching Estoque) ──────────────────────────────────────────

const inp = 'w-full bg-[#202026] border border-white/[0.07] rounded-lg px-3 text-sm text-[#EDE8E0] outline-none transition-colors placeholder:text-[#4A4A52] focus:border-[#C8A97A]/40';
const inpH = 'h-[38px]';
const lbl = 'block text-[11px] font-semibold text-[#888480] tracking-wide mb-1';
const btnGold = 'h-9 px-4 rounded-lg bg-[#C8A97A] text-black text-xs font-bold hover:bg-[#E8D5B0] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const btnGhost = 'h-9 px-3 rounded-lg bg-[#18181C] border border-white/[0.07] text-[#888480] text-xs font-semibold hover:border-white/[0.11] hover:text-[#EDE8E0] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50';
const btnDanger = 'h-9 px-3 rounded-lg bg-[#18181C] border border-rose-500/30 text-rose-300 text-xs font-semibold hover:border-rose-500/50 hover:text-rose-200 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50';

// ─── WhatsApp Preview Modal ───────────────────────────────────────────────────

function WhatsAppPreviewModal({
    order,
    onClose,
    onSent,
}: {
    order: OrderRecord;
    onClose: () => void;
    onSent: () => void;
}) {
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [message, setMessage] = useState('');
    const [whatsapp, setWhatsapp] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        let cancelled = false;
        setLoadingPreview(true);
        fetch(`/api/internal/orders/${order.id}/notify-whatsapp/preview`, { cache: 'no-store' })
            .then(async (res) => {
                const d = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (!res.ok) {
                    setError(d.message ?? 'Erro ao carregar prévia.');
                    return;
                }
                setMessage(d.message ?? '');
                setWhatsapp(d.whatsapp_number ?? null);
            })
            .finally(() => { if (!cancelled) setLoadingPreview(false); });
        return () => { cancelled = true; };
    }, [order.id]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const handleSend = async () => {
        if (!message.trim()) { toast.push('warning', 'Mensagem vazia', 'Escreva ou aguarde a prévia carregar.'); return; }
        setSending(true);
        try {
            const res = await fetch(`/api/internal/orders/${order.id}/notify-whatsapp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.push('error', 'Falha ao enviar', d.message ?? 'Tente novamente em instantes.');
                setSending(false);
                return;
            }
            toast.push('success', 'Mensagem enviada', `Cliente notificado via WhatsApp (${d.provider_type ?? 'provedor'}).`);
            onSent();
        } catch {
            toast.push('error', 'Falha de rede', 'Não foi possível enviar.');
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-[#EDE8E0]" style={{ fontFamily: 'Playfair Display, serif' }}>Notificar cliente no WhatsApp</h2>
                    <button onClick={onClose} className="text-[#888480] hover:text-[#EDE8E0] text-xl leading-none">×</button>
                </div>

                {error ? (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>
                ) : (
                    <>
                        <div className="mb-3 text-[11px] text-[#888480]">
                            Para: <span className="text-[#C8A97A] font-medium">{whatsapp ?? '—'}</span> · Pedido <span className="text-[#EDE8E0]">{order.order_number}</span>
                        </div>
                        <label className={lbl}>Mensagem</label>
                        <textarea
                            rows={6}
                            value={loadingPreview ? 'Gerando prévia...' : message}
                            disabled={loadingPreview}
                            onChange={(e) => setMessage(e.target.value)}
                            className={`${inp} py-2 mb-3`}
                        />
                        <p className="text-[10px] text-[#4A4A52] mb-4">A mensagem é enviada pelo provedor WhatsApp marcado como primário em Ajustes &gt; WhatsApp.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={onClose} className={btnGhost} disabled={sending}>Cancelar</button>
                            <button onClick={handleSend} className={btnGold} disabled={loadingPreview || sending || !message.trim()}>
                                {sending ? 'Enviando…' : 'Enviar mensagem'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Reason Prompt Modal (pause / cancel) ─────────────────────────────────────

function ReasonModal({
    title,
    description,
    confirmLabel,
    variant,
    onCancel,
    onConfirm,
}: {
    title: string;
    description: string;
    confirmLabel: string;
    variant: 'warning' | 'danger';
    onCancel: () => void;
    onConfirm: (reason: string) => Promise<void> | void;
}) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onCancel]);

    const handle = async () => {
        if (reason.trim().length < 2) return;
        setBusy(true);
        try { await onConfirm(reason.trim()); } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onCancel}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
                <h2 className="text-base font-semibold text-[#EDE8E0] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>{title}</h2>
                <p className="text-xs text-[#888480] mb-4">{description}</p>
                <label className={lbl}>Motivo</label>
                <textarea autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inp} py-2 mb-4`} placeholder="Explique brevemente o motivo" />
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className={btnGhost} disabled={busy}>Cancelar</button>
                    <button
                        onClick={handle}
                        className={variant === 'danger' ? btnDanger : btnGold}
                        disabled={busy || reason.trim().length < 2}
                    >
                        {busy ? 'Aguarde…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Stage Progress Bar ───────────────────────────────────────────────────────

function StageBar({ status, paused }: { status: OrderStatus; paused: boolean }) {
    const pct = progressPercent(status);
    const cancelled = status === 'CANCELADO';
    const color = cancelled ? '#E05252' : paused ? '#F0A040' : '#C8A97A';
    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-1 text-[10px]">
                <span style={{ color: paused ? '#F0A040' : '#888480' }}>
                    {paused ? '⏸ Pausado' : cancelled ? 'Cancelado' : STAGE_LABEL[status]}
                </span>
                <span className="text-[#4A4A52]">{cancelled ? '—' : `${pct}%`}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-white/[0.05] overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}

// ─── Order Drawer (right side panel) ──────────────────────────────────────────

function OrderDrawer({
    order,
    onClose,
    onChanged,
    canCommercial,
}: {
    order: OrderRecord;
    onClose: () => void;
    onChanged: () => void;
    canCommercial: boolean;
}) {
    const router = useRouter();
    const toast = useToast();
    const confirm = useConfirm();
    const [busy, setBusy] = useState(false);
    const [showWhatsApp, setShowWhatsApp] = useState(false);
    const [showPause, setShowPause] = useState(false);
    const [showCancel, setShowCancel] = useState(false);

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showWhatsApp && !showPause && !showCancel) onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose, showWhatsApp, showPause, showCancel]);

    const paused = Boolean(order.paused_at);
    const finalized = order.status === 'RETIRADO' || order.status === 'CANCELADO';

    const callJson = async (url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> => {
        const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    };

    const handlePause = async (reason: string) => {
        setBusy(true);
        const { ok, data } = await callJson(`/api/internal/orders/${order.id}/pause`, { method: 'POST', body: JSON.stringify({ reason }) });
        setBusy(false);
        setShowPause(false);
        if (!ok) { toast.push('error', 'Falha ao pausar', String(data.message ?? '')); return; }
        toast.push('success', 'Pedido pausado');
        onChanged();
    };

    const handleResume = async () => {
        const ok2 = await confirm({ title: 'Retomar pedido?', description: 'O pedido voltará para a etapa onde estava antes da pausa.', confirmLabel: 'Retomar' });
        if (!ok2) return;
        setBusy(true);
        const { ok, data } = await callJson(`/api/internal/orders/${order.id}/resume`, { method: 'POST' });
        setBusy(false);
        if (!ok) { toast.push('error', 'Falha ao retomar', String(data.message ?? '')); return; }
        toast.push('success', 'Pedido retomado');
        onChanged();
    };

    const handleCancel = async (reason: string) => {
        setBusy(true);
        const { ok, data } = await callJson(`/api/internal/orders/${order.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
        setBusy(false);
        setShowCancel(false);
        if (!ok) { toast.push('error', 'Falha ao cancelar', String(data.message ?? '')); return; }
        toast.push('success', 'Pedido cancelado');
        onChanged();
    };

    const handleAdvanceStage = async () => {
        const currentIdx = STAGE_ORDER.indexOf(order.status);
        const nextIdx = currentIdx + 1;
        if (currentIdx < 0 || nextIdx >= STAGE_ORDER.length) {
            toast.push('warning', 'Sem próxima etapa', 'Este pedido já está no fim do fluxo padrão. Use o seletor abaixo.');
            return;
        }
        const nextStatus = STAGE_ORDER[nextIdx];
        const ok2 = await confirm({ title: 'Avançar etapa?', description: `Mover para "${STAGE_LABEL[nextStatus!]}".`, confirmLabel: 'Avançar' });
        if (!ok2) return;
        const fd = new FormData();
        fd.append('order_id', order.id);
        fd.append('selected', order.id);
        fd.append('status', nextStatus!);
        try { await updateOrderStatusAction(fd); } catch { /* server action redirects */ }
        setTimeout(() => router.refresh(), 600);
    };

    const handleStatusChange = async (newStatus: OrderStatus) => {
        if (newStatus === order.status) return;
        const ok2 = await confirm({ title: 'Mudar status?', description: `Mover para "${STAGE_LABEL[newStatus]}".`, confirmLabel: 'Confirmar' });
        if (!ok2) return;
        const fd = new FormData();
        fd.append('order_id', order.id);
        fd.append('selected', order.id);
        fd.append('status', newStatus);
        try { await updateOrderStatusAction(fd); } catch { /* redirect */ }
        setTimeout(() => router.refresh(), 600);
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <aside
                className="fixed right-0 top-0 z-40 h-screen w-full max-w-[480px] overflow-y-auto border-l border-white/[0.07] bg-[#0A0A0B] text-[#EDE8E0] shadow-[0_0_60px_rgba(0,0,0,0.6)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#0A0A0B]/95 backdrop-blur px-5 py-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.6px] text-[#4A4A52]">Pedido</div>
                        <div className="text-sm font-semibold">{order.order_number}</div>
                    </div>
                    <button onClick={onClose} className="text-[#888480] hover:text-[#EDE8E0] text-2xl leading-none">×</button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Customer + ficha button */}
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.6px] text-[#4A4A52]">Cliente</div>
                            <div className="text-sm font-semibold mt-0.5">{order.customer.name}</div>
                            {order.customer.whatsapp_number && (
                                <div className="text-[11px] text-[#888480] mt-0.5">{order.customer.whatsapp_number}</div>
                            )}
                        </div>
                        <a href={`/clientes/${order.customer.id}`} className={btnGhost} target="_blank" rel="noopener">
                            Abrir ficha →
                        </a>
                    </div>

                    {/* Stage bar */}
                    <div className="rounded-xl border border-white/[0.07] bg-[#111113] p-4">
                        <StageBar status={order.status} paused={paused} />
                        {paused && order.paused_reason && (
                            <div className="mt-3 text-[11px] text-[#F0A040]">Pausado: {order.paused_reason}</div>
                        )}
                        {order.status === 'CANCELADO' && order.cancellation_reason && (
                            <div className="mt-3 text-[11px] text-rose-300">Cancelado: {order.cancellation_reason}</div>
                        )}
                    </div>

                    {/* Quick actions */}
                    <div className="grid grid-cols-2 gap-2">
                        {!finalized && !paused && (
                            <button onClick={handleAdvanceStage} className={btnGold} disabled={busy}>Avançar etapa</button>
                        )}
                        {!finalized && !paused && (
                            <button onClick={() => setShowWhatsApp(true)} className={btnGhost} disabled={busy || !order.customer.whatsapp_number}>
                                Notificar WhatsApp
                            </button>
                        )}
                        {!finalized && !paused && (
                            <button onClick={() => setShowPause(true)} className={btnGhost} disabled={busy}>Pausar</button>
                        )}
                        {paused && (
                            <button onClick={handleResume} className={btnGold} disabled={busy}>Retomar</button>
                        )}
                        {!finalized && (
                            <button onClick={() => setShowCancel(true)} className={btnDanger} disabled={busy}>Cancelar pedido</button>
                        )}
                    </div>

                    {/* Status manual */}
                    <div>
                        <label className={lbl}>Mudar etapa manualmente</label>
                        <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
                            disabled={finalized || busy}
                            className={`${inp} ${inpH}`}
                        >
                            {(Object.keys(STAGE_LABEL) as OrderStatus[]).map((s) => (
                                <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                            ))}
                        </select>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <InfoCell label="Tipo" value={order.type === 'PRONTA_ENTREGA' ? 'Pronta entrega' : 'Personalizado'} />
                        <InfoCell label="Valor" value={fmtCurrency(order.final_amount_cents)} />
                        <InfoCell label="Entrega" value={order.delivery_type === 'RETIRADA' ? 'Retirada' : 'Entrega'} />
                        <InfoCell label="Responsável" value={order.assigned_to.name} />
                        <InfoCell label="Criado em" value={fmtDateTime(order.created_at)} />
                        <InfoCell label="Atualizado" value={fmtDateTime(order.updated_at)} />
                    </div>

                    {order.notes && (
                        <div className="rounded-lg border border-white/[0.07] bg-[#111113] p-3">
                            <div className="text-[10px] uppercase tracking-[0.6px] text-[#4A4A52] mb-1">Observações</div>
                            <div className="text-xs text-[#C8C4BE] whitespace-pre-wrap">{order.notes}</div>
                        </div>
                    )}

                    {/* Items */}
                    {order.order_items && order.order_items.length > 0 && (
                        <div className="rounded-lg border border-white/[0.07] bg-[#111113] p-3">
                            <div className="text-[10px] uppercase tracking-[0.6px] text-[#4A4A52] mb-2">Itens</div>
                            <div className="space-y-1.5">
                                {order.order_items.map((it) => (
                                    <div key={it.id} className="flex items-center justify-between text-xs">
                                        <span className="text-[#C8C4BE]">{it.quantity}x {it.description}</span>
                                        <span className="text-[#EDE8E0]">{fmtCurrency(it.total_price_cents)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Commercial actions */}
                    {canCommercial && !finalized && (
                        <div className="rounded-lg border border-white/[0.07] bg-[#111113] p-3 space-y-2">
                            <div className="text-[10px] uppercase tracking-[0.6px] text-[#4A4A52] mb-1">Ações comerciais</div>
                            {(order.status === 'RASCUNHO' || order.status === 'AGUARDANDO_PAGAMENTO') && (
                                <form action={createMercadoPagoPaymentLinkAction} onSubmit={() => setTimeout(() => router.refresh(), 600)}>
                                    <input type="hidden" name="order_id" value={order.id} />
                                    <input type="hidden" name="selected" value={order.id} />
                                    <button type="submit" className={`${btnGhost} w-full justify-center`}>Gerar link Mercado Pago</button>
                                </form>
                            )}
                            <form action={requestOrderNfeAction} onSubmit={() => setTimeout(() => router.refresh(), 600)}>
                                <input type="hidden" name="order_id" value={order.id} />
                                <input type="hidden" name="selected" value={order.id} />
                                <button type="submit" className={`${btnGhost} w-full justify-center`}>Solicitar NF-e</button>
                            </form>
                            <div className="grid grid-cols-2 gap-2">
                                <form action={sendOrderReceiptAction}>
                                    <input type="hidden" name="order_id" value={order.id} />
                                    <input type="hidden" name="selected" value={order.id} />
                                    <input type="hidden" name="channel" value="whatsapp" />
                                    <button type="submit" className={`${btnGhost} w-full justify-center`}>Comprovante WA</button>
                                </form>
                                <form action={sendOrderReceiptAction}>
                                    <input type="hidden" name="order_id" value={order.id} />
                                    <input type="hidden" name="selected" value={order.id} />
                                    <input type="hidden" name="channel" value="email" />
                                    <button type="submit" className={`${btnGhost} w-full justify-center`}>Comprovante Email</button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {showWhatsApp && <WhatsAppPreviewModal order={order} onClose={() => setShowWhatsApp(false)} onSent={() => { setShowWhatsApp(false); onChanged(); }} />}
            {showPause && (
                <ReasonModal
                    title="Pausar pedido"
                    description="O pedido fica sobreposto como pausado. O status atual é preservado e volta ao retomar."
                    confirmLabel="Pausar"
                    variant="warning"
                    onCancel={() => setShowPause(false)}
                    onConfirm={handlePause}
                />
            )}
            {showCancel && (
                <ReasonModal
                    title="Cancelar pedido"
                    description="Esta ação não pode ser desfeita pela tela. Informe um motivo claro para registro."
                    confirmLabel="Cancelar pedido"
                    variant="danger"
                    onCancel={() => setShowCancel(false)}
                    onConfirm={handleCancel}
                />
            )}
        </>
    );
}

function InfoCell({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-[0.6px] text-[#4A4A52]">{label}</div>
            <div className="text-xs text-[#EDE8E0] mt-0.5">{value}</div>
        </div>
    );
}

// ─── Main Client ──────────────────────────────────────────────────────────────

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

    // refetch on filter changes (debounced for search)
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
