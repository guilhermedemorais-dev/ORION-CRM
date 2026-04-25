"use client"
import { X, Loader2, Send, Phone } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/Input"; 
import { Button } from "@/components/ui/Button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createAppointmentAction, editAppointmentAction, notifyAppointmentAction } from "../actions";
import { useTransition, useEffect, useState, useMemo, useCallback } from "react";
import type { AppointmentRecord } from "../types";

// Base schema fields shared by both modes
const baseFields = {
    type: z.string().min(1, "Tipo é obrigatório"),
    pipeline_id: z.string().min(1, "Pipeline é obrigatório"),
    assigned_to_id: z.string().optional(),
    lead_id: z.string().optional(),
    customer_id: z.string().optional(),
    date: z.string().min(1, "Data é obrigatória"),
    time: z.string().min(1, "Horário é obrigatório"),
    notes: z.string().optional(),
};

// FIX: WhatsApp validation — require numeric format, reject letters
const phoneRegex = /^\+?[1-9]\d{10,14}$/;

// Schema when contact fields are visible (no pre-filled entity) — ALL required
const newContactSchema = z.object({
    ...baseFields,
    contact_name: z.string().min(2, "Nome do contato é obrigatório (mín. 2 caracteres)"),
    contact_phone: z.string()
        .min(10, "Número de WhatsApp é obrigatório (mín. 10 dígitos)")
        .refine(
            (val) => phoneRegex.test(val.replace(/[\s()-]/g, '')),
            { message: "Formato de telefone inválido. Use apenas números." }
        ),
});

// Schema when entity is pre-filled (contact fields hidden)
const prefilledSchema = z.object({
    ...baseFields,
    contact_name: z.string().optional(),
    contact_phone: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof newContactSchema>;

interface Pipeline {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
}

interface UserOption {
    id: string;
    name: string;
}

interface CreateAppointmentDialogProps {
    /** Controlled mode — if provided, dialog visibility is controlled by parent */
    open?: boolean;
    /** Callback when dialog closes (controlled mode) */
    onClose?: () => void;
    /** Pre-fill lead_id when opening from a client profile */
    prefilledLeadId?: string | null;
    /** Pre-fill customer_id when opening from a client profile */
    prefilledCustomerId?: string | null;
    /** FIX: Current authenticated user's ID — pre-selects as default "Responsável" */
    currentUserId?: string | null;
}

/** 
 * Format phone number as (XX) XXXXX-XXXX while typing.
 * Strips non-digit chars, applies mask progressively.
 */
function formatPhoneInput(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/** Strip mask to get raw digits for submission */
function stripPhoneMask(masked: string): string {
    return masked.replace(/\D/g, '');
}

export function CreateAppointmentDialog({ 
    open: controlledOpen, 
    onClose: controlledOnClose,
    prefilledLeadId,
    prefilledCustomerId,
    currentUserId,
}: CreateAppointmentDialogProps = {}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [createdId, setCreatedId] = useState<string | null>(null);
    const [notifySending, setNotifySending] = useState(false);
    const [notifySent, setNotifySent] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Edit mode detection via URL params
    const editId = searchParams.get('edit');
    const isReschedule = searchParams.get('reschedule') === 'true';
    const isEditMode = Boolean(editId);

    // Decide visibility: controlled or URL-based
    const isControlled = controlledOpen !== undefined;
    const isVisible = isControlled ? controlledOpen : searchParams.get('create') === 'true';

    // Whether we have a pre-filled entity (from client profile page)
    const hasPrefilledEntity = Boolean(prefilledLeadId || prefilledCustomerId);

    // Pick the right schema: require contact fields when no entity is pre-filled
    const activeSchema = useMemo(
        () => hasPrefilledEntity ? prefilledSchema : newContactSchema,
        [hasPrefilledEntity]
    );

    // Fetch pipelines & users
    useEffect(() => {
        if (!isVisible) return;

        fetch('/api/internal/pipelines')
            .then(r => r.ok ? r.json() : { data: [] })
            .then(data => {
                const list: Pipeline[] = Array.isArray(data) ? data : (data.data ?? []);
                setPipelines(list.filter(p => p.is_active));
            })
            .catch(() => {});

        fetch('/api/internal/users')
            .then(r => r.ok ? r.json() : { data: [] })
            .then(data => {
                const list = Array.isArray(data) ? data : (data.data ?? []);
                setUsers(list.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
            })
            .catch(() => {});
    }, [isVisible]);

    // Load appointment data for edit mode
    const [editData, setEditData] = useState<AppointmentRecord | null>(null);
    useEffect(() => {
        if (!editId || !isVisible) return;
        fetch(`/api/internal/appointments/${editId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) setEditData(data);
            })
            .catch(() => {});
    }, [editId, isVisible]);

    const handleClose = useCallback(() => {
        setCreatedId(null);
        setNotifySent(false);
        setEditData(null);
        setSubmitError(null);

        if (isControlled && controlledOnClose) {
            controlledOnClose();
        } else {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('create');
            params.delete('edit');
            params.delete('reschedule');
            router.push(`${pathname}?${params.toString()}`);
        }
    }, [isControlled, controlledOnClose, searchParams, pathname, router]);

    // Build default values — can be overridden by edit data
    const defaultValues = useMemo(() => {
        if (editData) {
            const startsAt = new Date(editData.starts_at);
            return {
                type: editData.type || "Visita Showroom",
                pipeline_id: editData.pipeline_id || "",
                assigned_to_id: editData.assigned_to?.id || "",
                lead_id: editData.lead?.id || prefilledLeadId || "",
                customer_id: editData.customer?.id || prefilledCustomerId || "",
                contact_name: editData.lead?.name || editData.customer?.name || "",
                contact_phone: editData.lead?.whatsapp_number || editData.customer?.whatsapp_number || "",
                // For reschedule: clear dates so user picks new ones
                date: isReschedule ? "" : startsAt.toISOString().split('T')[0],
                time: isReschedule ? "" : startsAt.toTimeString().slice(0, 5),
                notes: editData.notes || "",
            };
        }
        return {
            type: "Visita Showroom",
            pipeline_id: "",
            assigned_to_id: currentUserId || "",
            lead_id: prefilledLeadId || "",
            customer_id: prefilledCustomerId || "",
            contact_name: "",
            contact_phone: "",
            date: new Date().toISOString().split('T')[0],
            time: "10:00",
            notes: ""
        };
    }, [editData, isReschedule, prefilledLeadId, prefilledCustomerId]);

    const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<AppointmentFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(activeSchema) as any,
        defaultValues,
    });
    const contactPhoneField = register('contact_phone');

    // Reset form when editData loads
    useEffect(() => {
        if (editData) {
            reset(defaultValues);
        }
    }, [editData, reset, defaultValues]);

    // Phone mask handler
    const phoneValue = watch('contact_phone');
    const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const masked = formatPhoneInput(e.target.value);
        setValue('contact_phone', masked, { shouldValidate: true });
    }, [setValue]);

    const onSubmit = (data: AppointmentFormValues) => {
        startTransition(async () => {
            setSubmitError(null);
            const formData = new FormData();
            
            if (isEditMode && editId) {
                formData.append('id', editId);
            }

            formData.append('type', data.type);
            formData.append('pipeline_id', data.pipeline_id);
            if (data.assigned_to_id) formData.append('assigned_to_id', data.assigned_to_id);
            if (data.lead_id) formData.append('lead_id', data.lead_id);
            if (data.customer_id) formData.append('customer_id', data.customer_id);
            if (data.contact_name) formData.append('contact_name', data.contact_name);
            // Strip phone mask before sending
            if (data.contact_phone) formData.append('contact_phone', stripPhoneMask(data.contact_phone));
            formData.append('starts_at', `${data.date}T${data.time}:00`);

            // Assume 1 hour duration
            const [hours, minutes] = data.time.split(':').map(Number);
            const endDate = new Date(`${data.date}T00:00:00`);
            endDate.setHours(hours + 1, minutes, 0, 0);
            formData.append('ends_at', endDate.toISOString());

            if (data.notes) formData.append('notes', data.notes);

            try {
                if (isEditMode) {
                    await editAppointmentAction(formData);
                } else {
                    const result = await createAppointmentAction(formData);
                    if (result?.id) {
                        setCreatedId(result.id);
                    } else {
                        setSubmitError('A API não retornou o agendamento criado.');
                    }
                }
            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : 'Não foi possível registrar o agendamento.';
                setSubmitError(message);
            }
        });
    };

    const handleNotify = async () => {
        if (!createdId) return;
        setNotifySending(true);
        try {
            await notifyAppointmentAction(createdId);
            setNotifySent(true);
        } catch {
            // silently fail
        } finally {
            setNotifySending(false);
        }
    };

    if (!isVisible) return null;

    // FIX: Determine title based on mode
    const dialogTitle = createdId 
        ? 'Agendamento Criado ✓' 
        : isEditMode 
            ? (isReschedule ? 'Remarcar Agendamento' : 'Editar Agendamento')
            : 'Novo Agendamento';

    return (
        /* FIX: fixed inset-0 with flex items-center justify-center ensures modal stays centered in viewport.
         * body scroll is prevented by the overlay covering the full screen.
         * Added p-4 for mobile safe area and max-h-[90vh] with overflow-y-auto on the form. */
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleClose}>
            <form 
                onSubmit={handleSubmit(onSubmit)}
                className="w-full max-w-lg bg-surface-sidebar border border-white/10 rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="text-lg font-semibold text-white">
                        {dialogTitle}
                    </h2>
                    <button type="button" onClick={handleClose} className="p-1 -mr-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5" aria-label="Fechar modal">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {createdId ? (
                    /* ── Post-creation view ── */
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-300">
                            Agendamento criado com sucesso! Deseja enviar uma mensagem ao cliente via WhatsApp Bot?
                        </p>
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="primary"
                                onClick={handleNotify}
                                disabled={notifySending || notifySent}
                                icon={notifySent ? undefined : <Send className="w-4 h-4" />}
                            >
                                {notifySent ? '✓ Mensagem Enviada' : notifySending ? 'Enviando...' : 'Enviar Mensagem via Bot'}
                            </Button>
                            <Button type="button" variant="ghost" onClick={handleClose}>
                                Fechar
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* ── Form view ── */
                    <>
                        <div className="p-6 space-y-4">
                            {submitError && (
                                <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                                    {submitError}
                                </div>
                            )}

                            {/* FIX: grid-cols-1 sm:grid-cols-2 — collapses to single column on mobile */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Tipo de Agendamento *</label>
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
                                    <label className="text-xs font-medium text-gray-400">Pipeline *</label>
                                    <select 
                                        {...register('pipeline_id')}
                                        className="w-full h-9 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-[color:var(--orion-text)] focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold transition-colors"
                                    >
                                        <option value="" className="text-black">Selecione...</option>
                                        {pipelines.map(p => (
                                            <option key={p.id} value={p.id} className="text-black">{p.name}</option>
                                        ))}
                                    </select>
                                    {errors.pipeline_id && <p className="text-[10px] text-rose-500">{errors.pipeline_id.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-400">Responsável</label>
                                <select 
                                    {...register('assigned_to_id')}
                                    className="w-full h-9 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-[color:var(--orion-text)] focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold transition-colors"
                                >
                                    {/* FIX: Show "Selecione..." placeholder instead of misleading "Atendente Atual".
                                     * The first valid user from the list is the default when the API pre-selects. */}
                                    <option value="" className="text-black">Selecione um responsável...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id} className="text-black">{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            {!hasPrefilledEntity && (
                                /* FIX: grid-cols-1 sm:grid-cols-2 for mobile single-column */
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-400">
                                            Nome do Contato *
                                        </label>
                                        <Input 
                                            placeholder="Nome do cliente" 
                                            {...register('contact_name')} 
                                        />
                                        {errors.contact_name && <p className="text-[10px] text-rose-500">{errors.contact_name.message}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                                            <Phone className="w-3 h-3" />
                                            WhatsApp *
                                        </label>
                                        {/* FIX: inputMode="numeric" for mobile keyboard, tel type for proper keyboard,
                                         * onChange masked handler blocks letters in real-time */}
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            name={contactPhoneField.name}
                                            ref={contactPhoneField.ref}
                                            onBlur={contactPhoneField.onBlur}
                                            placeholder="(XX) XXXXX-XXXX"
                                            value={phoneValue || ''}
                                            onChange={handlePhoneChange}
                                            className="w-full h-9 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-[color:var(--orion-text)] placeholder:text-gray-500 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold transition-colors"
                                        />
                                        {errors.contact_phone && <p className="text-[10px] text-rose-500">{errors.contact_phone.message}</p>}
                                    </div>
                                </div>
                            )}

                            {/* FIX: grid-cols-1 sm:grid-cols-2 for mobile single-column */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Data *</label>
                                    <Input type="date" {...register('date')} />
                                    {errors.date && <p className="text-[10px] text-rose-500">{errors.date.message}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Horário *</label>
                                    <Input type="time" {...register('time')} />
                                    {errors.time && <p className="text-[10px] text-rose-500">{errors.time.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-400">Observações</label>
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
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditMode ? 'Salvar Alterações' : 'Confirmar e Agendar')}
                            </Button>
                        </div>
                    </>
                )}
            </form>
        </div>
    );
}
