import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import type { PipelineRecord, PipelineStageRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { PipelineBuilderV2Client } from './_components/PipelineBuilderV2Client';

export default async function PipelineBuilderV2Page({
    params,
}: {
    params: { slug: string };
}) {
    const session = requireSession();

    if (session.user.role !== 'ROOT') {
        redirect(`/pipeline/${params.slug}`);
    }

    if (params.slug === 'novo') {
        redirect('/pipeline/novo/builder');
    }

    const pipeline = await apiRequest<PipelineRecord>(`/pipelines/slug/${params.slug}`);
    const stagesResponse = await apiRequest<{ data: PipelineStageRecord[] }>(`/pipelines/${pipeline.id}/stages`);

    return (
        <div className="space-y-5">
            <PageHeader
                title="Builder V2"
                description="Configure regras operacionais do pipeline sem usar o canvas legado."
            />
            <PipelineBuilderV2Client pipeline={pipeline} stages={stagesResponse.data} />
        </div>
    );
}
