import { notFound, redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import type { ApiListResponse, PipelineRecord } from '@/lib/api';

export default async function LeadsPage() {
    const payload = await apiRequest<ApiListResponse<PipelineRecord> & { meta: { total: number } }>('/pipelines');
    const targetPipeline =
        payload.data.find((pipeline) => pipeline.slug === 'leads') ??
        payload.data.find((pipeline) => pipeline.is_default) ??
        payload.data[0];

    if (!targetPipeline) {
        notFound();
    }

    redirect(`/pipeline/${targetPipeline.slug}`);
}
