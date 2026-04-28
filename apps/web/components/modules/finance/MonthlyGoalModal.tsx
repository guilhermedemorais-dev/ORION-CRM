'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { parseCurrencyToCents } from '@/lib/financeiro';
import { formatCurrencyFromCents } from '@/lib/utils';

interface MonthlyGoalModalProps {
    open: boolean;
    initialAmountCents: number | null;
    title: string;
    helperText?: string;
    onClose: () => void;
    onSave: (amountCents: number) => Promise<void> | void;
}

export function MonthlyGoalModal({
    open,
    initialAmountCents,
    title,
    helperText,
    onClose,
    onSave,
}: MonthlyGoalModalProps) {
    const [draft, setDraft] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        setDraft(initialAmountCents ? (initialAmountCents / 100).toFixed(2).replace('.', ',') : '');
        setError(null);
        setBusy(false);
    }, [initialAmountCents, open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        function handleKeydown(event: KeyboardEvent) {
            if (event.key === 'Escape' && !busy) {
                onClose();
            }
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeydown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeydown);
        };
    }, [busy, onClose, open]);

    if (!open) {
        return null;
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busy) {
            return;
        }

        const cents = parseCurrencyToCents(draft);
        if (!cents) {
            setError('Informe um valor maior que zero.');
            return;
        }

        setBusy(true);
        setError(null);

        try {
            await onSave(cents);
        } catch (saveError) {
            setBusy(false);
            setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar meta.');
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]" onClick={() => !busy && onClose()}>
            <div
                className="relative w-full max-w-[440px] rounded-[18px] border border-[color:var(--orion-border-low)] bg-[color:var(--orion-surface)] p-7 shadow-[var(--orion-shadow-dialog)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-serif text-[18px] font-semibold text-[color:var(--orion-text)]">{title}</h2>
                        {helperText ? (
                            <p className="mt-1 text-[12px] text-[color:var(--orion-text-secondary)]">{helperText}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--orion-text-secondary)] transition hover:bg-white/5 hover:text-[color:var(--orion-text)]',
                            busy && 'pointer-events-none opacity-50'
                        )}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="grid gap-4">
                    <label className="grid gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">Meta mensal</span>
                        <input
                            inputMode="decimal"
                            autoFocus
                            value={draft}
                            onChange={(event) => {
                                setDraft(event.target.value);
                                if (error) {
                                    setError(null);
                                }
                            }}
                            placeholder="Ex: 12000,00"
                            className={cn(
                                'h-10 rounded-[10px] border bg-[color:var(--orion-base)] px-3 text-[13px] text-[color:var(--orion-text)] outline-none',
                                error ? 'border-[color:var(--orion-red)]' : 'border-[color:var(--orion-border-mid)]'
                            )}
                        />
                        <span className="text-[11px] text-[color:var(--orion-text-secondary)]">
                            {draft ? formatCurrencyFromCents(parseCurrencyToCents(draft) ?? 0) : 'Digite o valor que deseja acompanhar no mês.'}
                        </span>
                    </label>

                    {error ? (
                        <div className="rounded-[10px] border border-[color:rgba(224,82,82,0.25)] bg-[color:rgba(224,82,82,0.12)] px-3 py-2 text-sm text-[color:var(--orion-red)]">
                            {error}
                        </div>
                    ) : null}

                    <div className="mt-2 flex gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={busy}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={busy}
                            className="flex-1"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {busy ? 'Salvando...' : 'Salvar meta'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
