'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search, Settings2 } from 'lucide-react';
import type { ChannelIntegrationRecord, InboxConversationRecord } from '@/lib/api';
import { cn, formatPhone, ORION_TIME_ZONE } from '@/lib/utils';

interface ConversationListProps {
    conversations: InboxConversationRecord[];
    channels: ChannelIntegrationRecord[];
    selectedConversationId: string | null;
    channel: string;
    search: string;
    status: string;
    currentUserId: string;
}

const channelMeta: Record<InboxConversationRecord['channel'], { label: string; short: string; accent: string; badge: string }> = {
    whatsapp: { label: 'WhatsApp', short: 'WA', accent: 'text-emerald-300', badge: 'bg-emerald-400 text-black' },
    instagram: { label: 'Instagram', short: 'IG', accent: 'text-pink-300', badge: 'bg-pink-400 text-black' },
    telegram: { label: 'Telegram', short: 'TG', accent: 'text-sky-300', badge: 'bg-sky-400 text-black' },
    tiktok: { label: 'TikTok', short: 'TT', accent: 'text-cyan-300', badge: 'bg-cyan-300 text-black' },
    messenger: { label: 'Messenger', short: 'MS', accent: 'text-indigo-300', badge: 'bg-indigo-300 text-black' },
};

type ViewFilter = 'ALL' | 'UNREAD' | 'MINE' | 'FREE';

function getInitials(label: string): string {
    return label
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

function formatConversationTime(value: string | null): string {
    if (!value) {
        return '--:--';
    }

    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: ORION_TIME_ZONE,
    }).format(new Date(value));
}

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
    currentUserId,
}: ConversationListProps) {
    const [hasMounted, setHasMounted] = useState(false);
    const [viewFilter, setViewFilter] = useState<ViewFilter>('ALL');

    useEffect(() => {
        setHasMounted(true);
    }, []);

    const filteredConversations = useMemo(() => {
        return conversations.filter((conversation) => {
            if (viewFilter === 'UNREAD') {
                return conversation.unread_count > 0;
            }

            if (viewFilter === 'MINE') {
                return conversation.assigned_to?.id === currentUserId;
            }

            if (viewFilter === 'FREE') {
                return !conversation.assigned_to;
            }

            return true;
        });
    }, [conversations, currentUserId, viewFilter]);

    const channelCounts = useMemo(() => {
        return conversations.reduce<Record<string, number>>((acc, conversation) => {
            acc[conversation.channel] = (acc[conversation.channel] ?? 0) + 1;
            return acc;
        }, {});
    }, [conversations]);

    const filterTabs: Array<{ key: ViewFilter; label: string }> = [
        { key: 'ALL', label: 'Todos' },
        { key: 'UNREAD', label: 'Não lidos' },
        { key: 'MINE', label: 'Meus' },
        { key: 'FREE', label: 'Livre' },
    ];

    if (!hasMounted) {
        return (
            <section className="flex h-full min-h-[720px] flex-col overflow-hidden rounded-[22px] border border-white/5 bg-[linear-gradient(180deg,#111114_0%,#0f0f12_100%)] shadow-card">
                <div className="border-b border-white/5 px-4 py-4">
                    <div className="mb-4 h-7 w-32 rounded-full bg-white/5" />
                    <div className="mb-3 h-9 rounded-lg bg-white/5" />
                    <div className="h-9 rounded-lg bg-white/5" />
                </div>
                <div className="space-y-2 px-3 py-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={`inbox-skeleton-${index}`} className="h-[76px] rounded-xl bg-white/5" />
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section className="flex h-full min-h-[720px] flex-col overflow-hidden rounded-[22px] border border-white/5 bg-[linear-gradient(180deg,#111114_0%,#0f0f12_100%)] shadow-card">
            <div className="border-b border-white/5 px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="font-serif text-[1.1rem] font-semibold text-[color:var(--orion-text)]">Inbox</h2>
                    <button
                        type="button"
                        className="text-[color:var(--orion-text-secondary)] transition hover:text-brand-gold"
                        aria-label="Configurar inbox"
                    >
                        <Settings2 className="h-4 w-4" />
                    </button>
                </div>

                <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
                    <Link
                        href={buildFilterHref('', search, status)}
                        className={cn(
                            'inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold uppercase tracking-[0.14em] transition',
                            channel
                                ? 'border-white/10 bg-[color:var(--orion-base)] text-[color:var(--orion-text-secondary)] hover:border-brand-gold/30 hover:text-brand-gold'
                                : 'border-brand-gold/30 bg-brand-gold/10 text-brand-gold'
                        )}
                    >
                        Todos
                    </Link>

                    <div className="h-4 w-px shrink-0 bg-white/10" />

                    {channels.map((item) => (
                        <Link
                            key={item.channel}
                            href={buildFilterHref(item.channel, search, status)}
                            className={cn(
                                'relative inline-flex h-8 shrink-0 items-center justify-center rounded-lg border px-3 text-[10px] font-bold uppercase tracking-[0.14em] transition',
                                channel === item.channel
                                    ? 'border-brand-gold/30 bg-[color:var(--orion-elevated)] text-[color:var(--orion-text)]'
                                    : 'border-white/10 bg-[color:var(--orion-base)] text-[color:var(--orion-text-secondary)] hover:border-brand-gold/30 hover:text-brand-gold',
                                !item.is_active && 'opacity-35'
                            )}
                            title={item.is_active ? `${channelMeta[item.channel].label} ativo` : `${channelMeta[item.channel].label} visível, integração pendente`}
                        >
                            <span className={channelMeta[item.channel].accent}>{channelMeta[item.channel].short}</span>
                            <span className={cn('ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-black', channelMeta[item.channel].badge)}>
                                {channelCounts[item.channel] ?? 0}
                            </span>
                        </Link>
                    ))}
                </div>

                <form method="get" className="rounded-lg border border-white/10 bg-[color:var(--orion-elevated)]">
                    {channel ? <input type="hidden" name="channel" value={channel} /> : null}
                    {status ? <input type="hidden" name="status" value={status} /> : null}
                    <label className="flex items-center gap-2 px-3 py-2">
                        <Search className="h-4 w-4 text-[color:var(--orion-text-secondary)]" />
                        <input
                            name="q"
                            defaultValue={search}
                            placeholder="Buscar conversa..."
                            className="w-full border-0 bg-transparent p-0 text-sm text-[color:var(--orion-text)] outline-none placeholder:text-[color:var(--orion-text-muted)]"
                        />
                    </label>
                </form>

                <div className="mt-3 grid grid-cols-4 border-b border-white/5">
                    {filterTabs.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setViewFilter(item.key)}
                            className={cn(
                                'flex h-8 items-center justify-center border-b-2 text-[11px] font-medium transition',
                                viewFilter === item.key
                                    ? 'border-brand-gold text-brand-gold'
                                    : 'border-transparent text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)]'
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
                {filteredConversations.length === 0 ? (
                    <div className="mx-2 rounded-xl border border-dashed border-white/10 bg-[color:var(--orion-base)] px-4 py-8 text-center text-sm text-[color:var(--orion-text-secondary)]">
                        Nenhuma conversa encontrada para os filtros atuais.
                    </div>
                ) : (
                    filteredConversations.map((conversation) => {
                        const label = conversation.contact_name
                            ?? conversation.customer?.name
                            ?? conversation.lead?.name
                            ?? formatPhone(conversation.contact_phone ?? conversation.whatsapp_number);
                        const initials = getInitials(label);

                        return (
                            <Link
                                key={conversation.id}
                                href={buildConversationHref(conversation.id, channel, search, status)}
                                className={cn(
                                    'relative mb-1.5 flex items-start gap-3 rounded-xl px-3 py-3 transition',
                                    selectedConversationId === conversation.id
                                        ? 'bg-[color:var(--orion-elevated)]'
                                        : 'hover:bg-[color:var(--orion-hover)]'
                                )}
                            >
                                {selectedConversationId === conversation.id ? (
                                    <span className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-brand-gold" />
                                ) : null}

                                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2a1f0e,#3d2e16)] text-xs font-bold text-brand-gold">
                                    {initials}
                                    {conversation.assigned_to ? (
                                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--orion-surface)] bg-emerald-400" />
                                    ) : (
                                        <span className={cn('absolute bottom-0 right-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-[color:var(--orion-surface)] text-[8px] font-black', channelMeta[conversation.channel].badge)}>
                                            {channelMeta[conversation.channel].short}
                                        </span>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[color:var(--orion-text)]">{label}</p>
                                            <p className="mt-1 truncate text-[11px] text-[color:var(--orion-text-secondary)]">
                                                {conversation.contact_handle
                                                    ? `@${conversation.contact_handle}`
                                                    : formatPhone(conversation.contact_phone ?? conversation.whatsapp_number)}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                            <span className="text-[10px] text-[color:var(--orion-text-muted)]">
                                                {formatConversationTime(conversation.last_message_at)}
                                            </span>
                                            {conversation.unread_count > 0 ? (
                                                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-gold px-1.5 py-0.5 text-[9px] font-black text-black">
                                                    {conversation.unread_count}
                                                </span>
                                            ) : conversation.assigned_to ? null : (
                                                <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-red-300">
                                                    Livre
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="mt-2 line-clamp-1 text-[12px] text-[color:var(--orion-text-secondary)]">
                                        {conversation.last_message_preview ?? 'Sem mensagens registradas ainda.'}
                                    </p>

                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--orion-text-muted)]">
                                            {conversation.assigned_to?.name ?? 'Sem atendente'}
                                        </span>
                                        <span className={cn(
                                            'text-[10px] font-bold uppercase tracking-[0.14em]',
                                            channelMeta[conversation.channel].accent
                                        )}>
                                            {channelMeta[conversation.channel].label}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </section>
    );
}
