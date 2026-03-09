'use client';

import { useMemo, useRef, useState } from 'react';
import { sendInboxMessageAction } from '@/app/(crm)/inbox/actions';
import { Button } from '@/components/ui/Button';
import type { QuickReplyRecord } from '@/lib/api';
import { cn } from '@/lib/utils';

interface InboxComposerProps {
    conversationId: string;
    conversationChannel: 'whatsapp' | 'instagram' | 'telegram' | 'tiktok' | 'messenger';
    contactName: string;
    quickReplies: QuickReplyRecord[];
}

export function InboxComposer({
    conversationId,
    conversationChannel,
    contactName,
    quickReplies,
}: InboxComposerProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [text, setText] = useState('');
    const [kind, setKind] = useState<'TEXT' | 'IDENTIFICATION'>('TEXT');
    const [quickReplyId, setQuickReplyId] = useState('');
    const [query, setQuery] = useState('');
    const [trayOpen, setTrayOpen] = useState(false);

    const filteredReplies = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) {
            return quickReplies;
        }

        return quickReplies.filter((reply) =>
            [reply.title, reply.body, reply.category ?? '']
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery)
        );
    }, [query, quickReplies]);

    const sendEnabled = conversationChannel === 'whatsapp';

    return (
        <form ref={formRef} action={sendInboxMessageAction} className="border-t border-canvas-border pt-4">
            <input type="hidden" name="conversation_id" value={conversationId} />
            <input type="hidden" name="kind" value={kind} />
            {quickReplyId ? <input type="hidden" name="quick_reply_id" value={quickReplyId} /> : null}

            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setTrayOpen((current) => !current)}
                        className="rounded-full border border-canvas-border bg-white px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-brand-gold hover:text-gray-900"
                    >
                        Prontas
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setKind('IDENTIFICATION');
                            setQuickReplyId('');
                            formRef.current?.requestSubmit();
                        }}
                        disabled={!sendEnabled}
                        className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-xs font-medium text-brand-gold-dark transition hover:border-brand-gold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Identificar atendimento
                    </button>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                        {sendEnabled ? `Responder como atendimento de ${contactName}` : `Canal ${conversationChannel} em leitura operacional`}
                    </span>
                </div>

                {trayOpen ? (
                    <div className="rounded-2xl border border-canvas-border bg-white/80 p-3">
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar mensagem pronta"
                            className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                        />
                        <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto">
                            {filteredReplies.length === 0 ? (
                                <p className="rounded-md border border-dashed border-canvas-border px-3 py-4 text-sm text-gray-500">
                                    Nenhuma mensagem pronta encontrada.
                                </p>
                            ) : (
                                filteredReplies.map((reply) => (
                                    <button
                                        key={reply.id}
                                        type="button"
                                        onClick={() => {
                                            setText(reply.body);
                                            setKind('TEXT');
                                            setQuickReplyId(reply.id);
                                            setTrayOpen(false);
                                        }}
                                        className="rounded-xl border border-canvas-border bg-white px-3 py-3 text-left transition hover:border-brand-gold hover:shadow-card"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <strong className="text-sm text-gray-900">{reply.title}</strong>
                                            {reply.category ? (
                                                <span className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{reply.category}</span>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{reply.body}</p>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                ) : null}

                <div className="rounded-2xl border border-canvas-border bg-white p-3 shadow-sm">
                    <textarea
                        name="text"
                        rows={3}
                        value={text}
                        onChange={(event) => {
                            setKind('TEXT');
                            setText(event.target.value);
                        }}
                        placeholder={sendEnabled ? 'Digite a resposta para o cliente...' : 'Este canal ainda está em modo leitura.'}
                        disabled={!sendEnabled}
                        className="w-full resize-none border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:text-gray-400"
                    />

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-canvas-border pt-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-gray-500">
                            <span>{sendEnabled ? 'Texto livre + prontas + identificação' : 'Envio pendente para este canal'}</span>
                            {quickReplyId ? (
                                <button
                                    type="button"
                                    onClick={() => setQuickReplyId('')}
                                    className="rounded-full border border-canvas-border px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-gray-600 transition hover:border-brand-gold hover:text-gray-900"
                                >
                                    pronta selecionada
                                </button>
                            ) : null}
                        </div>
                        <Button
                            type="submit"
                            disabled={!sendEnabled || text.trim().length === 0}
                            onClick={() => setKind('TEXT')}
                            className={cn(!sendEnabled && 'pointer-events-none')}
                        >
                            Enviar
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
}
