'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const saveNoteSchema = z.object({
    conversation_id: z.string().uuid(),
    note: z.string().max(4000),
});

const conversationSchema = z.object({
    conversation_id: z.string().uuid(),
});

const sendMessageSchema = conversationSchema.extend({
    text: z.string().trim().min(1).max(4096).optional(),
    kind: z.enum(['TEXT', 'IDENTIFICATION']).default('TEXT'),
    quick_reply_id: z.string().uuid().optional(),
});

function buildConversationRedirect(conversationId: string, error?: string): string {
    const params = new URLSearchParams({
        conversation: conversationId,
    });

    if (error) {
        params.set('error', error);
    }

    return `/inbox?${params.toString()}`;
}

export async function sendInboxMessageAction(formData: FormData) {
    const parsed = sendMessageSchema.safeParse({
        conversation_id: formData.get('conversation_id'),
        text: formData.get('text') ?? undefined,
        kind: formData.get('kind') ?? undefined,
        quick_reply_id: formData.get('quick_reply_id') ?? undefined,
    });

    if (!parsed.success) {
        const fallbackConversation = String(formData.get('conversation_id') ?? '');
        redirect(buildConversationRedirect(fallbackConversation, 'Verifique a mensagem antes de enviar.'));
    }

    try {
        await apiRequest(`/inbox/conversations/${parsed.data.conversation_id}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                text: parsed.data.text,
                kind: parsed.data.kind,
                quick_reply_id: parsed.data.quick_reply_id,
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao enviar mensagem.';
        redirect(buildConversationRedirect(parsed.data.conversation_id, message));
    }

    revalidatePath('/inbox');
    redirect(buildConversationRedirect(parsed.data.conversation_id));
}

export async function assignConversationAction(formData: FormData) {
    const parsed = conversationSchema.safeParse({
        conversation_id: formData.get('conversation_id'),
    });

    if (!parsed.success) {
        redirect('/inbox?error=Conversa%20inválida%20para%20assumir.');
    }

    try {
        await apiRequest(`/inbox/conversations/${parsed.data.conversation_id}/assign`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao assumir a conversa.';
        redirect(buildConversationRedirect(parsed.data.conversation_id, message));
    }

    revalidatePath('/inbox');
    redirect(buildConversationRedirect(parsed.data.conversation_id));
}

export async function closeConversationAction(formData: FormData) {
    const parsed = conversationSchema.safeParse({
        conversation_id: formData.get('conversation_id'),
    });

    if (!parsed.success) {
        redirect('/inbox?error=Conversa%20inválida%20para%20encerrar.');
    }

    try {
        await apiRequest(`/inbox/conversations/${parsed.data.conversation_id}/close`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao encerrar a conversa.';
        redirect(buildConversationRedirect(parsed.data.conversation_id, message));
    }

    revalidatePath('/inbox');
    redirect(buildConversationRedirect(parsed.data.conversation_id));
}

export async function handoffConversationAction(formData: FormData) {
    const parsed = conversationSchema.safeParse({
        conversation_id: formData.get('conversation_id'),
    });

    if (!parsed.success) {
        redirect('/inbox?error=Conversa%20inválida%20para%20transferir.');
    }

    try {
        await apiRequest(`/inbox/conversations/${parsed.data.conversation_id}/handoff`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao devolver a conversa para a fila.';
        redirect(buildConversationRedirect(parsed.data.conversation_id, message));
    }

    revalidatePath('/inbox');
    redirect(buildConversationRedirect(parsed.data.conversation_id));
}

export async function saveConversationNoteAction(conversationId: string, note: string): Promise<void> {
    const parsed = saveNoteSchema.safeParse({ conversation_id: conversationId, note });
    if (!parsed.success) {
        return;
    }

    try {
        await apiRequest(`/inbox/conversations/${parsed.data.conversation_id}/note`, {
            method: 'PATCH',
            body: JSON.stringify({ note: parsed.data.note }),
        });
    } catch {
        // fire-and-forget: note save is non-critical
    }
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
    const parsed = z.string().uuid().safeParse(conversationId);
    if (!parsed.success) {
        return;
    }

    try {
        await apiRequest(`/inbox/conversations/${parsed.data}/read`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    } catch {
        // fire-and-forget
    }

    revalidatePath('/inbox');
}
