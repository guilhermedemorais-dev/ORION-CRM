import { notFound } from 'next/navigation';
import { LeadDetailClient } from '@/components/modules/leads/LeadDetailClient';
import type { LeadRecord, PipelineStageRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';

interface TaskRecord {
    id: string;
    title: string;
    due_date: string | null;
    done: boolean;
    done_at: string | null;
    assigned_to: string | null;
    created_by: string;
    created_at: string;
}

interface AttachmentRecord {
    id: string;
    filename: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    created_at: string;
}

interface TimelineRecord {
    id: string;
    source: 'timeline' | 'whatsapp';
    type: string;
    title: string;
    body: string | null;
    created_at: string;
}

interface CustomFieldRecord {
    id: string;
    name: string;
    field_key: string;
    field_type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
    required: boolean;
    position: number;
}

export default async function LeadDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const lead = await apiRequest<LeadRecord>(`/leads/${params.id}`).catch(() => null);
    if (!lead) {
        notFound();
    }

    const [tasks, attachments, timeline, stages, customFields] = await Promise.all([
        apiRequest<{ data: TaskRecord[] }>(`/leads/${params.id}/tasks`).catch(() => ({ data: [] })),
        apiRequest<{ data: AttachmentRecord[] }>(`/leads/${params.id}/attachments`).catch(() => ({ data: [] })),
        apiRequest<{ data: TimelineRecord[] }>(`/leads/${params.id}/timeline?limit=40`).catch(() => ({ data: [] })),
        apiRequest<{ data: PipelineStageRecord[] }>('/pipeline/stages').catch(() => ({ data: [] })),
        apiRequest<{ data: CustomFieldRecord[] }>('/pipeline/custom-fields').catch(() => ({ data: [] })),
    ]);

    return (
        <LeadDetailClient
            initialLead={lead}
            tasks={tasks.data}
            attachments={attachments.data}
            timeline={timeline.data}
            stages={stages.data}
            customFields={customFields.data}
        />
    );
}
