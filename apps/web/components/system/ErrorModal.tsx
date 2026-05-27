'use client';

import { useEffect, useState } from 'react';

export interface ErrorViolation {
    code: string;
    message: string;
    technical?: string;
}

export interface ErrorModalProps {
    title: string;
    description?: string;
    violations?: ErrorViolation[];
    /** Erro técnico bruto (stack, status, requestId etc.) */
    technical?: string;
    /** Texto do botão primário. Default "Entendi". */
    confirmLabel?: string;
    /** Botão extra (ex: "Forçar movimentação") só aparece se passado */
    secondaryAction?: {
        label: string;
        onClick: () => void;
        variant?: 'gold' | 'danger';
    };
    onClose: () => void;
}

/**
 * Modal de erro padrão do sistema.
 *
 * Padrão visual definido em PRD.DOCS/Designer Systems:
 *  - Header com ícone vermelho + título em PT-BR
 *  - Body com lista de violations (borda esquerda vermelha)
 *  - Botão "+ Detalhes técnicos" colapsável (mono font)
 *  - Footer com 1 botão primário "Entendi" (e opcional secundário)
 */
export function ErrorModal({
    title,
    description,
    violations,
    technical,
    confirmLabel = 'Entendi',
    secondaryAction,
    onClose,
}: ErrorModalProps) {
    const [showTechnical, setShowTechnical] = useState(false);

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const hasTechnical = Boolean(technical) || (violations?.some(v => v.technical) ?? false);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg rounded-2xl border bg-[#111113]"
                style={{ borderColor: 'rgba(224,82,82,0.25)' }}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2" style={{ color: '#E05252' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="text-sm font-semibold" style={{ fontFamily: 'Playfair Display, serif' }}>{title}</span>
                    </div>
                    <button onClick={onClose} className="text-[#888480] hover:text-[#EDE8E0] text-xl leading-none">×</button>
                </div>

                <div className="px-5 py-4 space-y-3">
                    {description && (
                        <p className="text-xs text-[#C8C4BE] leading-relaxed">{description}</p>
                    )}

                    {violations && violations.length > 0 && (
                        <ul className="space-y-1.5 list-none p-0 m-0">
                            {violations.map((v, i) => (
                                <li
                                    key={`${v.code}-${i}`}
                                    className="text-xs px-3 py-2 rounded"
                                    style={{
                                        background: 'rgba(224,82,82,0.08)',
                                        borderLeft: '2px solid #E05252',
                                        color: '#EDE8E0',
                                    }}
                                >
                                    {v.message}
                                </li>
                            ))}
                        </ul>
                    )}

                    {hasTechnical && (
                        <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <button
                                type="button"
                                onClick={() => setShowTechnical(s => !s)}
                                className="flex items-center gap-1.5 text-[10px] text-[#888480] hover:text-[#EDE8E0] transition-colors"
                            >
                                <span style={{ display: 'inline-block', transform: showTechnical ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 150ms' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                </span>
                                Detalhes técnicos
                            </button>
                            {showTechnical && (
                                <pre
                                    className="mt-2 p-3 rounded text-[10px] whitespace-pre-wrap break-words"
                                    style={{
                                        background: '#0A0A0B',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        color: '#888480',
                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                    }}
                                >
                                    {[
                                        technical,
                                        ...(violations ?? []).filter(v => v.technical).map(v => `${v.code}: ${v.technical}`),
                                    ].filter(Boolean).join('\n')}
                                </pre>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {secondaryAction && (
                        <button
                            onClick={secondaryAction.onClick}
                            className="h-9 px-4 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                            style={
                                secondaryAction.variant === 'danger'
                                    ? { background: 'rgba(224,82,82,0.10)', border: '1px solid rgba(224,82,82,0.30)', color: '#E05252' }
                                    : { background: 'rgba(200,169,122,0.10)', border: '1px solid rgba(200,169,122,0.30)', color: '#C8A97A' }
                            }
                        >
                            {secondaryAction.label}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="h-9 px-5 rounded-lg bg-[#C8A97A] text-black text-xs font-bold hover:bg-[#E8D5B0] transition-all"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
