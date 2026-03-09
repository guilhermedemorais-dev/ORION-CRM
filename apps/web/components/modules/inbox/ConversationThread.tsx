'use client';

import { assignConversationAction, closeConversationAction } from '@/app/(crm)/inbox/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { InboxConversationResponse, QuickReplyRecord } from '@/lib/api';
import { formatDate, formatPhone } from '@/lib/utils';
import { InboxComposer } from './InboxComposer';
import { MessageBubble } from './MessageBubble';

interface CurrentUserView {
    id: string;
    role: string;
}

interface ConversationThreadProps {
    thread: InboxConversationResponse;
    currentUser: CurrentUserView;
    quickReplies: QuickReplyRecord[];
}

const channelLabel: Record<InboxConversationResponse['conversation']['channel'], string> = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    telegram: 'Telegram',
    tiktok: 'TikTok',
    messenger: 'Messenger',
};

export function ConversationThread({ thread, currentUser, quickReplies }: ConversationThreadProps) {
    const displayName = thread.conversation.contact_name
        ?? thread.conversation.customer?.name
        ?? thread.conversation.lead?.name
        ?? formatPhone(thread.conversation.contact_phone ?? thread.conversation.whatsapp_number);

    const canAssign = currentUser.role === 'ADMIN'
        || !thread.conversation.assigned_to
        || thread.conversation.assigned_to.id !== currentUser.id;

    return (
        <Card className="h-full">
            <header className="flex flex-col gap-4 border-b border-canvas-border pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="truncate text-lg font-semibold text-gray-900">{displayName}</h2>
                        <StatusBadge status={thread.conversation.status} />
                        <span className="inline-flex rounded-full border border-canvas-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">
                            {channelLabel[thread.conversation.channel]}
                        </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-500">
                        {thread.conversation.contact_handle
                            ? `@${thread.conversation.contact_handle}`
                            : formatPhone(thread.conversation.contact_phone ?? thread.conversation.whatsapp_number)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-gray-500">
                        <span>Responsável: {thread.conversation.assigned_to?.name ?? 'Fila aberta'}</span>
                        {thread.conversation.assigned_at ? <span>Assumida em {formatDate(thread.conversation.assigned_at)}</span> : null}
                        {thread.conversation.lead ? <span>Lead vinculado</span> : null}
                        {thread.conversation.customer ? <span>Cliente vinculado</span> : null}
                        {thread.conversation.pipeline ? <span>Pipeline: {thread.conversation.pipeline.name}</span> : null}
                        {thread.conversation.stage ? <span>Etapa: {thread.conversation.stage.name}</span> : null}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {canAssign ? (
                        <form action={assignConversationAction}>
                            <input type="hidden" name="conversation_id" value={thread.conversation.id} />
                            <Button type="submit" variant="secondary">
                                Assumir
                            </Button>
                        </form>
                    ) : null}

                    <form action={closeConversationAction}>
                        <input type="hidden" name="conversation_id" value={thread.conversation.id} />
                        <Button type="submit" variant="ghost">
                            Encerrar
                        </Button>
                    </form>
                </div>
            </header>

            <div className="mt-5 flex max-h-[560px] min-h-[360px] flex-col gap-3 overflow-y-auto pr-1">
                {thread.messages.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-canvas-border px-4 py-8 text-center text-sm text-gray-500">
                        Ainda não há histórico salvo para esta conversa.
                    </div>
                ) : (
                    thread.messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                    ))
                )}
            </div>

            <div className="mt-5">
                <InboxComposer
                    conversationId={thread.conversation.id}
                    quickReplies={quickReplies}
                    conversationChannel={thread.conversation.channel}
                    contactName={displayName}
                />
            </div>
        </Card>
    );
}
