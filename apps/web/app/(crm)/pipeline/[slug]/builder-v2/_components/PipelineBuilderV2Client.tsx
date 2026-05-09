'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { GitBranch, Settings2, Workflow } from 'lucide-react';
import type { PipelineRecord, PipelineStageRecord } from '@/lib/api';
import { PipelineRulesDialog } from '../../builder/_components/PipelineRulesDialog';

type ToastState = { kind: 'success' | 'error'; message: string } | null;

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
    useEffect(() => {
        if (!toast) return;
        const id = setTimeout(onDismiss, 4000);
        return () => clearTimeout(id);
    }, [onDismiss, toast]);

    if (!toast) return null;

    const styles =
        toast.kind === 'success'
            ? 'border-[rgba(76,175,130,0.4)] bg-[rgba(76,175,130,0.12)] text-[color:var(--orion-green)]'
            : 'border-[rgba(224,82,82,0.4)] bg-[rgba(224,82,82,0.12)] text-[color:var(--orion-red)]';

    return (
        <div className={`fixed right-6 top-6 z-[70] rounded-[10px] border px-4 py-3 text-sm font-semibold shadow-[var(--orion-shadow-popover)] ${styles}`}>
            {toast.message}
        </div>
    );
}

export function PipelineBuilderV2Client({
    pipeline,
    stages,
}: {
    pipeline: PipelineRecord;
    stages: PipelineStageRecord[];
}) {
    const [rulesOpen, setRulesOpen] = useState(false);
    const [toast, setToast] = useState<ToastState>(null);

    const sortedStages = useMemo(
        () => [...stages].sort((a, b) => a.position - b.position),
        [stages],
    );

    const dismissToast = useCallback(() => setToast(null), []);

    return (
        <>
            <Toast toast={toast} onDismiss={dismissToast} />

            <section className="overflow-hidden rounded-[16px] border border-white/10 bg-[#111114] shadow-[var(--orion-shadow-card)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#151517] px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[color:var(--orion-gold-border)] bg-[color:var(--orion-gold-bg)] text-[color:var(--orion-gold)]">
                            <Workflow className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <h1 className="font-editorial text-[18px] font-bold text-[color:var(--orion-text)]">
                                    {pipeline.name}
                                </h1>
                                <span className="rounded-full border border-[color:var(--orion-gold-border)] bg-[color:var(--orion-gold-bg)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-gold)]">
                                    {pipeline.is_active ? 'Ativo' : 'Inativo'}
                                </span>
                            </div>
                            <p className="mt-0.5 text-[12px] text-[color:var(--orion-text-secondary)]">
                                {pipeline.slug} · {sortedStages.length} etapas · regras em popup
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setRulesOpen(true)}
                        className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[color:var(--orion-gold)] px-4 text-[12px] font-bold text-black hover:bg-[color:var(--orion-gold-light)]"
                    >
                        <GitBranch className="h-4 w-4" />
                        Abrir popup Regras V2
                    </button>
                </div>

                <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="rounded-[12px] border border-white/10 bg-[#151517] p-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-gold)]">
                            <GitBranch className="h-3.5 w-3.5" />
                            Modelo de regras
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-[10px] border border-white/10 bg-[#171719] p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Quando</p>
                                <p className="mt-2 text-sm font-semibold text-[color:var(--orion-text)]">Pipeline atual</p>
                                <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">Stage origem</p>
                            </div>
                            <div className="rounded-[10px] border border-white/10 bg-[#171719] p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Então</p>
                                <p className="mt-2 text-sm font-semibold text-[color:var(--orion-text)]">Ação</p>
                                <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">Criar, mover ou espelhar card</p>
                            </div>
                            <div className="rounded-[10px] border border-white/10 bg-[#171719] p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-text-muted)]">Em</p>
                                <p className="mt-2 text-sm font-semibold text-[color:var(--orion-text)]">Pipeline destino</p>
                                <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">Stage destino</p>
                            </div>
                        </div>
                    </div>

                    <aside className="rounded-[12px] border border-white/10 bg-[#151517] p-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-gold)]">
                            <Settings2 className="h-3.5 w-3.5" />
                            Etapas disponíveis
                        </div>
                        <div className="mt-4 space-y-2">
                            {sortedStages.map((stage) => (
                                <div key={stage.id} className="flex items-center gap-2 rounded-[9px] border border-white/10 bg-[#171719] px-3 py-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                    <span className="truncate text-sm font-medium text-[color:var(--orion-text)]">{stage.name}</span>
                                </div>
                            ))}
                            {sortedStages.length === 0 ? (
                                <p className="rounded-[9px] border border-white/10 bg-[#171719] px-3 py-2 text-sm text-[color:var(--orion-text-secondary)]">
                                    Nenhuma etapa cadastrada.
                                </p>
                            ) : null}
                        </div>
                    </aside>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
                    <p className="text-xs text-[color:var(--orion-text-secondary)]">
                        O builder visual anterior fica disponível apenas como fluxo legado.
                    </p>
                    <Link
                        href={`/pipeline/${pipeline.slug}/builder`}
                        className="inline-flex h-9 items-center rounded-[8px] border border-white/10 px-3 text-[12px] font-semibold text-[color:var(--orion-text-secondary)] hover:border-[color:var(--orion-gold)] hover:text-[color:var(--orion-gold)]"
                    >
                        Abrir legado
                    </Link>
                </div>
            </section>

            <PipelineRulesDialog
                open={rulesOpen}
                pipeline={pipeline}
                sourceStages={sortedStages}
                onClose={() => setRulesOpen(false)}
                onToast={setToast}
            />
        </>
    );
}
