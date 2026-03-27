'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export async function createAppointmentAction(formData: FormData) {
    const body = {
        type:        formData.get('type') as string,
        starts_at:   formData.get('starts_at') as string,
        ends_at:     formData.get('ends_at') as string,
        assigned_to: formData.get('assigned_to_id') as string | null,
        lead_id:     formData.get('lead_id') as string | null,
        customer_id: formData.get('customer_id') as string | null,
        notes:       formData.get('notes') as string | null,
        source:      'CRM',
    };

    await apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    revalidatePath('/agenda');
}

export async function updateAppointmentStatusAction(formData: FormData) {
    const id           = formData.get('id') as string;
    const status       = formData.get('status') as string;
    const cancelReason = formData.get('cancel_reason') as string | null;

    await apiRequest(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, cancel_reason: cancelReason || undefined }),
    });

    revalidatePath('/agenda');
    redirect(`/agenda?selected=${id}`);
}

export async function getAppointmentsForEntityAction(leadId?: string | null, customerId?: string | null) {
    const params = new URLSearchParams();
    if (leadId) params.append('lead_id', leadId);
    if (customerId) params.append('customer_id', customerId);
    
    // we fetch them to list in the tab
    const res = await apiRequest<{ data: any[] }>(`/appointments?${params.toString()}`);
    return res.data || [];
}
