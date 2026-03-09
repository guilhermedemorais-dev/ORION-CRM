'use client';

import { useMemo, useState } from 'react';
import {
    Building2,
    CalendarDays,
    Check,
    CircleDot,
    Clock3,
    Mail,
    MessageSquare,
    Paperclip,
    Phone,
    Plus,
    User2,
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
    const [activeCommunicationTab, setActiveCommunicationTab] = useState<CommunicationTab>('EMAIL');
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
        <div className="space-y-5">
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

            <div className="rounded-2xl border border-canvas-border bg-white px-4 py-3 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xl bg-[#F4F6FB] px-4 py-2 text-sm font-medium text-gray-500">Funil de Vendas</span>
                    {stages.map((stage) => (
                        <button
                            key={stage.id}
                            type="button"
                            disabled={isMovingStage}
                            onClick={() => void moveToStage(stage)}
                            className={cn(
                                'rounded-xl border px-4 py-2 text-sm font-medium transition',
                                lead.stage_id === stage.id
                                    ? 'border-[#D6DCEE] bg-white text-gray-900 shadow-sm'
                                    : 'border-transparent bg-[#F4F6FB] text-gray-500 hover:border-[#D6DCEE] hover:bg-white'
                            )}
                        >
                            {stage.name}
                        </button>
                    ))}
                    {wonStage ? (
                        <button
                            type="button"
                            disabled={isMovingStage}
                            onClick={() => void moveToStage(wonStage)}
                            className="rounded-xl border border-[#D6DCEE] bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-[#F9FAFC]"
                        >
                            Ganhou
                        </button>
                    ) : null}
                    {lostStage ? (
                        <button
                            type="button"
                            disabled={isMovingStage}
                            onClick={() => void moveToStage(lostStage)}
                            className="rounded-xl border border-[#D6DCEE] bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-[#F9FAFC]"
                        >
                            Perdeu
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_280px]">
                <div className="space-y-5">
                    <section className="rounded-3xl border border-canvas-border bg-white p-5 shadow-card">
                        <div className="flex items-center justify-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold-light/25 text-brand-gold-dark">
                                <Building2 className="h-7 w-7" />
                            </div>
                        </div>
                        <div className="mt-4 text-center">
                            <h1 className="text-[32px] font-semibold tracking-tight text-gray-800">
                                {lead.name ?? 'Negócio sem nome'}
                            </h1>
                            <p className="text-sm text-gray-500">
                                Criado em {formatDate(lead.created_at)}
                            </p>
                        </div>

                        <div className="mt-6 space-y-4 border-t border-canvas-border pt-5 text-[15px] text-gray-600">
                            <div className="flex items-start gap-3">
                                <span className="mt-1 text-gray-300">$</span>
                                <div>
                                    <p className="text-sm text-gray-400">Valor</p>
                                    <p className="font-semibold text-gray-800">{formatCurrencyFromCents(lead.estimated_value ?? 0)}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <CalendarDays className="mt-1 h-4 w-4 text-gray-300" />
                                <div>
                                    <p className="text-sm text-gray-400">Data prevista</p>
                                    <p className="font-semibold text-gray-800">{primaryTask?.due_date ? formatDate(primaryTask.due_date) : 'Não definida'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <User2 className="mt-1 h-4 w-4 text-gray-300" />
                                <div>
                                    <p className="text-sm text-gray-400">Responsável</p>
                                    <p className="font-semibold uppercase text-gray-800">{lead.assigned_to?.name ?? 'SEM RESPONSÁVEL'}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-canvas-border bg-white p-5 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold-light/25 text-brand-gold-dark">
                                <MessageSquare className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">Campos Personalizados</h2>
                            </div>
                        </div>

                        <div className="mt-5 border-t border-canvas-border pt-5">
                            {customFieldEntries.length === 0 ? (
                                <p className="text-center text-sm text-gray-400">Nenhum campo preenchido</p>
                            ) : (
                                <div className="space-y-3">
                                    {customFieldEntries.map((field) => (
                                        <div key={field.id} className="rounded-2xl border border-canvas-border bg-canvas px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{field.name}</p>
                                            <p className="mt-1 text-sm font-medium text-gray-700">{String(field.value)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="space-y-5">
                    <section className="rounded-3xl border border-canvas-border bg-white p-5 shadow-card">
                        <div className="grid grid-cols-4 gap-3 text-center">
                            <div>
                                <p className="text-[28px] font-semibold text-brand-gold-dark">{daysOpen}</p>
                                <p className="text-xs text-gray-500">Dias aberto</p>
                            </div>
                            <div>
                                <p className="text-[28px] font-semibold text-brand-gold-dark">{daysInStage}</p>
                                <p className="text-xs text-gray-500">Dias na fase</p>
                            </div>
                            <div>
                                <p className="text-[28px] font-semibold text-brand-gold-dark">{interactionsCount}</p>
                                <p className="text-xs text-gray-500">Interações</p>
                            </div>
                            <div>
                                <p className="text-[28px] font-semibold text-brand-gold-dark">{daysWithoutInteraction}</p>
                                <p className="text-xs text-gray-500">Dias sem interação</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-canvas-border bg-white shadow-card">
                        <div className="grid grid-cols-2 border-b border-canvas-border">
                            <button
                                type="button"
                                className="border-b-2 border-brand-gold px-5 py-3 text-sm font-semibold text-gray-800"
                            >
                                Nota
                            </button>
                            <button
                                type="button"
                                className="px-5 py-3 text-sm font-semibold text-gray-400"
                            >
                                Atividade Realizada
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-sm font-semibold text-surface-sidebar">
                                    G
                                </div>
                                <textarea
                                    value={noteDraft}
                                    onChange={(event) => setNoteDraft(event.target.value)}
                                    placeholder="Escreva ou grave o que aconteceu..."
                                    className="min-h-[118px] flex-1 resize-none rounded-2xl border border-canvas-border bg-canvas px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-brand-gold"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-canvas-border px-5 py-4">
                            <span className="text-sm text-gray-400">Tipo de atividade</span>
                            <Button onClick={() => void persistQuickNote()} disabled={isSavingNote}>
                                {isSavingNote ? 'Salvando...' : 'Salvar'}
                            </Button>
                        </div>
                    </section>

                    {primaryTask ? (
                        <section className="rounded-3xl border border-canvas-border bg-white p-4 shadow-card">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold-light/25 text-brand-gold-dark">
                                        <Check className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold text-gray-800">{primaryTask.title}</p>
                                        <p className="text-sm text-gray-500">
                                            {primaryTask.due_date ? formatDate(primaryTask.due_date) : 'Sem data'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-gray-400">
                                    <Check className="h-4 w-4" />
                                    <Clock3 className="h-4 w-4" />
                                    <CircleDot className="h-4 w-4" />
                                </div>
                            </div>
                        </section>
                    ) : null}

                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold-light/25 text-brand-gold-dark">
                                <MessageSquare className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-semibold text-gray-800">Comunicações</h2>
                        </div>

                        <div className="flex gap-2">
                            {(['EMAIL', 'WHATSAPP'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveCommunicationTab(tab)}
                                    className={cn(
                                        'min-w-[120px] rounded-2xl px-4 py-3 text-left text-sm font-semibold transition',
                                        activeCommunicationTab === tab
                                            ? 'bg-white text-brand-gold-dark shadow-card'
                                            : 'bg-[#ECEFF5] text-gray-400'
                                    )}
                                >
                                    {tab === 'EMAIL' ? 'Email' : 'Whatsapp'}
                                    <span className="mt-1 block text-xs font-medium text-inherit">Nenhum</span>
                                </button>
                            ))}
                        </div>

                        <div className="rounded-3xl border border-canvas-border bg-white px-5 py-4 shadow-card">
                            <p className="text-lg font-medium text-gray-700">
                                {activeCommunicationTab === 'EMAIL'
                                    ? 'Registre emails trocados na linha do tempo'
                                    : 'Registre mensagens trocadas na linha do tempo'}
                            </p>
                            <p className="text-sm text-gray-400">
                                {activeCommunicationTab === 'EMAIL'
                                    ? 'Envie através do ORION ou registre através da sua caixa'
                                    : 'Mensagens vindas do WhatsApp aparecem intercaladas na timeline'}
                            </p>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold-light/25 text-brand-gold-dark">
                                <Clock3 className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-semibold text-gray-800">Linha do Tempo</h2>
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
                                            ? 'bg-brand-gold-light/25 text-brand-gold-dark'
                                            : 'bg-transparent text-gray-500 hover:bg-[#F4F6FB]'
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="relative space-y-4 pl-6">
                            <div className="absolute left-[15px] top-0 h-full w-px bg-brand-gold-light/50" />
                            {filteredTimeline.length === 0 ? (
                                <div className="rounded-3xl border border-canvas-border bg-white p-5 text-sm text-gray-400 shadow-card">
                                    Nenhum evento nesta aba.
                                </div>
                            ) : (
                                filteredTimeline.map((entry) => (
                                    <article key={`${entry.source}-${entry.id}`} className="relative rounded-3xl border border-brand-gold-light/40 bg-white p-5 shadow-card">
                                        <div className="absolute -left-[22px] top-6 flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-surface-sidebar">
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
                                                <p className="text-[28px] leading-tight font-semibold text-gray-800">{entry.title}</p>
                                                {entry.body ? (
                                                    <p className="mt-2 whitespace-pre-line text-sm text-gray-500">{entry.body}</p>
                                                ) : null}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-gray-500">{formatDate(entry.created_at)}</p>
                                                <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-gold-light/25 text-sm font-semibold text-brand-gold-dark">
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
                    <section className="rounded-3xl border border-canvas-border bg-white shadow-card">
                        <div className="flex items-center justify-between border-b border-canvas-border px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold-light/20 text-brand-gold-dark">
                                    <User2 className="h-5 w-5" />
                                </div>
                                <h2 className="text-2xl font-semibold text-gray-800">Contato</h2>
                            </div>
                            <PlusBadge />
                        </div>
                        <div className="space-y-2 px-5 py-4 text-gray-700">
                            <p className="text-xl font-semibold">{lead.name ?? 'Contato não informado'}</p>
                            <p className="flex items-center gap-2 text-sm text-gray-500">
                                <Mail className="h-4 w-4 text-green-500" />
                                {lead.email ?? 'Email não informado'}
                            </p>
                            <p className="flex items-center gap-2 text-sm text-gray-500">
                                <Phone className="h-4 w-4 text-green-500" />
                                {formatPhone(lead.whatsapp_number)}
                            </p>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-canvas-border bg-white shadow-card">
                        <div className="flex items-center justify-between border-b border-canvas-border px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold-light/20 text-brand-gold-dark">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <h2 className="text-2xl font-semibold text-gray-800">Empresa</h2>
                            </div>
                            <PlusBadge />
                        </div>
                        <div className="space-y-2 px-5 py-4 text-gray-700">
                            <p className="text-xl font-semibold">{companyName}</p>
                            <p className="flex items-center gap-2 text-sm text-gray-500">
                                <Mail className="h-4 w-4 text-green-500" />
                                {lead.email ?? 'Email não informado'}
                            </p>
                            <p className="flex items-center gap-2 text-sm text-gray-500">
                                <Phone className="h-4 w-4 text-green-500" />
                                {formatPhone(lead.whatsapp_number)}
                            </p>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-canvas-border bg-white shadow-card">
                        <div className="flex items-center justify-between px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3F4F8] text-gray-400">
                                    <Paperclip className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-semibold text-gray-800">Arquivos</h2>
                                    <p className="text-sm text-gray-400">
                                        {attachments.length === 0 ? 'Nenhum arquivo encontrado' : `${attachments.length} arquivo(s)`}
                                    </p>
                                </div>
                            </div>
                            <PlusBadge />
                        </div>
                        {attachments.length > 0 ? (
                            <div className="space-y-2 border-t border-canvas-border px-5 py-4">
                                {attachments.map((file) => (
                                    <a
                                        key={file.id}
                                        href={file.file_path}
                                        target="_blank"
                                        className="block rounded-2xl border border-canvas-border bg-canvas px-4 py-3 transition hover:border-brand-gold-light"
                                    >
                                        <p className="font-medium text-gray-700">{file.filename}</p>
                                        <p className="mt-1 text-xs text-gray-400">{formatBytes(file.file_size)} · {formatDate(file.created_at)}</p>
                                    </a>
                                ))}
                            </div>
                        ) : null}
                    </section>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gold text-surface-sidebar shadow-[0_14px_36px_rgba(200,169,122,0.35)] transition hover:scale-[1.02]"
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
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-canvas-border text-gray-400">
            <span className="text-xl leading-none">+</span>
        </div>
    );
}
