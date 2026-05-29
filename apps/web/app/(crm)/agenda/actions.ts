'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';

/**
 * Server actions retornam {ok, error} ao invés de jogar Error.
 * Next.js em build de produção mascara o `.message` de exceções jogadas em
 * Server Actions ("specific message is omitted in production builds"),
 * impedindo o usuário de ver a mensagem real do backend (ex.: "Conflito de
 * horário"). Retornando como dado, o cliente pode renderizar diretamente.
 */
export type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

function actionErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}

export async function createAppointmentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
    const startsAtRaw = formData.get('starts_at') as string;
    const endsAtRaw = formData.get('ends_at') as string | null;
    const durationRaw = formData.get('duration_minutes') as string | null;

    const body: Record<string, unknown> = {
        type:        formData.get('type') as string,
        starts_at:   startsAtRaw,
        assigned_to: (formData.get('assigned_to_id') as string | null) || null,
        lead_id:     (formData.get('lead_id') as string | null) || null,
        customer_id: (formData.get('customer_id') as string | null) || null,
        notes:       (formData.get('notes') as string | null) || null,
        source:      'CRM',
    };

    // Prioridade: ends_at explícito > duration_minutes > backend usa settings default.
    if (endsAtRaw) {
        body.ends_at = endsAtRaw;
    } else if (durationRaw) {
        const dm = parseInt(durationRaw, 10);
        if (Number.isFinite(dm) && dm > 0) body.duration_minutes = dm;
    }

    // Pipeline & contact fields
    const pipelineId = formData.get('pipeline_id') as string | null;
    const contactName = formData.get('contact_name') as string | null;
    const contactPhone = formData.get('contact_phone') as string | null;

    if (pipelineId) body.pipeline_id = pipelineId;
    if (contactName) body.contact_name = contactName;
    if (contactPhone) body.contact_phone = contactPhone;

    try {
        const result = await apiRequest<{ id: string }>('/appointments', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        revalidatePath('/agenda');
        return { ok: true, data: result };
    } catch (err) {
        return { ok: false, error: actionErrorMessage(err, 'Falha ao criar agendamento.') };
    }
}

export async function updateAppointmentStatusAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
    const id           = formData.get('id') as string;
    const status       = formData.get('status') as string;
    const cancelReason = formData.get('cancel_reason') as string | null;
    const notes        = formData.get('notes') as string | null;

    try {
        await apiRequest(`/appointments/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({
                status,
                cancel_reason: cancelReason || undefined,
                notes: notes || undefined,
            }),
        });
    } catch (err) {
        return { ok: false, error: actionErrorMessage(err, 'Falha ao atualizar status do agendamento.') };
    }

    // Não usamos redirect() aqui — o cliente decide pra onde ir (ex.: ficha do
    // cliente em "Iniciar Atendimento"). revalidatePath garante que a agenda
    // recarregue se o usuário voltar pra ela.
    revalidatePath('/agenda');
    return { ok: true, data: { id } };
}

/**
 * Edit appointment — PATCH the full appointment record.
 * Used by the edit modal to update type, dates, notes, assigned_to, etc.
 */
export async function editAppointmentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
    const id = formData.get('id') as string;
    const startsAtRaw = formData.get('starts_at') as string | null;
    const endsAtRaw = formData.get('ends_at') as string | null;
    const durationRaw = formData.get('duration_minutes') as string | null;

    const body: Record<string, unknown> = {
        type:        formData.get('type') as string,
        assigned_to: (formData.get('assigned_to_id') as string | null) || null,
        notes:       (formData.get('notes') as string | null) || null,
    };
    if (startsAtRaw) body.starts_at = startsAtRaw;
    if (endsAtRaw) {
        body.ends_at = endsAtRaw;
    } else if (durationRaw) {
        const dm = parseInt(durationRaw, 10);
        if (Number.isFinite(dm) && dm > 0) body.duration_minutes = dm;
    }

    const pipelineId = formData.get('pipeline_id') as string | null;
    if (pipelineId) body.pipeline_id = pipelineId;

    const contactName = formData.get('contact_name') as string | null;
    const contactPhone = formData.get('contact_phone') as string | null;
    if (contactName) body.contact_name = contactName;
    if (contactPhone) body.contact_phone = contactPhone;

    try {
        await apiRequest(`/appointments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    } catch (err) {
        return { ok: false, error: actionErrorMessage(err, 'Falha ao atualizar agendamento.') };
    }

    revalidatePath('/agenda');
    // O redirect ficaria fora do try (precisa ser chamado fora). Como redirect
    // joga uma exceção interna que NÃO é capturada como erro, fazemos por último.
    redirect(`/agenda?selected=${id}`);
}

export async function getAppointmentsForEntityAction(leadId?: string | null, customerId?: string | null) {
    const params = new URLSearchParams();
    if (leadId) params.append('lead_id', leadId);
    if (customerId) params.append('customer_id', customerId);
    
    const res = await apiRequest<{ data: any[] }>(`/appointments?${params.toString()}`);
    return res.data || [];
}

export async function notifyAppointmentAction(id: string) {
    const result = await apiRequest<{ sent: boolean; whatsapp_number?: string }>(`/appointments/${id}/notify`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
    return result;
}
