'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const MENU_WIDTH = 192; // matches w-48
const STAGE_PICKER_WIDTH = 208; // w-52
const VIEWPORT_MARGIN = 8;

/**
 * Contextual menu for lead card. Renders the dropdown via React Portal so it
 * is never clipped by the column's `overflow-y-auto` container.
 */
export function LeadCardMenu({ lead, stages, onMoveStage, onFocusNote }: LeadCardMenuProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [showStagePicker, setShowStagePicker] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);

    const computeCoords = () => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const width = showStagePicker ? STAGE_PICKER_WIDTH : MENU_WIDTH;
        const top = rect.bottom + 4;
        let left = rect.right - width;
        if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
        if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
            left = window.innerWidth - VIEWPORT_MARGIN - width;
        }
        setCoords({ top, left });
    };

    useLayoutEffect(() => {
        if (!open) return;
        computeCoords();
        const onScroll = () => computeCoords();
        const onResize = () => computeCoords();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, showStagePicker]);

    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                popoverRef.current && !popoverRef.current.contains(target)
            ) {
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

    const popover = open && mounted && coords && createPortal(
        <div
            ref={popoverRef}
            role="menu"
            style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 1000 }}
            className={cn(
                'rounded-lg border border-white/10 bg-[color:var(--orion-surface)] shadow-xl shadow-black/60 p-1',
                showStagePicker ? 'w-52 max-h-72 overflow-y-auto' : 'w-48'
            )}
            onClick={(e) => e.stopPropagation()}
        >
            {!showStagePicker && (
                <>
                    <MenuItem icon={<ExternalLink className="h-3.5 w-3.5" />} label="Abrir ficha do cliente" onClick={handleOpenLead} />
                    <MenuItem icon={<NotebookPen className="h-3.5 w-3.5" />} label="Adicionar nota" onClick={handleAddNote} />
                    <MenuItem
                        icon={<MoveRight className="h-3.5 w-3.5" />}
                        label="Mover etapa"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowStagePicker(true);
                        }}
                    />
                </>
            )}

            {showStagePicker && (
                <>
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
                </>
            )}
        </div>,
        document.body
    );

    return (
        <>
            <button
                ref={triggerRef}
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
                    'inline-flex h-6 w-6 items-center justify-center rounded-md border border-brand-gold/30 bg-brand-gold/10 text-brand-gold transition hover:bg-brand-gold/20 ml-auto',
                    open && 'bg-brand-gold/20'
                )}
            >
                <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {popover}
        </>
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
