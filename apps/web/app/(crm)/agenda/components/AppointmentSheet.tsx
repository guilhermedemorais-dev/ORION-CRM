"use client";
import { X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import type { AppointmentRecord } from "../types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { AiContextCard } from "./AiContextCard";
import { updateAppointmentStatusAction } from "../actions";

export function AppointmentSheet({ 
    appointment,
    closeHref
}: { 
    appointment: AppointmentRecord;
    closeHref: string;
}) {
    const [isPending, startTransition] = useTransition();

    const handleStatusUpdate = (newStatus: string) => {
        startTransition(async () => {
            const formData = new FormData();
            formData.append('id', appointment.id);
            formData.append('status', newStatus);
            // Optionally could add cancel_reason for Cancelado
            await updateAppointmentStatusAction(formData);
        });
    };

    const clientName = appointment.customer?.name || appointment.lead?.name || 'Cliente Não Informado';

    return (
        <div className="h-full bg-surface-sidebar border-l border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <h2 className="text-lg font-semibold text-white">Detalhes do Agendamento</h2>
                <Link href={closeHref} className="p-2 -mr-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
                    <X className="w-5 h-5" />
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
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
                <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Cliente</label>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold font-bold">
                            {clientName.charAt(0)}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">{clientName}</p>
                            <button className="text-xs text-brand-gold hover:underline">Ver perfil do cliente</button>
                        </div>
                    </div>
                </div>

                {/* AI Context */}
                {appointment.ai_context && (
                    <div>
                        <AiContextCard context={appointment.ai_context} />
                    </div>
                )}

                {/* Notes */}
                {appointment.notes && (
                    <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Observações</label>
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
                            {appointment.notes}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions Footer */}
            <div className="p-6 border-t border-white/5 bg-black/20 flex flex-col gap-3">
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
                        <div className="flex gap-3">
                            <Button 
                                variant="secondary" 
                                className="w-full"
                                disabled={isPending}
                            >
                                Reagendar
                            </Button>
                            <Button 
                                variant="secondary" 
                                className="w-full !border-rose-500/20 !text-rose-400 hover:!bg-rose-500/10 hover:!border-rose-500/30"
                                disabled={isPending}
                                onClick={() => handleStatusUpdate('CANCELADO')}
                            >
                                Cancelar
                            </Button>
                        </div>
                    </>
                )}

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
                        <div className="flex gap-3">
                            <Button 
                                variant="secondary" 
                                className="w-full"
                                disabled={isPending}
                            >
                                Reagendar
                            </Button>
                            <Button 
                                variant="secondary" 
                                className="w-full !border-rose-500/20 !text-rose-400 hover:!bg-rose-500/10 hover:!border-rose-500/30"
                                disabled={isPending}
                                onClick={() => handleStatusUpdate('CANCELADO')}
                            >
                                Cancelar
                            </Button>
                        </div>
                    </>
                )}

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
                
                {['CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU'].includes(appointment.status) && (
                    <div className="text-center text-sm text-gray-500 py-2 border border-white/5 bg-white/5 rounded-md">
                        Atendimento Encerrado
                    </div>
                )}
            </div>
        </div>
    );
}
