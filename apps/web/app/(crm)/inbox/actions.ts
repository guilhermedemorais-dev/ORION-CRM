'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const conversationSchema = z.object({
    conversation_id: z.string().uuid(),
});

const sendMessageSchema = conversationSchema.extend({
    text: z.string().trim().min(1).max(4096),
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
        text: formData.get('text'),
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
