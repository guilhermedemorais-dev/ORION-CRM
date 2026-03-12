import { notFound } from 'next/navigation';
import { LeadsPipelineClient } from '@/components/modules/leads/LeadsPipelineClient';
import type { ApiListResponse, LeadRecord, PipelineRecord, PipelineStageRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';

export default async function PipelinePage({
    params,
    searchParams,
}: {
    params: { slug: string };
    searchParams?: { q?: string };
}) {
    const session = requireSession();

    let pipeline: PipelineRecord;
    try {
        pipeline = await apiRequest<PipelineRecord>(`/pipelines/slug/${params.slug}`);
    } catch {
        notFound();
    }

    const query = new URLSearchParams({ limit: '100' });
    if (searchParams?.q) {
        query.set('q', searchParams.q);
    }

    const [leadResponse, stagesResponse] = await Promise.all([
        apiRequest<ApiListResponse<LeadRecord>>(`/pipelines/${pipeline.id}/leads?${query.toString()}`),
        apiRequest<{ data: PipelineStageRecord[] }>(`/pipelines/${pipeline.id}/stages`),
    ]);

    return (
        <LeadsPipelineClient
            initialLeads={leadResponse.data}
            initialStages={stagesResponse.data}
            pipelineId={pipeline.id}
            pipelineName={pipeline.name}
            canManagePipeline={session.user.role === 'ADMIN'}
            currentUserId={session.user.id}
            initialQuery={searchParams?.q ?? ''}
        />
    );
}
