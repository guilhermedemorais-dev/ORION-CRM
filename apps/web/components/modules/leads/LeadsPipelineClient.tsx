'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    CheckSquare,
    ChevronDown,
    ChevronUp,
    Clock3,
    Download,
    LayoutGrid,
    List,
    MessageCircle,
    Plus,
    Search,
    SlidersHorizontal,
    Users2,
    X,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { LeadRecord, PipelineStageRecord } from '@/lib/api';
import { cn, formatCurrencyFromCents } from '@/lib/utils';
import { LeadCardMenu } from './LeadCardMenu';
import { LeadsListView } from './LeadsListView';

type PipelineViewMode = 'kanban' | 'list';
type NoteSaveState = 'idle' | 'saving' | 'saved' | 'error';

const WHATSAPP_REGEX = /^\+?[1-9]\d{9,14}$/;

function normalizeWhatsAppInput(raw: string): string {
    return raw.replace(/\s|[()-]/g, '');
}

function isValidWhatsApp(raw: string): boolean {
    const cleaned = normalizeWhatsAppInput(raw);
    return WHATSAPP_REGEX.test(cleaned);
}

function initials(name: string | null | undefined): string {
    if (!name) return 'OR';
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

function daysWithoutInteraction(lastInteraction: string | null | undefined): number | null {
    if (!lastInteraction) return null;
    const diff = Date.now() - new Date(lastInteraction).getTime();
    if (Number.isNaN(diff) || diff < 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function normalizeLeadWithStage(lead: LeadRecord, stage: PipelineStageRecord): LeadRecord {
    return {
        ...lead,
        stage_id: stage.id,
        stage_name: stage.name,
        stage_color: stage.color,
        stage_is_won: stage.is_won,
        stage_is_lost: stage.is_lost,
    };
}

function getCardDateParts(dateValue: string | null | undefined) {
    const date = dateValue ? new Date(dateValue) : null;
    if (!date || Number.isNaN(date.getTime())) {
        return { month: '---', day: '--' };
    }

    return {
        month: date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
        day: String(date.getDate()).padStart(2, '0'),
    };
}

function getStageHeaderStyle(index: number, total: number) {
    if (index === 0) {
        return {
            clipPath: total === 1
                ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
                : 'polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 0 0)',
        };
    }

    if (index === total - 1) {
        return {
            clipPath: 'polygon(18px 0, 100% 0, 100% 100%, 18px 100%, 0 50%)',
        };
    }

    return {
        clipPath: 'polygon(18px 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 18px 100%, 0 50%)',
    };
}

interface LeadsPipelineClientProps {
    initialLeads: LeadRecord[];
    initialStages: PipelineStageRecord[];
    pipelineId: string;
    pipelineName: string;
    canManagePipeline: boolean;
    currentUserId: string;
    initialQuery?: string;
}

export function LeadsPipelineClient({
    initialLeads,
    initialStages,
    pipelineId,
    pipelineName,
    canManagePipeline,
    currentUserId,
    initialQuery = '',
}: LeadsPipelineClientProps) {
    const [hasMounted, setHasMounted] = useState(false);
    const [leads, setLeads] = useState<LeadRecord[]>(initialLeads);
    const [stages, setStages] = useState<PipelineStageRecord[]>(
        [...initialStages].sort((a, b) => a.position - b.position)
    );
    const [query, setQuery] = useState(initialQuery);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
    const [highlightStageId, setHighlightStageId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [showPipelineConfig, setShowPipelineConfig] = useState(false);
    const [savingOrder, setSavingOrder] = useState(false);
    const [creatingStage, setCreatingStage] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [newStageColor, setNewStageColor] = useState('#3B82F6');
    const [showNewLeadForm, setShowNewLeadForm] = useState(false);
    const [newLeadInitialStage, setNewLeadInitialStage] = useState<string | null>(null);
    const [activeQuickFilter, setActiveQuickFilter] = useState<'ALL' | 'MINE' | 'WHATSAPP' | 'STALE' | 'HAS_TASKS'>('ALL');
    const [viewMode, setViewMode] = useState<PipelineViewMode>('kanban');
    const [hideEmptyStages, setHideEmptyStages] = useState(false);
    const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
    const [noteSaveState, setNoteSaveState] = useState<Record<string, NoteSaveState>>({});
    const [formErrors, setFormErrors] = useState<{ name?: string; whatsapp_number?: string; submit?: string }>({});
    const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
    const boardRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setHasMounted(true);
        // restore preferred view mode + auto fallback to list on small viewports (TASK-06)
        try {
            const stored = localStorage.getItem('orion:pipeline:view') as PipelineViewMode | null;
            const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
            if (isMobile) {
                setViewMode('list');
            } else if (stored === 'kanban' || stored === 'list') {
                setViewMode(stored);
            }
            const hideEmpty = localStorage.getItem('orion:pipeline:hideEmpty');
            if (hideEmpty === '1') setHideEmptyStages(true);
        } catch { /* localStorage unavailable */ }
    }, []);

    function applyViewMode(next: PipelineViewMode) {
        setViewMode(next);
        try { localStorage.setItem('orion:pipeline:view', next); } catch { /* noop */ }
    }

    function toggleHideEmpty() {
        const next = !hideEmptyStages;
        setHideEmptyStages(next);
        try { localStorage.setItem('orion:pipeline:hideEmpty', next ? '1' : '0'); } catch { /* noop */ }
    }

    function focusNoteForLead(leadId: string) {
        const node = noteRefs.current[leadId];
        if (node) {
            node.focus();
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function openNewLeadModal(stageId: string | null) {
        setNewLeadInitialStage(stageId);
        setFormErrors({});
        setShowNewLeadForm(true);
    }

    useEffect(() => {
        const handler = (event: WheelEvent) => {
            if (!event.shiftKey) return;
            const board = boardRef.current;
            if (!board) return;
            const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
            if (delta !== 0) {
                board.scrollLeft += delta;
                event.preventDefault();
            }
        };

        window.addEventListener('wheel', handler, { passive: false });
        return () => window.removeEventListener('wheel', handler);
    }, []);

    const filteredLeads = useMemo(() => {
        const q = query.trim().toLowerCase();

        return leads.filter((lead) => {
            const inactivity = daysWithoutInteraction(lead.last_interaction_at) ?? 0;

            if (activeQuickFilter === 'MINE' && lead.assigned_to?.id !== currentUserId) {
                return false;
            }

            if (activeQuickFilter === 'WHATSAPP' && !lead.whatsapp_number) {
                return false;
            }

            if (activeQuickFilter === 'STALE' && inactivity < 7) {
                return false;
            }

            if (activeQuickFilter === 'HAS_TASKS' && (lead.open_tasks_count ?? 0) <= 0) {
                return false;
            }

            if (!q) return true;

            const blob = [
                lead.name ?? '',
                lead.whatsapp_number,
                lead.email ?? '',
                lead.notes ?? '',
                lead.quick_note ?? '',
                lead.assigned_to?.name ?? '',
            ].join(' ').toLowerCase();

            return blob.includes(q);
        });
    }, [activeQuickFilter, currentUserId, leads, query]);

    const leadsByStage = useMemo(() => {
        const grouped = new Map<string, LeadRecord[]>();
        for (const stage of stages) {
            grouped.set(stage.id, []);
        }
        for (const lead of filteredLeads) {
            if (lead.stage_id && grouped.has(lead.stage_id)) {
                grouped.get(lead.stage_id)?.push(lead);
            }
        }
        return grouped;
    }, [filteredLeads, stages]);

    const selectedLead = useMemo(
        () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
        [leads, selectedLeadId]
    );

    const focusedStageIndex = useMemo(() => {
        if (selectedLead?.stage_id) {
            const selectedStageIndex = stages.findIndex((stage) => stage.id === selectedLead.stage_id);
            if (selectedStageIndex >= 0) {
                return selectedStageIndex;
            }
        }

        const firstPopulatedStage = stages.findIndex((stage) => (leadsByStage.get(stage.id) ?? []).length > 0);
        return firstPopulatedStage >= 0 ? firstPopulatedStage : 0;
    }, [leadsByStage, selectedLead, stages]);

    async function refreshFromApi() {
        const [leadsRes, stagesRes] = await Promise.all([
            fetch(`/api/internal/pipelines/${pipelineId}/leads?limit=100`, { cache: 'no-store' }),
            fetch(`/api/internal/pipelines/${pipelineId}/stages`, { cache: 'no-store' }),
        ]);

        if (!leadsRes.ok || !stagesRes.ok) {
            throw new Error('Não foi possível sincronizar pipeline.');
        }

        const leadsPayload = await leadsRes.json() as { data: LeadRecord[] };
        const stagesPayload = await stagesRes.json() as { data: PipelineStageRecord[] };
        setLeads(leadsPayload.data);
        setStages([...stagesPayload.data].sort((a, b) => a.position - b.position));
    }

    async function moveLead(leadId: string, targetStageId: string) {
        const stage = stages.find((item) => item.id === targetStageId);
        if (!stage) return;

        const previous = leads;
        setLeads((current) => current.map((lead) => {
            if (lead.id !== leadId) return lead;
            return normalizeLeadWithStage(lead, stage);
        }));

        const response = await fetch(`/api/internal/leads/${leadId}/stage`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stageId: targetStageId }),
        });

        if (!response.ok) {
            setLeads(previous);
            const payload = await response.json().catch(() => ({}));
            throw new Error(typeof payload.message === 'string' ? payload.message : 'Falha ao mover lead.');
        }

        const payload = await response.json() as { data: LeadRecord };
        if (payload.data) {
            setLeads((current) => current.map((lead) => lead.id === payload.data.id ? payload.data : lead));
        }
    }

    function onDragStart(leadId: string) {
        setDraggingLeadId(leadId);
        setErrorMessage(null);
    }

    async function onDrop(stageId: string) {
        if (!draggingLeadId) return;
        setHighlightStageId(null);
        try {
            await moveLead(draggingLeadId, stageId);
            setInfoMessage('Lead movido com sucesso.');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Não foi possível mover o lead.');
        } finally {
            setDraggingLeadId(null);
        }
    }

    function scheduleQuickNoteSave(leadId: string, quickNote: string) {
        if (noteTimers.current[leadId]) {
            clearTimeout(noteTimers.current[leadId]);
        }
        // mark as 'saving' immediately so the indicator shows while we wait for debounce
        setNoteSaveState((prev) => ({ ...prev, [leadId]: 'saving' }));

        noteTimers.current[leadId] = setTimeout(async () => {
            try {
                const response = await fetch(`/api/internal/leads/${leadId}/quick-note`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quickNote }),
                });

                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    setNoteSaveState((prev) => ({ ...prev, [leadId]: 'error' }));
                    setErrorMessage(typeof payload.message === 'string' ? payload.message : 'Falha ao salvar nota rápida.');
                    return;
                }

                const payload = await response.json() as { data: LeadRecord };
                if (payload.data) {
                    setLeads((current) => current.map((lead) => lead.id === leadId ? payload.data : lead));
                }
                setNoteSaveState((prev) => ({ ...prev, [leadId]: 'saved' }));
                // hide "Salvo" indicator after 1.5s
                setTimeout(() => {
                    setNoteSaveState((prev) => {
                        if (prev[leadId] !== 'saved') return prev;
                        const next = { ...prev };
                        delete next[leadId];
                        return next;
                    });
                }, 1500);
            } catch {
                setNoteSaveState((prev) => ({ ...prev, [leadId]: 'error' }));
            }
        }, 1000);
    }

    function updateQuickNoteLocally(leadId: string, value: string) {
        setLeads((current) => current.map((lead) => {
            if (lead.id !== leadId) return lead;
            return { ...lead, quick_note: value };
        }));
        scheduleQuickNoteSave(leadId, value);
    }

    async function onCreateLead(event: React.FormEvent<HTMLFormElement>): Promise<boolean> {
        event.preventDefault();
        setErrorMessage(null);
        setInfoMessage(null);
        setFormErrors({});

        const form = new FormData(event.currentTarget);
        const name = String(form.get('name') ?? '').trim();
        const whatsappRaw = String(form.get('whatsapp_number') ?? '').trim();
        const whatsappCleaned = normalizeWhatsAppInput(whatsappRaw);

        // client-side validation (TASK-09)
        const errors: { name?: string; whatsapp_number?: string } = {};
        if (!name) {
            errors.name = 'Informe o nome do lead.';
        } else if (name.length < 2) {
            errors.name = 'Nome muito curto.';
        }
        if (!whatsappCleaned) {
            errors.whatsapp_number = 'Informe um número de WhatsApp.';
        } else if (!isValidWhatsApp(whatsappCleaned)) {
            errors.whatsapp_number = 'Formato inválido. Use +5511999999999 ou DDD+número.';
        }
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return false;
        }

        const payload = {
            name,
            whatsapp_number: whatsappCleaned.startsWith('+') ? whatsappCleaned : `+${whatsappCleaned}`,
            source: String(form.get('source') ?? 'WHATSAPP'),
            pipeline_id: pipelineId,
            stage_id: newLeadInitialStage ?? undefined,
        };

        const response = await fetch('/api/internal/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setFormErrors({ submit: typeof data.message === 'string' ? data.message : 'Falha ao criar lead.' });
            return false;
        }

        const lead = data?.data as LeadRecord | undefined;
        if (lead) {
            setLeads((current) => [lead, ...current]);
            setSelectedLeadId(lead.id);
        } else {
            await refreshFromApi();
        }

        setInfoMessage(data?.duplicate_prevented ? 'Lead já existia e foi reutilizado.' : 'Lead criado com sucesso.');
        event.currentTarget.reset();
        return true;
    }

    function moveStageLocal(stageId: string, direction: 'up' | 'down') {
        setStages((current) => {
            const ordered = [...current].sort((a, b) => a.position - b.position);
            const index = ordered.findIndex((stage) => stage.id === stageId);
            if (index < 0) return ordered;
            const swapIndex = direction === 'up' ? index - 1 : index + 1;
            if (swapIndex < 0 || swapIndex >= ordered.length) return ordered;

            const tmp = ordered[index];
            ordered[index] = ordered[swapIndex];
            ordered[swapIndex] = tmp;

            return ordered.map((stage, idx) => ({
                ...stage,
                position: idx + 1,
            }));
        });
    }

    async function saveStageOrder() {
        setSavingOrder(true);
        setErrorMessage(null);
        const payload = {
            stages: stages.map((stage, index) => ({
                id: stage.id,
                position: index + 1,
            })),
        };

        const response = await fetch(`/api/internal/pipelines/${pipelineId}/stages/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        setSavingOrder(false);

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setErrorMessage(typeof data.message === 'string' ? data.message : 'Falha ao salvar ordem das etapas.');
            return;
        }

        const data = await response.json() as { data: PipelineStageRecord[] };
        setStages([...data.data].sort((a, b) => a.position - b.position));
        setInfoMessage('Ordem das etapas salva.');
    }

    async function createStage(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!newStageName.trim()) return;
        setCreatingStage(true);
        setErrorMessage(null);

        const response = await fetch(`/api/internal/pipelines/${pipelineId}/stages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newStageName.trim(),
                color: newStageColor,
                position: stages.length + 1,
            }),
        });

        setCreatingStage(false);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setErrorMessage(typeof data.message === 'string' ? data.message : 'Falha ao criar etapa.');
            return;
        }

        await refreshFromApi();
        setNewStageName('');
        setInfoMessage('Etapa criada.');
    }

    async function removeStage(stageId: string) {
        setErrorMessage(null);
        const response = await fetch(`/api/internal/pipelines/${pipelineId}/stages/${stageId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setErrorMessage(typeof data.message === 'string' ? data.message : 'Falha ao remover etapa.');
            return;
        }
        await refreshFromApi();
        setInfoMessage('Etapa removida.');
    }

    if (!hasMounted) {
        return (
            <div className="-mx-6 -my-6 flex w-[calc(100%+3rem)] min-h-[calc(100%+3rem)] flex-col gap-4 bg-[color:var(--orion-void)] px-5 py-4">
                <div className="h-[42px] rounded-xl border border-[color:var(--orion-border-low)] bg-[color:var(--orion-surface)]" />
                <div className="h-[32px] rounded-xl border border-[color:var(--orion-border-low)] bg-[color:var(--orion-surface)]" />
                <div className="h-[40px] rounded-xl border border-[color:var(--orion-border-low)] bg-[color:var(--orion-surface)]" />
                <div className="flex-1 rounded-2xl border border-[color:var(--orion-border-low)] bg-[color:var(--orion-surface)]" />
            </div>
        );
    }

    return (
        <div className="-mx-6 -my-6 flex h-full w-[calc(100%+3rem)] min-h-[calc(100%+3rem)] flex-col bg-[color:var(--orion-void)] text-[color:var(--orion-text)]">
            {errorMessage || infoMessage ? (
                <div className="space-y-2 px-5 pt-4">
                    {errorMessage ? (
                        <div className="rounded-lg border border-[color:var(--orion-red)]/30 bg-[rgba(224,82,82,0.1)] px-4 py-3 text-sm text-[color:var(--orion-red)]">
                            {errorMessage}
                        </div>
                    ) : null}
                    {infoMessage ? (
                        <div className="rounded-lg border border-[color:var(--orion-green)]/30 bg-[rgba(76,175,130,0.12)] px-4 py-3 text-sm text-[color:var(--orion-green)]">
                            {infoMessage}
                        </div>
                    ) : null}
                </div>
            ) : null}

            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
                    <div className="flex items-center gap-3">
                        <Users2 className="h-4 w-4 text-[color:var(--orion-gold)]" />
                        <h1 className="font-serif text-[15px] font-semibold text-[color:var(--orion-text)]">
                            {pipelineName}
                        </h1>
                        <span className="rounded-full border border-[color:var(--orion-gold-border)] bg-[color:var(--orion-gold-bg)] px-3 py-1 text-[10px] font-semibold text-[color:var(--orion-gold)]">
                            Pipeline de Vendas
                        </span>
                    </div>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            disabled
                            title="Importação de leads via CSV — em breve"
                            aria-disabled="true"
                            className="inline-flex h-8 items-center gap-2 rounded-[7px] border border-[color:var(--orion-border-mid)] bg-white/5 px-3 text-[11px] font-semibold text-[color:var(--orion-text-muted)] opacity-50 cursor-not-allowed"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Importar leads
                            <span className="text-[8px] font-bold uppercase tracking-wide text-amber-500/80 bg-amber-500/10 px-1 py-0.5 rounded-sm leading-none">
                                Em breve
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => openNewLeadModal(null)}
                            className="inline-flex h-8 items-center gap-2 rounded-[7px] bg-[color:var(--orion-gold)] px-3 text-[11px] font-bold text-[#0A0A0C] transition hover:bg-[color:var(--orion-gold-light)]"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Novo Lead
                        </button>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 px-5 pb-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--orion-text-muted)]" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar lead..."
                            className="h-8 w-[200px] rounded-md border border-[color:var(--orion-border-mid)] bg-[color:var(--orion-base)] pl-8 text-[12px] text-[color:var(--orion-text)] placeholder:text-[color:var(--orion-text-muted)] focus:border-[color:var(--orion-gold-border)] focus:ring-2 focus:ring-[color:var(--orion-gold-bg)]"
                        />
                    </div>

                    {[
                        { value: 'ALL', label: 'Todos' },
                        { value: 'MINE', label: 'Meus leads', icon: Users2, tone: 'blue' },
                        { value: 'WHATSAPP', label: 'Com WA', icon: MessageCircle },
                        { value: 'STALE', label: 'Sem interação 7d+', icon: Clock3, tone: 'warn' },
                        { value: 'HAS_TASKS', label: 'Com tarefas', icon: CheckSquare },
                    ].map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setActiveQuickFilter(item.value as 'ALL' | 'MINE' | 'WHATSAPP' | 'STALE' | 'HAS_TASKS')}
                            className={cn(
                                'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11px] font-semibold transition',
                                activeQuickFilter === item.value
                                    ? 'border-[color:var(--orion-gold)] bg-[color:var(--orion-gold)] text-[#0A0A0C]'
                                    : item.tone === 'warn'
                                        ? 'border-[color:var(--orion-amber)]/30 bg-[rgba(240,160,64,0.1)] text-[color:var(--orion-amber)] hover:border-[color:var(--orion-amber)]/50'
                                        : item.tone === 'blue'
                                            ? 'border-[color:var(--orion-blue)]/25 bg-[rgba(74,158,255,0.1)] text-[color:var(--orion-blue)] hover:border-[color:var(--orion-blue)]/45'
                                            : 'border-[color:var(--orion-border-mid)] bg-white/5 text-[color:var(--orion-text-secondary)] hover:border-[color:var(--orion-border-strong)] hover:text-[color:var(--orion-text)]'
                            )}
                        >
                            {item.icon ? <item.icon className="h-3.5 w-3.5" /> : null}
                            {item.label}
                        </button>
                    ))}

                    {canManagePipeline ? (
                        <button
                            type="button"
                            onClick={() => setShowPipelineConfig(true)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--orion-border-mid)] bg-white/5 px-3 text-[11px] font-semibold text-[color:var(--orion-text-secondary)] transition hover:border-[color:var(--orion-border-strong)] hover:text-[color:var(--orion-text)]"
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Pipeline
                        </button>
                    ) : null}

                    <button
                        type="button"
                        onClick={toggleHideEmpty}
                        title={hideEmptyStages ? 'Mostrar todas as etapas' : 'Ocultar etapas sem leads'}
                        aria-pressed={hideEmptyStages}
                        className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11px] font-semibold transition',
                            hideEmptyStages
                                ? 'border-brand-gold/40 bg-brand-gold/10 text-brand-gold'
                                : 'border-[color:var(--orion-border-mid)] bg-white/5 text-[color:var(--orion-text-secondary)] hover:border-[color:var(--orion-border-strong)] hover:text-[color:var(--orion-text)]'
                        )}
                    >
                        {hideEmptyStages ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        Etapas vazias
                    </button>

                    <div className="ml-auto flex overflow-hidden rounded-md border border-[color:var(--orion-border-mid)] bg-[color:var(--orion-base)]">
                        <button
                            type="button"
                            onClick={() => applyViewMode('kanban')}
                            aria-pressed={viewMode === 'kanban'}
                            title="Visualização Kanban"
                            className={cn(
                                'flex h-8 items-center gap-1 px-3 text-[11px] font-semibold transition-colors',
                                viewMode === 'kanban'
                                    ? 'bg-white/10 text-[color:var(--orion-text)]'
                                    : 'text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)]'
                            )}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Pipeline
                        </button>
                        <button
                            type="button"
                            onClick={() => applyViewMode('list')}
                            aria-pressed={viewMode === 'list'}
                            title="Visualização em lista"
                            className={cn(
                                'flex h-8 items-center gap-1 px-3 text-[11px] font-semibold transition-colors',
                                viewMode === 'list'
                                    ? 'bg-white/10 text-[color:var(--orion-text)]'
                                    : 'text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)]'
                            )}
                        >
                            <List className="h-3.5 w-3.5" />
                            Lista
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto px-5 pb-1">
                    {stages.map((stage, index) => (
                        <button
                            key={stage.id}
                            type="button"
                            onClick={() => setSelectedLeadId((leadsByStage.get(stage.id) ?? [])[0]?.id ?? null)}
                            className={cn(
                                'flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-semibold transition',
                                index === focusedStageIndex
                                    ? 'bg-white/10 text-[color:var(--orion-text)]'
                                    : 'text-[color:var(--orion-text-secondary)] hover:bg-[color:var(--orion-hover)] hover:text-[color:var(--orion-text)]'
                            )}
                        >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                            <span>{stage.name}</span>
                            {stage.is_won ? <span className="text-[10px] text-[color:var(--orion-text-muted)]">✓</span> : null}
                        </button>
                    ))}
                </div>

                {viewMode === 'list' ? (
                    <LeadsListView
                        leads={filteredLeads}
                        stages={stages}
                        onSelect={(lead) => setSelectedLeadId(lead.id)}
                        selectedLeadId={selectedLeadId}
                    />
                ) : (
                <div
                    ref={boardRef}
                    className="kanban-board flex-1 min-h-0 min-w-0 overflow-x-scroll overflow-y-hidden px-5 pb-5 pt-3 [scrollbar-gutter:stable] overscroll-x-contain"
                    onWheel={(event) => {
                        const board = boardRef.current;
                        if (!board) return;

                        if (event.shiftKey) {
                            const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
                            if (delta !== 0) {
                                board.scrollLeft += delta;
                                event.preventDefault();
                            }
                            return;
                        }

                        const target = event.target as HTMLElement | null;
                        const columnBody = target?.closest('[data-col-body=\"true\"]') as HTMLElement | null;
                        const canScrollColumn =
                            !!columnBody && columnBody.scrollHeight > columnBody.clientHeight;

                        if (canScrollColumn && Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
                            const atTop = columnBody!.scrollTop <= 0;
                            const atBottom =
                                columnBody!.scrollTop + columnBody!.clientHeight >=
                                columnBody!.scrollHeight - 1;
                            const scrollingDown = event.deltaY > 0;

                            if ((scrollingDown && !atBottom) || (!scrollingDown && !atTop)) {
                                return;
                            }
                        }

                        const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
                        if (delta !== 0) {
                            board.scrollLeft += delta;
                            event.preventDefault();
                        }
                    }}
                >
                    <div ref={contentRef} className="inline-flex h-full min-w-max w-max items-start gap-3">
                        {stages
                            .filter((stage) => !hideEmptyStages || (leadsByStage.get(stage.id) ?? []).length > 0 || stage.is_won || stage.is_lost)
                            .map((stage) => {
                            const stageLeads = leadsByStage.get(stage.id) ?? [];
                            const totalValue = stageLeads.reduce((sum, lead) => sum + (lead.estimated_value ?? 0), 0);
                            const isCollapsed = !!collapsedStages[stage.id];

                            if (isCollapsed) {
                                return (
                                    <button
                                        key={stage.id}
                                        type="button"
                                        onClick={() => setCollapsedStages((prev) => ({ ...prev, [stage.id]: false }))}
                                        title={`Expandir ${stage.name}`}
                                        className="flex h-full min-h-0 w-10 min-w-10 flex-col items-center justify-between rounded-lg border border-white/5 bg-[color:var(--orion-surface)] py-3 hover:bg-white/5 transition-colors"
                                    >
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                        <span className="rotate-180 text-[10px] font-bold uppercase tracking-wider text-[color:var(--orion-text-secondary)] [writing-mode:vertical-rl]">
                                            {stage.name}
                                        </span>
                                        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-[color:var(--orion-text-muted)]">
                                            {stageLeads.length}
                                        </span>
                                    </button>
                                );
                            }

                            return (
                                <section key={stage.id} className="flex h-full min-h-0 w-[260px] min-w-[260px] flex-col gap-2">
                                    <div className="flex h-9 items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-text)]">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                        <span className="text-[11px] font-bold">{stage.name}</span>
                                        <span
                                            title={`${stageLeads.length} ${stageLeads.length === 1 ? 'lead' : 'leads'} nesta etapa`}
                                            className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold text-[color:var(--orion-text-muted)]"
                                        >
                                            {stageLeads.length}
                                        </span>
                                        <span
                                            title="Valor total estimado"
                                            className="ml-auto text-[10px] font-bold text-[color:var(--orion-text-muted)]"
                                        >
                                            {formatCurrencyFromCents(totalValue)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setCollapsedStages((prev) => ({ ...prev, [stage.id]: true }))}
                                            title="Recolher etapa"
                                            aria-label={`Recolher ${stage.name}`}
                                            className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-md text-[color:var(--orion-text-muted)] hover:text-white hover:bg-white/5 transition-colors"
                                        >
                                            <ChevronUp className="h-3 w-3" />
                                        </button>
                                    </div>

                                    <div
                                        data-col-body="true"
                                        className={cn(
                                            'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 transition overscroll-y-contain',
                                            highlightStageId === stage.id
                                                ? 'bg-[color:var(--orion-gold-bg)] ring-1 ring-[color:var(--orion-gold-border)] rounded-[10px]'
                                                : ''
                                        )}
                                        onDragOver={(event) => {
                                            event.preventDefault();
                                            setHighlightStageId(stage.id);
                                        }}
                                        onDragLeave={() => setHighlightStageId((current) => (current === stage.id ? null : current))}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            void onDrop(stage.id);
                                        }}
                                    >
                                        {stageLeads.length === 0 ? (
                                            <div className="flex min-h-[80px] flex-1 items-center justify-center rounded-[10px] border border-dashed border-[color:var(--orion-border-low)] text-[11px] text-[color:var(--orion-text-disabled)]">
                                                Nenhum lead nesta etapa
                                            </div>
                                        ) : (
                                            stageLeads.map((lead) => {
                                                const inactivity = daysWithoutInteraction(lead.last_interaction_at) ?? 0;

                                                return (
                                                    <article
                                                        key={lead.id}
                                                        draggable
                                                        onDragStart={() => onDragStart(lead.id)}
                                                        onClick={() => setSelectedLeadId(lead.id)}
                                                        className={cn(
                                                            'relative rounded-[10px] border border-[color:var(--orion-border-low)] bg-[color:var(--orion-surface)] p-3 transition hover:-translate-y-0.5 hover:border-[color:var(--orion-border-strong)] hover:bg-[color:var(--orion-elevated)]',
                                                            draggingLeadId === lead.id && 'opacity-50',
                                                            selectedLeadId === lead.id && 'border-[color:var(--orion-gold-border)]'
                                                        )}
                                                    >
                                                        <span
                                                            className="absolute left-3 right-3 top-0 h-0.5 rounded-b"
                                                            style={{ backgroundColor: stage.color, opacity: 0.5 }}
                                                        />

                                                        <div className="mb-2 flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-[12px] font-semibold leading-[1.3] text-white">
                                                                    {lead.name ?? 'Lead sem nome'}
                                                                </p>
                                                                <p className="mt-1 flex items-center gap-1 text-[10px] text-[color:var(--orion-text-secondary)]">
                                                                    <MessageCircle className="h-3 w-3" />
                                                                    {lead.whatsapp_number ? 'WhatsApp' : 'Origem não informada'}
                                                                </p>
                                                            </div>
                                                            <div
                                                                className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold"
                                                                style={{
                                                                    backgroundColor: `${stage.color}26`,
                                                                    color: stage.color,
                                                                }}
                                                            >
                                                                {initials(lead.assigned_to?.name ?? lead.name)}
                                                            </div>
                                                        </div>

                                                        <div className="relative mb-2">
                                                            <textarea
                                                                ref={(el) => { noteRefs.current[lead.id] = el; }}
                                                                value={lead.quick_note ?? ''}
                                                                maxLength={500}
                                                                onClick={(event) => event.stopPropagation()}
                                                                onChange={(event) => updateQuickNoteLocally(lead.id, event.target.value)}
                                                                placeholder="Adicionar nota..."
                                                                className="min-h-[40px] w-full resize-none rounded-md border border-[color:var(--orion-border-subtle)] bg-white/5 px-2 py-1.5 pr-16 text-[11px] leading-[1.5] text-[color:var(--orion-text-secondary)] outline-none transition placeholder:text-[color:var(--orion-text-disabled)] hover:border-[color:var(--orion-border-mid)] focus:border-[color:var(--orion-gold-border)]"
                                                            />
                                                            {noteSaveState[lead.id] && (
                                                                <span
                                                                    className={cn(
                                                                        'pointer-events-none absolute right-2 top-2 text-[9px] font-semibold uppercase tracking-wider',
                                                                        noteSaveState[lead.id] === 'saving' && 'text-[color:var(--orion-text-muted)]',
                                                                        noteSaveState[lead.id] === 'saved'  && 'text-emerald-400',
                                                                        noteSaveState[lead.id] === 'error'  && 'text-rose-400'
                                                                    )}
                                                                >
                                                                    {noteSaveState[lead.id] === 'saving' ? 'Salvando...' : noteSaveState[lead.id] === 'saved' ? 'Salvo ✓' : 'Erro'}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className={cn('text-[12px] font-semibold', lead.estimated_value ? 'text-[color:var(--orion-text)]' : 'text-[color:var(--orion-text-muted)]')}>
                                                            {formatCurrencyFromCents(lead.estimated_value ?? 0)}
                                                        </p>

                                                        <div className="mt-2 flex items-center gap-1.5">
                                                            <span
                                                                title={lead.whatsapp_number ? `WhatsApp: ${lead.whatsapp_number}` : 'Sem WhatsApp cadastrado'}
                                                                className="inline-flex items-center gap-1 rounded-md border border-[color:var(--orion-green)]/25 bg-[rgba(76,175,130,0.12)] px-2 py-0.5 text-[9px] font-semibold text-[color:var(--orion-green)]"
                                                            >
                                                                <MessageCircle className="h-3 w-3" />
                                                                {lead.whatsapp_number ? 'WA' : '--'}
                                                            </span>
                                                            <span
                                                                title={`${lead.open_tasks_count ?? 0} tarefa(s) em aberto`}
                                                                className="inline-flex items-center gap-1 rounded-md border border-[color:var(--orion-border-subtle)] bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-[color:var(--orion-text-muted)]"
                                                            >
                                                                <CheckSquare className="h-3 w-3" />
                                                                {lead.open_tasks_count ?? 0}
                                                            </span>
                                                            <span
                                                                title={`Último contato há ${inactivity} dia(s)`}
                                                                className={cn(
                                                                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-semibold',
                                                                    inactivity >= 8
                                                                        ? 'border-[color:var(--orion-red)]/30 bg-[rgba(224,82,82,0.12)] text-[color:var(--orion-red)]'
                                                                        : 'border-[color:var(--orion-amber)]/30 bg-[rgba(240,160,64,0.12)] text-[color:var(--orion-amber)]'
                                                                )}
                                                            >
                                                                <Clock3 className="h-3 w-3" />
                                                                {inactivity}d
                                                            </span>
                                                            <LeadCardMenu
                                                                lead={lead}
                                                                stages={stages}
                                                                onMoveStage={async (id, stageId) => {
                                                                    try {
                                                                        await moveLead(id, stageId);
                                                                        setInfoMessage('Lead movido com sucesso.');
                                                                    } catch (err) {
                                                                        setErrorMessage(err instanceof Error ? err.message : 'Falha ao mover lead.');
                                                                    }
                                                                }}
                                                                onFocusNote={focusNoteForLead}
                                                            />
                                                        </div>
                                                    </article>
                                                );
                                            })
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openNewLeadModal(stage.id)}
                                        title={`Criar lead em ${stage.name}`}
                                        className="flex h-9 items-center justify-center gap-2 rounded-md border border-brand-gold/30 bg-brand-gold/10 text-[11px] font-semibold text-brand-gold transition hover:bg-brand-gold/20"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Adicionar lead
                                    </button>
                                </section>
                            );
                        })}
                    </div>
                </div>
                )}

            </main>

            {showNewLeadForm ? (
                <div
                    className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
                    onClick={() => setShowNewLeadForm(false)}
                >
                    <div
                        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[color:var(--orion-surface)] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.55)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-gold">Pipeline</p>
                                <h2 className="mt-1 font-serif text-[22px] font-semibold text-[color:var(--orion-text)]">Novo lead</h2>
                                {newLeadInitialStage && (
                                    <p className="mt-1 text-[12px] text-[color:var(--orion-text-secondary)]">
                                        Etapa: <span className="font-semibold text-brand-gold">
                                            {stages.find((s) => s.id === newLeadInitialStage)?.name ?? '—'}
                                        </span>
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                title="Fechar"
                                onClick={() => setShowNewLeadForm(false)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[color:var(--orion-text-muted)] transition hover:border-brand-gold/40 hover:text-brand-gold"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form
                            onSubmit={async (event) => {
                                const ok = await onCreateLead(event);
                                if (ok) setShowNewLeadForm(false);
                            }}
                            className="mt-6 space-y-3"
                            noValidate
                        >
                            <div>
                                <Input
                                    name="name"
                                    placeholder="Nome do lead"
                                    aria-invalid={!!formErrors.name}
                                    onChange={() => formErrors.name && setFormErrors((p) => ({ ...p, name: undefined }))}
                                    className={cn(
                                        'h-10 bg-[color:var(--orion-elevated)] text-[color:var(--orion-text)] placeholder:text-[color:var(--orion-text-disabled)]',
                                        formErrors.name ? 'border-rose-500/60 focus:border-rose-500' : 'border-white/10'
                                    )}
                                />
                                {formErrors.name && (
                                    <p className="mt-1 text-[11px] text-rose-400">{formErrors.name}</p>
                                )}
                            </div>
                            <div>
                                <Input
                                    name="whatsapp_number"
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="+5511999999999"
                                    aria-invalid={!!formErrors.whatsapp_number}
                                    onChange={() => formErrors.whatsapp_number && setFormErrors((p) => ({ ...p, whatsapp_number: undefined }))}
                                    className={cn(
                                        'h-10 bg-[color:var(--orion-elevated)] text-[color:var(--orion-text)] placeholder:text-[color:var(--orion-text-disabled)]',
                                        formErrors.whatsapp_number ? 'border-rose-500/60 focus:border-rose-500' : 'border-white/10'
                                    )}
                                />
                                {formErrors.whatsapp_number ? (
                                    <p className="mt-1 text-[11px] text-rose-400">{formErrors.whatsapp_number}</p>
                                ) : (
                                    <p className="mt-1 text-[10px] text-[color:var(--orion-text-muted)]">Formato internacional. Ex.: +5511999999999</p>
                                )}
                            </div>
                            <select
                                name="source"
                                title="Origem do lead"
                                defaultValue="WHATSAPP"
                                className="h-10 w-full rounded-md border border-white/10 bg-[color:var(--orion-elevated)] px-3 text-sm text-[color:var(--orion-text)] outline-none"
                            >
                                <option value="WHATSAPP">WhatsApp</option>
                                <option value="BALCAO">Balcão</option>
                                <option value="INDICACAO">Indicação</option>
                                <option value="INSTAGRAM">Instagram</option>
                                <option value="OUTRO">Outro</option>
                            </select>
                            {formErrors.submit && (
                                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
                                    {formErrors.submit}
                                </div>
                            )}
                            <button
                                type="submit"
                                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-gold text-sm font-bold text-black transition hover:bg-brand-gold/80"
                            >
                                Criar lead
                            </button>
                        </form>
                    </div>
                </div>
            ) : null}

            {showPipelineConfig && canManagePipeline ? (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
                    <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[color:var(--orion-surface)] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-gold">Admin</p>
                                <h2 className="mt-1 font-serif text-[24px] font-semibold text-[color:var(--orion-text)]">Configurar pipeline</h2>
                                <p className="mt-2 text-sm text-[color:var(--orion-text-secondary)]">
                                    Ajuste etapas e ordem operacional sem sair do board.
                                </p>
                            </div>
                            <button
                                type="button"
                                title="Fechar"
                                onClick={() => setShowPipelineConfig(false)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[color:var(--orion-text-secondary)] transition hover:border-brand-gold hover:text-brand-gold"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                            <Card title="Nova etapa" description="Adicione etapas canônicas ao pipeline atual.">
                                <form onSubmit={createStage} className="grid gap-3">
                                    <Input
                                        value={newStageName}
                                        onChange={(event) => setNewStageName(event.target.value)}
                                        placeholder="Nova etapa"
                                        required
                                    />
                                    <input
                                        type="color"
                                        title="Cor da etapa"
                                        value={newStageColor}
                                        onChange={(event) => setNewStageColor(event.target.value)}
                                        className="h-10 w-full cursor-pointer rounded-md border border-white/10 bg-[color:var(--orion-base)] px-2"
                                    />
                                    <button
                                        type="submit"
                                        disabled={creatingStage}
                                        className="inline-flex h-10 items-center justify-center rounded-md bg-brand-gold text-sm font-bold text-black transition hover:bg-brand-gold-light disabled:opacity-50"
                                    >
                                        {creatingStage ? 'Criando...' : 'Adicionar etapa'}
                                    </button>
                                </form>
                            </Card>

                            <Card title="Etapas atuais" description="Reordene e remova etapas sem sair do contexto do pipeline.">
                                <div className="space-y-2">
                                    {stages.map((stage, index) => (
                                        <div key={stage.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-[color:var(--orion-base)] px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                                <span className="text-sm font-medium text-[color:var(--orion-text)]">{stage.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => moveStageLocal(stage.id, 'up')}
                                                    disabled={index === 0}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-sm text-[color:var(--orion-text-secondary)] transition hover:border-brand-gold hover:text-brand-gold disabled:opacity-40"
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveStageLocal(stage.id, 'down')}
                                                    disabled={index === stages.length - 1}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-sm text-[color:var(--orion-text-secondary)] transition hover:border-brand-gold hover:text-brand-gold disabled:opacity-40"
                                                >
                                                    ↓
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void removeStage(stage.id)}
                                                    disabled={stage.is_won || stage.is_lost}
                                                    className="inline-flex h-8 items-center justify-center rounded-md border border-red-400/25 px-3 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => void saveStageOrder()}
                                    disabled={savingOrder}
                                    className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-brand-gold px-4 text-sm font-bold text-black transition hover:bg-brand-gold-light disabled:opacity-50"
                                >
                                    {savingOrder ? 'Salvando...' : 'Salvar ordem'}
                                </button>
                            </Card>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
