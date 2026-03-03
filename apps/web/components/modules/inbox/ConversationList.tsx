'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { InboxConversationRecord } from '@/lib/api';
import { cn, formatDate, formatPhone } from '@/lib/utils';

interface ConversationListProps {
    conversations: InboxConversationRecord[];
    selectedConversationId: string | null;
    search: string;
    status: string;
}

function buildConversationHref(
    conversationId: string,
    currentSearch: string,
    currentStatus: string
): string {
    const params = new URLSearchParams({
        conversation: conversationId,
    });

    if (currentSearch) {
        params.set('q', currentSearch);
    }

    if (currentStatus) {
        params.set('status', currentStatus);
    }

    return `/inbox?${params.toString()}`;
}

export function ConversationList({
    conversations,
    selectedConversationId,
    search,
    status,
}: ConversationListProps) {
    const router = useRouter();

    useEffect(() => {
        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                router.refresh();
            }
        }, 3000);

        return () => window.clearInterval(interval);
    }, [router]);

    return (
        <Card
            title="Conversas"
            description="Fila operacional do WhatsApp com atualização automática a cada 3 segundos."
            className="h-full"
        >
            <form method="get" className="mb-4 grid gap-3">
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
                        const label = conversation.customer?.name
                            ?? conversation.lead?.name
                            ?? formatPhone(conversation.whatsapp_number);

                        return (
                            <Link
                                key={conversation.id}
                                href={buildConversationHref(conversation.id, search, status)}
                                className={cn(
                                    'block rounded-xl border px-4 py-3 transition',
                                    selectedConversationId === conversation.id
                                        ? 'border-brand-gold bg-brand-gold/10 shadow-card'
                                        : 'border-canvas-border bg-white hover:border-brand-gold-light hover:shadow-card-hover'
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-gray-900">{label}</p>
                                        <p className="mt-1 text-xs text-gray-500">{formatPhone(conversation.whatsapp_number)}</p>
                                    </div>
                                    <StatusBadge status={conversation.status} />
                                </div>

                                <p className="mt-3 line-clamp-2 text-sm text-gray-600">
                                    {conversation.last_message_preview ?? 'Sem mensagens registradas ainda.'}
                                </p>

                                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-gray-500">
                                    <span>{conversation.assigned_to?.name ?? 'Fila aberta'}</span>
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
