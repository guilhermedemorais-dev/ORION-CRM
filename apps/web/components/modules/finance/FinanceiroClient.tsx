'use client';

import type { ReactNode } from 'react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
} from 'react';
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Loader2,
    MoreVertical,
    Paperclip,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { uploadFinancialReceiptAction } from '@/app/(crm)/financeiro/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import '@/app/(crm)/dashboard/components/DashboardTemplate.css';
import { MonthlyGoalModal } from '@/components/modules/finance/MonthlyGoalModal';
import type {
    FinanceCommissionRecord,
    FinanceDashboardResponse,
    FinanceLaunchFilter,
    FinanceLaunchesResponse,
    FinanceLaunchRecord,
    FinancePeriod,
} from '@/lib/financeiro-types';
import { parseCurrencyToCents } from '@/lib/financeiro';
import { getMonthlyFinanceGoalKey, readMonthlyFinanceGoal, writeMonthlyFinanceGoal } from '@/lib/finance-goal';
import { cn, formatCurrencyFromCents } from '@/lib/utils';

const TYPE_OPTIONS: Array<{ value: FinanceLaunchFilter; label: string }> = [
    { value: 'todos', label: 'Todos' },
    { value: 'receitas', label: 'Receitas' },
    { value: 'despesas', label: 'Despesas' },
    { value: 'pendentes', label: 'Pendentes' },
];

const CATEGORY_OPTIONS = [
    'VENDA_BALCAO',
    'PEDIDO',
    'MATERIAIS',
    'ALUGUEL_INFRA',
    'MARKETING',
    'OUTROS',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
    VENDA_BALCAO: 'Vendas Balcão',
    PEDIDO: 'Pedido',
    MATERIAIS: 'Materiais',
    ALUGUEL_INFRA: 'Aluguel Infra',
    MARKETING: 'Marketing',
    OUTROS: 'Outros',
};

const PIE_COLORS = ['#C8A97A', '#3B82F6', '#F59E0B', '#10B981', '#FB7185'];

const MONTH_SHORT_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_FULL_LABELS = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
];

function parseLocalDate(value: string): Date {
    const clean = value.split('T')[0];
    const [year, month, day] = clean.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function formatShortDate(value: string | undefined): string {
    if (!value) {
        return 'Sem data';
    }

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(parseLocalDate(value));
}

function formatCompactDate(value: string | undefined): string {
    if (!value) {
        return '--';
    }

    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(parseLocalDate(value));
}

function formatDelta(delta: number): string {
    const sign = delta > 0 ? '▲' : '▼';
    return `${sign} ${Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs mês anterior`;
}

function formatCategory(value: string): string {
    if (CATEGORY_LABELS[value]) {
        return CATEGORY_LABELS[value];
    }
    return value
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

function getLaunchBadge(record: FinanceLaunchRecord) {
    if (record.status === 'pendente') {
        return {
            label: 'Pendente',
            className: 'bg-[#FEF3C7] text-[#92400E]',
        };
    }

    if (record.type === 'ENTRADA') {
        return {
            label: 'Receita',
            className: 'bg-[#D1FAE5] text-[#065F46]',
        };
    }

    return {
        label: 'Despesa',
        className: 'bg-[#FEE2E2] text-[#991B1B]',
    };
}

function canDeleteLaunch(record: FinanceLaunchRecord, role?: string): boolean {
    if (role === 'ROOT') {
        return true;
    }

    return record.status !== 'pendente' && !record.reference.order_id && !record.reference.payment_id;
}

interface ToastState {
    id: number;
    type: 'success' | 'error';
    message: string;
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastState[]; onDismiss: (id: number) => void }) {
    return (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    role="status"
                    aria-live="polite"
                    className={cn(
                        'pointer-events-auto flex min-w-[280px] max-w-[420px] items-start gap-3 rounded-[12px] border px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.25)]',
                        toast.type === 'success'
                            ? 'border-[#10B981]/40 bg-[#0B2D24] text-[#A7F3D0]'
                            : 'border-[#EF4444]/40 bg-[#2D0B0B] text-[#FCA5A5]'
                    )}
                >
                    {toast.type === 'success' ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    )}
                    <div className="flex-1 text-[13px] leading-relaxed">{toast.message}</div>
                    <button
                        type="button"
                        onClick={() => onDismiss(toast.id)}
                        aria-label="Fechar notificação"
                        className="text-current/60 transition hover:opacity-80"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

function LightCard({
    title,
    description,
    className,
    children,
    id,
}: {
    title: string;
    description?: string;
    className?: string;
    children: ReactNode;
    id?: string;
}) {
    return (
        <Card id={id} title={title} description={description} className={cn('bg-[color:var(--orion-surface)]', className)}>
            {children}
        </Card>
    );
}

function KpiCard({
    label,
    accentClassName,
    valueClassName,
    value,
    delta,
    helper,
}: {
    label: string;
    accentClassName: string;
    valueClassName: string;
    value: string;
    delta: string;
    helper: string;
}) {
    return (
        <div className="overflow-hidden rounded-[18px] border border-[color:var(--orion-border-low)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[var(--orion-shadow-card)]">
            <div className={cn('h-[3px] w-full', accentClassName)} />
            <div className="p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-muted)]">{label}</div>
                <div className={cn('mt-3 font-serif text-[26px] font-semibold leading-none', valueClassName)}>{value}</div>
                <div className="mt-2 text-[12px] font-semibold text-[color:var(--orion-text)]">{delta}</div>
                <div className="mt-1 text-[11px] text-[color:var(--orion-text-secondary)]">{helper}</div>
            </div>
        </div>
    );
}

function DialogContainer({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    useEffect(() => {
        function handleKeydown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('keydown', handleKeydown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeydown);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-[460px] rounded-[18px] border border-[color:var(--orion-border-low)] bg-[color:var(--orion-surface)] p-7 shadow-[var(--orion-shadow-dialog)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-5 flex items-center justify-between gap-3">
                    <h2 className="font-serif text-[18px] font-semibold text-[color:var(--orion-text)]">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--orion-text-secondary)] transition hover:bg-white/5 hover:text-[color:var(--orion-text)]"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

interface LaunchDraft {
    id: string | null;
    tipo: 'receita' | 'despesa';
    descricao: string;
    valor: string;
    data: string;
    categoria: string;
    payment_method: string;
}

function makeEmptyDraft(todayDate: string): LaunchDraft {
    return {
        id: null,
        tipo: 'despesa',
        descricao: '',
        valor: '',
        data: todayDate,
        categoria: 'OUTROS',
        payment_method: '',
    };
}

function LaunchFormModal({
    title,
    initial,
    submitLabel,
    onSubmit,
    onClose,
}: {
    title: string;
    initial: LaunchDraft;
    submitLabel: string;
    onSubmit: (draft: LaunchDraft) => Promise<{ ok: boolean; message?: string }>;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState<LaunchDraft>(initial);
    const [valorError, setValorError] = useState<string | null>(null);
    const [descricaoError, setDescricaoError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    function validate(target: LaunchDraft): boolean {
        let ok = true;

        if (!target.descricao.trim() || target.descricao.trim().length < 5) {
            setDescricaoError('Descreva com pelo menos 5 caracteres.');
            ok = false;
        } else {
            setDescricaoError(null);
        }

        const cents = parseCurrencyToCents(target.valor);
        if (!cents) {
            setValorError('Informe um valor maior que zero');
            ok = false;
        } else {
            setValorError(null);
        }

        return ok;
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (submitting) {
            return;
        }

        if (!validate(draft)) {
            return;
        }

        setSubmitting(true);
        setSubmitError(null);

        const result = await onSubmit(draft);

        if (!result.ok) {
            setSubmitError(result.message ?? 'Falha ao salvar lançamento.');
            setSubmitting(false);
        }
        // Success: parent closes modal — keep submitting=true so button stays disabled
    }

    return (
        <DialogContainer title={title} onClose={() => (submitting ? undefined : onClose())}>
            <form onSubmit={handleSubmit} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">Tipo</span>
                        <select
                            value={draft.tipo}
                            onChange={(event) => setDraft((prev) => ({ ...prev, tipo: event.target.value as 'receita' | 'despesa' }))}
                            className="h-10 rounded-[10px] border border-[color:var(--orion-border-mid)] bg-[color:var(--orion-base)] px-3 text-[13px] text-[color:var(--orion-text)] outline-none"
                        >
                            <option value="receita">Receita</option>
                            <option value="despesa">Despesa</option>
                        </select>
                    </label>
                    <label className="grid gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">Data</span>
                        <input
                            type="date"
                            required
                            value={draft.data}
                            onChange={(event) => setDraft((prev) => ({ ...prev, data: event.target.value }))}
                            className="h-10 rounded-[10px] border border-[color:var(--orion-border-mid)] bg-[color:var(--orion-base)] px-3 text-[13px] text-[color:var(--orion-text)] outline-none"
                        />
                    </label>
                </div>

                <label className="grid gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">Método de pagamento</span>
                    <select
                        value={draft.payment_method}
                        onChange={(event) => setDraft((prev) => ({ ...prev, payment_method: event.target.value }))}
                        className="h-10 rounded-[10px] border border-[color:var(--orion-border-mid)] bg-[color:var(--orion-base)] px-3 text-[13px] text-[color:var(--orion-text)] outline-none"
                    >
                        <option value="">Selecionar (opcional)</option>
                        <option value="PIX">PIX</option>
                        <option value="CARTAO_CREDITO">Cartão de crédito</option>
                        <option value="CARTAO_DEBITO">Cartão de débito</option>
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="TRANSFERENCIA">Transferência</option>
                        <option value="BOLETO">Boleto</option>
                        <option value="LINK_PAGAMENTO">Link de pagamento</option>
                    </select>
                </label>

                <label className="grid gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">Descrição</span>
                    <input
                        placeholder="Ex: Venda de aliança, aluguel, campanha..."
                        value={draft.descricao}
                        onChange={(event) => setDraft((prev) => ({ ...prev, descricao: event.target.value }))}
                        onBlur={() => {
                            if (!draft.descricao.trim() || draft.descricao.trim().length < 5) {
                                setDescricaoError('Descreva com pelo menos 5 caracteres.');
                            } else {
                                setDescricaoError(null);
                            }
                        }}
                        className={cn(
                            'h-10 rounded-[10px] border bg-[color:var(--orion-base)] px-3 text-[13px] text-[color:var(--orion-text)] outline-none',
                            descricaoError ? 'border-[color:var(--orion-red)]' : 'border-[color:var(--orion-border-mid)]'
                        )}
                    />
                    {descricaoError ? (
                        <span className="text-sm text-[color:var(--orion-red)]">{descricaoError}</span>
                    ) : null}
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">Valor (R$)</span>
                        <input
                            inputMode="decimal"
                            placeholder="0,00"
                            value={draft.valor}
                            onChange={(event) => {
                                setDraft((prev) => ({ ...prev, valor: event.target.value }));
                                if (valorError) {
                                    setValorError(null);
                                }
                            }}
                            onBlur={() => {
                                const cents = parseCurrencyToCents(draft.valor);
                                if (!cents) {
                                    setValorError('Informe um valor maior que zero');
                                }
                            }}
                            className={cn(
                                'h-10 rounded-[10px] border bg-[color:var(--orion-base)] px-3 text-[13px] text-[color:var(--orion-text)] outline-none',
                                valorError ? 'border-[color:var(--orion-red)]' : 'border-[color:var(--orion-border-mid)]'
                            )}
                        />
                        {valorError ? (
                            <span className="text-sm text-[color:var(--orion-red)]">{valorError}</span>
                        ) : null}
                    </label>
                    <label className="grid gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">Categoria</span>
                        <select
                            value={draft.categoria}
                            onChange={(event) => setDraft((prev) => ({ ...prev, categoria: event.target.value }))}
                            className="h-10 rounded-[10px] border border-[color:var(--orion-border-mid)] bg-[color:var(--orion-base)] px-3 text-[13px] text-[color:var(--orion-text)] outline-none"
                        >
                            {CATEGORY_OPTIONS.map((category) => (
                                <option key={category} value={category}>
                                    {formatCategory(category)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {submitError ? (
                    <div className="rounded-[10px] border border-[color:rgba(224,82,82,0.25)] bg-[color:rgba(224,82,82,0.12)] px-3 py-2 text-sm text-[color:var(--orion-red)]">
                        {submitError}
                    </div>
                ) : null}

                <div className="mt-2 flex gap-3">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={submitting}
                        className="flex-1"
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {submitting ? 'Salvando...' : submitLabel}
                    </Button>
                </div>
            </form>
        </DialogContainer>
    );
}

function ConfirmDialog({
    title,
    message,
    confirmLabel,
    onConfirm,
    onCancel,
    busy,
}: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    busy: boolean;
}) {
    return (
        <DialogContainer title={title} onClose={() => (busy ? undefined : onCancel())}>
            <p className="text-[13px] text-[color:var(--orion-text-secondary)]">{message}</p>
            <div className="mt-6 flex gap-3">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={busy}
                    className="flex-1"
                >
                    Cancelar
                </Button>
                <Button
                    type="button"
                    variant="danger"
                    onClick={onConfirm}
                    disabled={busy}
                    className="flex-1"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {busy ? 'Excluindo...' : confirmLabel}
                </Button>
            </div>
        </DialogContainer>
    );
}

function buildPeriodOptions(now: Date): Array<{ value: FinancePeriod; label: string; tooltip: string }> {
    const monthShort = MONTH_SHORT_LABELS[now.getMonth()];
    const monthFull = MONTH_FULL_LABELS[now.getMonth()];
    const year = now.getFullYear();
    return [
        { value: '7d', label: '7d', tooltip: 'Últimos 7 dias' },
        { value: 'mes', label: monthShort, tooltip: `Mês atual (${monthFull}/${year})` },
        { value: 'trimestre', label: 'Trim', tooltip: 'Trimestre atual' },
        { value: 'ano', label: 'Ano', tooltip: 'Ano atual' },
    ];
}

function countBusinessDaysBetween(start: Date, end: Date): number {
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    let count = 0;

    while (cursor <= last) {
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) {
            count += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return count;
}

function countBusinessDaysRemaining(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDay = date.getDate() + 1;
    const lastDay = new Date(year, month + 1, 0).getDate();
    let count = 0;

    for (let day = startDay; day <= lastDay; day += 1) {
        const dow = new Date(year, month, day).getDay();
        if (dow !== 0 && dow !== 6) {
            count += 1;
        }
    }

    return count;
}

interface KebabMenuProps {
    onEdit: () => void;
    onDelete: () => void;
    disabled?: boolean;
    canDelete?: boolean;
}

function KebabMenu({ onEdit, onDelete, disabled, canDelete = true }: KebabMenuProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    return (
        <div ref={containerRef} className="relative inline-flex">
            <button
                type="button"
                aria-label="Ações do lançamento"
                disabled={disabled}
                onClick={() => setOpen((value) => !value)}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[color:var(--orion-text-secondary)] transition hover:bg-white/5 hover:text-[color:var(--orion-text)] disabled:opacity-40"
            >
                <MoreVertical className="h-4 w-4" />
            </button>
            {open ? (
                <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-[10px] border border-[color:var(--orion-border-low)] bg-[color:var(--orion-nav)] shadow-[var(--orion-shadow-popover)]">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onEdit();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[color:var(--orion-text)] hover:bg-white/5"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!canDelete) {
                                return;
                            }
                            setOpen(false);
                            onDelete();
                        }}
                        disabled={!canDelete}
                        title={canDelete ? 'Excluir lançamento' : 'Lançamentos vinculados a pedidos ou pagamentos não podem ser excluídos'}
                        className={cn(
                            'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px]',
                            canDelete
                                ? 'text-[color:var(--orion-red)] hover:bg-white/5'
                                : 'cursor-not-allowed text-[color:var(--orion-text-disabled)]'
                        )}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                    </button>
                </div>
            ) : null}
        </div>
    );
}

export function FinanceiroClient({
    dashboard,
    commissions,
    launches,
    filters,
    todayDate,
    error,
    currentUserRole,
}: {
    dashboard: FinanceDashboardResponse;
    commissions: FinanceCommissionRecord[];
    launches: FinanceLaunchesResponse;
    filters: {
        period: FinancePeriod;
        type: FinanceLaunchFilter;
        search: string;
    };
    todayDate: string;
    error?: string | null;
    currentUserRole: string;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [hasMounted, setHasMounted] = useState(false);
    const [searchValue, setSearchValue] = useState(filters.search);
    const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
    const [editingLaunch, setEditingLaunch] = useState<FinanceLaunchRecord | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<FinanceLaunchRecord | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toasts, setToasts] = useState<ToastState[]>([]);
    const [goalModalOpen, setGoalModalOpen] = useState(false);
    const [monthlyGoalCents, setMonthlyGoalCents] = useState<number | null>(null);

    const periodOptions = useMemo(() => buildPeriodOptions(new Date()), []);
    const selectedPeriod = periodOptions.find((option) => option.value === filters.period);
    const selectedPeriodLabel = selectedPeriod?.tooltip ?? 'Período selecionado';
    const currentDate = useMemo(() => new Date(todayDate), [todayDate]);
    const businessDaysRemaining = useMemo(() => countBusinessDaysRemaining(currentDate), [currentDate]);
    const businessDaysElapsed = useMemo(
        () => countBusinessDaysBetween(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), currentDate),
        [currentDate]
    );

    const chartSeries = useMemo(
        () => dashboard.grafico_barras.map((point) => ({
            label: point.label,
            amount_cents: point.receitas_cents,
        })),
        [dashboard.grafico_barras]
    );
    const hasChartData = chartSeries.length > 0 && chartSeries.some((point) => point.amount_cents > 0);
    const chartStats = useMemo(() => {
        if (!hasChartData) {
            return {
                linePath: '',
                areaPath: '',
                dotX: 0,
                dotY: 0,
                maxDay: 0,
                avgDay: 0,
            };
        }

        const width = 600;
        const height = 180;
        const topPad = 20;
        const bottomPad = 10;
        const values = chartSeries.map((point) => point.amount_cents / 100);
        const max = Math.max(...values, 1);
        const min = Math.min(...values, 0);
        const range = Math.max(max - min, 1);
        const stepX = chartSeries.length > 1 ? width / (chartSeries.length - 1) : width;
        const points = values.map((value, index) => {
            const x = Math.round(index * stepX);
            const normalized = (value - min) / range;
            const y = Math.round(height - bottomPad - normalized * (height - topPad - bottomPad));
            return { x, y };
        });
        const linePath = points
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
            .join(' ');
        const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
        const last = points[points.length - 1] ?? { x: 0, y: 0 };
        const avgDay = Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);

        return {
            linePath,
            areaPath,
            dotX: last.x,
            dotY: last.y,
            maxDay: Math.round(max),
            avgDay,
        };
    }, [chartSeries, hasChartData]);
    const goalProgress = monthlyGoalCents ? Math.min(100, (dashboard.receitas.total_cents / monthlyGoalCents) * 100) : 0;
    const goalRemaining = monthlyGoalCents ? Math.max(monthlyGoalCents - dashboard.receitas.total_cents, 0) : 0;
    const projectedRevenue = useMemo(() => {
        if (!monthlyGoalCents) {
            return dashboard.receitas.total_cents;
        }

        const safeElapsed = Math.max(businessDaysElapsed, 1);
        const projected = Math.round((dashboard.receitas.total_cents / safeElapsed) * (safeElapsed + businessDaysRemaining));
        return Number.isFinite(projected) && projected > 0 ? projected : dashboard.receitas.total_cents;
    }, [businessDaysElapsed, businessDaysRemaining, dashboard.receitas.total_cents, monthlyGoalCents]);

    const pushToast = useCallback((toast: Omit<ToastState, 'id'>) => {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((prev) => [...prev, { ...toast, id }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((entry) => entry.id !== id));
        }, 4500);
    }, []);

    const dismissToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((entry) => entry.id !== id));
    }, []);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        if (error) {
            pushToast({ type: 'error', message: error });
        }
    }, [error, pushToast]);

    useEffect(() => {
        const readGoal = () => {
            setMonthlyGoalCents(readMonthlyFinanceGoal(currentDate)?.amount_cents ?? null);
        };

        readGoal();

        function handleStorage(event: StorageEvent) {
            if (event.key !== getMonthlyFinanceGoalKey(currentDate)) {
                return;
            }
            readGoal();
        }

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [currentDate]);

    useEffect(() => {
        setSearchValue(filters.search);
    }, [filters.search]);

    useEffect(() => {
        const normalizedSearch = searchValue.trim();
        if (normalizedSearch === filters.search) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            const params = new URLSearchParams();
            params.set('periodo', filters.period);
            params.set('tipo', filters.type);
            if (normalizedSearch) {
                params.set('search', normalizedSearch);
            }

            startTransition(() => {
                router.replace(`/financeiro?${params.toString()}`, { scroll: false });
            });
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [filters.period, filters.search, filters.type, router, searchValue, startTransition]);

    function navigateWith(nextFilters: Partial<{ period: FinancePeriod; type: FinanceLaunchFilter; search: string; page: number }>) {
        const params = new URLSearchParams();
        const period = nextFilters.period ?? filters.period;
        const type = nextFilters.type ?? filters.type;
        const search = nextFilters.search ?? filters.search;
        const page = nextFilters.page ?? launches.meta.page;

        params.set('periodo', period);
        params.set('tipo', type);

        if (search.trim()) {
            params.set('search', search.trim());
        }

        if (page > 1) {
            params.set('page', String(page));
        }

        startTransition(() => {
            router.replace(`/financeiro?${params.toString()}`, { scroll: false });
        });
    }

    async function handleSaveMonthlyGoal(amountCents: number) {
        const goal = writeMonthlyFinanceGoal(amountCents, currentDate);
        setMonthlyGoalCents(goal.amount_cents);
        setGoalModalOpen(false);
        pushToast({ type: 'success', message: 'Meta mensal salva com sucesso.' });
    }

    async function submitLaunch(draft: LaunchDraft): Promise<{ ok: boolean; message?: string }> {
        const cents = parseCurrencyToCents(draft.valor);
        if (!cents) {
            return { ok: false, message: 'Informe um valor maior que zero.' };
        }

        const isUpdate = Boolean(draft.id);
        const path = isUpdate
            ? `/api/internal/financeiro/lancamentos/${draft.id}`
            : '/api/internal/financeiro/lancamentos';

        try {
            const response = await fetch(path, {
                method: isUpdate ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({
                    tipo: draft.tipo,
                    descricao: draft.descricao.trim(),
                    valor: cents,
                    data: draft.data,
                    categoria: draft.categoria,
                    payment_method: draft.payment_method || '',
                }),
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = typeof payload?.message === 'string'
                    ? payload.message
                    : isUpdate
                        ? 'Falha ao atualizar lançamento.'
                        : 'Falha ao registrar lançamento.';
                return { ok: false, message };
            }

            pushToast({
                type: 'success',
                message: isUpdate ? 'Lançamento atualizado com sucesso!' : 'Lançamento salvo com sucesso!',
            });

            setIsLaunchModalOpen(false);
            setEditingLaunch(null);

            startTransition(() => {
                router.refresh();
            });

            return { ok: true };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Falha ao salvar lançamento.';
            return { ok: false, message };
        }
    }

    async function handleDelete(record: FinanceLaunchRecord) {
        if (record.status === 'pendente' && currentUserRole !== 'ROOT') {
            pushToast({ type: 'error', message: 'Pagamentos pendentes não podem ser excluídos.' });
            return;
        }

        if (!canDeleteLaunch(record, currentUserRole)) {
            pushToast({ type: 'error', message: 'Lançamentos vinculados a pedidos ou pagamentos não podem ser excluídos.' });
            return;
        }

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/internal/financeiro/lancamentos/${record.id}`, {
                method: 'DELETE',
                cache: 'no-store',
            });

            if (!response.ok && response.status !== 204) {
                const payload = await response.json().catch(() => ({}));
                const message = typeof payload?.message === 'string' ? payload.message : 'Falha ao excluir lançamento.';
                pushToast({ type: 'error', message });
                return;
            }

            pushToast({ type: 'success', message: 'Lançamento excluído.' });
            setConfirmDelete(null);
            startTransition(() => {
                router.refresh();
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Falha ao excluir lançamento.';
            pushToast({ type: 'error', message });
        } finally {
            setIsDeleting(false);
        }
    }

    function buildEditDraft(record: FinanceLaunchRecord): LaunchDraft {
        return {
            id: record.id,
            tipo: record.type === 'ENTRADA' ? 'receita' : 'despesa',
            descricao: record.description,
            valor: (record.amount_cents / 100).toFixed(2).replace('.', ','),
            data: record.competence_date.slice(0, 10),
            categoria: CATEGORY_OPTIONS.includes(record.category as typeof CATEGORY_OPTIONS[number])
                ? record.category
                : 'OUTROS',
            payment_method: record.payment_method ?? '',
        };
    }

    const maxCommissionValue = commissions[0]?.comissao_cents ?? 0;
    const paymentMethods = useMemo(() => {
        const counts = new Map<string, number>();
        let total = 0;

        for (const record of launches.data) {
            const method = record.payment_method || 'OUTROS';
            counts.set(method, (counts.get(method) ?? 0) + 1);
            total += 1;
        }

        if (total === 0) {
            return [
                { method: 'CARTAO_CREDITO', amount_cents: 0, percentage: 52 },
                { method: 'PIX', amount_cents: 0, percentage: 31 },
                { method: 'CARTAO_DEBITO', amount_cents: 0, percentage: 17 },
            ];
        }

        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([method, count]) => ({
                method,
                amount_cents: 0,
                percentage: Math.round((count / total) * 100),
            }));
    }, [launches.data]);

    const commissionsCount = dashboard.comissoes.attendants ?? 0;

    if (!hasMounted) {
        return (
            <div className="orion-crm min-h-screen bg-[color:var(--orion-base)] text-[color:var(--orion-text)]">
                <div className="h-14 border-b border-[color:var(--orion-border-low)] bg-[color:var(--orion-nav)]" />
                <div className="space-y-6 p-7">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={`finance-kpi-${index}`}
                                className="h-[150px] animate-pulse rounded-[14px] border border-[color:var(--orion-border-low)] bg-white/5"
                            />
                        ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
                        <div className="h-[320px] animate-pulse rounded-[14px] border border-[color:var(--orion-border-low)] bg-white/5" />
                        <div className="h-[320px] animate-pulse rounded-[14px] border border-[color:var(--orion-border-low)] bg-white/5" />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
                        <div className="h-[280px] animate-pulse rounded-[14px] border border-[color:var(--orion-border-low)] bg-white/5" />
                        <div className="h-[280px] animate-pulse rounded-[14px] border border-[color:var(--orion-border-low)] bg-white/5" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="orion-crm min-h-screen bg-[color:var(--orion-base)] text-[color:var(--orion-text)]">
            <div className="flex flex-col gap-3 border-b border-[color:var(--orion-border-low)] bg-[color:var(--orion-nav)] px-4 py-4 md:px-7 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="hidden md:flex md:flex-col">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--orion-text-muted)]">Caixa e comissões</p>
                        <h1 className="mt-1 font-serif text-[20px] font-bold text-[color:var(--orion-text)]">Financeiro</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="inline-flex flex-1 overflow-hidden rounded-[10px] border border-[color:var(--orion-border-low)] bg-white/5 md:flex-initial">
                            {periodOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    title={option.tooltip}
                                    aria-label={option.tooltip}
                                    disabled={isPending}
                                    onClick={() => navigateWith({ period: option.value, page: 1 })}
                                    className={cn(
                                        'h-9 flex-1 px-4 text-[12px] font-medium transition md:flex-initial',
                                        filters.period === option.value
                                            ? 'bg-[color:var(--orion-gold)] font-bold text-black'
                                            : 'bg-transparent text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-[color:var(--orion-text)]'
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsLaunchModalOpen(true)}
                            aria-label="Novo lançamento"
                            className="flex h-9 min-w-[44px] items-center justify-center gap-2 rounded-[10px] bg-[color:var(--orion-gold)] px-3 text-[13px] font-bold text-black transition hover:bg-[color:var(--orion-gold-light)] md:hidden"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <Button
                    type="button"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => setIsLaunchModalOpen(true)}
                    className="hidden md:inline-flex"
                >
                    Novo Lançamento
                </Button>
            </div>

            <div className="space-y-4 p-4 md:p-6">
                <div className="flex flex-col gap-3 border-b border-[color:var(--orion-border-low)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--orion-text-muted)]">
                            Financeiro
                        </p>
                        <h1 className="mt-1 font-serif text-[22px] font-semibold leading-[1.02] text-[color:var(--orion-text)] md:text-[30px]">
                            Caixa, comissões e lançamentos no mesmo painel.
                        </h1>
                        <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--orion-text-secondary)]">
                            Visão compacta do período atual com gráfico, meta mensal e ações operacionais sem sobra de espaço.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-[color:var(--orion-gold-border)] bg-[color:var(--orion-gold-bg)] px-3 py-1 text-[11px] font-semibold text-[color:var(--orion-gold-light)]">
                                {selectedPeriodLabel}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-[color:var(--orion-text-secondary)]">
                                {launches.meta.total.toLocaleString('pt-BR')} lançamentos
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-[color:var(--orion-text-secondary)]">
                                {formatCurrencyFromCents(dashboard.saldo.total_cents)} de saldo
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="inline-flex overflow-hidden rounded-[10px] border border-[color:var(--orion-border-low)] bg-white/5">
                            {periodOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    title={option.tooltip}
                                    aria-label={option.tooltip}
                                    disabled={isPending}
                                    onClick={() => navigateWith({ period: option.value, page: 1 })}
                                    className={cn(
                                        'h-9 px-4 text-[12px] font-medium transition',
                                        filters.period === option.value
                                            ? 'bg-[color:var(--orion-gold)] font-bold text-black'
                                            : 'bg-transparent text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-[color:var(--orion-text)]'
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsLaunchModalOpen(true)}
                            aria-label="Novo lançamento"
                            className="flex h-9 min-w-[44px] items-center justify-center gap-2 rounded-[10px] bg-[color:var(--orion-gold)] px-3 text-[13px] font-bold text-black transition hover:bg-[color:var(--orion-gold-light)] md:hidden"
                        >
                            <Plus className="h-4 w-4" />
                        </button>

                        <Button
                            type="button"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={() => setIsLaunchModalOpen(true)}
                            className="hidden md:inline-flex"
                        >
                            Novo Lançamento
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <section className="panel">
                        <div className="panel-head">
                            <span className="panel-title">Faturamento — Últimos 30 Dias</span>
                            <Link href="#finance-lancamentos" className="panel-action">
                                Ver lançamentos →
                            </Link>
                        </div>
                        <div className="panel-body" style={{ position: 'relative', gap: '10px' }}>
                            <div style={{ position: 'relative', flex: 1, minHeight: '210px' }}>
                                {hasChartData ? (
                                    <svg className="chart-svg" width="100%" height="100%" viewBox="0 0 600 180" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="finance-chart-gradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#C8A97A" stopOpacity={0.15} />
                                                <stop offset="100%" stopColor="#C8A97A" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <line x1="0" y1="45" x2="600" y2="45" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                                        <line x1="0" y1="90" x2="600" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                                        <line x1="0" y1="135" x2="600" y2="135" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                                        <path className="chart-area" d={chartStats.areaPath} fill="url(#finance-chart-gradient)" />
                                        <path className="chart-line" d={chartStats.linePath} fill="none" stroke="#C8A97A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <circle className="chart-dot" cx={chartStats.dotX} cy={chartStats.dotY} r="4" fill="#111113" stroke="#C8A97A" strokeWidth="2" />
                                    </svg>
                                ) : (
                                    <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-white/10 text-[11px] text-[#777]">
                                        Nenhum dado para o período
                                    </div>
                                )}
                            </div>
                            <div className="chart-stats">
                                <div>
                                    <div className="cs-label">Maior Dia</div>
                                    <div className="cs-val" suppressHydrationWarning>{formatCurrencyFromCents(chartStats.maxDay * 100)}</div>
                                </div>
                                <div>
                                    <div className="cs-label">Média Diária</div>
                                    <div className="cs-val" suppressHydrationWarning>{formatCurrencyFromCents(chartStats.avgDay * 100)}</div>
                                </div>
                                <div>
                                    <div className="cs-label">Meta do Mês</div>
                                    <div className="cs-val" title={monthlyGoalCents ? 'Meta mensal configurada' : 'Nenhuma meta configurada'}>
                                        {monthlyGoalCents ? formatCurrencyFromCents(monthlyGoalCents) : '--'}
                                    </div>
                                </div>
                                <div style={{ marginLeft: 'auto' }}>
                                    <div className="cs-label">Projeção</div>
                                    <div className="cs-val" title={monthlyGoalCents ? 'Projeção baseada no ritmo atual' : 'Projeção indisponível sem meta configurada'}>
                                        {monthlyGoalCents ? formatCurrencyFromCents(projectedRevenue) : '--'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-col gap-4">
                        <section className="panel">
                            <div className="panel-head">
                                <span className="panel-title">Meta do Mês</span>
                                <button type="button" onClick={() => setGoalModalOpen(true)} className="panel-action">
                                    {monthlyGoalCents ? 'Alterar meta →' : 'Configurar meta →'}
                                </button>
                            </div>
                            <div className="panel-body">
                                {monthlyGoalCents ? (
                                    <>
                                        <div className="meta-hero">
                                            <div className="meta-value">{formatCurrencyFromCents(monthlyGoalCents)}</div>
                                            <div className="meta-pct">{goalProgress.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</div>
                                        </div>
                                        <div className="meta-bar-wrap">
                                            <div className="meta-bar-fill" style={{ width: `${Math.max(0, Math.min(goalProgress, 100))}%` }} />
                                        </div>
                                        <div className="meta-stats">
                                            <div className="meta-stat">
                                                <div className="meta-stat-label">Atual</div>
                                                <div className="meta-stat-val">{formatCurrencyFromCents(dashboard.receitas.total_cents)}</div>
                                            </div>
                                            <div className="meta-stat">
                                                <div className="meta-stat-label">Restante</div>
                                                <div className="meta-stat-val">{formatCurrencyFromCents(goalRemaining)}</div>
                                            </div>
                                            <div className="meta-stat">
                                                <div className="meta-stat-label">Projeção</div>
                                                <div className="meta-stat-val">{formatCurrencyFromCents(projectedRevenue)}</div>
                                            </div>
                                        </div>
                                        <div className="meta-proj">
                                            <div className="meta-proj-label">{businessDaysRemaining} dias úteis restam</div>
                                            <div className="meta-proj-val">{goalRemaining === 0 ? 'Meta batida' : 'Em progresso'}</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center">
                                        <div className="mx-auto max-w-[240px] text-[11px] leading-6 text-[#888]">
                                            Nenhuma meta configurada para o mês. Defina um valor para acompanhar progresso e projeção de fechamento.
                                        </div>
                                        <Button
                                            type="button"
                                            variant="gold-ghost"
                                            size="md"
                                            onClick={() => setGoalModalOpen(true)}
                                            className="mt-4"
                                        >
                                            Configurar meta →
                                        </Button>
                                        <div className="mt-3 text-[10px] text-[#555]">{businessDaysRemaining} dias úteis restam</div>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="panel">
                            <div className="panel-head">
                                <span className="panel-title">Formas de Pagamento</span>
                            </div>
                            <div className="panel-body" style={{ gap: 0, justifyContent: 'space-around' }}>
                                {paymentMethods.map((pm, i) => (
                                    <div key={i} className="pay-row">
                                        <div className="pay-label-row">
                                            <span className="pay-lbl">{pm.method === 'CARTAO_CREDITO' || pm.method === 'CREDIT_CARD' ? 'Cartão de crédito' : pm.method === 'CARTAO_DEBITO' || pm.method === 'DEBIT_CARD' ? 'Débito' : pm.method === 'PIX' ? 'PIX' : pm.method}</span>
                                            <span className="pay-pct">{pm.percentage}%</span>
                                        </div>
                                        <div className="pay-bg">
                                            <div className="pay-fill" style={{ width: `${pm.percentage}%`, background: i === 0 ? '#C8A97A' : i === 1 ? '#60A5FA' : '#555' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                        label="Receitas"
                        accentClassName="bg-[#10B981]"
                        valueClassName="text-[#10B981]"
                        value={formatCurrencyFromCents(dashboard.receitas.total_cents)}
                        delta={formatDelta(dashboard.receitas.delta_percent)}
                        helper={`${dashboard.receitas.count ?? 0} lançamentos`}
                    />
                    <KpiCard
                        label="Despesas"
                        accentClassName="bg-[#EF4444]"
                        valueClassName="text-[#EF4444]"
                        value={formatCurrencyFromCents(dashboard.despesas.total_cents)}
                        delta={formatDelta(dashboard.despesas.delta_percent)}
                        helper={`${dashboard.despesas.count ?? 0} lançamentos`}
                    />
                    <KpiCard
                        label="Saldo do Mês"
                        accentClassName="bg-[#C8A97A]"
                        valueClassName="text-[#A8895A]"
                        value={formatCurrencyFromCents(dashboard.saldo.total_cents)}
                        delta={formatDelta(dashboard.saldo.delta_percent)}
                        helper={`Ticket médio ${formatCurrencyFromCents(dashboard.saldo.ticket_medio_cents ?? 0)}`}
                    />
                    <KpiCard
                        label="Comissões a Pagar"
                        accentClassName="bg-[#3B82F6]"
                        valueClassName="text-[#3B82F6]"
                        value={formatCurrencyFromCents(dashboard.comissoes.total_cents)}
                        delta={`${commissionsCount} ${commissionsCount === 1 ? 'atendente' : 'atendentes'}`}
                        helper={`Vencimento ${formatShortDate(dashboard.comissoes.due_date)}`}
                    />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
                    <LightCard
                        id="finance-lancamentos"
                        title="Lançamentos"
                        description="Busca, filtro e paginação operacional."
                    >
                        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                {TYPE_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => navigateWith({ type: option.value, page: 1 })}
                                        className={cn(
                                            'inline-flex min-h-[44px] items-center justify-center rounded-full border px-3 text-[12px] font-medium transition lg:min-h-0 lg:h-8 lg:py-1.5',
                                            filters.type === option.value
                                                ? 'border-[#C8A97A] bg-[#C8A97A] text-black'
                                                : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            <label
                                className={cn(
                                    'relative flex h-[34px] w-full items-center gap-2 rounded-[10px] border bg-white/5 px-3 xl:max-w-[260px]',
                                    searchValue.trim().length > 0 ? 'border-[color:var(--orion-gold)]' : 'border-[color:var(--orion-border-low)]'
                                )}
                            >
                                <Search className="h-4 w-4 text-[color:var(--orion-text-muted)]" />
                                <input
                                    value={searchValue}
                                    onChange={(event) => setSearchValue(event.target.value)}
                                    placeholder="Buscar lançamento..."
                                    className="w-full border-0 bg-transparent p-0 pr-6 text-[13px] text-[color:var(--orion-text)] outline-none placeholder:text-[color:var(--orion-text-muted)]"
                                />
                                {searchValue.length > 0 ? (
                                    <button
                                        type="button"
                                        aria-label="Limpar busca"
                                        onClick={() => setSearchValue('')}
                                        className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--orion-text-muted)] hover:bg-white/5 hover:text-[color:var(--orion-text)]"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                ) : null}
                            </label>
                        </div>

                        {launches.data.length === 0 ? (
                            <div className="rounded-[12px] border border-dashed border-[color:var(--orion-border-low)] bg-white/5 px-4 py-10 text-center text-sm text-[color:var(--orion-text-secondary)]">
                                Nenhum lançamento encontrado com os filtros atuais.
                            </div>
                        ) : (
                            <>
                                {/* Mobile cards */}
                                <div className="space-y-3 md:hidden">
                                    {launches.data.map((record) => {
                                        const badge = getLaunchBadge(record);
                                        return (
                                            <div
                                                key={record.id}
                                                className="rounded-[12px] border border-white/10 bg-white/5 p-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-semibold text-white">{record.description}</div>
                                                        <div className="mt-1 text-[11px] text-white/50">
                                                            {formatCategory(record.category)} • {formatCompactDate(record.competence_date)}
                                                        </div>
                                                    </div>
                                                    <KebabMenu
                                                        disabled={record.status === 'pendente' && currentUserRole !== 'ROOT'}
                                                        canDelete={canDeleteLaunch(record, currentUserRole)}
                                                        onEdit={() => setEditingLaunch(record)}
                                                        onDelete={() => setConfirmDelete(record)}
                                                    />
                                                </div>
                                                <div className="mt-3 flex items-center justify-between gap-3">
                                                    <span className={cn('inline-flex rounded-full px-2 py-1 text-[11px] font-semibold', badge.className)}>
                                                        {badge.label}
                                                    </span>
                                                    <div
                                                        className={cn(
                                                            'font-serif text-[16px] font-semibold',
                                                            record.status === 'pendente'
                                                                ? 'text-[#F59E0B]'
                                                                : record.type === 'ENTRADA'
                                                                    ? 'text-[#10B981]'
                                                                    : 'text-[#EF4444]'
                                                        )}
                                                    >
                                                        {record.type === 'ENTRADA' && record.status !== 'pendente' ? '+ ' : record.type === 'SAIDA' ? '− ' : ''}
                                                        {formatCurrencyFromCents(record.amount_cents)}
                                                    </div>
                                                </div>
                                                {record.receipt_url ? (
                                                    <a
                                                        href={record.receipt_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-[12px] font-medium text-[#A8895A] hover:text-[#C8A97A]"
                                                    >
                                                        <Paperclip className="h-3.5 w-3.5" />
                                                        Ver comprovante
                                                    </a>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Desktop table */}
                                <div className="hidden overflow-x-auto md:block">
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.05em] text-white/50">
                                                <th className="px-3 pb-3 font-semibold">Descrição</th>
                                                <th className="px-3 pb-3 font-semibold">Categoria</th>
                                                <th className="px-3 pb-3 font-semibold">Data</th>
                                                <th className="px-3 pb-3 font-semibold">Tipo</th>
                                                <th className="px-3 pb-3 font-semibold">Valor</th>
                                                <th className="px-3 pb-3 font-semibold">Comprovante</th>
                                                <th className="px-3 pb-3 font-semibold text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {launches.data.map((record) => {
                                                const badge = getLaunchBadge(record);

                                                return (
                                                    <tr key={record.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                                                        <td className="px-3 py-3">
                                                            <div className="min-w-[220px]">
                                                                <div className="font-semibold text-white">{record.description}</div>
                                                                <div className="mt-0.5 text-[11px] text-white/50">
                                                                    {record.responsible?.name ?? 'Sistema'}
                                                                    {record.reference.order_number ? ` • ${record.reference.order_number}` : ''}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-[13px] text-white/50">{formatCategory(record.category)}</td>
                                                        <td className="px-3 py-3 text-[13px] text-white/50">{formatCompactDate(record.competence_date)}</td>
                                                        <td className="px-3 py-3">
                                                            <span className={cn('inline-flex rounded-full px-2 py-1 text-[11px] font-semibold', badge.className)}>
                                                                {badge.label}
                                                            </span>
                                                        </td>
                                                        <td
                                                            className={cn(
                                                                'px-3 py-3 font-serif text-[15px] font-semibold',
                                                                record.status === 'pendente'
                                                                    ? 'text-[#F59E0B]'
                                                                    : record.type === 'ENTRADA'
                                                                        ? 'text-[#10B981]'
                                                                        : 'text-[#EF4444]'
                                                            )}
                                                        >
                                                            {record.type === 'ENTRADA' && record.status !== 'pendente' ? '+ ' : record.type === 'SAIDA' ? '− ' : ''}
                                                            {formatCurrencyFromCents(record.amount_cents)}
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            {record.receipt_url ? (
                                                                <a
                                                                    href={record.receipt_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-1 text-[12px] font-medium text-[#A8895A] hover:text-[#C8A97A]"
                                                                >
                                                                    <Paperclip className="h-3.5 w-3.5" />
                                                                    Ver
                                                                </a>
                                                            ) : record.status === 'pendente' ? (
                                                                <span className="text-[12px] text-white/30">—</span>
                                                            ) : (
                                                                <form action={uploadFinancialReceiptAction} encType="multipart/form-data">
                                                                    <input type="hidden" name="id" value={record.id} />
                                                                    <label className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-[#9CA3AF] hover:text-[#A8895A]">
                                                                        <Paperclip className="h-3.5 w-3.5" />
                                                                        Anexar
                                                                        <input
                                                                            type="file"
                                                                            name="file"
                                                                            accept="image/png,image/jpeg,application/pdf"
                                                                            className="sr-only"
                                                                            onChange={(e) => {
                                                                                if (e.target.files?.[0]) {
                                                                                    e.target.form?.requestSubmit();
                                                                                }
                                                                            }}
                                                                        />
                                                                    </label>
                                                                </form>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-3 text-right">
                                                            <KebabMenu
                                                                disabled={record.status === 'pendente' && currentUserRole !== 'ROOT'}
                                                                canDelete={canDeleteLaunch(record, currentUserRole)}
                                                                onEdit={() => setEditingLaunch(record)}
                                                                onDelete={() => setConfirmDelete(record)}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="text-[12px] text-white/50">
                                Mostrando {launches.data.length} de {launches.meta.total} lançamentos
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-label="Página anterior"
                                    disabled={launches.meta.page <= 1 || isPending}
                                    onClick={() => navigateWith({ page: launches.meta.page - 1 })}
                                    className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/15 bg-white/5 text-white disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="rounded-[8px] bg-[#C8A97A] px-3 py-1 text-[12px] font-bold text-black">
                                    {launches.meta.page}
                                </span>
                                <button
                                    type="button"
                                    aria-label="Próxima página"
                                    disabled={launches.meta.page >= launches.meta.pages || isPending}
                                    onClick={() => navigateWith({ page: launches.meta.page + 1 })}
                                    className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/15 bg-white/5 text-white disabled:opacity-40"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </LightCard>

                    <LightCard
                        title="Comissões"
                        description="Ranking por venda reconhecida no período."
                    >
                        <div className="space-y-3">
                            {commissions.length === 0 ? (
                                <div className="rounded-[12px] border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/50">
                                    Nenhuma comissão apurada no período selecionado.
                                </div>
                            ) : (
                                commissions.map((record) => {
                                    const progress = maxCommissionValue > 0
                                        ? Math.max(12, Math.round((record.comissao_cents / maxCommissionValue) * 100))
                                        : 0;

                                    return (
                                        <div key={record.user_id} className="flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/5 px-3 py-3">
                                            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#E8D5B0] text-[13px] font-bold text-[#A8895A]">
                                                {getInitials(record.nome)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[13px] font-semibold text-white">{record.nome}</div>
                                                <div className="text-[11px] text-white/50">
                                                    {record.vendas} vendas • {formatCurrencyFromCents(record.total_vendido_cents)}
                                                </div>
                                            </div>
                                            <div className="w-20">
                                                <div className="h-[5px] rounded-full bg-white/15">
                                                    <div className="h-[5px] rounded-full bg-[#3B82F6]" style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-serif text-[15px] font-semibold text-[#3B82F6]">
                                                    {formatCurrencyFromCents(record.comissao_cents)}
                                                </div>
                                                <div className="text-[11px] text-white/50">{record.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </LightCard>
                </div>
            </div>

            {isLaunchModalOpen ? (
                <LaunchFormModal
                    title="Novo Lançamento"
                    initial={makeEmptyDraft(todayDate)}
                    submitLabel="Salvar lançamento"
                    onSubmit={submitLaunch}
                    onClose={() => setIsLaunchModalOpen(false)}
                />
            ) : null}

            {editingLaunch ? (
                <LaunchFormModal
                    title="Editar Lançamento"
                    initial={buildEditDraft(editingLaunch)}
                    submitLabel="Salvar alterações"
                    onSubmit={submitLaunch}
                    onClose={() => setEditingLaunch(null)}
                />
            ) : null}

            {confirmDelete ? (
                <ConfirmDialog
                    title="Excluir lançamento"
                    message={`Tem certeza que deseja excluir "${confirmDelete.description}"? Esta ação não pode ser desfeita.`}
                    confirmLabel="Excluir"
                    busy={isDeleting}
                    onConfirm={() => handleDelete(confirmDelete)}
                    onCancel={() => setConfirmDelete(null)}
                />
            ) : null}

            <MonthlyGoalModal
                open={goalModalOpen}
                initialAmountCents={monthlyGoalCents}
                title="Meta do mês"
                helperText="A meta salva aqui também aparece no dashboard."
                onClose={() => setGoalModalOpen(false)}
                onSave={handleSaveMonthlyGoal}
            />

            <ToastViewport toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
}
