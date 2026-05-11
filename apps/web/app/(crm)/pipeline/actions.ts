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

export async function createPipelineAction(formData: FormData) {
    const parsed = createPipelineSchema.safeParse({
        name: formData.get('name'),
        slug: formData.get('slug') || undefined,
        description: formData.get('description') || undefined,
        icon: formData.get('icon') || undefined,
    });

    if (!parsed.success) {
        redirect('/pipeline/leads?config=1&error=Verifique%20os%20dados%20do%20pipeline.');
    }

    try {
        const pipeline = await apiRequest<{ slug: string }>('/pipelines', {
            method: 'POST',
            body: JSON.stringify(parsed.data),
        });

        revalidatePath('/leads');
        redirect(`/pipeline/${pipeline.slug}?config=1`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao criar pipeline.';
        redirect(`/pipeline/leads?config=1&error=${encodeURIComponent(message)}`);
    }
}
