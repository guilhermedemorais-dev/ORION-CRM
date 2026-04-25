'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, MoreHorizontal, MoveRight, NotebookPen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeadRecord, PipelineStageRecord } from '@/lib/api';

interface LeadCardMenuProps {
    lead: LeadRecord;
    stages: PipelineStageRecord[];
    onMoveStage: (leadId: string, stageId: string) => Promise<void> | void;
    onFocusNote: (leadId: string) => void;
}

/**
 * Contextual menu for lead card. Replaces the previous `<a href="/leads/{id}">` button
 * that, in production, was triggering a session loss when navigating into the lead page.
 * Now exposes safe in-place actions plus an explicit "Abrir lead" item.
 */
export function LeadCardMenu({ lead, stages, onMoveStage, onFocusNote }: LeadCardMenuProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [showStagePicker, setShowStagePicker] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setShowStagePicker(false);
            }
        };
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                setShowStagePicker(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
            document.removeEventListener('keydown', onEsc);
        };
    }, [open]);

    const handleOpenLead = (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen(false);
        router.push(`/leads/${lead.id}`);
    };

    const handleAddNote = (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen(false);
        onFocusNote(lead.id);
    };

    const handleMoveStage = async (stageId: string) => {
        setShowStagePicker(false);
        setOpen(false);
        await onMoveStage(lead.id, stageId);
    };

    return (
        <div ref={ref} className="relative ml-auto">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((v) => !v);
                    setShowStagePicker(false);
                }}
                aria-label="Ações do lead"
                aria-haspopup="menu"
                aria-expanded={open}
                title="Ações rápidas"
                className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-md border border-brand-gold/30 bg-brand-gold/10 text-brand-gold transition hover:bg-brand-gold/20',
                    open && 'bg-brand-gold/20'
                )}
            >
                <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {open && !showStagePicker && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 z-30 w-48 rounded-lg border border-white/10 bg-[color:var(--orion-surface)] shadow-xl shadow-black/50 p-1"
                    onClick={(e) => e.stopPropagation()}
                >
                    <MenuItem icon={<ExternalLink className="h-3.5 w-3.5" />} label="Abrir lead" onClick={handleOpenLead} />
                    <MenuItem icon={<NotebookPen className="h-3.5 w-3.5" />} label="Adicionar nota" onClick={handleAddNote} />
                    <MenuItem
                        icon={<MoveRight className="h-3.5 w-3.5" />}
                        label="Mover etapa"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowStagePicker(true);
                        }}
                    />
                </div>
            )}

            {open && showStagePicker && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 z-30 w-52 rounded-lg border border-white/10 bg-[color:var(--orion-surface)] shadow-xl shadow-black/50 p-1 max-h-72 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        Mover para etapa
                    </div>
                    {stages.map((stage) => (
                        <button
                            key={stage.id}
                            type="button"
                            disabled={stage.id === lead.stage_id}
                            onClick={() => void handleMoveStage(stage.id)}
                            className={cn(
                                'flex w-full items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-left transition-colors',
                                stage.id === lead.stage_id
                                    ? 'bg-brand-gold/10 text-brand-gold cursor-default'
                                    : 'text-gray-200 hover:bg-white/5'
                            )}
                        >
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                            <span className="truncate">{stage.name}</span>
                            {stage.id === lead.stage_id && (
                                <span className="ml-auto text-[10px] text-brand-gold">atual</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function MenuItem({
    icon,
    label,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: (e: React.MouseEvent) => void;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-gray-200 transition-colors hover:bg-white/5"
        >
            {icon}
            {label}
        </button>
    );
}
