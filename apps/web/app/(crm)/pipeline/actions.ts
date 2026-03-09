'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const createPipelineSchema = z.object({
    name: z.string().trim().min(2).max(100),
    slug: z.string().trim().max(100).optional(),
    description: z.string().trim().max(1000).optional(),
    icon: z.string().trim().max(32).optional(),
});

const flowSchema = z.object({
    pipeline_id: z.string().uuid(),
    slug: z.string().trim().min(1),
    flow_json: z.string().trim().min(2),
});

const publishSchema = z.object({
    pipeline_id: z.string().uuid(),
    slug: z.string().trim().min(1),
});

const toggleSchema = z.object({
    pipeline_id: z.string().uuid(),
    slug: z.string().trim().min(1),
    is_active: z.preprocess((value) => value === 'true' || value === true, z.boolean()),
});

function builderErrorPath(slug: string, message: string): string {
    return `/pipeline/${slug}/builder?error=${encodeURIComponent(message)}`;
}

export async function createPipelineAction(formData: FormData) {
    const parsed = createPipelineSchema.safeParse({
        name: formData.get('name'),
        slug: formData.get('slug') || undefined,
        description: formData.get('description') || undefined,
        icon: formData.get('icon') || undefined,
    });

    if (!parsed.success) {
        redirect('/pipeline/novo/builder?error=Verifique%20os%20dados%20do%20pipeline.');
    }

    try {
        const pipeline = await apiRequest<{ slug: string }>('/pipelines', {
            method: 'POST',
            body: JSON.stringify(parsed.data),
        });

        revalidatePath('/pipeline/novo/builder');
        revalidatePath('/leads');
        redirect(`/pipeline/${pipeline.slug}/builder`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao criar pipeline.';
        redirect(`/pipeline/novo/builder?error=${encodeURIComponent(message)}`);
    }
}

export async function savePipelineFlowAction(formData: FormData) {
    const parsed = flowSchema.safeParse({
        pipeline_id: formData.get('pipeline_id'),
        slug: formData.get('slug'),
        flow_json: formData.get('flow_json'),
    });

    if (!parsed.success) {
        redirect(builderErrorPath(String(formData.get('slug') ?? 'leads'), 'Flow inválido.'));
    }

    try {
        const flow = JSON.parse(parsed.data.flow_json) as Record<string, unknown>;
        await apiRequest(`/pipelines/${parsed.data.pipeline_id}/flow`, {
            method: 'PUT',
            body: JSON.stringify({ flow_json: flow }),
        });

        revalidatePath(`/pipeline/${parsed.data.slug}/builder`);
        redirect(`/pipeline/${parsed.data.slug}/builder?saved=1`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao salvar flow.';
        redirect(builderErrorPath(parsed.data.slug, message));
    }
}

export async function publishPipelineAction(formData: FormData) {
    const parsed = publishSchema.safeParse({
        pipeline_id: formData.get('pipeline_id'),
        slug: formData.get('slug'),
    });

    if (!parsed.success) {
        redirect(builderErrorPath(String(formData.get('slug') ?? 'leads'), 'Pipeline inválido para publicação.'));
    }

    try {
        await apiRequest(`/pipelines/${parsed.data.pipeline_id}/publish`, {
            method: 'POST',
        });

        revalidatePath(`/pipeline/${parsed.data.slug}/builder`);
        redirect(`/pipeline/${parsed.data.slug}/builder?published=1`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao publicar pipeline.';
        redirect(builderErrorPath(parsed.data.slug, message));
    }
}

export async function togglePipelineStatusAction(formData: FormData) {
    const parsed = toggleSchema.safeParse({
        pipeline_id: formData.get('pipeline_id'),
        slug: formData.get('slug'),
        is_active: formData.get('is_active'),
    });

    if (!parsed.success) {
        redirect(builderErrorPath(String(formData.get('slug') ?? 'leads'), 'Status inválido para pipeline.'));
    }

    try {
        await apiRequest(`/pipelines/${parsed.data.pipeline_id}/toggle`, {
            method: 'PATCH',
            body: JSON.stringify({ is_active: parsed.data.is_active }),
        });

        revalidatePath(`/pipeline/${parsed.data.slug}/builder`);
        revalidatePath('/leads');
        redirect(`/pipeline/${parsed.data.slug}/builder`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao alterar status do pipeline.';
        redirect(builderErrorPath(parsed.data.slug, message));
    }
}
