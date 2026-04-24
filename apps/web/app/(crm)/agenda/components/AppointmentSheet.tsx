"use client";
import { X, Loader2, Phone, MessageCircle, Send, Pencil, XCircle, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useTransition, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { AppointmentRecord } from "../types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { AiContextCard } from "./AiContextCard";
import { updateAppointmentStatusAction, notifyAppointmentAction } from "../actions";

/** Sanitize event type names — same logic as AppointmentPill */
function formatEventName(raw: string): string {
    return raw
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Confirmation Dialog (inline) ──────────────────────────────────────
function ConfirmationDialog({
    title,
    description,
    confirmLabel,
    confirmColor,
    showNotes,
    showReasonField,
    onConfirm,
    onCancel,
    isPending,
}: {
    title: string;
    description: string;
    confirmLabel: string;
    confirmColor: string;
    showNotes?: boolean;
    showReasonField?: boolean;
    onConfirm: (extra: { notes?: string; reason?: string }) => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    const [notes, setNotes] = useState('');
    const [reason, setReason] = useState('');

    return (
        <div className="p-5 border border-amber-500/20 bg-amber-500/5 rounded-lg space-y-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-gray-400 mt-1">{description}</p>
                </div>
            </div>

            {showReasonField && (
                <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Motivo *</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Descreva o motivo do cancelamento..."
                        className="w-full min-h-[60px] rounded-md border border-white/10 bg-white/5 p-2.5 text-sm text-white placeholder:text-gray-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                </div>
            )}

            {showNotes && (
                <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Observações de conclusão (opcional)</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Detalhes sobre a conclusão do atendimento..."
                        className="w-full min-h-[60px] rounded-md border border-white/10 bg-white/5 p-2.5 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                    />
                </div>
            )}

            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="primary"
                    className={`flex-1 ${confirmColor}`}
                    onClick={() => onConfirm({ notes, reason })}
                    disabled={isPending || (showReasonField && reason.trim().length === 0)}
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
                    Voltar
                </Button>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────
export function AppointmentSheet({ 
    appointment,
    closeHref
}: { 
    appointment: AppointmentRecord;
    closeHref: string;
}) {
    const [isPending, startTransition] = useTransition();
    const [notifySending, setNotifySending] = useState(false);
    const [notifySent, setNotifySent] = useState(false);

    // Confirmation dialogs state
    const [confirmAction, setConfirmAction] = useState<'complete' | 'cancel' | null>(null);

    // Edit mode — open CreateAppointmentDialog in edit mode via URL
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const handleStatusUpdate = useCallback((newStatus: string, extra?: { cancel_reason?: string; notes?: string }) => {
        startTransition(async () => {
            const formData = new FormData();
            formData.append('id', appointment.id);
            formData.append('status', newStatus);
            if (extra?.cancel_reason) formData.append('cancel_reason', extra.cancel_reason);
            if (extra?.notes) formData.append('notes', extra.notes);
            await updateAppointmentStatusAction(formData);
        });
    }, [appointment.id]);

    const handleNotify = async () => {
        setNotifySending(true);
        try {
            await notifyAppointmentAction(appointment.id);
            setNotifySent(true);
        } catch {
            // silently fail
        } finally {
            setNotifySending(false);
        }
    };

    const handleEdit = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('create', 'true');
        params.set('edit', appointment.id);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleReschedule = () => {
        // Reschedule = open edit modal with cleared dates
        const params = new URLSearchParams(searchParams.toString());
        params.set('create', 'true');
        params.set('edit', appointment.id);
        params.set('reschedule', 'true');
        router.push(`${pathname}?${params.toString()}`);
    };

    const clientName = appointment.customer?.name || appointment.lead?.name || 'Cliente Não Informado';
    const clientWhatsapp = appointment.lead?.whatsapp_number || appointment.customer?.whatsapp_number || null;

    // Build profile link — prefer customer, fallback to lead
    const profileHref = appointment.customer?.id
        ? `/clientes/${appointment.customer.id}`
        : appointment.lead?.id
            ? `/leads/${appointment.lead.id}`
            : null;

    // Check if appointment is still actionable (not ended)
    const isEnded = ['CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU'].includes(appointment.status);
    const isActive = !isEnded;

    return (
        <div className="h-full bg-surface-sidebar border-l border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <h2 className="text-lg font-semibold text-white">Detalhes do Agendamento</h2>
                <Link href={closeHref} className="p-2 -mr-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
                    <X className="w-5 h-5" />
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Header Info */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        {/* FIX: Sanitize event type for display */}
                        <span className="text-xl font-bold text-white">{formatEventName(appointment.type)}</span>
                        <StatusBadge status={appointment.status} />
                    </div>
                    <p className="text-sm text-brand-gold">
                        {new Date(appointment.starts_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}
                        {' - '}
                        {new Date(appointment.ends_at).toLocaleTimeString('pt-BR', { timeStyle: 'short' })}
                    </p>
                </div>

                {/* Metadata: Pipeline & Responsável */}
                <div className="grid grid-cols-2 gap-3">
                    {appointment.pipeline_id && (
                        <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                            <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Pipeline</label>
                            <p className="text-sm text-gray-300">{appointment.pipeline_id}</p>
                        </div>
                    )}
                    {appointment.assigned_to && (
                        <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                            <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Responsável</label>
                            <p className="text-sm text-gray-300">{appointment.assigned_to.name}</p>
                        </div>
                    )}
                </div>

                {/* Client Info */}
                <div className="p-4 rounded-lg border border-white/5 bg-white/[0.02]">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-3">Cliente</label>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold font-bold shrink-0">
                            {clientName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{clientName}</p>
                            {clientWhatsapp && (
                                <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                    <Phone className="w-3 h-3" />
                                    <span>{clientWhatsapp}</span>
                                </div>
                            )}
                            {profileHref ? (
                                <Link href={profileHref} className="text-xs text-brand-gold hover:underline mt-1 inline-block">
                                    Ver perfil do cliente →
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {appointment.notes && (
                    <div>
                        <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-2">Observações</label>
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
                            {appointment.notes}
                        </div>
                    </div>
                )}

                {/* Cancel reason (if cancelled) */}
                {appointment.cancel_reason && (
                    <div>
                        <label className="block text-[10px] font-medium uppercase tracking-wider text-rose-400 mb-2">Motivo do Cancelamento</label>
                        <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg text-sm text-rose-300 whitespace-pre-wrap">
                            {appointment.cancel_reason}
                        </div>
                    </div>
                )}

                {/* AI Context */}
                {appointment.ai_context && (
                    <div>
                        <AiContextCard context={appointment.ai_context} />
                    </div>
                )}

                {/* Bot message button */}
                {isActive && clientWhatsapp && (
                    <div>
                        <Button
                            type="button"
                            variant="secondary"
                            className="w-full"
                            onClick={handleNotify}
                            disabled={notifySending || notifySent}
                            icon={notifySent ? <MessageCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        >
                            {notifySent ? '✓ Lembrete enviado' : notifySending ? 'Enviando...' : 'Enviar lembrete via Bot'}
                        </Button>
                    </div>
                )}

                {/* Confirmation dialogs */}
                {confirmAction === 'complete' && (
                    <ConfirmationDialog
                        title="Concluir Atendimento"
                        description={`Deseja marcar o atendimento de ${clientName} como concluído? Esta ação não pode ser desfeita.`}
                        confirmLabel="Confirmar Conclusão"
                        confirmColor="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                        showNotes
                        onConfirm={({ notes }) => handleStatusUpdate('CONCLUIDO', { notes })}
                        onCancel={() => setConfirmAction(null)}
                        isPending={isPending}
                    />
                )}

                {confirmAction === 'cancel' && (
                    <ConfirmationDialog
                        title="Cancelar Agendamento"
                        description={`Deseja cancelar o agendamento de ${clientName}? Um motivo é obrigatório.`}
                        confirmLabel="Confirmar Cancelamento"
                        confirmColor="bg-rose-600 hover:bg-rose-700 text-white border-none"
                        showReasonField
                        onConfirm={({ reason }) => handleStatusUpdate('CANCELADO', { cancel_reason: reason })}
                        onCancel={() => setConfirmAction(null)}
                        isPending={isPending}
                    />
                )}
            </div>

            {/* Actions Footer */}
            <div className="p-5 border-t border-white/5 bg-black/20 flex flex-col gap-2.5">

                {/* ─── Edit & Reschedule buttons (always visible when active) ─── */}
                {isActive && !confirmAction && (
                    <div className="flex gap-2.5">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={handleEdit}
                            icon={<Pencil className="w-4 h-4" />}
                        >
                            Editar
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={handleReschedule}
                            icon={<RefreshCw className="w-4 h-4" />}
                        >
                            Remarcar
                        </Button>
                    </div>
                )}

                {/* AGENDADO: can confirm, start service, cancel */}
                {appointment.status === 'AGENDADO' && !confirmAction && (
                    <>
                        <Button 
                            variant="primary" 
                            className="w-full"
                            disabled={isPending}
                            onClick={() => handleStatusUpdate('CONFIRMADO_CLIENTE')}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar com Cliente'}
                        </Button>
                        <Button 
                            variant="primary" 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                            disabled={isPending}
                            onClick={() => handleStatusUpdate('EM_ATENDIMENTO')}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Recepcionar (Iniciar Atendimento)'}
                        </Button>
                        <div className="flex gap-2.5">
                            {/* FIX: Cancel now goes through confirmation dialog with mandatory reason */}
                            <Button 
                                variant="secondary" 
                                className="w-full !border-rose-500/20 !text-rose-400 hover:!bg-rose-500/10"
                                disabled={isPending}
                                onClick={() => setConfirmAction('cancel')}
                                icon={<XCircle className="w-4 h-4" />}
                            >
                                Cancelar
                            </Button>
                            <Button 
                                variant="secondary" 
                                className="w-full !border-orange-500/20 !text-orange-400 hover:!bg-orange-500/10"
                                disabled={isPending}
                                onClick={() => handleStatusUpdate('NAO_COMPARECEU')}
                            >
                                Não Compareceu
                            </Button>
                        </div>
                    </>
                )}

                {/* CONFIRMADO: can start service, cancel, no-show */}
                {appointment.status === 'CONFIRMADO_CLIENTE' && !confirmAction && (
                    <>
                        <Button 
                            variant="primary" 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                            disabled={isPending}
                            onClick={() => handleStatusUpdate('EM_ATENDIMENTO')}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Recepcionar (Iniciar Atendimento)'}
                        </Button>
                        <div className="flex gap-2.5">
                            <Button 
                                variant="secondary" 
                                className="w-full !border-rose-500/20 !text-rose-400 hover:!bg-rose-500/10"
                                disabled={isPending}
                                onClick={() => setConfirmAction('cancel')}
                                icon={<XCircle className="w-4 h-4" />}
                            >
                                Cancelar
                            </Button>
                            <Button 
                                variant="secondary" 
                                className="w-full !border-orange-500/20 !text-orange-400 hover:!bg-orange-500/10"
                                disabled={isPending}
                                onClick={() => handleStatusUpdate('NAO_COMPARECEU')}
                            >
                                Não Compareceu
                            </Button>
                        </div>
                    </>
                )}

                {/* EM_ATENDIMENTO: can complete (with confirmation!) */}
                {appointment.status === 'EM_ATENDIMENTO' && !confirmAction && (
                    <Button 
                        variant="primary" 
                        // FIX: Uses green (success) instead of gold for completion — distinguishes from primary action
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                        disabled={isPending}
                        onClick={() => setConfirmAction('complete')}
                        icon={<CheckCircle2 className="w-4 h-4" />}
                    >
                        Concluir Atendimento
                    </Button>
                )}
                
                {/* Ended states */}
                {isEnded && (
                    <div className="text-center text-sm text-gray-500 py-2 border border-white/5 bg-white/5 rounded-md">
                        Atendimento Encerrado
                    </div>
                )}
            </div>
        </div>
    );
}
