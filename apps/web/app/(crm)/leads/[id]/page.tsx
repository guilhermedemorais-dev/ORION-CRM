import { notFound, redirect } from 'next/navigation';
import type { LeadRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import ClientPanelShell from '@/app/(crm)/clientes/[id]/components/ClientPanelShell';
import type { CustomerFull } from '@/app/(crm)/clientes/[id]/components/types';

export default async function LeadDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const lead = await apiRequest<LeadRecord>(`/leads/${params.id}`).catch(() => null);
    if (!lead) notFound();

    // Lead já foi convertido → redirecionar para o painel do cliente
    if (lead.converted_customer_id) {
        redirect(`/clientes/${lead.converted_customer_id}`);
    }

    // Lead não convertido → montar CustomerFull a partir dos dados do lead
    const customer: CustomerFull = {
        id: lead.id,
        name: lead.name ?? 'Lead sem nome',
        whatsapp_number: lead.whatsapp_number,
        email: lead.email,
        cpf: null,
        social_name: null,
        rg: null,
        birth_date: null,
        gender: null,
        instagram: null,
        phone_landline: null,
        zip_code: null,
        city: null,
        state: null,
        address_full: null,
        cnpj: null,
        company_name: null,
        company_address: null,
        preferred_metal: null,
        ring_size: null,
        preferred_channel: null,
        special_dates: null,
        remarketing_notes: lead.notes,
        origin: lead.source,
        notes: lead.notes,
        is_converted: false,
        lifetime_value_cents: lead.estimated_value ?? 0,
        ltv_cents: lead.estimated_value ?? 0,
        orders_count: 0,
        last_order_at: null,
        has_pending_os: false,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        assigned_to: lead.assigned_to,
    };

    return <ClientPanelShell customerId={lead.id} initialCustomer={customer} />;
}
