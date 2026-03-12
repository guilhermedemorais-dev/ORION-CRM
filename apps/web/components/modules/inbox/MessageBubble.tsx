import { Check, ExternalLink, FileText, Image, MapPin, Play, UserRound } from 'lucide-react';
import type { InboxMessageRecord } from '@/lib/api';
import { cn, ORION_TIME_ZONE } from '@/lib/utils';

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

function getInitials(label: string): string {
    return label
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

function formatMessageTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: ORION_TIME_ZONE,
    }).format(new Date(value));
}

function isIdentificationMessage(message: InboxMessageRecord): boolean {
    return message.direction === 'OUTBOUND'
        && Boolean(message.content?.includes('Vou seguir com o seu atendimento por aqui.'));
}

function renderStatusCheck(message: InboxMessageRecord) {
    if (message.direction !== 'OUTBOUND' || message.status === 'FAILED') {
        return null;
    }

    return <Check className="h-3 w-3 text-[color:var(--orion-blue)]" />;
}

export function MessageBubble({ message }: { message: InboxMessageRecord }) {
    const isInbound = message.direction === 'INBOUND';
    const content = getMessageFallback(message);
    const identificationMessage = isIdentificationMessage(message);
    const senderLabel = message.sent_by?.name ?? 'Equipe ORION';
    const initials = getInitials(senderLabel);

    if (identificationMessage) {
        return (
            <div className="flex justify-end">
                <article className="max-w-[72%] rounded-[12px] rounded-tr-[4px] border border-brand-gold/25 bg-[linear-gradient(135deg,rgba(191,160,106,0.12),rgba(191,160,106,0.06))] px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-gold-dark)]">
                        <UserRound className="h-3 w-3" />
                        Identificação enviada
                    </div>

                    <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-black text-emerald-300">
                            {initials}
                        </div>
                        <div>
                            <div className="text-[13px] font-bold text-[color:var(--orion-text)]">{senderLabel}</div>
                            <div className="text-[10px] text-[color:var(--orion-text-secondary)]">Atendimento · ORIN CRM</div>
                        </div>
                    </div>

                    <p className="text-[12px] leading-6 text-[color:var(--orion-text-secondary)]">{content}</p>

                    <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-[color:var(--orion-text-muted)]">
                        <span>{formatMessageTime(message.created_at)}</span>
                        {renderStatusCheck(message)}
                    </div>
                </article>
            </div>
        );
    }

    if (message.type === 'AUDIO') {
        return (
            <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
                <div className="max-w-[72%]">
                    <div className="flex w-[230px] items-center gap-3 rounded-[10px] border border-white/10 bg-[color:var(--orion-elevated)] px-3 py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold text-black">
                            <Play className="h-3.5 w-3.5 fill-current" />
                        </div>
                        <div className="flex flex-1 items-center gap-1">
                            {Array.from({ length: 12 }).map((_, index) => (
                                <span
                                    key={`wave-${message.id}-${index}`}
                                    className={cn(
                                        'block w-[3px] rounded-full bg-white/25',
                                        index < 5 && 'bg-brand-gold/80'
                                    )}
                                    style={{ height: `${8 + ((index * 7) % 14)}px` }}
                                />
                            ))}
                        </div>
                        <span className="text-[10px] text-[color:var(--orion-text-secondary)]">0:18</span>
                    </div>
                    <div className={cn('mt-1 flex items-center gap-1 text-[10px] text-[color:var(--orion-text-muted)]', !isInbound && 'justify-end')}>
                        <span>{formatMessageTime(message.created_at)}</span>
                        {renderStatusCheck(message)}
                    </div>
                </div>
            </div>
        );
    }

    if (message.type === 'DOCUMENT') {
        return (
            <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
                <div className="max-w-[72%]">
                    <div className="flex w-[230px] items-center gap-3 rounded-[10px] border border-white/10 bg-[color:var(--orion-elevated)] px-3 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-red-500/10 text-red-300">
                            <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-semibold text-[color:var(--orion-text)]">
                                {message.content ?? 'Documento enviado'}
                            </div>
                            {message.media_url ? (
                                <a
                                    href={message.media_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-brand-gold hover:underline"
                                >
                                    <ExternalLink className="h-2.5 w-2.5" />
                                    Abrir
                                </a>
                            ) : (
                                <div className="text-[10px] text-[color:var(--orion-text-secondary)]">Documento</div>
                            )}
                        </div>
                    </div>
                    <div className={cn('mt-1 flex items-center gap-1 text-[10px] text-[color:var(--orion-text-muted)]', !isInbound && 'justify-end')}>
                        <span>{formatMessageTime(message.created_at)}</span>
                        {renderStatusCheck(message)}
                    </div>
                </div>
            </div>
        );
    }

    if (message.type === 'IMAGE') {
        return (
            <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
                <div className="max-w-[72%]">
                    {message.media_url ? (
                        <a href={message.media_url} target="_blank" rel="noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={message.media_url}
                                alt={message.content ?? 'Imagem'}
                                className="max-h-[320px] max-w-[280px] rounded-[10px] border border-white/10 object-cover"
                            />
                        </a>
                    ) : (
                        <div className="flex h-[120px] w-[200px] items-center justify-center rounded-[10px] border border-white/10 bg-[color:var(--orion-elevated)]">
                            <Image className="h-8 w-8 text-[color:var(--orion-text-muted)]" />
                        </div>
                    )}
                    {message.content ? (
                        <p className="mt-1 text-[12px] leading-5 text-[color:var(--orion-text-secondary)]">{message.content}</p>
                    ) : null}
                    <div className={cn('mt-1 flex items-center gap-1 text-[10px] text-[color:var(--orion-text-muted)]', !isInbound && 'justify-end')}>
                        <span>{formatMessageTime(message.created_at)}</span>
                        {renderStatusCheck(message)}
                    </div>
                </div>
            </div>
        );
    }

    if (message.type === 'VIDEO') {
        return (
            <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
                <div className="max-w-[72%]">
                    {message.media_url ? (
                        <video
                            src={message.media_url}
                            controls
                            className="max-h-[320px] max-w-[280px] rounded-[10px] border border-white/10 bg-black"
                        />
                    ) : (
                        <div className="flex h-[120px] w-[200px] items-center justify-center rounded-[10px] border border-white/10 bg-[color:var(--orion-elevated)]">
                            <Play className="h-8 w-8 text-[color:var(--orion-text-muted)]" />
                        </div>
                    )}
                    <div className={cn('mt-1 flex items-center gap-1 text-[10px] text-[color:var(--orion-text-muted)]', !isInbound && 'justify-end')}>
                        <span>{formatMessageTime(message.created_at)}</span>
                        {renderStatusCheck(message)}
                    </div>
                </div>
            </div>
        );
    }

    if (message.type === 'STICKER') {
        return (
            <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
                <div className="max-w-[72%]">
                    {message.media_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={message.media_url}
                            alt="Sticker"
                            className="h-[120px] w-[120px] object-contain"
                        />
                    ) : (
                        <div className="flex h-[80px] w-[80px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-[color:var(--orion-elevated)] text-[28px]">
                            🎟
                        </div>
                    )}
                    <div className={cn('mt-1 flex items-center gap-1 text-[10px] text-[color:var(--orion-text-muted)]', !isInbound && 'justify-end')}>
                        <span>{formatMessageTime(message.created_at)}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (message.type === 'LOCATION') {
        let lat: number | null = null;
        let lng: number | null = null;

        if (message.content) {
            try {
                const parsed = JSON.parse(message.content) as { lat?: number; lng?: number };
                lat = parsed.lat ?? null;
                lng = parsed.lng ?? null;
            } catch {
                // not JSON, skip
            }
        }

        const mapsUrl = lat !== null && lng !== null
            ? `https://www.google.com/maps?q=${lat},${lng}`
            : null;

        return (
            <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
                <div className="max-w-[72%]">
                    <div className="flex w-[230px] items-center gap-3 rounded-[10px] border border-white/10 bg-[color:var(--orion-elevated)] px-3 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-emerald-500/10 text-emerald-300">
                            <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-[color:var(--orion-text)]">Localização</div>
                            {mapsUrl ? (
                                <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-brand-gold hover:underline"
                                >
                                    <ExternalLink className="h-2.5 w-2.5" />
                                    Abrir no Maps
                                </a>
                            ) : (
                                <div className="text-[10px] text-[color:var(--orion-text-secondary)]">{message.content ?? 'Localização compartilhada'}</div>
                            )}
                        </div>
                    </div>
                    <div className={cn('mt-1 flex items-center gap-1 text-[10px] text-[color:var(--orion-text-muted)]', !isInbound && 'justify-end')}>
                        <span>{formatMessageTime(message.created_at)}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
            <article className="max-w-[72%]">
                <div
                    className={cn(
                        'relative rounded-[10px] px-3 py-2 text-[13px] leading-6',
                        isInbound
                            ? 'rounded-tl-[4px] border border-white/10 bg-[color:var(--orion-elevated)] text-[color:var(--orion-text)]'
                            : 'rounded-tr-[4px] border border-emerald-500/10 bg-emerald-500/10 text-[color:var(--orion-text)]'
                    )}
                >
                    {message.is_quick_reply ? (
                        <span className="absolute -right-1.5 -top-1.5 rounded-[4px] border border-brand-gold/30 bg-brand-gold/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-[color:var(--orion-gold-dark)]">
                            pronta
                        </span>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">{content}</p>
                </div>

                <div className={cn('mt-1 flex items-center gap-1 text-[10px] text-[color:var(--orion-text-muted)]', !isInbound && 'justify-end')}>
                    <span>{formatMessageTime(message.created_at)}</span>
                    {renderStatusCheck(message)}
                </div>
            </article>
        </div>
    );
}
