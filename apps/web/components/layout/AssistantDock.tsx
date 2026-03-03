'use client';

import { useMemo, useState } from 'react';
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
}

function createMessage(role: ChatMessage['role'], content: string, toolsUsed?: string[]): ChatMessage {
    return {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        toolsUsed,
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

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const message = input.trim();
        if (!message || isSubmitting) {
            return;
        }

        setInput('');
        setIsSubmitting(true);
        setMessages((current) => [...current, createMessage('user', message)]);

        try {
            const response = await fetch('/internal/assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
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

            setMessages((current) => [...current, createMessage('assistant', content, toolsUsed)]);
        } catch {
            setMessages((current) => [
                ...current,
                createMessage('assistant', 'Falha de comunicação com o assistente. Tente novamente.'),
            ]);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-gold text-surface-sidebar shadow-card transition hover:bg-brand-gold-dark"
                aria-label={open ? 'Fechar assistente' : 'Abrir assistente'}
            >
                {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </button>

            <aside
                className={cn(
                    'fixed bottom-24 right-6 z-40 flex w-[min(420px,calc(100vw-3rem))] flex-col rounded-2xl border border-canvas-border bg-white shadow-2xl transition-all',
                    open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
                )}
            >
                <header className="border-b border-canvas-border px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Assistente ORION</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-500">{helperText}</p>
                        </div>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : null}
                    </div>
                </header>

                <div className="max-h-[420px] min-h-[320px] space-y-3 overflow-y-auto px-5 py-4">
                    {messages.map((message) => (
                        <article
                            key={message.id}
                            className={cn(
                                'rounded-2xl px-4 py-3 text-sm',
                                message.role === 'assistant'
                                    ? 'mr-8 bg-canvas-card text-gray-800'
                                    : 'ml-8 bg-brand-gold text-surface-sidebar'
                            )}
                        >
                            <p>{message.content}</p>
                            {message.toolsUsed && message.toolsUsed.length > 0 ? (
                                <p className="mt-2 text-[11px] uppercase tracking-[0.16em] opacity-70">
                                    Tools: {message.toolsUsed.join(', ')}
                                </p>
                            ) : null}
                        </article>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="border-t border-canvas-border px-5 py-4">
                    <textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        rows={3}
                        placeholder="Pergunte algo dentro do seu escopo operacional."
                        className="w-full rounded-xl border border-canvas-border bg-white px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">Sem acesso fora das permissões do seu perfil.</p>
                        <Button type="submit" disabled={!canSend}>
                            {isSubmitting ? 'Consultando...' : 'Enviar'}
                        </Button>
                    </div>
                </form>
            </aside>
        </>
    );
}
