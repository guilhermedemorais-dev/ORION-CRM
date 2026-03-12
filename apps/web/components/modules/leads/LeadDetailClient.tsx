'use client';

import { useMemo, useState } from 'react';
import {
    ChevronRight,
    Building2,
    CalendarDays,
    Check,
    CircleDot,
    Clock3,
    Ellipsis,
    FileText,
    List,
    Mail,
    MessageSquare,
    Mic,
    Paperclip,
    Phone,
    Plus,
    Tag,
    User2,
    Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { LeadRecord, PipelineStageRecord } from '@/lib/api';
import { cn, formatCurrencyFromCents, formatDate, formatPhone } from '@/lib/utils';

interface TaskRecord {
    id: string;
    title: string;
    due_date: string | null;
    done: boolean;
    done_at: string | null;
    assigned_to: string | null;
    created_by: string;
    created_at: string;
}

interface AttachmentRecord {
    id: string;
    filename: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    created_at: string;
}

interface TimelineRecord {
    id: string;
    source: 'timeline' | 'whatsapp';
    type: string;
    title: string;
    body: string | null;
    created_at: string;
}

interface CustomFieldRecord {
    id: string;
    name: string;
    field_key: string;
    field_type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
    required: boolean;
    position: number;
}

type TimelineTab = 'ALL' | 'EMAIL' | 'NOTES' | 'ACTIVITIES' | 'WHATSAPP';
type CommunicationTab = 'EMAIL' | 'WHATSAPP';

const SOURCE_LABEL: Record<LeadRecord['source'], string> = {
    WHATSAPP: 'WhatsApp',
    BALCAO: 'Balcão',
    INDICACAO: 'Indicação',
    OUTRO: 'Outro',
};

function daysSince(value: string | null | undefined): number {
    if (!value) return 0;
    const diff = Date.now() - new Date(value).getTime();
    if (Number.isNaN(diff) || diff < 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function inferCompanyName(lead: LeadRecord): string {
    if (lead.email?.includes('@')) {
        const domain = lead.email.split('@')[1] ?? '';
        const root = domain.split('.')[0] ?? '';
        if (root) {
            return root.charAt(0).toUpperCase() + root.slice(1);
        }
    }

    return lead.name ?? 'Empresa não informada';
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTimelineTabType(entry: TimelineRecord): TimelineTab {
    if (entry.source === 'whatsapp') return 'WHATSAPP';
    if (entry.type === 'NOTE_ADDED') return 'NOTES';
    if (entry.type === 'MESSAGE_SENT' || entry.type === 'MESSAGE_RECEIVED') return 'EMAIL';
    return 'ACTIVITIES';
}

function mapLeadWithStage(lead: LeadRecord, stage: PipelineStageRecord): LeadRecord {
    return {
        ...lead,
        stage_id: stage.id,
        stage_name: stage.name,
        stage_color: stage.color,
        stage_is_won: stage.is_won,
        stage_is_lost: stage.is_lost,
    };
}

function getMonogram(value: string | null | undefined): string {
    if (!value) return 'OR';
    return value
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

function getLeadTags(lead: LeadRecord, customFieldEntries: Array<{ name: string; value: unknown }>): string[] {
    const tags = new Set<string>();

    tags.add(SOURCE_LABEL[lead.source]);

    for (const field of customFieldEntries.slice(0, 2)) {
        tags.add(`${field.value}`);
    }

    if (lead.stage_name) {
        tags.add(lead.stage_name);
    }

    return Array.from(tags).slice(0, 4);
}

interface LeadDetailClientProps {
    initialLead: LeadRecord;
    stages: PipelineStageRecord[];
    tasks: TaskRecord[];
    attachments: AttachmentRecord[];
    timeline: TimelineRecord[];
    customFields: CustomFieldRecord[];
}

export function LeadDetailClient({
    initialLead,
    stages,
    tasks,
    attachments,
    timeline,
    customFields,
}: LeadDetailClientProps) {
    const [lead, setLead] = useState(initialLead);
    const [activeTimelineTab, setActiveTimelineTab] = useState<TimelineTab>('ALL');
    const [activeCommunicationTab, setActiveCommunicationTab] = useState<CommunicationTab>('WHATSAPP');
    const [noteDraft, setNoteDraft] = useState(initialLead.quick_note ?? '');
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isMovingStage, setIsMovingStage] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const wonStage = useMemo(() => stages.find((stage) => stage.is_won) ?? null, [stages]);
    const lostStage = useMemo(() => stages.find((stage) => stage.is_lost) ?? null, [stages]);

    const filteredTimeline = useMemo(() => {
        if (activeTimelineTab === 'ALL') return timeline;
        return timeline.filter((entry) => getTimelineTabType(entry) === activeTimelineTab);
    }, [activeTimelineTab, timeline]);

    const customFieldEntries = useMemo(() => {
        return customFields
            .sort((a, b) => a.position - b.position)
            .map((field) => ({
                ...field,
                value: lead.custom_fields?.[field.field_key],
            }))
            .filter((field) => field.value !== undefined && field.value !== null && field.value !== '');
    }, [customFields, lead.custom_fields]);

    const interactionsCount = timeline.length;
    const daysOpen = daysSince(lead.created_at);
    const daysInStage = daysSince(lead.updated_at);
    const daysWithoutInteraction = daysSince(lead.last_interaction_at);
    const primaryTask = tasks[0] ?? null;
    const companyName = inferCompanyName(lead);
    const leadTags = useMemo(
        () => getLeadTags(lead, customFieldEntries.map((field) => ({ name: field.name, value: field.value }))),
        [customFieldEntries, lead]
    );
    const whatsappMessages = useMemo(
        () => timeline.filter((entry) => entry.source === 'whatsapp'),
        [timeline]
    );
    const emailMessages = useMemo(
        () => timeline.filter((entry) => getTimelineTabType(entry) === 'EMAIL'),
        [timeline]
    );
    const activityFeed = useMemo(
        () => {
            const taskCards = tasks.slice(0, 1).map((task) => ({
                id: `task-${task.id}`,
                kind: 'task' as const,
                title: task.title,
                subtitle: `${task.done ? 'Concluída' : 'Reunião'} · ${task.due_date ? formatDate(task.due_date) : 'Sem data'} · ${lead.assigned_to?.name ?? 'Sem responsável'}`,
            }));
            const noteCards = timeline
                .filter((entry) => entry.source === 'timeline')
                .slice(0, 1)
                .map((entry) => ({
                    id: `timeline-${entry.id}`,
                    kind: 'note' as const,
                    title: entry.title,
                    subtitle: `${entry.type.replaceAll('_', ' ')} · ${formatDate(entry.created_at)}`,
                }));

            return [...taskCards, ...noteCards].slice(0, 2);
        },
        [lead.assigned_to?.name, tasks, timeline]
    );
    const latestCommunication = activeCommunicationTab === 'WHATSAPP'
        ? whatsappMessages[0] ?? null
        : emailMessages[0] ?? null;

    async function persistQuickNote() {
        setIsSavingNote(true);
        setErrorMessage(null);
        setFeedback(null);

        const response = await fetch(`/api/internal/leads/${lead.id}/quick-note`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quickNote: noteDraft }),
        });

        setIsSavingNote(false);

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            setErrorMessage(typeof payload.message === 'string' ? payload.message : 'Falha ao salvar nota.');
            return;
        }

        if (payload.data) {
            setLead(payload.data as LeadRecord);
        } else {
            setLead((current) => ({ ...current, quick_note: noteDraft }));
        }

        setFeedback('Nota salva.');
    }

    async function moveToStage(stage: PipelineStageRecord) {
        if (lead.stage_id === stage.id) return;

        setIsMovingStage(true);
        setErrorMessage(null);
        setFeedback(null);

        const previousLead = lead;
        setLead((current) => mapLeadWithStage(current, stage));

        const response = await fetch(`/api/internal/leads/${lead.id}/stage`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stageId: stage.id }),
        });

        setIsMovingStage(false);

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            setLead(previousLead);
            setErrorMessage(typeof payload.message === 'string' ? payload.message : 'Falha ao mover etapa.');
            return;
        }

        if (payload.data) {
            setLead(payload.data as LeadRecord);
        }

        setFeedback(`Etapa alterada para ${stage.name}.`);
    }

    return (
        <div className="space-y-4 font-[family:var(--font-orion-alt-sans)]">
            {errorMessage ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                </div>
            ) : null}
            {feedback ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {feedback}
                </div>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#18181C] px-4 py-2 shadow-card">
                <div className="flex min-w-max items-center gap-0">
                    <div className="mr-4 flex items-center gap-2 border-r border-white/10 pr-4 text-[11px] text-[color:var(--orion-text-secondary)]">
                        <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                        <span>Pipeline Leads</span>
                    </div>
                    {stages.map((stage, index) => (
                        <div key={stage.id} className="flex items-center">
                            <button
                                type="button"
                                disabled={isMovingStage}
                                onClick={() => void moveToStage(stage)}
                                className={cn(
                                    'relative flex items-center gap-2 px-3 py-2 text-[12px] font-medium transition',
                                    lead.stage_id === stage.id
                                        ? 'font-bold text-[#D4B87E]'
                                        : stage.position < (stages.find((item) => item.id === lead.stage_id)?.position ?? 0)
                                            ? 'text-emerald-300'
                                            : 'text-[#777] hover:text-[#A09A94]'
                                )}
                            >
                                <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: stage.color }} />
                                {stage.name}
                                {lead.stage_id === stage.id ? (
                                    <span className="absolute inset-x-0 -bottom-2 h-[2px] bg-brand-gold" />
                                ) : null}
                            </button>
                            {index < stages.length - 1 ? (
                                <span className="mx-1 h-4 w-px bg-white/10" />
                            ) : null}
                        </div>
                    ))}
                    <div className="ml-auto flex items-center gap-2 pl-4">
                        {wonStage ? (
                            <button
                                type="button"
                                disabled={isMovingStage}
                                onClick={() => void moveToStage(wonStage)}
                                className="inline-flex h-8 items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-4 text-[11px] font-bold text-emerald-300 transition hover:bg-emerald-500/20"
                            >
                                Ganhou
                            </button>
                        ) : null}
                        {lostStage ? (
                            <button
                                type="button"
                                disabled={isMovingStage}
                                onClick={() => void moveToStage(lostStage)}
                                className="inline-flex h-8 items-center rounded-md border border-rose-500/25 bg-rose-500/10 px-4 text-[11px] font-bold text-rose-300 transition hover:bg-rose-500/20"
                            >
                                Perdeu
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
                <div className="space-y-5">
                    <section className="rounded-[10px] border border-white/10 bg-[#18181C] p-4 shadow-card">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(191,160,106,0.14)] text-brand-gold">
                                    <CircleDot className="h-5 w-5" />
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-secondary)]">
                                    Lead
                                </span>
                            </div>
                            <button type="button" className="text-[color:var(--orion-text-secondary)] transition hover:text-brand-gold">
                                <Ellipsis className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-4">
                            <h1 className="font-serif text-[28px] font-semibold tracking-tight text-[color:var(--orion-text)]">
                                {lead.name ?? 'Negócio sem nome'}
                            </h1>
                            <p className="text-sm text-[color:var(--orion-text-secondary)]">
                                Criado em {formatDate(lead.created_at)}
                            </p>
                        </div>

                        <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-[14px] text-[color:var(--orion-text-secondary)]">
                            <div className="flex items-start gap-3">
                                <span className="mt-1 text-brand-gold">$</span>
                                <div>
                                    <p className="text-sm text-[color:var(--orion-text-secondary)]">Valor</p>
                                    <p className="font-semibold text-[color:var(--orion-text)]">{formatCurrencyFromCents(lead.estimated_value ?? 0)}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <CalendarDays className="mt-1 h-4 w-4 text-brand-gold" />
                                <div>
                                    <p className="text-sm text-[color:var(--orion-text-secondary)]">Data prevista</p>
                                    <p className="font-semibold text-[color:var(--orion-text)]">{primaryTask?.due_date ? formatDate(primaryTask.due_date) : 'Não definida'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <User2 className="mt-1 h-4 w-4 text-brand-gold" />
                                <div>
                                    <p className="text-sm text-[color:var(--orion-text-secondary)]">Responsável</p>
                                    <p className="font-semibold uppercase text-[color:var(--orion-text)]">{lead.assigned_to?.name ?? 'SEM RESPONSÁVEL'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Tag className="mt-1 h-4 w-4 text-brand-gold" />
                                <div>
                                    <p className="text-sm text-[color:var(--orion-text-secondary)]">Origem</p>
                                    <p className="font-semibold text-[color:var(--orion-text)]">{SOURCE_LABEL[lead.source]}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-[10px] border border-white/10 bg-[#18181C] p-4 shadow-card">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold">
                                    <Tag className="h-5 w-5" />
                                </div>
                                <h2 className="text-lg font-semibold text-[color:var(--orion-text)]">Tags</h2>
                            </div>
                            <PlusBadge />
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                            {leadTags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex h-7 items-center rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 text-[11px] font-semibold text-brand-gold"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-[10px] border border-white/10 bg-[#18181C] p-4 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(191,160,106,0.14)] text-brand-gold">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-[color:var(--orion-text)]">Campos Personalizados</h2>
                            </div>
                        </div>

                        <div className="mt-5 border-t border-white/10 pt-5">
                            {customFieldEntries.length === 0 ? (
                                <p className="text-center text-sm text-[color:var(--orion-text-secondary)]">Nenhum campo preenchido</p>
                            ) : (
                                <div className="space-y-3">
                                    {customFieldEntries.map((field) => (
                                        <div key={field.id} className="rounded-xl border border-white/10 bg-[#0F0F11] px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">{field.name}</p>
                                            <p className="mt-1 text-sm font-medium text-[color:var(--orion-text)]">{String(field.value)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="space-y-5">
                    <section className="rounded-[10px] border border-white/10 bg-[#18181C] p-4 shadow-card">
                        <div className="grid grid-cols-4 gap-3 text-center">
                            <div>
                                <p className="text-[24px] font-semibold text-brand-gold">{daysOpen}</p>
                                <p className="text-[10px] uppercase tracking-[0.06em] text-[color:var(--orion-text-secondary)]">Dias aberto</p>
                            </div>
                            <div>
                                <p className="text-[24px] font-semibold text-brand-gold">{daysInStage}</p>
                                <p className="text-[10px] uppercase tracking-[0.06em] text-[color:var(--orion-text-secondary)]">Dias na fase</p>
                            </div>
                            <div>
                                <p className="text-[24px] font-semibold text-brand-gold">{interactionsCount}</p>
                                <p className="text-[10px] uppercase tracking-[0.06em] text-[color:var(--orion-text-secondary)]">Interações</p>
                            </div>
                            <div>
                                <p className="text-[24px] font-semibold text-brand-gold">{daysWithoutInteraction}</p>
                                <p className="text-[10px] uppercase tracking-[0.06em] text-[color:var(--orion-text-secondary)]">Dias sem interação</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-[10px] border border-white/10 bg-[#18181C] shadow-card">
                        <div className="grid grid-cols-3 border-b border-white/10">
                            <button
                                type="button"
                                className="flex items-center justify-center gap-2 border-b-2 border-brand-gold px-5 py-3 text-sm font-semibold text-[color:var(--orion-text)]"
                            >
                                <FileText className="h-4 w-4" />
                                Nota
                                <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-brand-gold/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-gold">
                                    {activityFeed.length}
                                </span>
                            </button>
                            <button
                                type="button"
                                className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[color:var(--orion-text-secondary)]"
                            >
                                <MessageSquare className="h-4 w-4" />
                                Atividade Realizada
                            </button>
                            <button
                                type="button"
                                className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[color:var(--orion-text-secondary)]"
                            >
                                <Clock3 className="h-4 w-4" />
                                Timeline
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-sm font-semibold text-black">
                                    G
                                </div>
                                <textarea
                                    value={noteDraft}
                                    onChange={(event) => setNoteDraft(event.target.value)}
                                    placeholder="Escreva ou grave o que aconteceu..."
                                    className="min-h-[118px] flex-1 resize-none rounded-xl border border-white/10 bg-[#0F0F11] px-4 py-3 text-sm text-[color:var(--orion-text)] outline-none transition focus:border-brand-gold"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
                            <span className="inline-flex items-center gap-2 text-sm text-[color:var(--orion-text-secondary)]">
                                <List className="h-4 w-4" />
                                Tipo de atividade
                            </span>
                            <div className="flex items-center gap-3">
                                <button type="button" className="text-[color:var(--orion-text-secondary)] transition hover:text-brand-gold">
                                    <Mic className="h-4 w-4" />
                                </button>
                                <Button onClick={() => void persistQuickNote()} disabled={isSavingNote}>
                                    {isSavingNote ? 'Salvando...' : 'Salvar'}
                                </Button>
                            </div>
                        </div>
                    </section>

                    {activityFeed.map((item) => (
                        <section key={item.id} className="rounded-[10px] border border-white/10 bg-[#18181C] p-4 shadow-card">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <div
                                        className={cn(
                                            'mt-1 flex h-9 w-9 items-center justify-center rounded-xl',
                                            item.kind === 'task'
                                                ? 'bg-[rgba(74,158,255,0.12)] text-[#4A9EFF]'
                                                : 'bg-brand-gold/12 text-brand-gold'
                                        )}
                                    >
                                        {item.kind === 'task' ? <CalendarDays className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold text-[color:var(--orion-text)]">{item.title}</p>
                                        <p className="text-sm text-[color:var(--orion-text-secondary)]">{item.subtitle}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-[color:var(--orion-text-secondary)]">
                                    <Check className="h-4 w-4" />
                                    <Clock3 className="h-4 w-4" />
                                    <Ellipsis className="h-4 w-4" />
                                </div>
                            </div>
                        </section>
                    ))}

                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(191,160,106,0.14)] text-brand-gold">
                                <MessageSquare className="h-5 w-5" />
                            </div>
                            <h2 className="font-serif text-[24px] font-semibold text-[color:var(--orion-text)]">Comunicações</h2>
                        </div>

                        <div className="flex gap-2">
                            {(['EMAIL', 'WHATSAPP'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveCommunicationTab(tab)}
                                    className={cn(
                                        'min-w-[120px] rounded-xl px-4 py-3 text-left text-sm font-semibold transition',
                                        activeCommunicationTab === tab
                                            ? 'border border-brand-gold/20 bg-brand-gold/10 text-brand-gold shadow-card'
                                            : 'border border-white/10 bg-[#18181C] text-[color:var(--orion-text-secondary)]'
                                    )}
                                >
                                    {tab === 'EMAIL' ? 'Email' : 'WhatsApp'}
                                    <span className="mt-1 block text-xs font-medium text-inherit">
                                        {tab === 'EMAIL' ? emailMessages.length : whatsappMessages.length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {latestCommunication ? (
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 rounded-[10px] border border-white/10 bg-[#18181C] px-5 py-4 text-left shadow-card transition hover:border-brand-gold/20"
                            >
                                <div
                                    className={cn(
                                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                        activeCommunicationTab === 'WHATSAPP'
                                            ? 'bg-emerald-500/10 text-emerald-300'
                                            : 'bg-[#4A9EFF]/10 text-[#4A9EFF]'
                                    )}
                                >
                                    <MessageSquare className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-lg font-medium text-[color:var(--orion-text)]">
                                        {latestCommunication.body ?? latestCommunication.title}
                                    </p>
                                    <p className="text-sm text-[color:var(--orion-text-secondary)]">
                                        Última mensagem · {formatDate(latestCommunication.created_at)} · Ver no Inbox →
                                    </p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-[color:var(--orion-text-secondary)]" />
                            </button>
                        ) : (
                            <div className="rounded-[10px] border border-white/10 bg-[#18181C] px-5 py-4 shadow-card">
                                <p className="text-lg font-medium text-[color:var(--orion-text)]">
                                    {activeCommunicationTab === 'EMAIL'
                                        ? 'Registre emails trocados na linha do tempo'
                                        : 'Registre mensagens trocadas na linha do tempo'}
                                </p>
                                <p className="text-sm text-[color:var(--orion-text-secondary)]">
                                    {activeCommunicationTab === 'EMAIL'
                                        ? 'Envie através do ORION ou registre através da sua caixa'
                                        : 'Mensagens vindas do WhatsApp aparecem intercaladas na timeline'}
                                </p>
                            </div>
                        )}
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(191,160,106,0.14)] text-brand-gold">
                                <Clock3 className="h-5 w-5" />
                            </div>
                            <h2 className="font-serif text-[24px] font-semibold text-[color:var(--orion-text)]">Linha do Tempo</h2>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[
                                ['ALL', 'Todas'],
                                ['EMAIL', 'Email'],
                                ['NOTES', 'Notas'],
                                ['ACTIVITIES', 'Atividades'],
                                ['WHATSAPP', 'WhatsApp'],
                            ].map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setActiveTimelineTab(key as TimelineTab)}
                                    className={cn(
                                        'rounded-full px-4 py-2 text-sm font-semibold transition',
                                        activeTimelineTab === key
                                            ? 'bg-brand-gold/15 text-brand-gold'
                                            : 'bg-transparent text-[color:var(--orion-text-secondary)] hover:bg-white/5'
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="relative space-y-4 pl-6">
                            <div className="absolute left-[15px] top-0 h-full w-px bg-brand-gold/30" />
                            {filteredTimeline.length === 0 ? (
                                <div className="rounded-[10px] border border-white/10 bg-[#18181C] p-5 text-sm text-[color:var(--orion-text-secondary)] shadow-card">
                                    Nenhum evento nesta aba.
                                </div>
                            ) : (
                                filteredTimeline.map((entry) => (
                                    <article key={`${entry.source}-${entry.id}`} className="relative rounded-[10px] border border-white/10 bg-[#18181C] p-5 shadow-card">
                                        <div className="absolute -left-[22px] top-6 flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-black">
                                            {entry.source === 'whatsapp' ? (
                                                <MessageSquare className="h-4 w-4" />
                                            ) : entry.type === 'STAGE_CHANGED' ? (
                                                <CircleDot className="h-4 w-4" />
                                            ) : entry.type === 'LEAD_CREATED' ? (
                                                <Building2 className="h-4 w-4" />
                                            ) : (
                                                <Clock3 className="h-4 w-4" />
                                            )}
                                        </div>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-serif text-[26px] leading-tight font-semibold text-[color:var(--orion-text)]">{entry.title}</p>
                                                {entry.body ? (
                                                    <p className="mt-2 whitespace-pre-line text-sm text-[color:var(--orion-text-secondary)]">{entry.body}</p>
                                                ) : null}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-[color:var(--orion-text-secondary)]">{formatDate(entry.created_at)}</p>
                                                <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-gold/15 text-sm font-semibold text-brand-gold">
                                                    G
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                <div className="space-y-5">
                    <section className="rounded-[10px] border border-white/10 bg-[#18181C] shadow-card">
                        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4A9EFF]/10 text-[#4A9EFF]">
                                    <User2 className="h-5 w-5" />
                                </div>
                                <h2 className="font-serif text-[22px] font-semibold text-[color:var(--orion-text)]">Contato</h2>
                            </div>
                            <PlusBadge />
                        </div>
                        <div className="flex items-center gap-3 px-5 py-4 text-[color:var(--orion-text)]">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2a1f0e,#3d2e16)] text-xs font-bold text-brand-gold">
                                {getMonogram(lead.name)}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="truncate text-lg font-semibold">{lead.name ?? 'Contato não informado'}</p>
                                <p className="truncate text-sm text-[color:var(--orion-text-secondary)]">{formatPhone(lead.whatsapp_number)}</p>
                                <p className="truncate text-xs text-[color:var(--orion-text-muted)]">{lead.email ?? '@sem-email'}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-[color:var(--orion-text-secondary)]" />
                        </div>
                    </section>

                    <section className="rounded-[10px] border border-white/10 bg-[#18181C] shadow-card">
                        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <h2 className="font-serif text-[22px] font-semibold text-[color:var(--orion-text)]">Empresa</h2>
                            </div>
                            <PlusBadge />
                        </div>
                        <div className="flex items-center gap-3 px-5 py-4 text-[color:var(--orion-text)]">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10 text-xs font-bold text-brand-gold">
                                {getMonogram(companyName)}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="truncate text-lg font-semibold">{companyName}</p>
                                <p className="truncate text-sm text-[color:var(--orion-text-secondary)]">{lead.email ?? 'Email não informado'}</p>
                                <p className="truncate text-xs text-[color:var(--orion-text-muted)]">Conta vinculada ao lead atual</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-[color:var(--orion-text-secondary)]" />
                        </div>
                    </section>

                    <section className="rounded-[10px] border border-white/10 bg-[#18181C] shadow-card">
                        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-[color:var(--orion-text-secondary)]">
                                    <Users className="h-5 w-5" />
                                </div>
                                <h2 className="font-serif text-[22px] font-semibold text-[color:var(--orion-text)]">Equipe</h2>
                            </div>
                            <PlusBadge />
                        </div>
                        <div className="space-y-3 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-300">
                                    {getMonogram(lead.assigned_to?.name ?? 'SR')}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[color:var(--orion-text)]">
                                        {lead.assigned_to?.name ?? 'Sem responsável'}
                                    </p>
                                    <p className="text-xs text-[color:var(--orion-text-secondary)]">
                                        {lead.assigned_to ? 'Responsável' : 'Aguardando atribuição'}
                                    </p>
                                </div>
                                {lead.assigned_to ? <span className="h-2 w-2 rounded-full bg-emerald-400" /> : null}
                            </div>
                        </div>
                    </section>

                    <section className="rounded-[10px] border border-white/10 bg-[#18181C] shadow-card">
                        <div className="flex items-center justify-between px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-[color:var(--orion-text-secondary)]">
                                    <Paperclip className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="font-serif text-[22px] font-semibold text-[color:var(--orion-text)]">Arquivos</h2>
                                    <p className="text-sm text-[color:var(--orion-text-secondary)]">
                                        {attachments.length === 0 ? 'Nenhum arquivo encontrado' : `${attachments.length} arquivo(s)`}
                                    </p>
                                </div>
                            </div>
                            <PlusBadge />
                        </div>
                        {attachments.length > 0 ? (
                            <div className="space-y-2 border-t border-white/10 px-5 py-4">
                                {attachments.map((file) => (
                                    <a
                                        key={file.id}
                                        href={file.file_path}
                                        target="_blank"
                                        className="block rounded-xl border border-white/10 bg-[#0F0F11] px-4 py-3 transition hover:border-brand-gold-light"
                                    >
                                        <p className="font-medium text-[color:var(--orion-text)]">{file.filename}</p>
                                        <p className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">{formatBytes(file.file_size)} · {formatDate(file.created_at)}</p>
                                    </a>
                                ))}
                            </div>
                        ) : null}
                    </section>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gold text-black shadow-[0_14px_36px_rgba(200,169,122,0.35)] transition hover:scale-[1.02]"
                        >
                            <Plus className="h-8 w-8" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PlusBadge() {
    return (
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[color:var(--orion-text-secondary)]">
            <span className="text-xl leading-none">+</span>
        </div>
    );
}
