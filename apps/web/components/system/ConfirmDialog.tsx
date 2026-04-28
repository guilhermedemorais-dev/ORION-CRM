'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export type ConfirmVariant = 'destructive' | 'default';

export interface ConfirmOptions {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
}

interface ConfirmContextValue {
    confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue['confirm'] {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        // Fallback to window.confirm so consumers don't crash if provider is missing.
        return async (opts) => window.confirm(`${opts.title}${opts.description ? `\n\n${opts.description}` : ''}`);
    }
    return ctx.confirm;
}

interface PendingState extends ConfirmOptions {
    resolve: (value: boolean) => void;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
    const [pending, setPending] = useState<PendingState | null>(null);
    const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

    const confirm = useCallback<ConfirmContextValue['confirm']>((opts) => {
        return new Promise<boolean>((resolve) => {
            setPending({ ...opts, resolve });
        });
    }, []);

    const close = useCallback((value: boolean) => {
        setPending((prev) => {
            if (prev) prev.resolve(value);
            return null;
        });
    }, []);

    useEffect(() => {
        if (!pending) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close(false);
            if (e.key === 'Enter') close(true);
        };
        document.addEventListener('keydown', onKey);
        confirmBtnRef.current?.focus();
        return () => document.removeEventListener('keydown', onKey);
    }, [pending, close]);

    const value = useMemo(() => ({ confirm }), [confirm]);

    return (
        <ConfirmContext.Provider value={value}>
            {children}
            {pending && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-title"
                    className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
                    onClick={() => close(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-white/10 bg-[color:var(--orion-surface,#141417)] shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${pending.variant === 'destructive' ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 id="confirm-title" className="font-serif text-[17px] font-semibold text-white leading-tight">
                                        {pending.title}
                                    </h2>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => close(false)}
                                aria-label="Cancelar"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {pending.description && (
                            <div className="px-5 py-4 text-[13px] text-white/75 leading-relaxed">
                                {pending.description}
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2 border-t border-white/5 p-4 bg-black/20 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => close(false)}
                                className="h-9 px-4 rounded-md border border-white/10 text-[12px] font-semibold text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                            >
                                {pending.cancelLabel ?? 'Cancelar'}
                            </button>
                            <button
                                ref={confirmBtnRef}
                                type="button"
                                onClick={() => close(true)}
                                className={`h-9 px-4 rounded-md text-[12px] font-bold transition-colors ${
                                    pending.variant === 'destructive'
                                        ? 'bg-rose-500 hover:bg-rose-400 text-white'
                                        : 'bg-brand-gold hover:bg-brand-gold/90 text-black'
                                }`}
                            >
                                {pending.confirmLabel ?? 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
