import { redirect } from 'next/navigation';
import { AjustesClient } from '@/components/modules/settings/AjustesClient';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import type { AdminSettings, AdminUser, AdminUsersResponse } from '@/lib/ajustes-types';

const fallbackSettings: AdminSettings = {
    company_name: 'Minha Joalheria',
    logo_url: null,
    favicon_url: null,
    primary_color: '#C8A97A',
    secondary_color: null,
    cnpj: null,
    phone: null,
    address: null,
    instagram: null,
    whatsapp_greeting: null,
    email_from_name: null,
    notify_new_lead_whatsapp: false,
    notify_order_paid: false,
    notify_production_delayed: false,
    notify_low_stock: false,
    plan: 'starter',
};

export default async function AjustesPage() {
    const session = requireSession();

    if (session.user.role !== 'ADMIN') {
        redirect('/dashboard');
    }

    let settings = fallbackSettings;
    let users: AdminUser[] = [];

    try {
        settings = await apiRequest<AdminSettings>('/settings');
    } catch {
        settings = fallbackSettings;
    }

    try {
        const usersPayload = await apiRequest<AdminUsersResponse>('/users');
        users = usersPayload.data;
    } catch {
        users = [];
    }

    return (
        <AjustesClient
            initialSettings={settings}
            initialUsers={users}
            currentUserId={session.user.id}
        />
    );
}
