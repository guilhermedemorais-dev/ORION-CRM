import { AppShell } from '@/components/layout/AppShell';
import ClientErrorReporter from '@/components/system/ClientErrorReporter';
import { ToastProvider } from '@/components/system/ToastProvider';
import { ConfirmDialogProvider } from '@/components/system/ConfirmDialog';
import type { ApiListResponse, PipelineRecord } from '@/lib/api';
import { apiRequest, fetchPublicSettings } from '@/lib/api';
import { requireSession } from '@/lib/auth';

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
    const session = requireSession();
    const settings = await fetchPublicSettings();
    let pipelines: PipelineRecord[] = [];

    try {
        const payload = await apiRequest<ApiListResponse<PipelineRecord> & { meta: { total: number } }>('/pipelines');
        pipelines = payload.data;
    } catch {
        pipelines = [];
    }

    return (
        <ToastProvider>
            <ConfirmDialogProvider>
                <AppShell companyName={settings.company_name} logoUrl={settings.logo_url} pipelines={pipelines} user={session.user}>
                    <ClientErrorReporter />
                    {children}
                </AppShell>
            </ConfirmDialogProvider>
        </ToastProvider>
    );
}
