'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface AssistantDockProps {
    userRole: string;
}

interface ChatMessage {
    id: string;
    role: 'assistant' | 'user';
    content: string;
    toolsUsed?: string[];
    usage?: {
        inputTokens: number;
        outputTokens: number;
        latencyMs: number;
    };
}

function createMessage(
    role: ChatMessage['role'],
    content: string,
    toolsUsed?: string[],
    usage?: ChatMessage['usage']
): ChatMessage {
    return {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        toolsUsed,
        usage,
    };
}

function roleSummary(role: string): string {
    if (role === 'ADMIN') return 'escopo executivo completo';
    if (role === 'ATENDENTE') return 'escopo comercial e atendimento';
    if (role === 'PRODUCAO') return 'escopo operacional da produção';
    return 'escopo financeiro e cobranças';
}

export function AssistantDock({ userRole }: AssistantDockProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([
        createMessage(
            'assistant',
            `Assistente ativo no ${roleSummary(userRole)}. Pergunte sobre leads, pedidos, produção ou financeiro conforme sua permissão.`
        ),
    ]);

    const canSend = input.trim().length > 0 && !isSubmitting;
    const helperText = useMemo(
        () => `Escopo atual: ${roleSummary(userRole)}.`,
        [userRole]
    );

    useEffect(() => {
        function handleKeydown(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen((current) => !current);
                return;
            }

            if (event.key === 'Escape') {
                setOpen(false);
            }
        }

        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, []);

    useEffect(() => {
        if (open) {
            textareaRef.current?.focus();
        }
    }, [open]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const message = input.trim();
        if (!message || isSubmitting) {
            return;
        }

        setInput('');
        setIsSubmitting(true);
        const nextHistory = [...messages, createMessage('user', message)];
        setMessages(nextHistory);

        const payloadMessages = nextHistory
            .map((entry) => ({ role: entry.role, content: entry.content }))
            .slice(-20);

        try {
            const response = await fetch('/internal/assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    messages: payloadMessages,
                }),
            });

            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }

            const payload = await response.json().catch(() => null);
            const content = typeof payload?.answer === 'string'
                ? payload.answer
                : typeof payload?.message === 'string'
                    ? payload.message
                    : 'Não foi possível obter resposta do assistente.';
            const toolsUsed = Array.isArray(payload?.tools_used)
                ? payload.tools_used.filter((item: unknown): item is string => typeof item === 'string')
                : undefined;
            const usage = payload?.usage && typeof payload.usage === 'object'
                ? {
                    inputTokens: typeof payload.usage.inputTokens === 'number' ? payload.usage.inputTokens : 0,
                    outputTokens: typeof payload.usage.outputTokens === 'number' ? payload.usage.outputTokens : 0,
                    latencyMs: typeof payload.usage.latencyMs === 'number' ? payload.usage.latencyMs : 0,
                }
                : undefined;

            setMessages((current) => [...current, createMessage('assistant', content, toolsUsed, usage)].slice(-20));
        } catch {
            setMessages((current) => [
                ...current,
                createMessage('assistant', 'Falha de comunicação com o assistente. Tente novamente.'),
            ].slice(-20));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold text-[#0A0A0C] shadow-card transition hover:bg-brand-gold-light"
                aria-label={open ? 'Fechar assistente' : 'Abrir assistente'}
            >
                {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </button>

            <aside
                className={cn(
                    'fixed bottom-24 right-6 z-40 flex w-[min(420px,calc(100vw-3rem))] flex-col rounded-2xl border border-white/10 bg-[color:var(--orion-surface)] shadow-2xl transition-all',
                    open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
                )}
            >
                <header className="border-b border-white/5 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-[color:var(--orion-text)]">Assistente ORION</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--orion-text-secondary)]">{helperText}</p>
                        </div>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin text-[color:var(--orion-text-secondary)]" /> : null}
                    </div>
                </header>

                <div className="max-h-[420px] min-h-[320px] space-y-3 overflow-y-auto px-5 py-4">
                    {messages.map((message) => (
                        <article
                            key={message.id}
                            className={cn(
                                'rounded-2xl px-4 py-3 text-sm',
                                message.role === 'assistant'
                                    ? 'mr-8 border border-white/5 bg-[color:var(--orion-base)] text-[color:var(--orion-text)]'
                                    : 'ml-8 bg-brand-gold text-[#0A0A0C]'
                            )}
                        >
                            <p>{message.content}</p>
                            {message.toolsUsed && message.toolsUsed.length > 0 ? (
                                <p className="mt-2 text-[11px] uppercase tracking-[0.16em] opacity-70">
                                    Tools: {message.toolsUsed.join(', ')}
                                </p>
                            ) : null}
                            {message.usage ? (
                                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] opacity-60">
                                    {message.usage.inputTokens} in · {message.usage.outputTokens} out · {message.usage.latencyMs}ms
                                </p>
                            ) : null}
                        </article>
                    ))}
                    {isSubmitting ? (
                        <article className="mr-8 rounded-2xl border border-white/5 bg-[color:var(--orion-base)] px-4 py-3 text-sm text-[color:var(--orion-text)]">
                            <div className="space-y-2">
                                <div className="h-3 w-32 animate-pulse rounded-full bg-white/10" />
                                <div className="h-3 w-48 animate-pulse rounded-full bg-white/10" />
                            </div>
                        </article>
                    ) : null}
                </div>

                <form onSubmit={handleSubmit} className="border-t border-white/5 px-5 py-4">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        rows={3}
                        placeholder="Pergunte algo dentro do seu escopo operacional."
                        className="w-full rounded-xl border border-white/10 bg-[color:var(--orion-base)] px-3 py-3 text-sm text-[color:var(--orion-text)] outline-none transition placeholder:text-[color:var(--orion-text-muted)] focus:border-brand-gold/40 focus:ring-2 focus:ring-brand-gold/10"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-[color:var(--orion-text-secondary)]">Sem acesso fora das permissões do seu perfil.</p>
                        <Button type="submit" disabled={!canSend}>
                            {isSubmitting ? 'Consultando...' : 'Enviar'}
                        </Button>
                    </div>
                </form>
            </aside>
        </>
    );
}
