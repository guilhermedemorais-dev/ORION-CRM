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
    Plus,
    Tag,
    User2,
    Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LeadAppointmentsTab } from '@/app/(crm)/agenda/components/LeadAppointmentsTab';
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
type CenterTab = 'AGENDA' | 'NOTES' | 'COMMS' | 'TIMELINE';

const SOURCE_LABEL: Record<LeadRecord['source'], string> = {
    WHATSAPP: 'WhatsApp',
    BALCAO: 'Balcão',
    INDICACAO: 'Indicação',
    INSTAGRAM: 'Instagram',
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
    const [activeCenterTab, setActiveCenterTab] = useState<CenterTab>('AGENDA');
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
        <div className="flex h-full flex-col overflow-hidden font-sans bg-[#080809]">
            {errorMessage ? (
                <div className="shrink-0 rounded-md border border-red-200/10 bg-red-500/10 px-4 py-3 text-sm text-red-400 m-4 mb-0">
                    {errorMessage}
                </div>
            ) : null}
            {feedback ? (
                <div className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 m-4 mb-0">
                    {feedback}
                </div>
            ) : null}

            {/* STAGE BAR */}
            <div className="flex h-[46px] shrink-0 items-center overflow-x-auto border-b border-white/5 bg-[#1A1A1E] px-4 [&::-webkit-scrollbar]:hidden">
                {/* Breadcrumb */}
                <div className="mr-4 flex items-center gap-1.5 border-r border-white/5 pr-4 text-[11px] text-[#777]">
                    <ChevronRight className="h-3 w-3 rotate-180" />
                    <span className="cursor-pointer">Pipeline Leads</span>
                </div>

                {/* Stages */}
                <div className="flex flex-1 items-center gap-0">
                    {stages.map((stage, index) => {
                        const isCurrent = lead.stage_id === stage.id;
                        const leadStageIndex = stages.findIndex((item) => item.id === lead.stage_id);
                        const isDone = stage.position < (leadStageIndex >= 0 ? stages[leadStageIndex].position : 0);

                        return (
                            <div key={stage.id} className="flex items-center h-[46px]">
                                <button
                                    type="button"
                                    disabled={isMovingStage}
                                    onClick={() => void moveToStage(stage)}
                                    className={cn(
                                        'relative flex h-full items-center gap-1.5 px-3.5 text-[12px] font-medium transition-colors hover:text-[#A09A94]',
                                        isCurrent ? 'text-[#D4B87E] font-bold' : isDone ? 'text-[#4CAF82]' : 'text-[#777]'
                                    )}
                                >
                                    <div 
                                        className="h-[5px] w-[5px] shrink-0 rounded-full" 
                                        style={{ backgroundColor: isCurrent ? '#BFA06A' : isDone ? '#4CAF82' : stage.color }} 
                                    />
                                    <span className="whitespace-nowrap">{stage.name}</span>
                                    {isCurrent && (
                                        <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#BFA06A]" />
                                    )}
                                    {isDone && !isCurrent && (
                                        <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#4CAF82]" />
                                    )}
                                </button>
                                {index < stages.length - 1 && (
                                    <div className="mx-0.5 h-3.5 w-px shrink-0 bg-white/5" />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Next Stage / Final Actions */}
                <div className="ml-auto flex items-center gap-1.5 pl-4">
                    {wonStage ? (
                        <button
                            type="button"
                            disabled={isMovingStage}
                            onClick={() => void moveToStage(wonStage)}
                            className="flex h-7 items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/15 px-3.5 text-[11px] font-bold text-emerald-500 transition-colors hover:bg-emerald-500/25"
                        >
                            <Check className="h-3 w-3" strokeWidth={2.5} /> Ganhou
                        </button>
                    ) : null}
                    {lostStage ? (
                        <button
                            type="button"
                            disabled={isMovingStage}
                            onClick={() => void moveToStage(lostStage)}
                            className="flex h-7 items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-3.5 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-500/20"
                        >
                            <CircleDot className="h-3 w-3" strokeWidth={2.5} /> Perdeu
                        </button>
                    ) : null}
                </div>
            </div>

            {/* PAGE BODY */}
            <div className="flex flex-1 overflow-hidden xl:flex-row flex-col max-h-[calc(100vh-140px)]">
                {/* --- COL LEFT --- */}
                <div className="flex xl:w-[260px] w-full shrink-0 flex-col gap-3 xl:overflow-y-auto overflow-x-hidden border-r border-white/5 bg-[#080809] p-4 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[#222]">
                    
                    {/* LEAD INFO */}
                    <div className="rounded-[10px] border border-white/5 bg-[#131316] p-[14px]">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#BFA06A]/10 text-[#BFA06A]">
                                    <CircleDot className="h-3 w-3" strokeWidth={2} />
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-[1px] text-[#777]">Lead</span>
                            </div>
                            <button type="button" className="flex items-center justify-center text-[#777] transition-colors hover:text-[#BFA06A]">
                                <Ellipsis className="h-4 w-4" strokeWidth={2} />
                            </button>
                        </div>
                        
                        <h1 className="mb-0.5 font-serif text-[18px] font-bold text-[#F0EBE3]">{lead.name ?? 'Negócio sem nome'}</h1>
                        <p className="mb-3.5 text-[11px] text-[#777]">Criado em {formatDate(lead.created_at)}</p>
                        
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#52515A]">
                                    <CircleDot className="h-2.5 w-2.5" strokeWidth={2} /> Valor estimado
                                </div>
                                <div className="text-[13px] font-semibold text-[#D4B87E]">
                                    {formatCurrencyFromCents(lead.estimated_value ?? 0)}
                                </div>
                            </div>
                            <div className="m-0 h-px w-full bg-white/5" />
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#52515A]">
                                    <CalendarDays className="h-2.5 w-2.5" strokeWidth={2} /> Previsão de fechamento
                                </div>
                                <div className="text-[13px] font-semibold text-[#F0EBE3]">
                                    {primaryTask?.due_date ? formatDate(primaryTask.due_date) : 'Não definida'}
                                </div>
                            </div>
                            <div className="m-0 h-px w-full bg-white/5" />
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#52515A]">
                                    <User2 className="h-2.5 w-2.5" strokeWidth={2} /> Responsável
                                </div>
                                <div className="mt-1 flex items-center gap-1.5">
                                    <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#1a3a1a] text-[8px] font-extrabold text-[#4CAF82]">
                                        {getMonogram(lead.assigned_to?.name ?? 'SR')}
                                    </div>
                                    <div className="text-[12px] font-semibold text-[#F0EBE3] uppercase">
                                        {lead.assigned_to?.name ?? 'SEM RESPONSÁVEL'}
                                    </div>
                                </div>
                            </div>
                            <div className="m-0 h-px w-full bg-white/5" />
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#52515A]">
                                    <Tag className="h-2.5 w-2.5" strokeWidth={2} /> Origem
                                </div>
                                <div className="text-[13px] font-semibold text-[#F0EBE3]">{SOURCE_LABEL[lead.source]}</div>
                            </div>
                        </div>
                    </div>

                    {/* STATS */}
                    <div className="overflow-hidden rounded-[10px] border border-white/5 bg-[#131316]">
                        <div className="flex">
                            <div className="flex flex-1 flex-col items-center border-r border-white/5 px-1 py-3">
                                <div className="text-[18px] font-bold text-[#D4B87E]">{daysOpen}</div>
                                <div className="text-center text-[9px] font-semibold uppercase tracking-[0.3px] text-[#777]">Dias aberto</div>
                            </div>
                            <div className="flex flex-1 flex-col items-center border-r border-white/5 px-1 py-3">
                                <div className="text-[18px] font-bold text-[#D4B87E]">{daysInStage}</div>
                                <div className="text-center text-[9px] font-semibold uppercase tracking-[0.3px] text-[#777]">Dias na fase</div>
                            </div>
                            <div className="flex flex-1 flex-col items-center border-r border-white/5 px-1 py-3">
                                <div className="text-[18px] font-bold text-[#4CAF82]">{interactionsCount}</div>
                                <div className="text-center text-[9px] font-semibold uppercase tracking-[0.3px] text-[#777]">Interações</div>
                            </div>
                            <div className="flex flex-1 flex-col items-center px-1 py-3">
                                <div className="text-[18px] font-bold text-[#F0A040]">{daysWithoutInteraction}</div>
                                <div className="text-center text-[9px] font-semibold uppercase tracking-[0.3px] text-[#777] leading-tight">Dias sem<br/>interação</div>
                            </div>
                        </div>
                    </div>

                    {/* TAGS */}
                    <div className="rounded-[10px] border border-white/5 bg-[#131316] p-[14px]">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1px] text-[#777]">
                                <Tag className="h-3 w-3" strokeWidth={2} /> Tags
                            </div>
                            <button type="button" className="flex items-center justify-center text-[#777] transition-colors hover:text-[#BFA06A]">
                                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {leadTags.map((tag) => (
                                <div key={tag} className="flex h-[20px] items-center gap-1.5 rounded-full border border-[#BFA06A]/20 bg-[#BFA06A]/10 px-2.5 text-[10px] font-bold text-[#D4B87E]">
                                    {tag}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CUSTOM FIELDS */}
                    <div className="rounded-[10px] border border-white/5 bg-[#131316] p-[14px]">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1px] text-[#777]">
                                <List className="h-3 w-3" strokeWidth={2} /> Personalizados
                            </div>
                            <button type="button" className="flex items-center justify-center text-[#777] transition-colors hover:text-[#BFA06A]">
                                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {customFieldEntries.length === 0 ? (
                                <div className="py-2 text-center text-[11px] italic text-[#52515A]">
                                    Nenhum campo preenchido
                                </div>
                            ) : (
                                customFieldEntries.map((field, idx) => (
                                    <div key={field.id} className="flex flex-col gap-0.5">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#52515A]">{field.name}</div>
                                        <div className="text-[13px] font-semibold text-[#F0EBE3]">{String(field.value)}</div>
                                        {idx < customFieldEntries.length - 1 && (
                                            <div className="my-1.5 h-px w-full bg-white/5" />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* --- COL CENTER --- */}
                <div className="flex flex-1 flex-col overflow-hidden border-r border-white/5 bg-[#080809]">
                    
                    {/* CENTER TABS */}
                    <div className="flex h-[42px] shrink-0 overflow-x-auto border-b border-white/5 px-[18px] [&::-webkit-scrollbar]:hidden">
                        <button
                            type="button"
                            onClick={() => setActiveCenterTab('AGENDA')}
                            className={cn(
                                'flex h-[42px] shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-[11px] font-semibold transition-colors uppercase tracking-[0.4px]',
                                activeCenterTab === 'AGENDA' ? 'border-[#BFA06A] text-[#D4B87E]' : 'border-transparent text-[#777] hover:text-[#A09A94]'
                            )}
                        >
                            <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
                            Agenda
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveCenterTab('NOTES')}
                            className={cn(
                                'flex h-[42px] shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-[11px] font-semibold transition-colors uppercase tracking-[0.4px]',
                                activeCenterTab === 'NOTES' ? 'border-[#BFA06A] text-[#D4B87E]' : 'border-transparent text-[#777] hover:text-[#A09A94]'
                            )}
                        >
                            <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                            Notas & Atividades
                            <div className="flex h-3.5 min-w-[14px] items-center justify-center rounded-sm bg-[#BFA06A]/15 px-1 text-[9px] font-extrabold text-[#8A7248] border border-[#BFA06A]/10">
                                {activityFeed.length}
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveCenterTab('COMMS')}
                            className={cn(
                                'flex h-[42px] shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-[11px] font-semibold transition-colors uppercase tracking-[0.4px]',
                                activeCenterTab === 'COMMS' ? 'border-[#BFA06A] text-[#D4B87E]' : 'border-transparent text-[#777] hover:text-[#A09A94]'
                            )}
                        >
                            <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                            Comunicações
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveCenterTab('TIMELINE')}
                            className={cn(
                                'flex h-[42px] shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-[11px] font-semibold transition-colors uppercase tracking-[0.4px]',
                                activeCenterTab === 'TIMELINE' ? 'border-[#BFA06A] text-[#D4B87E]' : 'border-transparent text-[#777] hover:text-[#A09A94]'
                            )}
                        >
                            <Clock3 className="h-3.5 w-3.5" strokeWidth={2} />
                            Linha do Tempo
                        </button>
                    </div>

                    {/* CENTER BODY */}
                    <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-[18px] py-4 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[#222]">
                        
                        {/* Always show Note Input as header of the center feed */}
                        <div className="rounded-[10px] border border-white/5 bg-[#131316] overflow-hidden">
                            <textarea
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="Escreva ou grave o que aconteceu..."
                                className="min-h-[80px] w-full resize-none bg-transparent px-3.5 py-3 font-sans text-[13px] leading-relaxed text-[#A09A94] outline-none transition-colors placeholder:text-[#52515A] focus:text-[#F0EBE3]"
                            />
                            <div className="flex items-center justify-between border-t border-white/5 bg-[#18181C] px-2.5 py-2">
                                <div className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#777] hover:text-[#A09A94]">
                                    <List className="h-3 w-3" strokeWidth={2} />
                                    Tipo de atividade
                                    <ChevronRight className="h-3 w-3 rotate-90" strokeWidth={2.5} />
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <button type="button" className="text-[#777] transition-colors hover:text-[#BFA06A]">
                                        <Mic className="h-4 w-4" strokeWidth={2} />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => void persistQuickNote()} disabled={isSavingNote}
                                        className="h-[26px] rounded-[5px] border-none bg-[#BFA06A] px-3 font-sans text-[11px] font-bold text-[#0C0C0E] transition-colors hover:bg-[#D4B87E]"
                                    >
                                        {isSavingNote ? '...' : 'Salvar'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* SECTION: AGENDA */}
                        {activeCenterTab === 'AGENDA' && (
                            <div className="pt-2">
                                <LeadAppointmentsTab leadId={lead.id} />
                            </div>
                        )}

                        {/* SECTION: NOTES & ACTIVITIES */}
                        {activeCenterTab === 'NOTES' && (
                            <div className="flex flex-col gap-2">
                                {activityFeed.length === 0 && (
                                    <div className="text-center text-[12px] text-[#777] py-6">Nenhuma atividade recente.</div>
                                )}
                                {activityFeed.map((item) => (
                                    <div key={item.id} className="flex items-start gap-3 rounded-[10px] border border-white/5 bg-[#131316] p-[14px]">
                                        <div className={cn(
                                            'flex h-7 w-7 mt-0.5 shrink-0 items-center justify-center rounded-lg border',
                                            item.kind === 'task' ? 'border-[#4A9EFF]/20 bg-[#4A9EFF]/10 text-[#4A9EFF]' : 'border-[#BFA06A]/20 bg-[#BFA06A]/10 text-[#BFA06A]'
                                        )}>
                                            {item.kind === 'task' ? <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} /> : <FileText className="h-3.5 w-3.5" strokeWidth={2} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-0.5 text-[13px] font-bold text-[#F0EBE3]">{item.title}</div>
                                            <div className="text-[11px] text-[#777]">{item.subtitle}</div>
                                        </div>
                                        <div className="flex items-center gap-2 text-[#777]">
                                            <div className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-white/5 hover:text-[#4CAF82]"><Check className="h-3.5 w-3.5" strokeWidth={2.5} /></div>
                                            <div className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-white/5 hover:text-[#BFA06A]"><Clock3 className="h-3.5 w-3.5" strokeWidth={2} /></div>
                                            <div className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-white/5 hover:text-[#BFA06A]"><Ellipsis className="h-3.5 w-3.5" strokeWidth={2} /></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* SECTION: COMUNICAÇÕES */}
                        {activeCenterTab === 'COMMS' && (
                            <div>
                                <div className="mb-3 flex items-center gap-2">
                                    <div className="text-[14px] font-bold text-[#F0EBE3]">Comunicações</div>
                                </div>
                                <div className="mb-3 flex overflow-hidden rounded-[8px] border border-white/5 bg-[#0F0F11]">
                                    <button 
                                        type="button" 
                                        onClick={() => setActiveCommunicationTab('WHATSAPP')}
                                        className={cn(
                                            'flex-1 flex h-[34px] items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.4px] transition-all',
                                            activeCommunicationTab === 'WHATSAPP' ? 'bg-[#18181C] text-[#D4B87E] shadow-[0_1px_3px_rgba(0,0,0,0.5)]' : 'text-[#777] hover:bg-white/5'
                                        )}
                                    >
                                        <MessageSquare className="h-3 w-3" fill={activeCommunicationTab === 'WHATSAPP' ? 'currentColor' : 'none'} />
                                        WhatsApp <span className="text-[10px] font-extrabold text-[#25D366]">{whatsappMessages.length}</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setActiveCommunicationTab('EMAIL')}
                                        className={cn(
                                            'flex-1 flex h-[34px] items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.4px] transition-all',
                                            activeCommunicationTab === 'EMAIL' ? 'bg-[#18181C] text-[#D4B87E] shadow-[0_1px_3px_rgba(0,0,0,0.5)]' : 'text-[#777] hover:bg-white/5'
                                        )}
                                    >
                                        <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                                        Email <span className="text-[10px] font-extrabold">{emailMessages.length}</span>
                                    </button>
                                </div>
                                
                                {latestCommunication ? (
                                    <div className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-white/5 bg-[#131316] p-[14px] transition-colors hover:border-[#BFA06A]/25">
                                        <div className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                                            activeCommunicationTab === 'WHATSAPP' ? "border-[#25D366]/20 bg-[#25D366]/10 text-[#25D366]" : "border-[#4A9EFF]/20 bg-[#4A9EFF]/10 text-[#4A9EFF]"
                                        )}>
                                            {activeCommunicationTab === 'WHATSAPP' ? (
                                                <MessageSquare className="h-3.5 w-3.5" fill="currentColor" />
                                            ) : (
                                                <Mail className="h-3.5 w-3.5" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-0.5 text-[13px] font-semibold text-[#F0EBE3]">{latestCommunication.body ?? latestCommunication.title}</div>
                                            <div className="text-[11px] text-[#777]">Última mensagem · {formatDate(latestCommunication.created_at)} · Ver no Inbox →</div>
                                        </div>
                                        <ChevronRight className="h-3.5 w-3.5 mt-1 text-[#777]" strokeWidth={2} />
                                    </div>
                                ) : (
                                    <div className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-white/5 bg-[#131316] p-[14px] transition-colors hover:border-white/10">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-[#18181C] text-[#777]">
                                            {activeCommunicationTab === 'WHATSAPP' ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                                        </div>
                                        <div>
                                            <div className="text-[12px] font-semibold text-[#A09A94]">Nenhuma comunicação registrada</div>
                                            <div className="text-[11px] text-[#52515A]">Histórico do canal ficará visível aqui</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECTION: TIMELINE */}
                        {activeCenterTab === 'TIMELINE' && (
                            <div>
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="text-[14px] font-bold text-[#F0EBE3]">Linha do Tempo</div>
                                    <div className="flex flex-wrap gap-[0px] overflow-hidden rounded-[6px] border border-white/5 bg-[#0F0F11]">
                                        {[
                                            ['ALL', 'Todas'],
                                            ['NOTES', 'Notas'],
                                            ['ACTIVITIES', 'Ativ'],
                                            ['WHATSAPP', 'WA'],
                                        ].map(([key, label]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setActiveTimelineTab(key as TimelineTab)}
                                                className={cn(
                                                    'h-[24px] px-2 text-[9px] font-bold uppercase transition-all',
                                                    activeTimelineTab === key ? 'bg-[#18181C] text-[#D4B87E]' : 'text-[#777] hover:bg-white/5'
                                                )}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="flex flex-col pt-2 pb-8 pl-[16px]">
                                    {filteredTimeline.length === 0 ? (
                                        <div className="py-6 text-center text-[12px] text-[#777]">Nenhum evento na linha do tempo.</div>
                                    ) : (
                                        filteredTimeline.map((entry, index) => {
                                            const isLast = index === filteredTimeline.length - 1;
                                            return (
                                                <div key={`${entry.source}-${entry.id}`} className="relative flex gap-3 pb-5">
                                                    {!isLast && (
                                                        <div className="absolute bottom-[-5px] left-[13px] top-[26px] w-[2px] bg-white/5" />
                                                    )}
                                                    <div className="relative z-10 flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full border-[2px] border-[#080809] bg-[#1A1A1E]">
                                                        {entry.source === 'whatsapp' ? (
                                                            <MessageSquare className="h-[10px] w-[10px] text-[#25D366]" fill="#25D366" />
                                                        ) : entry.type === 'STAGE_CHANGED' ? (
                                                            <CircleDot className="h-[10px] w-[10px] text-[#BFA06A]" />
                                                        ) : (
                                                            <Clock3 className="h-[10px] w-[10px] text-[#777]" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1 pt-[4px]">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <div className="mb-[2px] text-[12px] font-bold text-[#F0EBE3]">{entry.title}</div>
                                                            <div className="whitespace-nowrap text-[9px] font-semibold text-[#52515A] uppercase tracking-[0.3px]">{formatDate(entry.created_at)}</div>
                                                        </div>
                                                        {entry.body && <div className="text-[11px] leading-snug text-[#A09A94]">{entry.body}</div>}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- COL RIGHT --- */}
                <div className="flex xl:w-[260px] w-full shrink-0 flex-col gap-3 xl:overflow-y-auto overflow-x-hidden bg-[#080809] p-4 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[#222]">
                    
                    {/* CONTATO */}
                    <div className="rounded-[10px] border border-white/5 bg-[#131316] p-[14px]">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1px] text-[#777]">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#4A9EFF]/10 text-[#4A9EFF]">
                                    <User2 className="h-3 w-3" strokeWidth={2} />
                                </div>
                                Contato
                            </div>
                            <button type="button" className="flex items-center justify-center text-[#777] transition-colors hover:text-[#BFA06A]">
                                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2.5 py-1">
                            {/* FALLBACK AVATAR ESTILO SYSTEM */}
                            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2a1f0e,#3d2e16)] border border-[#BFA06A]/20 text-[12px] font-extrabold text-[#BFA06A] shadow-[0_0_10px_rgba(191,160,106,0.15)]">
                                {getMonogram(lead.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="mb-[1px] truncate text-[12px] font-bold text-[#F0EBE3]">{lead.name ?? 'Contato não informado'}</div>
                                <div className="truncate text-[10px] font-semibold tracking-wide text-[#777]">{formatPhone(lead.whatsapp_number)}</div>
                                <div className="truncate text-[10px] text-[#52515A]">{lead.email ?? '@sem-email'}</div>
                            </div>
                        </div>
                    </div>

                    {/* EMPRESA */}
                    <div className="rounded-[10px] border border-white/5 bg-[#131316] p-[14px]">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1px] text-[#777]">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#BFA06A]/10 text-[#BFA06A]">
                                    <Building2 className="h-3 w-3" strokeWidth={2} />
                                </div>
                                Empresa
                            </div>
                            <button type="button" className="flex items-center justify-center text-[#777] transition-colors hover:text-[#BFA06A]">
                                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2.5 py-1">
                            <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-lg border border-[#BFA06A]/20 bg-[#BFA06A]/5 text-[10px] font-extrabold text-[#8A7248] shadow-sm">
                                {getMonogram(companyName)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="mb-[1px] truncate text-[12px] font-bold text-[#F0EBE3]">{companyName}</div>
                                <div className="truncate text-[10px] font-semibold text-[#777]">Conta vinculada</div>
                            </div>
                        </div>
                    </div>

                    {/* EQUIPE */}
                    <div className="rounded-[10px] border border-white/5 bg-[#131316] p-[14px]">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1px] text-[#777]">
                                <Users className="h-3 w-3" strokeWidth={2} />
                                Equipe
                            </div>
                            <button type="button" className="flex items-center justify-center text-[#777] transition-colors hover:text-[#4CAF82]">
                                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2.5 py-1">
                            <div className="relative flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-[#1A1A1E] border border-white/5 text-[10px] font-extrabold text-[#777] shadow-sm">
                                {getMonogram(lead.assigned_to?.name ?? 'SR')}
                                {lead.assigned_to && (
                                    <div className="absolute bottom-[0px] right-[0px] h-[8px] w-[8px] rounded-full border-2 border-[#131316] bg-[#4CAF82]" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-bold text-[#F0EBE3]">{lead.assigned_to?.name ?? 'Sem responsável'}</div>
                                <div className="truncate text-[10px] font-semibold text-[#52515A]">Responsável</div>
                            </div>
                        </div>
                    </div>

                    {/* ARQUIVOS */}
                    <div className="rounded-[10px] border border-white/5 bg-[#131316] p-[14px]">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1px] text-[#777]">
                                <Paperclip className="h-3 w-3" strokeWidth={2} />
                                Arquivos
                            </div>
                            <button type="button" className="flex items-center justify-center text-[#777] transition-colors hover:text-[#BFA06A]">
                                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {attachments.length === 0 ? (
                                <div className="py-2 text-center text-[11px] italic text-[#52515A]">Nenhum arquivo anexado</div>
                            ) : (
                                attachments.map((file) => (
                                    <div key={file.id} className="group flex cursor-pointer items-center justify-between rounded-md border border-white/5 bg-[#18181C] px-2.5 py-2 transition-colors hover:border-[#BFA06A]/30">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#4A9EFF]/10">
                                                <FileText className="h-3 w-3 text-[#4A9EFF]" strokeWidth={2} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[11px] font-bold text-[#F0EBE3] group-hover:text-[#D4B87E]">{file.filename}</div>
                                                <div className="text-[9px] text-[#52515A] tracking-wider uppercase">{formatBytes(file.file_size)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

// O componente PlusBadge não é mais utilizado no novo layout
