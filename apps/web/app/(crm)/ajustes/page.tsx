import { redirect } from 'next/navigation';
import { AjustesClient } from '@/components/modules/settings/AjustesClient';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import type { AdminSettings, AdminUser, AdminUsersResponse, AjustesTab } from '@/lib/ajustes-types';

const validTabs = new Set<AjustesTab>([
    'empresa',
    'usuarios',
    'notificacoes',
    'seguranca',
    'integracoes',
    'ia-copiloto',
]);

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
    security_login_protection: false,
    security_session_timeout_minutes: 480,
    plan: 'starter',
};

export default async function AjustesPage({
    searchParams,
}: {
    searchParams?: { tab?: string };
}) {
    const session = requireSession();
    const requestedTab = searchParams?.tab;
    const initialTab: AjustesTab = requestedTab && validTabs.has(requestedTab as AjustesTab)
        ? requestedTab as AjustesTab
        : 'empresa';

    if (session.user.role !== 'ADMIN' && session.user.role !== 'ROOT') {
        redirect('/dashboard');
    }

    let settings = fallbackSettings;
    let users: AdminUser[] = [];

    try {
        settings = await apiRequest<AdminSettings>('/org/settings');
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
            initialTab={initialTab}
            initialSettings={settings}
            initialUsers={users}
            currentUserId={session.user.id}
            currentUserRole={session.user.role}
        />
    );
}
