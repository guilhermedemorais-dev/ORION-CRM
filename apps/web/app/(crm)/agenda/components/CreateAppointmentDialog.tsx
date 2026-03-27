"use client"
import { X, Loader2 } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/Input"; 
import { Button } from "@/components/ui/Button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createAppointmentAction } from "../actions";
import { useTransition } from "react";

const appointmentSchema = z.object({
    type: z.string().min(1, "Campo obrigatório"),
    customer_id: z.string().optional(),
    lead_id: z.string().optional(),
    assigned_to_id: z.string().min(1, "Campo obrigatório"),
    date: z.string().min(1, "Campo obrigatório"),
    time: z.string().min(1, "Campo obrigatório"),
    notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

export function CreateAppointmentDialog() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handleClose = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('create');
        router.push(`${pathname}?${params.toString()}`);
    };

    const { register, handleSubmit, formState: { errors } } = useForm<AppointmentFormValues>({
        resolver: zodResolver(appointmentSchema),
        defaultValues: {
            type: "Visita Showroom",
            assigned_to_id: "1", // Atendente Atual mock
            date: new Date().toISOString().split('T')[0],
            time: "10:00",
            notes: ""
        }
    });

    const onSubmit = (data: AppointmentFormValues) => {
        startTransition(async () => {
            const formData = new FormData();
            formData.append('type', data.type);
            formData.append('assigned_to_id', data.assigned_to_id);
            if (data.customer_id) formData.append('customer_id', data.customer_id);
            if (data.lead_id) formData.append('lead_id', data.lead_id);
            formData.append('starts_at', `${data.date}T${data.time}:00Z`);
            
            // Assume 1 hour duration
            const [hours, minutes] = data.time.split(':').map(Number);
            const endDate = new Date(`${data.date}T00:00:00Z`);
            endDate.setUTCHours(hours + 1, minutes, 0, 0);
            formData.append('ends_at', endDate.toISOString());
            
            if (data.notes) formData.append('notes', data.notes);

            await createAppointmentAction(formData);
            handleClose();
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleClose}>
            <form 
                onSubmit={handleSubmit(onSubmit)}
                className="w-full max-w-lg bg-surface-sidebar border border-white/10 rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="text-lg font-semibold text-white">Novo Agendamento</h2>
                    <button type="button" onClick={handleClose} className="p-1 -mr-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Tipo de Agendamento</label>
                            <select 
                                {...register('type')}
                                className="w-full h-9 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-[color:var(--orion-text)] focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold transition-colors"
                            >
                                <option value="Visita Showroom" className="text-black">Visita Showroom</option>
                                <option value="Reunião Online" className="text-black">Reunião Online</option>
                                <option value="Retirada" className="text-black">Retirada</option>
                                <option value="Outro" className="text-black">Outro</option>
                            </select>
                            {errors.type && <p className="text-[10px] text-rose-500">{errors.type.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Responsável</label>
                            <select 
                                {...register('assigned_to_id')}
                                className="w-full h-9 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-[color:var(--orion-text)] focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold transition-colors"
                            >
                                <option value="1" className="text-black">Atendente Atual</option>
                            </select>
                            {errors.assigned_to_id && <p className="text-[10px] text-rose-500">{errors.assigned_to_id.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400">ID Cliente / Lead (Opcional)</label>
                        <Input placeholder="ID..." {...register('customer_id')} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Data</label>
                            <Input type="date" {...register('date')} />
                            {errors.date && <p className="text-[10px] text-rose-500">{errors.date.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Horário</label>
                            <Input type="time" {...register('time')} />
                            {errors.time && <p className="text-[10px] text-rose-500">{errors.time.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400">Observações Extras</label>
                        <textarea 
                            {...register('notes')}
                            className="w-full min-h-[80px] rounded-md border border-white/10 bg-white/5 p-3 text-sm text-[color:var(--orion-text)] placeholder:text-gray-500 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold transition-colors resize-none"
                            placeholder="Detalhes que podem ajudar no atendimento (opcional)"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end gap-3 rounded-b-xl">
                    <Button variant="ghost" onClick={handleClose} disabled={isPending} type="button">
                        Cancelar
                    </Button>
                    <Button variant="primary" type="submit" disabled={isPending}>
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar e Agendar'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
