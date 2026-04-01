"use client";
import { X, Loader2, Phone, MessageCircle, Send } from "lucide-react";
import Link from "next/link";
import { useTransition, useState } from "react";
import type { AppointmentRecord } from "../types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { AiContextCard } from "./AiContextCard";
import { updateAppointmentStatusAction, notifyAppointmentAction } from "../actions";

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

    const handleStatusUpdate = (newStatus: string) => {
        startTransition(async () => {
            const formData = new FormData();
            formData.append('id', appointment.id);
            formData.append('status', newStatus);
            await updateAppointmentStatusAction(formData);
        });
    };

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
                        <span className="text-xl font-bold text-white">{appointment.type}</span>
                        <StatusBadge status={appointment.status} />
                    </div>
                    <p className="text-sm text-brand-gold">
                        {new Date(appointment.starts_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}
                        {' - '}
                        {new Date(appointment.ends_at).toLocaleTimeString('pt-BR', { timeStyle: 'short' })}
                    </p>
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
            </div>

            {/* Actions Footer */}
            <div className="p-5 border-t border-white/5 bg-black/20 flex flex-col gap-2.5">
                {/* AGENDADO: can confirm, start service, cancel */}
                {appointment.status === 'AGENDADO' && (
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
                            <Button 
                                variant="secondary" 
                                className="w-full !border-rose-500/20 !text-rose-400 hover:!bg-rose-500/10"
                                disabled={isPending}
                                onClick={() => handleStatusUpdate('CANCELADO')}
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
                {appointment.status === 'CONFIRMADO_CLIENTE' && (
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
                                onClick={() => handleStatusUpdate('CANCELADO')}
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

                {/* EM_ATENDIMENTO: can complete */}
                {appointment.status === 'EM_ATENDIMENTO' && (
                    <Button 
                        variant="primary" 
                        className="w-full bg-brand-gold text-black hover:bg-brand-gold/90"
                        disabled={isPending}
                        onClick={() => handleStatusUpdate('CONCLUIDO')}
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Concluir Atendimento'}
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
