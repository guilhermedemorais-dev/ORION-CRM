'use client';

import { useEffect, useState } from 'react';
import { Check, CircleDot, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/toast';

export type StageConfirmKind = 'won' | 'lost';

export interface StageConfirmPayload {
    note?: string;
    /** in cents — won only */
    saleValue?: number;
    /** lost only */
    reason?: string;
}

interface LeadStageConfirmDialogProps {
    kind: StageConfirmKind;
    leadName: string;
    stageName: string;
    onCancel: () => void;
    onConfirm: (payload: StageConfirmPayload) => Promise<void> | void;
}

export function LeadStageConfirmDialog({ kind, leadName, stageName, onCancel, onConfirm }: LeadStageConfirmDialogProps) {
    const [note, setNote] = useState('');
    const [reason, setReason] = useState('');
    const [valueInput, setValueInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting) onCancel();
        };
        document.addEventListener('keydown', onEsc);
        return () => document.removeEventListener('keydown', onEsc);
    }, [onCancel, submitting]);

    const isWon = kind === 'won';

    function parseCents(input: string): number | null {
        const cleaned = input.replace(/\D/g, '');
        if (!cleaned) return null;
        return Number(cleaned);
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const payload: StageConfirmPayload = { note: note.trim() || undefined };

        if (isWon) {
            const cents = parseCents(valueInput);
            if (cents === null || cents <= 0) {
                setError('Informe o valor da venda em reais.');
                return;
            }
            payload.saleValue = cents;
        } else {
            const r = reason.trim();
            if (!r) {
                setError('Informe o motivo da perda.');
                return;
            }
            payload.reason = r;
        }

        setSubmitting(true);
        try {
            await onConfirm(payload);
            notify.success(isWon ? 'Lead marcado como ganho' : 'Lead marcado como perdido', leadName);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.');
        } finally {
            setSubmitting(false);
        }
    }

    const accent = isWon
        ? { ring: 'border-emerald-500/30', icon: 'bg-emerald-500/15 text-emerald-400', btn: 'bg-emerald-500 hover:bg-emerald-400 text-black' }
        : { ring: 'border-rose-500/30',    icon: 'bg-rose-500/15 text-rose-400',     btn: 'bg-rose-500 hover:bg-rose-400 text-white' };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className={cn('w-full max-w-md rounded-2xl border bg-[color:var(--orion-surface)] p-6 shadow-2xl', accent.ring)}>
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', accent.icon)}>
                            {isWon ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <CircleDot className="h-5 w-5" strokeWidth={2.5} />}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-muted)]">
                                {isWon ? 'Marcar como ganho' : 'Marcar como perdido'}
                            </p>
                            <h2 className="font-serif text-[18px] font-semibold text-white">
                                {leadName}
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        aria-label="Cancelar"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-[color:var(--orion-text-muted)] hover:text-white hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <p className="text-[12px] text-[color:var(--orion-text-secondary)] mb-4">
                    {isWon
                        ? `Esse lead será movido para "${stageName}" e registrado no histórico como conversão.`
                        : `Esse lead será movido para "${stageName}". O motivo será registrado no histórico.`}
                </p>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {isWon && (
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[color:var(--orion-text-muted)] mb-1.5">
                                Valor da venda <span className="text-rose-400">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[color:var(--orion-text-muted)]">R$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoFocus
                                    value={valueInput}
                                    onChange={(e) => {
                                        const onlyNums = e.target.value.replace(/\D/g, '');
                                        if (!onlyNums) {
                                            setValueInput('');
                                            return;
                                        }
                                        const cents = Number(onlyNums);
                                        const reais = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        setValueInput(reais);
                                    }}
                                    placeholder="0,00"
                                    className="w-full h-10 rounded-md border border-white/10 bg-[color:var(--orion-base)] pl-10 pr-3 text-[13px] text-white outline-none focus:border-brand-gold/50"
                                />
                            </div>
                        </div>
                    )}

                    {!isWon && (
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[color:var(--orion-text-muted)] mb-1.5">
                                Motivo da perda <span className="text-rose-400">*</span>
                            </label>
                            <select
                                autoFocus
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full h-10 rounded-md border border-white/10 bg-[color:var(--orion-base)] px-3 text-[13px] text-white outline-none focus:border-brand-gold/50"
                            >
                                <option value="">Selecione...</option>
                                <option value="Preço">Preço</option>
                                <option value="Concorrência">Concorrência</option>
                                <option value="Sem interesse">Sem interesse</option>
                                <option value="Sem retorno">Sem retorno</option>
                                <option value="Timing">Timing inadequado</option>
                                <option value="Outro">Outro</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[color:var(--orion-text-muted)] mb-1.5">
                            Observação (opcional)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder={isWon ? 'Ex.: produto vendido, prazo de entrega...' : 'Detalhes adicionais...'}
                            className="w-full rounded-md border border-white/10 bg-[color:var(--orion-base)] px-3 py-2 text-[13px] text-white outline-none focus:border-brand-gold/50 resize-none"
                        />
                    </div>

                    {error && (
                        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={submitting}
                            className="h-10 px-4 rounded-md border border-white/10 text-[12px] font-semibold text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={cn(
                                'h-10 px-4 rounded-md text-[12px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                                accent.btn
                            )}
                        >
                            {submitting ? 'Confirmando...' : isWon ? 'Confirmar venda' : 'Confirmar perda'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
