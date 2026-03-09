'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ChannelIntegrationRecord, InboxConversationRecord } from '@/lib/api';
import { cn, formatDate, formatPhone } from '@/lib/utils';

interface ConversationListProps {
    conversations: InboxConversationRecord[];
    channels: ChannelIntegrationRecord[];
    selectedConversationId: string | null;
    channel: string;
    search: string;
    status: string;
}

const channelMeta: Record<InboxConversationRecord['channel'], { label: string; short: string }> = {
    whatsapp: { label: 'WhatsApp', short: 'WA' },
    instagram: { label: 'Instagram', short: 'IG' },
    telegram: { label: 'Telegram', short: 'TG' },
    tiktok: { label: 'TikTok', short: 'TT' },
    messenger: { label: 'Messenger', short: 'MS' },
};

function buildConversationHref(
    conversationId: string,
    currentChannel: string,
    currentSearch: string,
    currentStatus: string
): string {
    const params = new URLSearchParams({
        conversation: conversationId,
    });

    if (currentChannel) {
        params.set('channel', currentChannel);
    }

    if (currentSearch) {
        params.set('q', currentSearch);
    }

    if (currentStatus) {
        params.set('status', currentStatus);
    }

    return `/inbox?${params.toString()}`;
}

function buildFilterHref(
    selectedChannel: string,
    currentSearch: string,
    currentStatus: string
): string {
    const params = new URLSearchParams();

    if (selectedChannel) {
        params.set('channel', selectedChannel);
    }

    if (currentSearch) {
        params.set('q', currentSearch);
    }

    if (currentStatus) {
        params.set('status', currentStatus);
    }

    const query = params.toString();
    return query ? `/inbox?${query}` : '/inbox';
}

export function ConversationList({
    conversations,
    channels,
    selectedConversationId,
    channel,
    search,
    status,
}: ConversationListProps) {
    return (
        <Card
            title="Conversas"
            description="Fila multicanal com atualização em tempo real por eventos do inbox."
            className="h-full"
        >
            <div className="mb-4 flex flex-wrap gap-2">
                <Link
                    href={buildFilterHref('', search, status)}
                    className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition',
                        channel
                            ? 'border-canvas-border bg-white text-gray-600 hover:border-brand-gold hover:text-gray-900'
                            : 'border-brand-gold bg-brand-gold/10 text-brand-gold-dark'
                    )}
                >
                    Todos
                </Link>
                {channels.map((item) => (
                    <Link
                        key={item.channel}
                        href={buildFilterHref(item.channel, search, status)}
                        className={cn(
                            'rounded-full border px-3 py-1 text-xs font-medium transition',
                            channel === item.channel
                                ? 'border-brand-gold bg-brand-gold/10 text-brand-gold-dark'
                                : 'border-canvas-border bg-white text-gray-600 hover:border-brand-gold hover:text-gray-900',
                            !item.is_active && 'opacity-60'
                        )}
                        title={item.is_active ? `${channelMeta[item.channel].label} ativo` : `${channelMeta[item.channel].label} visível, integração pendente`}
                    >
                        {channelMeta[item.channel].short}
                    </Link>
                ))}
            </div>

            <form method="get" className="mb-4 grid gap-3">
                {channel ? <input type="hidden" name="channel" value={channel} /> : null}
                <div className="flex flex-wrap gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                        {channel ? `Canal: ${channelMeta[channel as InboxConversationRecord['channel']]?.label ?? channel}` : 'Canal: todos'}
                    </span>
                </div>
                <Input
                    name="q"
                    placeholder="Buscar por nome ou WhatsApp"
                    defaultValue={search}
                />
                <select
                    name="status"
                    defaultValue={status}
                    className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                >
                    <option value="">Todos os status</option>
                    <option value="BOT">Bot</option>
                    <option value="AGUARDANDO_HUMANO">Aguardando humano</option>
                    <option value="EM_ATENDIMENTO">Em atendimento</option>
                    <option value="ENCERRADA">Encerrada</option>
                </select>
                <button
                    type="submit"
                    className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-gold hover:text-gray-900"
                >
                    Aplicar filtros
                </button>
            </form>

            <div className="space-y-3">
                {conversations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-canvas-border px-4 py-8 text-center text-sm text-gray-500">
                        Nenhuma conversa encontrada para os filtros atuais.
                    </div>
                ) : (
                    conversations.map((conversation) => {
                        const label = conversation.contact_name
                            ?? conversation.customer?.name
                            ?? conversation.lead?.name
                            ?? formatPhone(conversation.contact_phone ?? conversation.whatsapp_number);

                        return (
                            <Link
                                key={conversation.id}
                                href={buildConversationHref(conversation.id, channel, search, status)}
                                className={cn(
                                    'block rounded-xl border px-4 py-3 transition',
                                    selectedConversationId === conversation.id
                                        ? 'border-brand-gold bg-brand-gold/10 shadow-card'
                                        : 'border-canvas-border bg-white hover:border-brand-gold-light hover:shadow-card-hover'
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-sm font-semibold text-gray-900">{label}</p>
                                            <span className="inline-flex rounded-full border border-canvas-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">
                                                {channelMeta[conversation.channel].short}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {conversation.contact_handle
                                                ? `@${conversation.contact_handle}`
                                                : formatPhone(conversation.contact_phone ?? conversation.whatsapp_number)}
                                        </p>
                                    </div>
                                    <StatusBadge status={conversation.status} />
                                </div>

                                <p className="mt-3 line-clamp-2 text-sm text-gray-600">
                                    {conversation.last_message_preview ?? 'Sem mensagens registradas ainda.'}
                                </p>

                                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-gray-500">
                                    <span>{conversation.assigned_to?.name ?? 'Livre'}</span>
                                    <span>{formatDate(conversation.last_message_at)}</span>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </Card>
    );
}
