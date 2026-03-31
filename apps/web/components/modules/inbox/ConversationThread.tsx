'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, MoreHorizontal, Phone, Repeat2, Workflow } from 'lucide-react';
import {
    assignConversationAction,
    closeConversationAction,
    handoffConversationAction,
    markConversationReadAction,
    saveConversationNoteAction,
} from '@/app/(crm)/inbox/actions';
import type { AdminUser } from '@/lib/ajustes-types';
import type { InboxConversationResponse, QuickReplyRecord } from '@/lib/api';
import { cn, formatPhone, ORION_TIME_ZONE } from '@/lib/utils';
import { InboxComposer } from './InboxComposer';
import { MessageBubble } from './MessageBubble';

interface CurrentUserView {
    id: string;
    role: string;
    name: string;
}

interface ConversationThreadProps {
    thread: InboxConversationResponse;
    currentUser: CurrentUserView;
    quickReplies: QuickReplyRecord[];
    attendants: AdminUser[];
    initialNote?: string | null;
}

const channelLabel: Record<InboxConversationResponse['conversation']['channel'], string> = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    telegram: 'Telegram',
    tiktok: 'TikTok',
    messenger: 'Messenger',
};

function getInitials(label: string): string {
    return label
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

function formatTime(value: string | null): string {
    if (!value) {
        return '--:--';
    }

    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: ORION_TIME_ZONE,
    }).format(new Date(value));
}

function formatDateDivider(value: string): string {
    const date = new Date(value);
    const today = new Date();

    const formatter = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        timeZone: ORION_TIME_ZONE,
    });

    const currentDate = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: ORION_TIME_ZONE,
    });

    if (currentDate.format(date) === currentDate.format(today)) {
        return `Hoje, ${formatter.format(date)}`;
    }

    return formatter.format(date);
}

function formatElapsedMinutes(value: string | null): string | null {
    if (!value) {
        return null;
    }

    const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));

    if (diffMinutes < 60) {
        return `${diffMinutes}min`;
    }

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
}

function mapRoleLabel(role: AdminUser['role']): string {
    switch (role) {
        case 'ADMIN':
            return 'Admin';
        case 'ATENDENTE':
            return 'Atendente';
        case 'PRODUCAO':
            return 'Produção';
        case 'FINANCEIRO':
            return 'Financeiro';
        default:
            return role;
    }
}

export function ConversationThread({
    thread,
    currentUser,
    quickReplies,
    attendants,
    initialNote,
}: ConversationThreadProps) {
    const [hasMounted, setHasMounted] = useState(false);
    const [note, setNote] = useState(initialNote ?? '');
    const [noteSaving, setNoteSaving] = useState(false);
    const noteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Mark as read on mount
    useEffect(() => {
        if (thread.conversation.unread_count > 0) {
            void markConversationReadAction(thread.conversation.id);
        }
    }, [thread.conversation.id, thread.conversation.unread_count]);

    const handleNoteChange = useCallback((value: string) => {
        setNote(value);

        if (noteDebounceRef.current) {
            clearTimeout(noteDebounceRef.current);
        }

        noteDebounceRef.current = setTimeout(() => {
            setNoteSaving(true);
            void saveConversationNoteAction(thread.conversation.id, value).finally(() => {
                setNoteSaving(false);
            });
        }, 800);
    }, [thread.conversation.id]);

    const displayName = thread.conversation.contact_name
        ?? thread.conversation.customer?.name
        ?? thread.conversation.lead?.name
        ?? formatPhone(thread.conversation.contact_phone ?? thread.conversation.whatsapp_number);

    const groupedMessages = useMemo(() => {
        const groups: Array<{ label: string; items: typeof thread.messages }> = [];

        thread.messages.forEach((message) => {
            const label = formatDateDivider(message.created_at);
            const group = groups[groups.length - 1];

            if (group && group.label === label) {
                group.items.push(message);
                return;
            }

            groups.push({
                label,
                items: [message],
            });
        });

        return groups;
    }, [thread.messages]);

    const canAssign = currentUser.role === 'ADMIN'
        || !thread.conversation.assigned_to
        || thread.conversation.assigned_to.id !== currentUser.id;

    const attendantsSnapshot = useMemo(() => {
        if (attendants.length === 0) {
            return [];
        }

        return [...attendants]
            .sort((left, right) => {
                if (left.id === currentUser.id) {
                    return -1;
                }

                if (right.id === currentUser.id) {
                    return 1;
                }

                if (left.id === thread.conversation.assigned_to?.id) {
                    return -1;
                }

                if (right.id === thread.conversation.assigned_to?.id) {
                    return 1;
                }

                if (left.status === 'active' && right.status !== 'active') {
                    return -1;
                }

                if (left.status !== 'active' && right.status === 'active') {
                    return 1;
                }

                return left.name.localeCompare(right.name, 'pt-BR');
            })
            .slice(0, 4);
    }, [attendants, currentUser.id, thread.conversation.assigned_to?.id]);

    if (!hasMounted) {
        return (
            <section className="flex h-full flex-col rounded-[22px] border border-white/5 bg-[linear-gradient(180deg,#111114_0%,#0f0f12_100%)] shadow-card">
                <div className="h-16 border-b border-white/5 bg-white/5" />
                <div className="grid flex-1 xl:grid-cols-[minmax(0,1fr)_248px]">
                    <div className="p-4">
                        <div className="h-full rounded-2xl bg-white/5" />
                    </div>
                    <div className="border-l border-white/5 p-4">
                        <div className="space-y-3">
                            <div className="h-20 rounded-xl bg-white/5" />
                            <div className="h-20 rounded-xl bg-white/5" />
                            <div className="h-32 rounded-xl bg-white/5" />
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="flex h-full flex-col overflow-hidden rounded-[22px] border border-white/5 bg-[linear-gradient(180deg,#111114_0%,#0f0f12_100%)] shadow-card">
            <div className="grid flex-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_248px]">
                <div className="flex h-full flex-col overflow-hidden">
                    <header className="flex h-[58px] items-center gap-3 border-b border-white/5 px-5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2a1f0e,#3d2e16)] text-[13px] font-bold text-brand-gold">
                            {getInitials(displayName)}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-bold text-[color:var(--orion-text)]">{displayName}</div>
                            <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                {thread.conversation.status === 'ENCERRADA' ? 'conversa encerrada' : 'online agora'}
                            </div>
                        </div>

                        {thread.conversation.pipeline || thread.conversation.stage ? (
                            <div className="hidden items-center gap-2 rounded-md border border-brand-gold/20 bg-brand-gold/10 px-3 py-1.5 text-[10px] font-semibold text-[color:var(--orion-gold-dark)] lg:flex">
                                <Workflow className="h-3.5 w-3.5" />
                                <span>
                                    {thread.conversation.stage?.name ?? 'Sem etapa'}
                                    {thread.conversation.pipeline ? ` · ${thread.conversation.pipeline.name}` : ''}
                                </span>
                            </div>
                        ) : null}

                        <div className="flex items-center gap-3 text-[color:var(--orion-text-secondary)]">
                            <button type="button" className="transition hover:text-brand-gold" aria-label="Contato">
                                <Phone className="h-4 w-4" />
                            </button>
                            <button type="button" className="transition hover:text-brand-gold" aria-label="Mais opções">
                                <MoreHorizontal className="h-4 w-4" />
                            </button>
                        </div>
                    </header>

                    {!thread.conversation.assigned_to ? (
                        <div className="flex items-center justify-between gap-3 border-b border-brand-gold/10 bg-[linear-gradient(90deg,rgba(191,160,106,0.08),rgba(191,160,106,0.03))] px-5 py-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-gold/20 bg-brand-gold/10 text-brand-gold">
                                    <Workflow className="h-4 w-4" />
                                </div>
                                <div className="text-[12px] text-[color:var(--orion-text-secondary)]">
                                    <strong className="font-semibold text-[color:var(--orion-text)]">Conversa na fila aberta.</strong> Assuma para responder por aqui.
                                </div>
                            </div>

                            {canAssign ? (
                                <form action={assignConversationAction}>
                                    <input type="hidden" name="conversation_id" value={thread.conversation.id} />
                                    <button
                                        type="submit"
                                        className="inline-flex h-8 items-center gap-2 rounded-md bg-brand-gold px-4 text-[12px] font-bold text-black transition hover:bg-brand-gold-light"
                                    >
                                        Assumir
                                    </button>
                                </form>
                            ) : null}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3 border-b border-emerald-500/10 bg-emerald-500/5 px-5 py-2.5">
                            <div className="flex items-center gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[9px] font-black text-emerald-300">
                                        {getInitials(thread.conversation.assigned_to.name)}
                                    </span>
                                    <span className="text-[11px] font-semibold text-emerald-300">{thread.conversation.assigned_to.name}</span>
                                </div>
                                <span className="text-[10px] text-[color:var(--orion-text-secondary)]">
                                    assumiu às {formatTime(thread.conversation.assigned_at)}{formatElapsedMinutes(thread.conversation.assigned_at) ? ` · ${formatElapsedMinutes(thread.conversation.assigned_at)}` : ''}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <form action={handoffConversationAction}>
                                    <input type="hidden" name="conversation_id" value={thread.conversation.id} />
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-2 text-[11px] font-semibold text-[color:var(--orion-text-secondary)] transition hover:text-brand-gold"
                                    >
                                        <Repeat2 className="h-3.5 w-3.5" />
                                        Transferir
                                    </button>
                                </form>

                                <form action={closeConversationAction}>
                                    <input type="hidden" name="conversation_id" value={thread.conversation.id} />
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-2 text-[11px] font-semibold text-[color:var(--orion-text-secondary)] transition hover:text-brand-gold"
                                    >
                                        Encerrar
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {groupedMessages.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-white/10 bg-[color:var(--orion-base)] px-4 py-8 text-center text-sm text-[color:var(--orion-text-secondary)]">
                                    Ainda não há histórico salvo para esta conversa.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {groupedMessages.map((group) => (
                                        <div key={group.label}>
                                            <div className="mb-4 text-center">
                                                <span className="inline-flex rounded-full border border-white/10 bg-[color:var(--orion-elevated)] px-3 py-1 text-[10px] font-semibold text-[color:var(--orion-text-secondary)]">
                                                    {group.label}
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-3">
                                                {group.items.map((message) => (
                                                    <MessageBubble key={message.id} message={message} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <InboxComposer
                            conversationId={thread.conversation.id}
                            quickReplies={quickReplies}
                            conversationChannel={thread.conversation.channel}
                            contactName={displayName}
                        />
                    </div>
                </div>

                <aside className="overflow-y-auto border-t border-white/5 px-4 py-4 xl:border-l xl:border-t-0">
                    <div className="space-y-5">
                        <section>
                            <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-muted)]">
                                Cliente
                            </div>
                            <div className="text-[14px] font-bold text-[color:var(--orion-text)]">{displayName}</div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-[color:var(--orion-text-secondary)]">
                                <Phone className="h-3.5 w-3.5" />
                                {formatPhone(thread.conversation.contact_phone ?? thread.conversation.whatsapp_number)}
                            </div>
                        </section>

                        <div className="h-px bg-white/5" />

                        <section>
                            <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-muted)]">
                                Pipeline
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border border-brand-gold/20 bg-brand-gold/10 px-3 py-2">
                                <span className="h-2 w-2 rounded-full bg-brand-gold" />
                                <span className="flex-1 text-[11px] font-semibold text-brand-gold">
                                    {thread.conversation.stage?.name ?? 'Sem etapa'}
                                </span>
                                <ChevronRight className="h-3.5 w-3.5 text-[color:var(--orion-text-secondary)]" />
                            </div>
                            {thread.conversation.pipeline ? (
                                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--orion-text-secondary)]">
                                    {thread.conversation.pipeline.name}
                                </p>
                            ) : null}
                        </section>

                        <div className="h-px bg-white/5" />

                        <section>
                            <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-muted)]">
                                Conversa
                            </div>
                            <div className="space-y-2 text-[11px]">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[color:var(--orion-text-secondary)]">Iniciada</span>
                                    <span className="font-semibold text-[color:var(--orion-text)]">
                                        {formatTime(thread.messages[0]?.created_at ?? thread.conversation.last_message_at)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[color:var(--orion-text-secondary)]">Atendente</span>
                                    <span className={cn(
                                        'font-semibold',
                                        thread.conversation.assigned_to ? 'text-emerald-300' : 'text-[color:var(--orion-text)]'
                                    )}>
                                        {thread.conversation.assigned_to?.name ?? 'Fila aberta'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[color:var(--orion-text-secondary)]">Mensagens</span>
                                    <span className="font-semibold text-[color:var(--orion-text)]">{thread.messages.length}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[color:var(--orion-text-secondary)]">Canal</span>
                                    <span className="font-semibold text-[color:var(--orion-text)]">
                                        {channelLabel[thread.conversation.channel]}
                                    </span>
                                </div>
                            </div>
                        </section>

                        {attendantsSnapshot.length > 0 ? (
                            <>
                                <div className="h-px bg-white/5" />

                                <section>
                                    <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-muted)]">
                                        Atendentes online
                                    </div>
                                    <div className="space-y-2">
                                        {attendantsSnapshot.map((attendant) => {
                                            const isCurrent = attendant.id === currentUser.id;
                                            const isAssigned = attendant.id === thread.conversation.assigned_to?.id;
                                            const isActive = attendant.status === 'active';

                                            return (
                                                <div
                                                    key={attendant.id}
                                                    className={cn(
                                                        'flex items-center gap-2 rounded-lg border border-white/10 bg-[color:var(--orion-elevated)] px-2.5 py-2',
                                                        !isActive && 'opacity-40'
                                                    )}
                                                >
                                                    <div className={cn(
                                                        'flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-black',
                                                        isCurrent && 'bg-emerald-500/15 text-emerald-300',
                                                        !isCurrent && isAssigned && 'bg-sky-500/15 text-sky-300',
                                                        !isCurrent && !isAssigned && 'bg-white/10 text-[color:var(--orion-text-secondary)]'
                                                    )}>
                                                        {getInitials(attendant.name)}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-[11px] font-semibold text-[color:var(--orion-text)]">{attendant.name}</div>
                                                        <div className="text-[10px] text-[color:var(--orion-text-secondary)]">
                                                            {isCurrent ? 'Você' : isAssigned ? 'Atendendo esta conversa' : isActive ? mapRoleLabel(attendant.role) : 'offline'}
                                                        </div>
                                                    </div>
                                                    <span className={cn(
                                                        'h-2 w-2 rounded-full',
                                                        isCurrent && 'bg-emerald-400',
                                                        !isCurrent && isAssigned && 'bg-amber-400',
                                                        !isCurrent && !isAssigned && isActive && 'bg-amber-400',
                                                        !isActive && 'bg-[color:var(--orion-text-muted)]'
                                                    )} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </>
                        ) : null}

                        <div className="h-px bg-white/5" />

                        <section>
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-muted)]">
                                    Nota interna
                                </div>
                                {noteSaving ? (
                                    <span className="text-[9px] text-[color:var(--orion-text-muted)]">salvando…</span>
                                ) : note.trim().length > 0 ? (
                                    <span className="text-[9px] text-emerald-400">salvo</span>
                                ) : null}
                            </div>
                            <textarea
                                value={note}
                                onChange={(e) => handleNoteChange(e.target.value)}
                                placeholder="Anotação privada sobre este cliente..."
                                className="min-h-[84px] w-full resize-none rounded-lg border border-white/10 bg-[color:var(--orion-elevated)] px-3 py-2 text-[11px] leading-5 text-[color:var(--orion-text-secondary)] outline-none transition placeholder:text-[color:var(--orion-text-muted)] focus:border-brand-gold/30"
                            />
                        </section>
                    </div>
                </aside>
            </div>
        </section>
    );
}
