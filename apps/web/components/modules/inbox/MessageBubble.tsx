import type { InboxMessageRecord } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

function getMessageFallback(message: InboxMessageRecord): string {
    if (message.content) {
        return message.content;
    }

    switch (message.type) {
        case 'IMAGE':
            return '[Imagem recebida]';
        case 'DOCUMENT':
            return '[Documento recebido]';
        case 'AUDIO':
            return '[Áudio recebido]';
        default:
            return '[Mensagem sem conteúdo]';
    }
}

export function MessageBubble({ message }: { message: InboxMessageRecord }) {
    const isInbound = message.direction === 'INBOUND';
    const isAutomatedOutbound = message.direction === 'OUTBOUND' && message.is_automated;

    return (
        <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
            <article
                className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                    isInbound && 'rounded-bl-md bg-gray-100 text-gray-800',
                    !isInbound && !isAutomatedOutbound && 'rounded-br-md bg-brand-gold text-surface-sidebar',
                    isAutomatedOutbound && 'rounded-br-md border border-dashed border-violet-300 bg-violet-50 text-violet-800'
                )}
            >
                {message.is_automated ? (
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">Automático</p>
                ) : null}

                <p className="whitespace-pre-wrap break-words">{getMessageFallback(message)}</p>

                <div
                    className={cn(
                        'mt-2 flex items-center gap-2 text-[11px]',
                        isInbound ? 'text-gray-500' : 'text-current/70'
                    )}
                >
                    {message.sent_by?.name ? <span>{message.sent_by.name}</span> : null}
                    <span>{formatDate(message.created_at)}</span>
                </div>
            </article>
        </div>
    );
}
