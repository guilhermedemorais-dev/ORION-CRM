import { ConversationList } from '@/components/modules/inbox/ConversationList';
import { ConversationThread } from '@/components/modules/inbox/ConversationThread';
import { InboxEmptyState } from '@/components/modules/inbox/InboxEmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import type {
    ApiListResponse,
    InboxConversationRecord,
    InboxConversationResponse,
} from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';

interface InboxSearchParams {
    q?: string;
    status?: InboxConversationRecord['status'] | '';
    conversation?: string;
    error?: string;
}

async function fetchSelectedConversation(
    selectedConversationId: string | null
): Promise<InboxConversationResponse | null> {
    if (!selectedConversationId) {
        return null;
    }

    try {
        return await apiRequest<InboxConversationResponse>(`/inbox/conversations/${selectedConversationId}`);
    } catch {
        return null;
    }
}

export default async function InboxPage({
    searchParams,
}: {
    searchParams?: InboxSearchParams;
}) {
    const session = requireSession();
    const query = new URLSearchParams({
        limit: '100',
    });

    if (searchParams?.q) {
        query.set('q', searchParams.q);
    }

    if (searchParams?.status) {
        query.set('status', searchParams.status);
    }

    const conversationResponse = await apiRequest<ApiListResponse<InboxConversationRecord>>(
        `/inbox/conversations?${query.toString()}`
    );

    const initialSelectedId = searchParams?.conversation ?? conversationResponse.data[0]?.id ?? null;
    let selectedThread = await fetchSelectedConversation(initialSelectedId);

    if (!selectedThread && conversationResponse.data[0]?.id && conversationResponse.data[0].id !== initialSelectedId) {
        selectedThread = await fetchSelectedConversation(conversationResponse.data[0].id);
    }

    const selectedConversationId = selectedThread?.conversation.id ?? conversationResponse.data[0]?.id ?? null;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Inbox"
                description="Atendimento operacional do WhatsApp com fila, thread unificada e resposta direta pela Meta Cloud API."
            />

            {searchParams?.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchParams.error}
                </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <ConversationList
                    conversations={conversationResponse.data}
                    selectedConversationId={selectedConversationId}
                    search={searchParams?.q ?? ''}
                    status={searchParams?.status ?? ''}
                />

                {selectedThread ? (
                    <ConversationThread thread={selectedThread} currentUser={session.user} />
                ) : (
                    <InboxEmptyState />
                )}
            </div>
        </div>
    );
}
