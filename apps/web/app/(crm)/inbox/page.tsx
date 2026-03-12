import { ConversationList } from '@/components/modules/inbox/ConversationList';
import { ConversationThread } from '@/components/modules/inbox/ConversationThread';
import { InboxEmptyState } from '@/components/modules/inbox/InboxEmptyState';
import { InboxRealtimeBridge } from '@/components/modules/inbox/InboxRealtimeBridge';
import type {
    ApiListResponse,
    ChannelIntegrationRecord,
    InboxConversationRecord,
    InboxConversationResponse,
    QuickReplyRecord,
} from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import type { AdminUser, AdminUsersResponse } from '@/lib/ajustes-types';

interface InboxSearchParams {
    channel?: InboxConversationRecord['channel'] | '';
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

    if (searchParams?.channel) {
        query.set('channel', searchParams.channel);
    }

    const conversationResponse = await apiRequest<ApiListResponse<InboxConversationRecord>>(
        `/inbox/conversations?${query.toString()}`
    );
    const [channelResponse, quickReplyResponse] = await Promise.all([
        apiRequest<ApiListResponse<ChannelIntegrationRecord>>('/inbox/channels'),
        apiRequest<ApiListResponse<QuickReplyRecord>>('/inbox/quick-replies'),
    ]);
    let attendants: AdminUser[] = [];

    if (session.user.role === 'ADMIN') {
        try {
            const usersPayload = await apiRequest<AdminUsersResponse>('/users');
            attendants = usersPayload.data;
        } catch {
            attendants = [];
        }
    }

    const initialSelectedId = searchParams?.conversation ?? conversationResponse.data[0]?.id ?? null;
    let selectedThread = await fetchSelectedConversation(initialSelectedId);

    if (!selectedThread && conversationResponse.data[0]?.id && conversationResponse.data[0].id !== initialSelectedId) {
        selectedThread = await fetchSelectedConversation(conversationResponse.data[0].id);
    }

    const selectedConversationId = selectedThread?.conversation.id ?? conversationResponse.data[0]?.id ?? null;

    return (
        <div className="min-h-[calc(100vh-7rem)]">
            <InboxRealtimeBridge />

            {searchParams?.error ? (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchParams.error}
                </div>
            ) : null}

            <div className="grid min-h-[calc(100vh-10rem)] gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
                <ConversationList
                    conversations={conversationResponse.data}
                    channels={channelResponse.data}
                    selectedConversationId={selectedConversationId}
                    channel={searchParams?.channel ?? ''}
                    search={searchParams?.q ?? ''}
                    status={searchParams?.status ?? ''}
                    currentUserId={session.user.id}
                />

                {selectedThread ? (
                    <ConversationThread
                        thread={selectedThread}
                        currentUser={session.user}
                        quickReplies={quickReplyResponse.data}
                        attendants={attendants}
                    />
                ) : (
                    <InboxEmptyState />
                )}
            </div>
        </div>
    );
}
