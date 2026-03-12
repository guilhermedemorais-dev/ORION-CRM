'use client';

import { useMemo, useRef, useState } from 'react';
import { Mic, Paperclip, Search, Send, UserRound } from 'lucide-react';
import { sendInboxMessageAction } from '@/app/(crm)/inbox/actions';
import type { QuickReplyRecord } from '@/lib/api';
import { cn } from '@/lib/utils';

interface InboxComposerProps {
    conversationId: string;
    conversationChannel: 'whatsapp' | 'instagram' | 'telegram' | 'tiktok' | 'messenger';
    contactName: string;
    quickReplies: QuickReplyRecord[];
}

function getInitials(label: string): string {
    return label
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
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
        <form ref={formRef} action={sendInboxMessageAction} className="border-t border-white/5">
            <input type="hidden" name="conversation_id" value={conversationId} />
            <input type="hidden" name="kind" value={kind} />
            {quickReplyId ? <input type="hidden" name="quick_reply_id" value={quickReplyId} /> : null}

            <div className={cn(
                'overflow-hidden transition-all duration-300',
                trayOpen ? 'max-h-[280px] border-b border-white/5' : 'max-h-0'
            )}>
                <div className="px-4 py-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-secondary)]">
                            Mensagens prontas
                        </span>
                        <label className="flex h-7 items-center gap-2 rounded-md border border-white/10 bg-[color:var(--orion-base)] px-3">
                            <Search className="h-3 w-3 text-[color:var(--orion-text-secondary)]" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Buscar mensagem..."
                                className="w-28 border-0 bg-transparent p-0 text-[11px] text-[color:var(--orion-text)] outline-none placeholder:text-[color:var(--orion-text-muted)]"
                            />
                        </label>
                    </div>

                    <div className="flex max-h-[190px] flex-col gap-2 overflow-y-auto pr-1">
                        {filteredReplies.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-white/10 bg-[color:var(--orion-base)] px-3 py-4 text-sm text-[color:var(--orion-text-secondary)]">
                                Nenhuma mensagem pronta encontrada.
                            </div>
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
                                    className="rounded-lg border border-white/10 bg-[color:var(--orion-base)] px-3 py-3 text-left transition hover:border-brand-gold/30 hover:bg-[color:var(--orion-elevated)]"
                                >
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-[color:var(--orion-gold-dark)]">{reply.title}</span>
                                        {reply.category ? (
                                            <span className="rounded-full border border-brand-gold/20 bg-brand-gold/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--orion-gold-dark)]">
                                                {reply.category}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="line-clamp-2 text-[12px] leading-5 text-[color:var(--orion-text-secondary)]">{reply.body}</p>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 border-b border-white/5 bg-[linear-gradient(90deg,rgba(191,160,106,0.08),transparent)] px-4 py-2">
                <UserRound className="h-3.5 w-3.5 text-[color:var(--orion-gold-dark)]" />
                <span className="text-[11px] text-[color:var(--orion-text-secondary)]">
                    Enviar minha identificação para o cliente
                </span>
                <button
                    type="button"
                    disabled={!sendEnabled}
                    onClick={() => {
                        setKind('IDENTIFICATION');
                        setQuickReplyId('');
                        formRef.current?.requestSubmit();
                    }}
                    className="inline-flex h-7 items-center gap-2 rounded-md border border-brand-gold/30 bg-[color:var(--orion-base)] px-3 text-[11px] font-bold text-brand-gold transition hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-[8px] font-black text-emerald-300">
                        {getInitials(contactName)}
                    </span>
                    Enviar como ORION
                </button>
            </div>

            <div className="flex items-end gap-3 px-4 py-3">
                <div className="flex items-center gap-2 pb-1">
                    <button
                        type="button"
                        disabled
                        className="text-[color:var(--orion-text-secondary)] opacity-50"
                        aria-label="Anexar arquivo"
                    >
                        <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setTrayOpen((current) => !current)}
                        className={cn(
                            'relative transition',
                            trayOpen ? 'text-brand-gold' : 'text-[color:var(--orion-text-secondary)] hover:text-brand-gold'
                        )}
                        aria-label="Mensagens prontas"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand-gold" />
                    </button>
                </div>

                <textarea
                    name="text"
                    rows={1}
                    value={text}
                    onChange={(event) => {
                        setKind('TEXT');
                        setText(event.target.value);
                    }}
                    placeholder={sendEnabled ? 'Mensagem...' : 'Este canal ainda está em modo leitura.'}
                    disabled={!sendEnabled}
                    className="min-h-[42px] max-h-28 flex-1 resize-none rounded-[10px] border border-white/10 bg-[color:var(--orion-elevated)] px-4 py-2.5 text-[13px] text-[color:var(--orion-text)] outline-none transition placeholder:text-[color:var(--orion-text-muted)] focus:border-brand-gold/30 disabled:cursor-not-allowed disabled:text-[color:var(--orion-text-muted)]"
                />

                <button
                    type="button"
                    disabled
                    className="pb-1 text-[color:var(--orion-text-secondary)] opacity-50"
                    aria-label="Gravar áudio"
                >
                    <Mic className="h-5 w-5" />
                </button>

                <button
                    type="submit"
                    disabled={!sendEnabled || text.trim().length === 0}
                    onClick={() => setKind('TEXT')}
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-brand-gold text-black transition hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Enviar mensagem"
                >
                    <Send className="h-4 w-4" />
                </button>
            </div>
        </form>
    );
}
