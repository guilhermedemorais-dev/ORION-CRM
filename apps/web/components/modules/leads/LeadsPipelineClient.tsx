'use client';

import { useMemo, useRef, useState } from 'react';
import {
    CalendarDays,
    CheckSquare,
    ChevronRight,
    Clock3,
    MessageCircle,
    Phone,
    Plus,
    Search,
    SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { LeadRecord, PipelineStageRecord } from '@/lib/api';
import { formatCurrencyFromCents, formatDate, formatPhone } from '@/lib/utils';

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
    initialQuery?: string;
}

export function LeadsPipelineClient({
    initialLeads,
    initialStages,
    pipelineId,
    pipelineName,
    canManagePipeline,
    initialQuery = '',
}: LeadsPipelineClientProps) {
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
    const [responsibleFilter, setResponsibleFilter] = useState('all');
    const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const responsibleOptions = useMemo(() => {
        const unique = new Map<string, string>();
        for (const lead of leads) {
            if (lead.assigned_to?.id && lead.assigned_to.name) {
                unique.set(lead.assigned_to.id, lead.assigned_to.name);
            }
        }
        return Array.from(unique.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [leads]);

    const filteredLeads = useMemo(() => {
        const q = query.trim().toLowerCase();

        return leads.filter((lead) => {
            if (responsibleFilter !== 'all' && lead.assigned_to?.id !== responsibleFilter) {
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
    }, [leads, query, responsibleFilter]);

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

        noteTimers.current[leadId] = setTimeout(async () => {
            const response = await fetch(`/api/internal/leads/${leadId}/quick-note`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quickNote }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                setErrorMessage(typeof payload.message === 'string' ? payload.message : 'Falha ao salvar nota rápida.');
                return;
            }

            const payload = await response.json() as { data: LeadRecord };
            if (payload.data) {
                setLeads((current) => current.map((lead) => lead.id === leadId ? payload.data : lead));
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

    async function onCreateLead(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage(null);
        setInfoMessage(null);

        const form = new FormData(event.currentTarget);
        const payload = {
            name: String(form.get('name') ?? '').trim(),
            whatsapp_number: String(form.get('whatsapp_number') ?? '').trim(),
            source: String(form.get('source') ?? 'WHATSAPP'),
            pipeline_id: pipelineId,
        };

        const response = await fetch('/api/internal/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setErrorMessage(typeof data.message === 'string' ? data.message : 'Falha ao criar lead.');
            return;
        }

        const lead = data?.data as LeadRecord | undefined;
        if (lead) {
            setLeads((current) => [lead, ...current]);
        } else {
            await refreshFromApi();
        }

        setInfoMessage(data?.duplicate_prevented ? 'Lead já existia e foi reutilizado.' : 'Lead criado com sucesso.');
        event.currentTarget.reset();
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

    return (
        <div className="space-y-5">
            {errorMessage ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                </div>
            ) : null}
            {infoMessage ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {infoMessage}
                </div>
            ) : null}

            <div className="rounded-2xl border border-canvas-border bg-white px-4 py-3 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">{pipelineName}</p>
                        <p className="text-sm text-gray-600">Meus negócios: {filteredLeads.length} resultado(s)</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[280px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Buscar nome, WhatsApp ou observação"
                                className="pl-9"
                            />
                        </div>
                        {canManagePipeline ? (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setShowPipelineConfig((current) => !current)}
                                icon={<SlidersHorizontal className="h-4 w-4" />}
                            >
                                Pipeline
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            {showPipelineConfig && canManagePipeline ? (
                <Card title="Configurar pipeline" description="Ajuste visual e ordem das etapas operacionais.">
                    <div className="space-y-4">
                        <form onSubmit={createStage} className="grid gap-3 md:grid-cols-[1fr_110px_auto]">
                            <Input
                                value={newStageName}
                                onChange={(event) => setNewStageName(event.target.value)}
                                placeholder="Nova etapa"
                                required
                            />
                            <input
                                type="color"
                                value={newStageColor}
                                onChange={(event) => setNewStageColor(event.target.value)}
                                className="h-10 w-full cursor-pointer rounded-md border border-canvas-border bg-white px-2"
                            />
                            <Button type="submit" disabled={creatingStage}>
                                {creatingStage ? 'Criando...' : 'Adicionar'}
                            </Button>
                        </form>

                        <div className="space-y-2">
                            {stages.map((stage, index) => (
                                <div key={stage.id} className="flex items-center justify-between rounded-lg border border-canvas-border bg-[#FBFBFD] px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                        <span className="text-sm font-medium text-gray-900">{stage.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="ghost" onClick={() => moveStageLocal(stage.id, 'up')} disabled={index === 0}>
                                            ↑
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => moveStageLocal(stage.id, 'down')}
                                            disabled={index === stages.length - 1}
                                        >
                                            ↓
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="border-red-200 text-red-700 hover:border-red-300 hover:text-red-800"
                                            onClick={() => void removeStage(stage.id)}
                                            disabled={stage.is_won || stage.is_lost}
                                        >
                                            Excluir
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button type="button" onClick={() => void saveStageOrder()} disabled={savingOrder}>
                            {savingOrder ? 'Salvando...' : 'Salvar ordem'}
                        </Button>
                    </div>
                </Card>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="overflow-hidden rounded-[28px] border border-canvas-border bg-[#F5F6FA] shadow-card">
                    <div className="overflow-x-auto pb-4">
                        <div className="min-w-max px-4 pt-4">
                            <div className="flex gap-0">
                                {stages.map((stage, index) => {
                                    const stageLeads = leadsByStage.get(stage.id) ?? [];
                                    const totalValue = stageLeads.reduce((sum, lead) => sum + (lead.estimated_value ?? 0), 0);

                                    return (
                                        <div key={stage.id} className="w-[260px]">
                                            <div
                                                className="relative mx-[2px] border-y border-r border-canvas-border bg-white px-5 py-3 first:border-l"
                                                style={getStageHeaderStyle(index, stages.length)}
                                            >
                                                <p className="text-[13px] font-semibold text-gray-800">{stage.name}</p>
                                                <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                                                    <span className="inline-flex items-center gap-1">
                                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                                        {stageLeads.length}
                                                    </span>
                                                    <span>{formatCurrencyFromCents(totalValue)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-4 flex items-start gap-4 pb-3">
                                {stages.map((stage) => {
                                    const stageLeads = leadsByStage.get(stage.id) ?? [];

                                    return (
                                        <section
                                            key={stage.id}
                                            className={`min-h-[620px] w-[260px] rounded-2xl border border-transparent px-1 py-1 transition ${
                                                highlightStageId === stage.id ? 'border-brand-gold bg-brand-gold/5' : ''
                                            }`}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                setHighlightStageId(stage.id);
                                            }}
                                            onDragLeave={() => setHighlightStageId((current) => current === stage.id ? null : current)}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                void onDrop(stage.id);
                                            }}
                                        >
                                            <div className="space-y-3">
                                                {stageLeads.length === 0 ? (
                                                    <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-canvas-border bg-white/60 px-4 text-center text-sm text-gray-400">
                                                        Nenhum resultado encontrado nesta fase.
                                                    </div>
                                                ) : (
                                                    stageLeads.map((lead) => {
                                                        const inactivity = daysWithoutInteraction(lead.last_interaction_at);
                                                        const dateBadge = getCardDateParts(lead.created_at);

                                                        return (
                                                            <article
                                                                key={lead.id}
                                                                draggable
                                                                onDragStart={() => onDragStart(lead.id)}
                                                                onClick={() => setSelectedLeadId(lead.id)}
                                                                className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-canvas-border bg-white shadow-[0_10px_25px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.10)] ${
                                                                    draggingLeadId === lead.id ? 'opacity-40' : ''
                                                                }`}
                                                            >
                                                                <div className="flex gap-3 px-3 py-3">
                                                                    <div className="flex w-11 shrink-0 flex-col items-center rounded-xl border border-brand-gold-light/60 bg-brand-gold-light/20 px-1 py-2">
                                                                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold-dark">
                                                                            {dateBadge.month}
                                                                        </span>
                                                                        <span className="mt-1 text-xl font-bold leading-none text-surface-sidebar">
                                                                            {dateBadge.day}
                                                                        </span>
                                                                    </div>

                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="truncate text-[15px] font-semibold text-gray-800">
                                                                            {lead.name ?? 'Lead sem nome'}
                                                                        </p>
                                                                        <p className="mt-1 text-sm text-gray-500">
                                                                            {formatCurrencyFromCents(lead.estimated_value ?? 0)}
                                                                        </p>
                                                                        <p className="mt-2 line-clamp-2 min-h-[34px] text-xs text-gray-500">
                                                                            {lead.quick_note?.trim() || lead.notes?.trim() || formatPhone(lead.whatsapp_number)}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="border-t border-canvas-border px-3 py-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gold-light/30 text-[11px] font-semibold text-brand-gold-dark">
                                                                                {initials(lead.assigned_to?.name ?? null)}
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <p className="truncate text-[11px] font-medium text-gray-700">
                                                                                    {lead.assigned_to?.name ?? 'Sem responsável'}
                                                                                </p>
                                                                                <p className="truncate text-[11px] text-gray-400">
                                                                                    {formatPhone(lead.whatsapp_number)}
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        <a
                                                                            href={`/leads/${lead.id}`}
                                                                            onClick={(event) => event.stopPropagation()}
                                                                            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-surface-sidebar transition hover:bg-brand-gold-dark"
                                                                            aria-label="Abrir lead"
                                                                        >
                                                                            <Plus className="h-4 w-4" />
                                                                        </a>
                                                                    </div>

                                                                    <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-1">
                                                                            <Phone className="h-3 w-3" />
                                                                            Lead
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-1">
                                                                            <CheckSquare className="h-3 w-3" />
                                                                            {lead.open_tasks_count ?? 0}
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-1">
                                                                            <MessageCircle className="h-3 w-3" />
                                                                            msg
                                                                        </span>
                                                                        <span
                                                                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                                                                                (inactivity ?? 0) > 7
                                                                                    ? 'bg-red-50 text-red-600'
                                                                                    : (inactivity ?? 0) > 3
                                                                                        ? 'bg-amber-50 text-amber-600'
                                                                                        : 'bg-canvas text-gray-500'
                                                                            }`}
                                                                        >
                                                                            <Clock3 className="h-3 w-3" />
                                                                            {inactivity ?? 0}d
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </article>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="space-y-4">
                    <Card title="Filtros" description="Refine a visão do pipeline sem sair da tela.">
                        <div className="space-y-3">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                                    Usuário responsável
                                </span>
                                <select
                                    value={responsibleFilter}
                                    onChange={(event) => setResponsibleFilter(event.target.value)}
                                    className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold"
                                >
                                    <option value="all">Todos</option>
                                    {responsibleOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="rounded-xl border border-dashed border-canvas-border bg-[#FBFBFD] px-3 py-3 text-sm text-gray-500">
                                Data de criação e filtros avançados entram no próximo ajuste fino.
                            </div>
                        </div>
                    </Card>

                    <Card title="Novo lead" description="Cadastro rápido sem tomar a área principal do kanban.">
                        <form onSubmit={onCreateLead} className="space-y-3">
                            <Input name="name" placeholder="Nome do lead" required />
                            <Input name="whatsapp_number" placeholder="+5511999999999" required />
                            <select
                                name="source"
                                defaultValue="WHATSAPP"
                                className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                            >
                                <option value="WHATSAPP">WhatsApp</option>
                                <option value="BALCAO">Balcão</option>
                                <option value="INDICACAO">Indicação</option>
                                <option value="OUTRO">Outro</option>
                            </select>
                            <Button className="w-full justify-center" type="submit">
                                Criar lead
                            </Button>
                        </form>
                    </Card>

                    {selectedLead ? (
                        <Card
                            title={selectedLead.name ?? 'Lead sem nome'}
                            description={selectedLead.assigned_to?.name ?? 'Sem responsável definido'}
                        >
                            <div className="space-y-3 text-sm text-gray-700">
                                <div className="flex items-center justify-between">
                                    <span>Etapa</span>
                                    <span className="font-semibold">{selectedLead.stage_name ?? selectedLead.stage}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Valor</span>
                                    <span className="font-semibold">{formatCurrencyFromCents(selectedLead.estimated_value ?? 0)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Última interação</span>
                                    <span className="font-semibold">{formatDate(selectedLead.last_interaction_at)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Tarefas abertas</span>
                                    <span className="font-semibold">{selectedLead.open_tasks_count ?? 0}</span>
                                </div>

                                <label className="block pt-1">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                                        Nota rápida
                                    </span>
                                    <textarea
                                        value={selectedLead.quick_note ?? ''}
                                        onChange={(event) => updateQuickNoteLocally(selectedLead.id, event.target.value)}
                                        placeholder="Escreva o que aconteceu..."
                                        className="min-h-[96px] w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-gold"
                                    />
                                </label>

                                <a
                                    href={`/leads/${selectedLead.id}`}
                                    className="inline-flex items-center gap-1 font-semibold text-brand-gold-dark hover:underline"
                                >
                                    Abrir detalhe completo
                                    <ChevronRight className="h-4 w-4" />
                                </a>
                            </div>
                        </Card>
                    ) : (
                        <Card title="Selecione um negócio" description="Clique em um card para abrir o resumo lateral.">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <CalendarDays className="h-4 w-4" />
                                O detalhe completo continua em `/leads/:id`.
                            </div>
                        </Card>
                    )}
                </aside>
            </div>
        </div>
    );
}
