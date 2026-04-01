"use client"
import { Plus, Loader2 } from "lucide-react";
import { AiContextCard } from "./AiContextCard";
import { AppointmentPill } from "./AppointmentPill";
import { AppointmentRecord } from "../types";
import { Button } from "@/components/ui/Button";
import { useEffect, useState, useCallback } from "react";
import { getAppointmentsForEntityAction } from "../actions";
import { CreateAppointmentDialog } from "./CreateAppointmentDialog";

export function LeadAppointmentsTab({ 
    leadId,
    customerId 
}: { 
    leadId?: string | null;
    customerId?: string | null;
}) {
    const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);

    const loadAppointments = useCallback(() => {
        if (!leadId && !customerId) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        getAppointmentsForEntityAction(leadId, customerId).then(data => {
            setAppointments(data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [leadId, customerId]);

    useEffect(() => {
        loadAppointments();
    }, [loadAppointments]);

    const handleDialogClose = () => {
        setShowDialog(false);
        // Reload appointments after creating a new one
        loadAppointments();
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-gold" /></div>;
    }

    const now = new Date();
    
    // Split into future and past
    const futureAppointments = appointments
        .filter(app => new Date(app.starts_at) >= now)
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        
    const pastAppointments = appointments
        .filter(app => new Date(app.starts_at) < now)
        .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

    const nextAppointment = futureAppointments[0];
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Próximo Agendamento</h3>
                <Button 
                    variant="secondary" 
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setShowDialog(true)}
                >
                    Novo Agendamento
                </Button>
            </div>

            {nextAppointment ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Next meeting info */}
                    <div className="p-4 rounded-xl border border-brand-gold/20 bg-brand-gold/5 flex gap-4">
                        <div className="flex flex-col items-center justify-center p-3 bg-black/40 border border-white/5 rounded-lg min-w-[80px]">
                            <span className="text-sm text-brand-gold font-bold">
                                {new Date(nextAppointment.starts_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()}
                            </span>
                            <span className="text-xl font-bold text-white">
                                {new Date(nextAppointment.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="flex-1 py-1">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase mb-1 border border-blue-500/30 bg-blue-500/10 text-blue-300">
                                {nextAppointment.status}
                            </span>
                            <h4 className="text-base font-semibold text-white mt-1">{nextAppointment.type}</h4>
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{nextAppointment.notes || 'Sem observações.'}</p>
                        </div>
                    </div>

                    {/* Right: AI Context */}
                    <div>
                        {nextAppointment.ai_context && (
                            <AiContextCard context={nextAppointment.ai_context} />
                        )}
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center border border-white/5 bg-white/[0.02] rounded-xl text-gray-400">
                    <p className="text-sm">Nenhum agendamento futuro para este contato.</p>
                </div>
            )}

            <div className="pt-6 border-t border-white/5">
                <h3 className="text-sm font-semibold text-white mb-4">Histórico de Agendamentos</h3>
                
                <div className="max-w-md space-y-2 opacity-80">
                    {pastAppointments.length === 0 ? (
                        <p className="text-xs text-gray-500">Sem histórico.</p>
                    ) : (
                        pastAppointments.map(app => (
                            <AppointmentPill 
                                key={app.id}
                                appointment={app} 
                                onClick={() => {}} 
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Create Appointment Dialog — controlled mode */}
            <CreateAppointmentDialog 
                open={showDialog}
                onClose={handleDialogClose}
                prefilledLeadId={leadId}
                prefilledCustomerId={customerId}
            />
        </div>
    );
}
