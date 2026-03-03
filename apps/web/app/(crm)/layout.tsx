import { AppShell } from '@/components/layout/AppShell';
import { fetchPublicSettings } from '@/lib/api';
import { requireSession } from '@/lib/auth';

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
    const session = requireSession();
    const settings = await fetchPublicSettings();

    return (
        <AppShell companyName={settings.company_name} user={session.user}>
            {children}
        </AppShell>
    );
}
