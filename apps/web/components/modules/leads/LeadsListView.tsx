'use client';

import { useRouter } from 'next/navigation';
import { Clock3, MessageCircle, ExternalLink } from 'lucide-react';
import type { LeadRecord, PipelineStageRecord } from '@/lib/api';
import { cn, formatCurrencyFromCents } from '@/lib/utils';

function daysSince(value: string | null | undefined): number | null {
    if (!value) return null;
    const diff = Date.now() - new Date(value).getTime();
    if (Number.isNaN(diff) || diff < 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

interface LeadsListViewProps {
    leads: LeadRecord[];
    stages: PipelineStageRecord[];
    onSelect: (lead: LeadRecord) => void;
    selectedLeadId: string | null;
}

export function LeadsListView({ leads, stages, onSelect, selectedLeadId }: LeadsListViewProps) {
    const router = useRouter();
    const stageById = new Map(stages.map((s) => [s.id, s]));

    if (leads.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center px-6 pb-6">
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-8 py-10 text-center">
                    <p className="text-sm text-[color:var(--orion-text-muted)]">Nenhum lead encontrado com os filtros atuais.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 overflow-auto px-5 pb-5 pt-3">
            <div className="rounded-xl border border-white/5 bg-[color:var(--orion-surface)] overflow-hidden">
                <table className="w-full text-[12px]">
                    <thead className="bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--orion-text-muted)]">
                        <tr>
                            <th className="text-left px-4 py-3">Nome</th>
                            <th className="text-left px-4 py-3">Origem</th>
                            <th className="text-left px-4 py-3">Etapa</th>
                            <th className="text-right px-4 py-3">Valor</th>
                            <th className="text-left px-4 py-3 hidden md:table-cell">Responsável</th>
                            <th className="text-left px-4 py-3 hidden lg:table-cell">Última interação</th>
                            <th className="px-4 py-3 w-10" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {leads.map((lead) => {
                            const stage = lead.stage_id ? stageById.get(lead.stage_id) : null;
                            const inactivity = daysSince(lead.last_interaction_at);
                            const isSelected = lead.id === selectedLeadId;
                            return (
                                <tr
                                    key={lead.id}
                                    onClick={() => onSelect(lead)}
                                    className={cn(
                                        'cursor-pointer transition-colors hover:bg-white/[0.04]',
                                        isSelected && 'bg-brand-gold/5'
                                    )}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="truncate font-semibold text-white">{lead.name ?? 'Lead sem nome'}</span>
                                            {lead.whatsapp_number && (
                                                <span title={lead.whatsapp_number} className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300 shrink-0">
                                                    <MessageCircle className="h-2.5 w-2.5" /> WA
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-[color:var(--orion-text-secondary)] capitalize">
                                        {lead.source.toLowerCase()}
                                    </td>
                                    <td className="px-4 py-3">
                                        {stage ? (
                                            <span className="inline-flex items-center gap-1.5 text-[color:var(--orion-text-secondary)]">
                                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                                {stage.name}
                                            </span>
                                        ) : (
                                            <span className="text-[color:var(--orion-text-muted)]">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-[color:var(--orion-gold)]">
                                        {formatCurrencyFromCents(lead.estimated_value ?? 0)}
                                    </td>
                                    <td className="px-4 py-3 text-[color:var(--orion-text-secondary)] hidden md:table-cell">
                                        {lead.assigned_to?.name ?? <span className="text-[color:var(--orion-text-muted)]">—</span>}
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        {inactivity !== null ? (
                                            <span
                                                title={lead.last_interaction_at ? `Última interação em ${new Date(lead.last_interaction_at).toLocaleString('pt-BR')}` : ''}
                                                className={cn(
                                                    'inline-flex items-center gap-1 text-[11px]',
                                                    inactivity >= 8 ? 'text-rose-300' : inactivity >= 3 ? 'text-amber-300' : 'text-[color:var(--orion-text-secondary)]'
                                                )}
                                            >
                                                <Clock3 className="h-3 w-3" />
                                                {inactivity}d
                                            </span>
                                        ) : (
                                            <span className="text-[color:var(--orion-text-muted)]">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/leads/${lead.id}`);
                                            }}
                                            aria-label="Abrir lead"
                                            title="Abrir lead"
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/5 text-[color:var(--orion-text-muted)] hover:text-brand-gold hover:border-brand-gold/30 transition-colors"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
