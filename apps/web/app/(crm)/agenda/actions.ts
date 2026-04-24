'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export async function createAppointmentAction(formData: FormData) {
    const body: Record<string, unknown> = {
        type:        formData.get('type') as string,
        starts_at:   formData.get('starts_at') as string,
        ends_at:     formData.get('ends_at') as string,
        assigned_to: formData.get('assigned_to_id') as string | null,
        lead_id:     formData.get('lead_id') as string | null,
        customer_id: formData.get('customer_id') as string | null,
        notes:       formData.get('notes') as string | null,
        source:      'CRM',
    };

    // Pipeline & contact fields
    const pipelineId = formData.get('pipeline_id') as string | null;
    const contactName = formData.get('contact_name') as string | null;
    const contactPhone = formData.get('contact_phone') as string | null;

    if (pipelineId) body.pipeline_id = pipelineId;
    if (contactName) body.contact_name = contactName;
    if (contactPhone) body.contact_phone = contactPhone;

    const result = await apiRequest<{ id: string }>('/appointments', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    revalidatePath('/agenda');

    return result;
}

export async function updateAppointmentStatusAction(formData: FormData) {
    const id           = formData.get('id') as string;
    const status       = formData.get('status') as string;
    const cancelReason = formData.get('cancel_reason') as string | null;
    const notes        = formData.get('notes') as string | null;

    await apiRequest(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
            status,
            cancel_reason: cancelReason || undefined,
            notes: notes || undefined,
        }),
    });

    revalidatePath('/agenda');
    redirect(`/agenda?selected=${id}`);
}

/**
 * Edit appointment — PATCH the full appointment record.
 * Used by the edit modal to update type, dates, notes, assigned_to, etc.
 */
export async function editAppointmentAction(formData: FormData) {
    const id = formData.get('id') as string;

    const body: Record<string, unknown> = {
        type:        formData.get('type') as string,
        starts_at:   formData.get('starts_at') as string,
        ends_at:     formData.get('ends_at') as string,
        assigned_to: formData.get('assigned_to_id') as string | null,
        notes:       formData.get('notes') as string | null,
    };

    const pipelineId = formData.get('pipeline_id') as string | null;
    if (pipelineId) body.pipeline_id = pipelineId;

    const contactName = formData.get('contact_name') as string | null;
    const contactPhone = formData.get('contact_phone') as string | null;
    if (contactName) body.contact_name = contactName;
    if (contactPhone) body.contact_phone = contactPhone;

    await apiRequest(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

    revalidatePath('/agenda');
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
