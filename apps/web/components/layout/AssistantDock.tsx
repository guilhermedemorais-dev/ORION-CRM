'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, Sparkles, X, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface AssistantDockProps {
    userName: string;
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

const QUICK_PROMPTS = [
    'Resuma os pedidos atrasados',
    'Mostre meu pipeline',
    'Extraia relatórios do dia',
    'Crie um rascunho de e-mail',
];

export function AssistantDock({ userName, userRole }: AssistantDockProps) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const canSend = input.trim().length > 0 && !isSubmitting;

    // Listeners para abrir a sidebar (via botão na Topbar ou Cmd+K)
    useEffect(() => {
        function handleToggle() {
            setOpen((current) => !current);
        }

        function handleKeydown(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') {
                event.preventDefault();
                setOpen((current) => !current);
                return;
            }

            if (event.key === 'Escape') {
                setOpen(false);
            }
        }

        window.addEventListener('toggle-ai-assistant', handleToggle);
        window.addEventListener('keydown', handleKeydown);
        return () => {
            window.removeEventListener('toggle-ai-assistant', handleToggle);
            window.removeEventListener('keydown', handleKeydown);
        };
    }, []);

    // Focar no input quando abrir
    useEffect(() => {
        if (open && activeTab === 'chat') {
            textareaRef.current?.focus();
        }
    }, [open, activeTab]);

    // Scroll para o fim da lista ao receber nova mensagem
    useEffect(() => {
        if (messages.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    async function sendQuery(query: string) {
        if (!query || isSubmitting) return;

        setInput('');
        setIsSubmitting(true);
        const nextHistory = [...messages, createMessage('user', query)];
        setMessages(nextHistory);

        const payloadMessages = nextHistory
            .map((entry) => ({ role: entry.role, content: entry.content }))
            .slice(-20);

        try {
            const response = await fetch('/internal/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: query, messages: payloadMessages }),
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

            setMessages((current) => [...current, createMessage('assistant', content, toolsUsed)].slice(-20));
        } catch {
            setMessages((current) => [
                ...current,
                createMessage('assistant', 'Falha de comunicação com o assistente. Tente novamente.'),
            ].slice(-20));
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        sendQuery(input.trim());
    }

    return (
        <aside
            className={cn(
                'fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[420px] flex-col border-l border-white/5 bg-[color:var(--orion-surface)] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                open ? 'translate-x-0' : 'translate-x-full'
            )}
        >
            {/* Header / Tabs */}
            <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                <div className="flex items-center gap-1 rounded-full bg-white/5 p-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab('chat')}
                        className={cn(
                            'rounded-full px-4 py-1.5 text-sm font-medium transition',
                            activeTab === 'chat'
                                ? 'bg-white text-black'
                                : 'text-[color:var(--orion-text-secondary)] hover:text-white'
                        )}
                    >
                        Chat
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={cn(
                            'rounded-full px-4 py-1.5 text-sm font-medium transition',
                            activeTab === 'history'
                                ? 'bg-white text-black'
                                : 'text-[color:var(--orion-text-secondary)] hover:text-white'
                        )}
                    >
                        Histórico
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </header>

            {/* Content Area */}
            <div className="relative flex flex-1 flex-col overflow-y-auto px-6 pb-32 pt-6">
                {activeTab === 'history' ? (
                    <div className="flex flex-1 items-center justify-center text-center">
                        <div>
                            <p className="font-medium text-[color:var(--orion-text)]">Histórico indísponível</p>
                            <p className="mt-1 text-sm text-[color:var(--orion-text-secondary)]">O histórico de conversas será habilitado na próxima atualização.</p>
                        </div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col h-full mt-10">
                        {/* Welcome State */}
                        <div className="text-center mb-10">
                            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center text-brand-gold">
                                <Sparkles className="h-12 w-12" />
                            </div>
                            <h2 className="text-xl font-bold tracking-wide text-brand-gold">
                                Olá {userName} 👋
                            </h2>
                            <p className="mt-2 text-[color:var(--orion-text-secondary)]">Como posso te ajudar hoje?</p>
                        </div>

                        {/* Quick Prompts */}
                        <div className="mt-auto mb-4 space-y-2">
                            {QUICK_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => sendQuery(prompt)}
                                    className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-left text-sm text-[color:var(--orion-text-secondary)] transition hover:border-brand-gold/30 hover:bg-white/10 hover:text-[color:var(--orion-text)]"
                                >
                                    <span>{prompt}</span>
                                    <ArrowUpRight className="h-4 w-4 opacity-50" />
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    'flex w-full flex-col',
                                    message.role === 'user' ? 'items-end' : 'items-start'
                                )}
                            >
                                <div
                                    className={cn(
                                        'rounded-2xl px-5 py-3 text-[15px] leading-relaxed max-w-[85%]',
                                        message.role === 'user'
                                            ? 'bg-brand-gold text-black rounded-tr-sm'
                                            : 'bg-white/5 border border-white/10 text-[color:var(--orion-text)] rounded-tl-sm'
                                    )}
                                >
                                    {message.content}
                                </div>
                                {message.toolsUsed && message.toolsUsed.length > 0 && (
                                    <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-brand-gold/60">
                                        Tools: {message.toolsUsed.join(', ')}
                                    </p>
                                )}
                            </div>
                        ))}
                        {isSubmitting && (
                            <div className="flex items-start">
                                <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 rounded-tl-sm w-[85%]">
                                    <div className="space-y-2">
                                        <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/10" />
                                        <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/10" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            {/* Floating Input Area */}
            {activeTab === 'chat' && (
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[color:var(--orion-surface)] via-[color:var(--orion-surface)] to-[color:var(--orion-surface)/0] pt-12">
                    <form
                        onSubmit={handleSubmit}
                        className="relative flex flex-col overflow-hidden rounded-[24px] border border-[color:var(--orion-gold-border)] bg-[color:var(--orion-base)] shadow-[0_0_20px_rgba(212,175,55,0.05)] transition-all focus-within:border-brand-gold focus-within:shadow-[0_0_30px_rgba(212,175,55,0.1)]"
                    >
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e as any);
                                }
                            }}
                            placeholder="Pergunte qualquer coisa..."
                            className="w-full resize-none bg-transparent pt-5 pb-12 pl-6 pr-6 text-sm text-[color:var(--orion-text)] outline-none placeholder:text-gray-500"
                            style={{ minHeight: '120px', maxHeight: '200px' }}
                        />
                        <button
                            type="button"
                            className="absolute right-3 bottom-3 rounded-full border border-white/10 p-2 text-gray-400 transition hover:bg-white/5 hover:border-brand-gold/50 hover:text-brand-gold"
                            title="Em breve: comando de voz"
                        >
                            <Mic className="h-[18px] w-[18px]" />
                        </button>
                    </form>
                    <p className="mt-3 text-center text-[11px] text-gray-500">
                        O ORION Assistant pode cometer erros. Confirme informações importantes.
                    </p>
                </div>
            )}
        </aside>
    );
}
