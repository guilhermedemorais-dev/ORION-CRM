'use client';

// Bloco visual padronizado para mostrar erros da API.
// Renderiza mensagem clara em destaque, código de erro como badge cinza e
// ID da requisição em texto pequeno (pra suporte localizar no log).
//
// Uso:
//   <ApiErrorMessage error={extractedError} />

import { AlertCircle, Copy } from 'lucide-react';
import { useState } from 'react';
import type { ExtractedApiError } from '@/lib/api-error';

interface Props {
    error: ExtractedApiError;
    /** Se true, mostra os detalhes de validação (campo + mensagem) em lista. */
    showDetails?: boolean;
    /** Variante de tamanho: compact (uma linha) ou full (com requestId visível). */
    variant?: 'compact' | 'full';
}

export function ApiErrorMessage({ error, showDetails = true, variant = 'full' }: Props) {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        const text = `Erro: ${error.message}\nCódigo: ${error.code}${error.requestId ? `\nID: ${error.requestId}` : ''}`;
        navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }).catch(() => { /* sem clipboard, ignora */ });
    };

    return (
        <div
            role="alert"
            style={{
                background: 'rgba(224,82,82,0.08)',
                border: '1px solid rgba(224,82,82,0.30)',
                borderRadius: '8px',
                padding: variant === 'compact' ? '8px 10px' : '12px 14px',
                color: '#E05252',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: '12px', color: '#F0EDE8', lineHeight: 1.5, fontWeight: 500,
                    }}>
                        {error.message}
                    </div>

                    {variant === 'full' && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            marginTop: '6px', flexWrap: 'wrap',
                        }}>
                            <code style={{
                                fontFamily: 'ui-monospace,monospace',
                                fontSize: '10px',
                                background: 'rgba(255,255,255,0.06)',
                                color: '#A8A4A0',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                letterSpacing: '0.04em',
                            }}>
                                {error.code}
                            </code>
                            {error.requestId && (
                                <>
                                    <span style={{ fontSize: '10px', color: '#7A7774' }}>·</span>
                                    <span style={{
                                        fontSize: '10px', color: '#7A7774',
                                        fontFamily: 'ui-monospace,monospace',
                                    }}>
                                        ID {error.requestId.slice(0, 8)}…
                                    </span>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={copy}
                                title="Copiar detalhes do erro"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                    marginLeft: 'auto',
                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                                    color: copied ? '#4CAF82' : '#7A7774',
                                    fontSize: '9px', fontWeight: 600,
                                    padding: '2px 6px', borderRadius: '4px',
                                    cursor: 'pointer', textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                }}
                            >
                                <Copy size={9} />
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                    )}

                    {showDetails && error.details.length > 0 && (
                        <ul style={{
                            margin: '8px 0 0 0', padding: '0 0 0 16px',
                            fontSize: '11px', color: '#C8C4BE', lineHeight: 1.5,
                        }}>
                            {error.details.map((d, i) => (
                                <li key={i}>
                                    <strong style={{ color: '#E8E4DE' }}>{d.field}</strong>: {d.message}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
