'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
    id: string;
    variant: ToastVariant;
    title: string;
    description?: string;
    duration: number;
}

interface ToastContextValue {
    push: (variant: ToastVariant, title: string, description?: string, duration?: number) => void;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let externalPush: ToastContextValue['push'] | null = null;

export function emitToast(variant: ToastVariant, title: string, description?: string, duration?: number) {
    if (externalPush) externalPush(variant, title, description, duration);
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        // Safe fallback so consumers in tests / RSC don't crash.
        return {
            push: (variant, title, description, duration) => emitToast(variant, title, description, duration),
            dismiss: () => {},
        };
    }
    return ctx;
}

const variantStyles: Record<ToastVariant, { ring: string; bg: string; icon: React.ReactNode }> = {
    success: {
        ring: 'border-emerald-500/40',
        bg: 'bg-emerald-500/12',
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" />,
    },
    error: {
        ring: 'border-rose-500/45',
        bg: 'bg-rose-500/12',
        icon: <XCircle className="h-4 w-4 text-rose-300" />,
    },
    warning: {
        ring: 'border-amber-500/45',
        bg: 'bg-amber-500/12',
        icon: <AlertTriangle className="h-4 w-4 text-amber-300" />,
    },
    info: {
        ring: 'border-sky-500/40',
        bg: 'bg-sky-500/12',
        icon: <Info className="h-4 w-4 text-sky-300" />,
    },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const handle = timeoutsRef.current.get(id);
        if (handle) {
            clearTimeout(handle);
            timeoutsRef.current.delete(id);
        }
    }, []);

    const push = useCallback<ToastContextValue['push']>((variant, title, description, duration = 4500) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts((prev) => [...prev, { id, variant, title, description, duration }]);
        const handle = setTimeout(() => dismiss(id), duration);
        timeoutsRef.current.set(id, handle);
    }, [dismiss]);

    useEffect(() => {
        externalPush = push;
        return () => { externalPush = null; };
    }, [push]);

    useEffect(() => {
        const timeouts = timeoutsRef.current;
        return () => {
            timeouts.forEach((h) => clearTimeout(h));
            timeouts.clear();
        };
    }, []);

    const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                aria-live="polite"
                aria-atomic="true"
                className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
            >
                {toasts.map((t) => {
                    const style = variantStyles[t.variant];
                    return (
                        <div
                            key={t.id}
                            role="status"
                            className={`pointer-events-auto min-w-[260px] max-w-sm rounded-lg border ${style.ring} ${style.bg} backdrop-blur-md shadow-lg shadow-black/30 px-3 py-2.5 flex items-start gap-2.5 animate-in slide-in-from-right-2 fade-in duration-200`}
                        >
                            <div className="mt-0.5 shrink-0">{style.icon}</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-white leading-snug">{t.title}</p>
                                {t.description && (
                                    <p className="text-[11px] text-white/70 leading-snug mt-0.5">{t.description}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => dismiss(t.id)}
                                aria-label="Fechar notificação"
                                className="text-white/50 hover:text-white transition-colors shrink-0"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}
