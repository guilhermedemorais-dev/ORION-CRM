'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, MessageCircle, X } from 'lucide-react';
import { cn, formatCurrencyFromCents, formatDate, formatPhone } from '@/lib/utils';
import type { LeadRecord, PipelineStageRecord } from '@/lib/api';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LeadQuickViewDialogProps {
    lead: LeadRecord;
    stages: PipelineStageRecord[];
    onClose: () => void;
    onPatch: (leadId: string, patch: Partial<LeadRecord>) => Promise<LeadRecord | null>;
    onMoveStage: (leadId: string, stageId: string) => Promise<void>;
}

function getInitials(name: string | null | undefined): string {
    if (!name) return 'OR';
    return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export function LeadQuickViewDialog({ lead, stages, onClose, onPatch, onMoveStage }: LeadQuickViewDialogProps) {
    const router = useRouter();
    const [note, setNote] = useState(lead.quick_note ?? '');
    const [valueInput, setValueInput] = useState(() => {
        if (typeof lead.estimated_value !== 'number' || lead.estimated_value === 0) return '';
        return (lead.estimated_value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
    const [stageId, setStageId] = useState(lead.stage_id ?? '');
    const [noteState, setNoteState] = useState<SaveState>('idle');
    const [valueState, setValueState] = useState<SaveState>('idle');
    const [error, setError] = useState<string | null>(null);
    const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const valueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stage = stages.find((s) => s.id === stageId) ?? null;

    useEffect(() => {
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onEsc);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onEsc);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    function scheduleNoteSave(value: string) {
        if (noteTimer.current) clearTimeout(noteTimer.current);
        setNoteState('saving');
        noteTimer.current = setTimeout(async () => {
            try {
                const response = await fetch(`/api/internal/leads/${lead.id}/quick-note`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quickNote: value }),
                });
                if (!response.ok) throw new Error('Falha ao salvar nota');
                setNoteState('saved');
                setTimeout(() => setNoteState((s) => (s === 'saved' ? 'idle' : s)), 1500);
            } catch (err) {
                setNoteState('error');
                setError(err instanceof Error ? err.message : 'Erro ao salvar nota');
            }
        }, 800);
    }

    function scheduleValueSave(displayedValue: string) {
        if (valueTimer.current) clearTimeout(valueTimer.current);
        setValueState('saving');
        const cleaned = displayedValue.replace(/\D/g, '');
        const cents = cleaned ? Number(cleaned) : 0;
        valueTimer.current = setTimeout(async () => {
            try {
                const updated = await onPatch(lead.id, { estimated_value: cents });
                if (!updated) throw new Error('Falha ao salvar valor');
                setValueState('saved');
                setTimeout(() => setValueState((s) => (s === 'saved' ? 'idle' : s)), 1500);
            } catch (err) {
                setValueState('error');
                setError(err instanceof Error ? err.message : 'Erro ao salvar valor');
            }
        }, 800);
    }

    function handleValueChange(input: string) {
        const onlyNums = input.replace(/\D/g, '');
        if (!onlyNums) {
            setValueInput('');
            scheduleValueSave('');
            return;
        }
        const cents = Number(onlyNums);
        const reais = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        setValueInput(reais);
        scheduleValueSave(reais);
    }

    async function handleStageChange(nextStageId: string) {
        if (!nextStageId || nextStageId === stageId) return;
        const previousStage = stageId;
        setStageId(nextStageId);
        try {
            await onMoveStage(lead.id, nextStageId);
        } catch (err) {
            setStageId(previousStage);
            setError(err instanceof Error ? err.message : 'Falha ao mover etapa');
        }
    }

    const responsibleLabel = lead.assigned_to?.name
        ?? (lead.source === 'WHATSAPP' ? 'BOT' : '—');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[color:var(--orion-surface)] shadow-2xl shadow-black/50"
                onClick={(e) => e.stopPropagation()}
            >
                {/* HEADER */}
                <div className="flex items-start gap-4 border-b border-white/5 p-5">
                    <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-gold/30 bg-brand-gold/10 text-[14px] font-bold text-brand-gold"
                        title={lead.name ?? 'Lead'}
                    >
                        {getInitials(lead.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            {stage && (
                                <span
                                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                                    style={{
                                        backgroundColor: `${stage.color}1A`,
                                        borderColor: `${stage.color}66`,
                                        color: stage.color,
                                    }}
                                >
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                    {stage.name}
                                </span>
                            )}
                            <span className="text-[10px] text-[color:var(--orion-text-muted)]">
                                Criado em {formatDate(lead.created_at)}
                            </span>
                        </div>
                        <h2 className="font-serif text-[22px] font-semibold text-white truncate">
                            {lead.name ?? 'Lead sem nome'}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[color:var(--orion-text-secondary)]">
                            {lead.whatsapp_number && (
                                <span className="inline-flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3" />
                                    {formatPhone(lead.whatsapp_number)}
                                </span>
                            )}
                            <span title={lead.assigned_to ? 'Responsável atribuído' : 'Lead criado por automação'}>
                                {lead.assigned_to ? `Responsável: ${responsibleLabel}` : `Origem: ${responsibleLabel}`}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Fechar (Esc)"
                        aria-label="Fechar"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[color:var(--orion-text-muted)] transition hover:border-brand-gold/40 hover:text-brand-gold"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* BODY */}
                <div className="p-5 space-y-4">
                    {error && (
                        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
                            {error}
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--orion-text-muted)] mb-1.5">
                                Valor estimado
                                {valueState !== 'idle' && (
                                    <span className={cn(
                                        'ml-2 normal-case tracking-normal text-[10px]',
                                        valueState === 'saving' && 'text-[color:var(--orion-text-muted)]',
                                        valueState === 'saved'  && 'text-emerald-400',
                                        valueState === 'error'  && 'text-rose-400',
                                    )}>
                                        {valueState === 'saving' ? 'Salvando...' : valueState === 'saved' ? 'Salvo ✓' : 'Erro'}
                                    </span>
                                )}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[color:var(--orion-text-muted)]">R$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={valueInput}
                                    onChange={(e) => handleValueChange(e.target.value)}
                                    placeholder="0,00"
                                    className="w-full h-10 rounded-md border border-white/10 bg-[color:var(--orion-base)] pl-10 pr-3 text-[14px] font-semibold text-brand-gold outline-none focus:border-brand-gold/50"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--orion-text-muted)] mb-1.5">
                                Etapa do funil
                            </label>
                            <select
                                value={stageId}
                                onChange={(e) => void handleStageChange(e.target.value)}
                                className="w-full h-10 rounded-md border border-white/10 bg-[color:var(--orion-base)] px-3 text-[13px] text-white outline-none focus:border-brand-gold/50"
                            >
                                {stages.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--orion-text-muted)] mb-1.5">
                            Anotações rápidas
                            {noteState !== 'idle' && (
                                <span className={cn(
                                    'ml-2 normal-case tracking-normal text-[10px]',
                                    noteState === 'saving' && 'text-[color:var(--orion-text-muted)]',
                                    noteState === 'saved'  && 'text-emerald-400',
                                    noteState === 'error'  && 'text-rose-400',
                                )}>
                                    {noteState === 'saving' ? 'Salvando...' : noteState === 'saved' ? 'Salvo ✓' : 'Erro'}
                                </span>
                            )}
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => {
                                setNote(e.target.value);
                                scheduleNoteSave(e.target.value);
                            }}
                            rows={8}
                            maxLength={2000}
                            placeholder="Anotações sobre este lead — contexto, objeções, observações de atendimento..."
                            className="w-full rounded-md border border-white/10 bg-[color:var(--orion-base)] px-3 py-2.5 text-[13px] text-white placeholder:text-[color:var(--orion-text-disabled)] outline-none focus:border-brand-gold/50 resize-none"
                        />
                        <div className="mt-1 flex items-center justify-between text-[10px] text-[color:var(--orion-text-muted)]">
                            <span>Salva automaticamente</span>
                            <span>{note.length}/2000</span>
                        </div>
                    </div>

                    {lead.estimated_value !== undefined && lead.estimated_value > 0 && (
                        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[12px]">
                            <span className="text-[color:var(--orion-text-muted)]">Valor atual no card</span>
                            <span className="font-semibold text-brand-gold">{formatCurrencyFromCents(lead.estimated_value)}</span>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="flex items-center justify-between gap-2 border-t border-white/5 p-4 bg-black/20">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 px-4 rounded-md border border-white/10 text-[12px] font-semibold text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-white transition-colors"
                    >
                        Fechar
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push(`/leads/${lead.id}`)}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-gold px-4 text-[12px] font-bold text-black transition-colors hover:bg-brand-gold-light"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir ficha completa
                    </button>
                </div>
            </div>
        </div>
    );
}
