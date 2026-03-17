'use client';

import { useEffect, useMemo, useState, useRef, type DragEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    Check,
    ChevronDown,
    Copy,
    ExternalLink,
    ImageUp,
    Loader2,
    Power,
    QrCode,
    RefreshCw,
    Trash2,
    Save,
    ShieldCheck,
    Users2,
} from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';

import { WhatsAppTab } from './WhatsAppTab';
import { IntegracoesTab } from './IntegracoesTab';
import { HexColorPicker } from 'react-colorful';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Switch } from '@/components/ui/Switch';
import type {
    AdminSettings,
    AdminUser,
    AdminUsersResponse,
    AjustesTab,
    IntegrationWorkflowSnapshot,
    IntegrationsSnapshot,
    NotificationPreferences,
    WhatsAppStatusPayload,
} from '@/lib/ajustes-types';
import { cn, formatDate } from '@/lib/utils';

const companySchema = z.object({
    company_name: z.string().trim().min(2, 'Informe o nome da empresa.'),
    cnpj: z.string().trim().max(18).optional(),
    phone: z.string().trim().max(20).optional(),
    address: z.string().trim().max(255).optional(),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.'),
});

const inviteSchema = z.object({
    name: z.string().trim().min(2, 'Nome obrigatório.'),
    email: z.string().trim().email('Email inválido.'),
    role: z.enum(['ADMIN', 'ATENDENTE']),
    personal_whatsapp: z.string().trim().max(25).optional(),
    commission_rate: z.coerce.number().min(0).max(100),
});

const personalWhatsappSchema = z.object({
    personal_whatsapp: z.string().trim().max(25).optional(),
});

const metaIntegrationSchema = z.object({
    access_token: z.string().trim().min(10).optional().or(z.literal('')),
    phone_number_id: z.string().trim().min(1).optional().or(z.literal('')),
    waba_id: z.string().trim().optional().or(z.literal('')),
    verify_token: z.string().trim().min(6).optional().or(z.literal('')),
});

const n8nIntegrationSchema = z.object({
    base_url: z.string().trim().url().optional().or(z.literal('')),
    api_key: z.string().trim().min(8).optional().or(z.literal('')),
    webhook_url: z.string().trim().url().optional().or(z.literal('')),
});

const mercadoPagoIntegrationSchema = z.object({
    access_token: z.string().trim().min(10).optional().or(z.literal('')),
    public_key: z.string().trim().min(6).optional().or(z.literal('')),
    sandbox_access_token: z.string().trim().min(10).optional().or(z.literal('')),
    sandbox_mode: z.boolean().optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;
type InviteFormValues = z.infer<typeof inviteSchema>;
type PersonalWhatsappFormValues = z.infer<typeof personalWhatsappSchema>;
type MetaIntegrationFormValues = z.infer<typeof metaIntegrationSchema>;
type N8nIntegrationFormValues = z.infer<typeof n8nIntegrationSchema>;
type MercadoPagoIntegrationFormValues = z.infer<typeof mercadoPagoIntegrationSchema>;
type ToastKind = 'success' | 'error';

interface ToastRecord {
    id: number;
    kind: ToastKind;
    message: string;
}

const tabItems: Array<{
    id: AjustesTab;
    label: string;
}> = [
    { id: 'empresa', label: 'Empresa' },
    { id: 'usuarios', label: 'Usuários' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'notificacoes', label: 'Notificações' },
    { id: 'integracoes', label: 'Integrações' },
];

type NotificationToggleKey =
    | 'notify_new_lead_whatsapp'
    | 'notify_order_paid'
    | 'notify_production_delayed'
    | 'notify_lead_inactive'
    | 'notify_goal_reached';

const notificationItems: Array<{
    key: NotificationToggleKey;
    label: string;
    description: string;
}> = [
    {
        key: 'notify_new_lead_whatsapp',
        label: 'Novo lead atribuído',
        description: 'Avisa quando um lead é atribuído a você.',
    },
    {
        key: 'notify_order_paid',
        label: 'Pedido pago',
        description: 'Avisa quando um pedido muda para pago.',
    },
    {
        key: 'notify_production_delayed',
        label: 'Produção atrasada',
        description: 'Avisa quando o prazo de produção passa.',
    },
    {
        key: 'notify_lead_inactive',
        label: 'Lead inativo (3 dias)',
        description: 'Avisa leads sem atividade há 3 dias.',
    },
    {
        key: 'notify_goal_reached',
        label: 'Meta atingida',
        description: 'Celebração quando meta mensal é alcançada.',
    },
];


const fallbackIntegrationWorkflows: IntegrationWorkflowSnapshot[] = [
    { id: 'wf_aurora_sdr_001', label: 'AURORA SDR — Atendimento WA', status: 'active' },
    { id: 'wf_checkout_mp_001', label: 'Checkout Webhook — Mercado Pago', status: 'active' },
    { id: 'wf_notify_agents_001', label: 'Notificações WA — Atendentes', status: 'active' },
    { id: 'wf_lead_qualify_001', label: 'Lead Qualificado → CRM', status: 'paused' },
];

const fallbackIntegrations: IntegrationsSnapshot = {
    meta: {
        status: 'pending',
        access_token_masked: null,
        phone_number_id: null,
        waba_id: null,
        verify_token: null,
        webhook_url: '',
        docs_url: 'https://docs.orion.io',
    },
    n8n: {
        status: 'pending',
        base_url: null,
        api_key_masked: null,
        webhook_url: null,
        workflows: fallbackIntegrationWorkflows,
    },
    mercadopago: {
        status: 'pending',
        access_token_masked: null,
        public_key_masked: null,
        sandbox_access_token_masked: null,
        sandbox_mode: false,
        webhook_url: '',
    },
};

const defaultNotificationPrefs: NotificationPreferences = {
    notify_new_lead_whatsapp: false,
    notify_order_paid: false,
    notify_production_delayed: false,
    notify_lead_inactive: false,
    notify_goal_reached: false,
    quiet_hours_enabled: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
};

const panelClassName = 'rounded-2xl border border-white/10 bg-[color:var(--orion-surface)] shadow-[var(--orion-shadow-card)]';
const fieldClassName = 'h-10 w-full rounded-[10px] border border-white/10 bg-[color:var(--orion-base)] px-3 text-[13px] text-[color:var(--orion-text)] outline-none transition placeholder:text-[color:var(--orion-text-muted)] focus:border-brand-gold/40 focus:ring-2 focus:ring-brand-gold/10';
const readOnlyFieldClassName = 'flex min-h-10 w-full items-center justify-between gap-3 rounded-[10px] border border-white/10 bg-[color:var(--orion-base)] px-3 py-2 text-[12px] text-[color:var(--orion-text-secondary)]';
const subtleFieldClassName = 'flex min-h-10 w-full items-center rounded-[10px] border border-white/5 bg-[#0A0A0C] px-3 py-2 text-[13px] text-[color:var(--orion-text-muted)]';
const secondaryButtonClassName = 'inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border border-white/10 bg-white/5 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--orion-text-secondary)] transition hover:border-[color:var(--orion-gold-border)] hover:text-brand-gold';
const primaryButtonClassName = 'inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border border-[color:var(--orion-gold)] bg-[color:var(--orion-gold)] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0A0A0C] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60';

function maskCnpj(input: string): string {
    const digits = input.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function maskPhone(input: string): string {
    const digits = input.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function extractAddressLine(address: AdminSettings['address']): string {
    if (!address) return '';
    if (typeof address.line1 === 'string') return address.line1;
    const firstValue = Object.values(address).find((value) => typeof value === 'string');
    return typeof firstValue === 'string' ? firstValue : '';
}

function normalizeOptional(value: string | null | undefined): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

function normalizeTimeValue(value: string | null | undefined): string | null {
    if (!value) return null;
    if (value.length >= 5) return value.slice(0, 5);
    return value;
}

async function parseError(response: Response): Promise<string> {
    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    return typeof payload.message === 'string' ? payload.message : 'Não foi possível concluir a ação.';
}

function statusLabel(status: WhatsAppStatusPayload['status']): string {
    if (status === 'CONNECTED') return 'Conectado';
    if (status === 'CONNECTING') return 'Conectando';
    return 'Desconectado';
}

function statusBadgeClass(status: WhatsAppStatusPayload['status']) {
    if (status === 'CONNECTED') return 'border-emerald-500/20 bg-emerald-500/10 text-[color:var(--orion-green)]';
    if (status === 'CONNECTING') return 'border-amber-500/20 bg-amber-500/10 text-[color:var(--orion-amber)]';
    return 'border-rose-500/20 bg-rose-500/10 text-[color:var(--orion-red)]';
}

function integrationBadgeClass(status: 'connected' | 'pending' | 'error') {
    if (status === 'connected') return 'border-emerald-500/20 bg-emerald-500/10 text-[color:var(--orion-green)]';
    if (status === 'error') return 'border-rose-500/20 bg-rose-500/10 text-[color:var(--orion-red)]';
    return 'border-white/10 bg-white/5 text-[color:var(--orion-text-secondary)]';
}

function integrationStatusText(status: 'connected' | 'pending' | 'error') {
    if (status === 'connected') return 'Conectado';
    if (status === 'error') return 'Erro';
    return 'Não configurado';
}

function roleBadgeClass(role: AdminUser['role']) {
    if (role === 'ADMIN') return 'border-amber-500/20 bg-amber-500/10 text-[color:var(--orion-gold-light)]';
    return 'border-blue-500/20 bg-blue-500/10 text-[color:var(--orion-blue)]';
}

function userStatusBadgeClass(status: AdminUser['status']) {
    if (status === 'active') return 'border-emerald-500/20 bg-emerald-500/10 text-[color:var(--orion-green)]';
    return 'border-white/10 bg-white/5 text-[color:var(--orion-text-secondary)]';
}

function FieldMeta({
    label,
    hint,
}: {
    label: string;
    hint?: string;
}) {
    return (
        <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                {label}
            </div>
            {hint ? (
                <div className="text-[10px] leading-4 text-[color:var(--orion-text-muted)]">{hint}</div>
            ) : null}
        </div>
    );
}

function SectionCard({
    title,
    description,
    action,
    className,
    children,
}: {
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <section className={cn(panelClassName, className)}>
            <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text)]">
                        {title}
                    </div>
                    {description ? (
                        <div className="mt-1 text-[11px] text-[color:var(--orion-text-secondary)]">{description}</div>
                    ) : null}
                </div>
                {action}
            </div>
            <div className="px-5 py-5">{children}</div>
        </section>
    );
}

function DialogContainer({
    title,
    description,
    onClose,
    children,
}: {
    title: string;
    description?: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[color:var(--orion-surface)] shadow-[var(--orion-shadow-dialog)]">
                <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
                    <div>
                        <h2
                            className="text-2xl font-semibold text-[color:var(--orion-text)]"
                            style={{ fontFamily: 'var(--font-orion-serif)' }}
                        >
                            {title}
                        </h2>
                        {description ? (
                            <p className="mt-1 text-sm text-[color:var(--orion-text-secondary)]">{description}</p>
                        ) : null}
                    </div>
                    <button type="button" className={secondaryButtonClassName} onClick={onClose}>
                        Fechar
                    </button>
                </div>
                <div className="px-5 py-5">{children}</div>
            </div>
        </div>
    );
}

function LoadingPanel({ title }: { title: string }) {
    return (
        <SectionCard title={title} description="Carregando dados do módulo.">
            <div className="space-y-3">
                <div className="h-10 animate-pulse rounded-xl bg-white/5" />
                <div className="h-28 animate-pulse rounded-xl bg-white/5" />
                <div className="h-10 animate-pulse rounded-xl bg-white/5" />
            </div>
        </SectionCard>
    );
}

export function AjustesClient({
    initialTab,
    initialSettings,
    initialUsers,
    currentUserId,
}: {
    initialTab: AjustesTab;
    initialSettings: AdminSettings;
    initialUsers: AdminUser[];
    currentUserId: string;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState<AjustesTab>(initialTab);
    const [settings, setSettings] = useState(initialSettings);
    const [users, setUsers] = useState(initialUsers);
    const [usersLoading, setUsersLoading] = useState(false);
    const [toastItems, setToastItems] = useState<ToastRecord[]>([]);
    const [savingCompany, setSavingCompany] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState(initialSettings.logo_url);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [savingInvite, setSavingInvite] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
    const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppStatusPayload>({
        status: 'DISCONNECTED',
        connected_number: null,
        connected_at: null,
    });
    const [whatsAppLoading, setWhatsAppLoading] = useState(true);
    const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [updatingNotification, setUpdatingNotification] = useState<string | null>(null);
    const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [didLoadNotifications, setDidLoadNotifications] = useState(false);
    const [savingQuietHours, setSavingQuietHours] = useState(false);
    const [savingPersonalWhatsapp, setSavingPersonalWhatsapp] = useState(false);
    const [integrations, setIntegrations] = useState<IntegrationsSnapshot | null>(null);
    const [integrationsLoading, setIntegrationsLoading] = useState(true);
    const [copyingKey, setCopyingKey] = useState<string | null>(null);
    const [didLoadWhatsApp, setDidLoadWhatsApp] = useState(false);
    const [didLoadIntegrations, setDidLoadIntegrations] = useState(false);
    const [savingMetaIntegration, setSavingMetaIntegration] = useState(false);
    const [savingN8nIntegration, setSavingN8nIntegration] = useState(false);
    const [savingMpIntegration, setSavingMpIntegration] = useState(false);
    const [quietHoursStart, setQuietHoursStart] = useState('22:00');
    const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');

    const companyForm = useForm<CompanyFormValues>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            company_name: initialSettings.company_name,
            cnpj: initialSettings.cnpj ?? '',
            phone: initialSettings.phone ?? '',
            address: extractAddressLine(initialSettings.address),
            primary_color: initialSettings.primary_color,
        },
    });

    const inviteForm = useForm<InviteFormValues>({
        resolver: zodResolver(inviteSchema),
        defaultValues: {
            name: '',
            email: '',
            role: 'ATENDENTE',
            personal_whatsapp: '',
            commission_rate: 0,
        },
    });

    const editForm = useForm<InviteFormValues>({
        resolver: zodResolver(inviteSchema),
        defaultValues: {
            name: '',
            email: '',
            role: 'ATENDENTE',
            personal_whatsapp: '',
            commission_rate: 0,
        },
    });

    const personalWhatsappForm = useForm<PersonalWhatsappFormValues>({
        resolver: zodResolver(personalWhatsappSchema),
        defaultValues: {
            personal_whatsapp: '',
        },
    });

    const metaIntegrationForm = useForm<MetaIntegrationFormValues>({
        resolver: zodResolver(metaIntegrationSchema),
        defaultValues: {
            access_token: '',
            phone_number_id: '',
            waba_id: '',
            verify_token: '',
        },
    });

    const n8nIntegrationForm = useForm<N8nIntegrationFormValues>({
        resolver: zodResolver(n8nIntegrationSchema),
        defaultValues: {
            base_url: '',
            api_key: '',
            webhook_url: '',
        },
    });

    const mercadoPagoIntegrationForm = useForm<MercadoPagoIntegrationFormValues>({
        resolver: zodResolver(mercadoPagoIntegrationSchema),
        defaultValues: {
            access_token: '',
            public_key: '',
            sandbox_access_token: '',
            sandbox_mode: false,
        },
    });

    const currentUser = useMemo(
        () => users.find((user) => user.id === currentUserId) ?? null,
        [users, currentUserId]
    );

    function addToast(kind: ToastKind, message: string) {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToastItems((current) => [...current, { id, kind, message }]);
        window.setTimeout(() => {
            setToastItems((current) => current.filter((item) => item.id !== id));
        }, 4200);
    }

    function syncTab(tab: AjustesTab) {
        setActiveTab(tab);
        router.replace(`${pathname}?tab=${tab}`, { scroll: false });
    }

    async function refreshUsers(showSkeleton = true) {
        if (showSkeleton) {
            setUsersLoading(true);
        }

        try {
            const response = await fetch('/api/internal/users', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const payload = await response.json() as AdminUsersResponse;
            setUsers(payload.data);
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao carregar usuários.');
        } finally {
            if (showSkeleton) {
                setUsersLoading(false);
            }
        }
    }

    async function refreshWhatsAppStatus(showSkeleton = true) {
        if (showSkeleton) {
            setWhatsAppLoading(true);
        }

        try {
            const response = await fetch('/api/internal/whatsapp/status', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const payload = await response.json() as WhatsAppStatusPayload;
            setWhatsAppStatus(payload);
            if (payload.status === 'CONNECTED') {
                setQrCodeBase64(null);
            }
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao carregar status do WhatsApp.');
            setWhatsAppStatus({
                status: 'DISCONNECTED',
                connected_number: null,
                connected_at: null,
            });
        } finally {
            if (showSkeleton) {
                setWhatsAppLoading(false);
            }
        }
    }

    async function refreshIntegrations(showSkeleton = true) {
        if (showSkeleton) {
            setIntegrationsLoading(true);
        }

        try {
            const response = await fetch('/api/internal/integrations', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const payload = await response.json() as IntegrationsSnapshot;
            setIntegrations(payload);
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao carregar snapshot das integrações.');
            setIntegrations(fallbackIntegrations);
        } finally {
            if (showSkeleton) {
                setIntegrationsLoading(false);
            }
        }
    }

    function applyNotificationPrefs(payload: NotificationPreferences) {
        const normalized: NotificationPreferences = {
            ...defaultNotificationPrefs,
            ...payload,
            quiet_hours_start: normalizeTimeValue(payload.quiet_hours_start),
            quiet_hours_end: normalizeTimeValue(payload.quiet_hours_end),
        };
        setNotificationPrefs(normalized);
        setQuietHoursStart(normalized.quiet_hours_start ?? '22:00');
        setQuietHoursEnd(normalized.quiet_hours_end ?? '08:00');
    }

    async function refreshNotificationPrefs(showSkeleton = true) {
        if (showSkeleton) {
            setNotificationsLoading(true);
        }

        try {
            const response = await fetch('/api/internal/notifications/preferences', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const payload = await response.json() as NotificationPreferences;
            applyNotificationPrefs(payload);
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao carregar preferências de notificações.');
            setNotificationPrefs(defaultNotificationPrefs);
        } finally {
            if (showSkeleton) {
                setNotificationsLoading(false);
            }
        }
    }

    async function testN8nConnection() {
        try {
            const response = await fetch('/api/internal/integrations/n8n/test', {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }
            const payload = await response.json() as { status: 'connected' | 'error' };
            addToast(payload.status === 'connected' ? 'success' : 'error', payload.status === 'connected' ? 'n8n conectado.' : 'Falha ao validar n8n.');
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao validar n8n.');
        } finally {
            await refreshIntegrations(false);
        }
    }

    async function testMercadoPagoConnection() {
        try {
            const response = await fetch('/api/internal/integrations/mp/test', {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }
            const payload = await response.json() as { status: 'connected' | 'error' };
            addToast(payload.status === 'connected' ? 'success' : 'error', payload.status === 'connected' ? 'Mercado Pago conectado.' : 'Falha ao validar Mercado Pago.');
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao validar Mercado Pago.');
        } finally {
            await refreshIntegrations(false);
        }
    }

    async function onSaveMetaIntegration(values: MetaIntegrationFormValues) {
        setSavingMetaIntegration(true);

        try {
            const payload = {
                access_token: normalizeOptional(values.access_token),
                phone_number_id: normalizeOptional(values.phone_number_id),
                waba_id: normalizeOptional(values.waba_id),
                verify_token: normalizeOptional(values.verify_token),
            };
            const filtered = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

            if (Object.keys(filtered).length === 0) {
                addToast('error', 'Informe ao menos um campo para salvar na Meta.');
                return;
            }

            const response = await fetch('/api/internal/integrations/meta', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filtered),
            });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const updated = await response.json() as IntegrationsSnapshot;
            setIntegrations(updated);
            metaIntegrationForm.reset({
                access_token: '',
                phone_number_id: updated.meta.phone_number_id ?? '',
                waba_id: updated.meta.waba_id ?? '',
                verify_token: updated.meta.verify_token ?? '',
            });
            addToast('success', 'Credenciais da Meta salvas.');
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao salvar Meta Cloud API.');
        } finally {
            setSavingMetaIntegration(false);
        }
    }

    async function onSaveN8nIntegration(values: N8nIntegrationFormValues) {
        setSavingN8nIntegration(true);

        try {
            const payload = {
                base_url: normalizeOptional(values.base_url),
                api_key: normalizeOptional(values.api_key),
                webhook_url: normalizeOptional(values.webhook_url),
            };
            const filtered = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

            if (Object.keys(filtered).length === 0) {
                addToast('error', 'Informe ao menos um campo para salvar no n8n.');
                return;
            }

            const response = await fetch('/api/internal/integrations/n8n', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filtered),
            });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const updated = await response.json() as IntegrationsSnapshot;
            setIntegrations(updated);
            n8nIntegrationForm.reset({
                base_url: updated.n8n.base_url ?? '',
                api_key: '',
                webhook_url: updated.n8n.webhook_url ?? '',
            });
            addToast('success', 'Credenciais do n8n salvas.');
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao salvar n8n.');
        } finally {
            setSavingN8nIntegration(false);
        }
    }

    async function onSaveMercadoPagoIntegration(values: MercadoPagoIntegrationFormValues) {
        setSavingMpIntegration(true);

        try {
            const payload = {
                access_token: normalizeOptional(values.access_token),
                public_key: normalizeOptional(values.public_key),
                sandbox_access_token: normalizeOptional(values.sandbox_access_token),
                sandbox_mode: values.sandbox_mode ?? false,
            };
            const filtered = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

            if (Object.keys(filtered).length === 0) {
                addToast('error', 'Informe ao menos um campo para salvar no Mercado Pago.');
                return;
            }

            const response = await fetch('/api/internal/integrations/mercadopago', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filtered),
            });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const updated = await response.json() as IntegrationsSnapshot;
            setIntegrations(updated);
            mercadoPagoIntegrationForm.reset({
                access_token: '',
                public_key: '',
                sandbox_access_token: '',
                sandbox_mode: updated.mercadopago.sandbox_mode ?? false,
            });
            addToast('success', 'Credenciais do Mercado Pago salvas.');
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao salvar Mercado Pago.');
        } finally {
            setSavingMpIntegration(false);
        }
    }

    async function loadQrCode(showErrorToast = true) {
        setQrLoading(true);

        try {
            const response = await fetch('/api/internal/whatsapp/reconnect', {
                method: 'POST',
                cache: 'no-store',
            });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const payload = await response.json() as { qr_code_base64?: string };
            if (!payload.qr_code_base64) {
                throw new Error('QR Code indisponível no momento.');
            }

            setQrCodeBase64(payload.qr_code_base64);
        } catch (error) {
            if (showErrorToast) {
                addToast('error', error instanceof Error ? error.message : 'Falha ao gerar QR Code.');
            }
        } finally {
            setQrLoading(false);
        }
    }

    async function onSaveCompany(values: CompanyFormValues) {
        setSavingCompany(true);

        try {
            const payload = {
                company_name: values.company_name,
                cnpj: values.cnpj?.trim() ? values.cnpj.trim() : null,
                phone: values.phone?.trim() ? values.phone.trim() : null,
                address: values.address?.trim() ? { line1: values.address.trim() } : null,
                primary_color: values.primary_color,
            };

            const response = await fetch('/api/internal/org/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const updated = await response.json() as AdminSettings;
            setSettings(updated);
            companyForm.reset({
                company_name: updated.company_name,
                cnpj: updated.cnpj ?? '',
                phone: updated.phone ?? '',
                address: extractAddressLine(updated.address),
                primary_color: updated.primary_color,
            });
            addToast('success', 'Dados da empresa salvos com sucesso.');
            router.refresh();
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao salvar dados da empresa.');
        } finally {
            setSavingCompany(false);
        }
    }

    async function onUploadLogo() {
        if (!logoFile) {
            addToast('error', 'Selecione um arquivo de logo antes de enviar.');
            return;
        }

        setUploadingLogo(true);

        try {
            const formData = new FormData();
            formData.append('type', 'logo');
            formData.append('file', logoFile);

            const response = await fetch('/api/internal/org/logo', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const payload = await response.json() as { url: string };
            
            // Atualizar preview imediatamente
            setLogoPreview(payload.url);
            setLogoFile(null);
            
            // Limpar o input file
            if (logoInputRef.current) {
                logoInputRef.current.value = '';
            }
            
            // Refetch settings completas para sincronizar
            try {
                const settingsResponse = await fetch('/api/internal/settings');
                if (settingsResponse.ok) {
                    const newSettings = await settingsResponse.json() as AdminSettings;
                    setSettings(newSettings);
                    setLogoPreview(newSettings.logo_url || payload.url);
                }
            } catch {
                // Se falhar, mantém a preview que já setamos acima
            }
            
            addToast('success', 'Logo atualizada com sucesso.');
            router.refresh();
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao enviar logo.');
        } finally {
            setUploadingLogo(false);
        }
    }

    function onRemoveLogo() {
        setLogoFile(null);
        setLogoPreview(initialSettings.logo_url || null);
        
        // Limpar o input file
        if (logoInputRef.current) {
            logoInputRef.current.value = '';
        }
        
        addToast('success', 'Logo removida. Clique em "Enviar logo" para confirmar.');
    }

    function applyLogoFile(file: File) {
        const acceptedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
        if (!acceptedTypes.includes(file.type)) {
            addToast('error', 'Formato inválido. Envie PNG, JPG ou SVG.');
            return;
        }

        setLogoFile(file);
        const objectUrl = URL.createObjectURL(file);
        setLogoPreview(objectUrl);
    }

    function onDropLogo(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setDragActive(false);
        const droppedFile = event.dataTransfer.files?.[0];
        if (droppedFile) {
            applyLogoFile(droppedFile);
        }
    }

    async function onInviteUser(values: InviteFormValues) {
        setSavingInvite(true);

        try {
            const response = await fetch('/api/internal/users/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...values,
                    personal_whatsapp: values.personal_whatsapp?.trim() || null,
                }),
            });

            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const payload = await response.json() as { temporary_password?: string };
            inviteForm.reset({
                name: '',
                email: '',
                role: 'ATENDENTE',
                personal_whatsapp: '',
                commission_rate: 0,
            });
            setInviteOpen(false);
            await refreshUsers(false);
            addToast(
                'success',
                payload.temporary_password
                    ? `Usuário convidado. Senha temporária: ${payload.temporary_password}`
                    : 'Usuário convidado com sucesso.'
            );
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao convidar usuário.');
        } finally {
            setSavingInvite(false);
        }
    }

    async function onSaveUserEdit(values: InviteFormValues) {
        if (!editingUser) return;

        setSavingEdit(true);

        try {
            const response = await fetch(`/api/internal/users/${editingUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...values,
                    personal_whatsapp: values.personal_whatsapp?.trim() || null,
                }),
            });

            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            await refreshUsers(false);
            setEditingUser(null);
            addToast('success', 'Usuário atualizado com sucesso.');
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao atualizar usuário.');
        } finally {
            setSavingEdit(false);
        }
    }

    async function onSavePersonalWhatsapp(values: PersonalWhatsappFormValues) {
        if (!currentUser) return;

        setSavingPersonalWhatsapp(true);

        try {
            const response = await fetch(`/api/internal/users/${currentUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personal_whatsapp: values.personal_whatsapp?.trim() || null,
                }),
            });

            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            await refreshUsers(false);
            addToast('success', 'Número pessoal atualizado.');
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao atualizar número pessoal.');
        } finally {
            setSavingPersonalWhatsapp(false);
        }
    }

    async function onToggleUserStatus(user: AdminUser) {
        if (user.id === currentUserId && user.status === 'active') {
            addToast('error', 'Você não pode desativar o próprio usuário.');
            return;
        }

        setTogglingUserId(user.id);

        try {
            const nextActive = user.status !== 'active';
            const response = await fetch(`/api/internal/users/${user.id}/toggle-status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: nextActive }),
            });

            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            await refreshUsers(false);
            addToast('success', nextActive ? 'Usuário ativado.' : 'Usuário desativado.');
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao alterar status do usuário.');
        } finally {
            setTogglingUserId(null);
        }
    }

    async function onDisconnectWhatsApp() {
        setWhatsAppLoading(true);

        try {
            const response = await fetch('/api/internal/whatsapp/disconnect', {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            setQrCodeBase64(null);
            await refreshWhatsAppStatus(false);
            addToast('success', 'Número desconectado com sucesso.');
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao desconectar número.');
        } finally {
            setWhatsAppLoading(false);
        }
    }

    async function onToggleNotification(key: NotificationToggleKey, value: boolean) {
        if (!notificationPrefs) {
            return;
        }

        const previous = notificationPrefs[key];
        setUpdatingNotification(key);
        setNotificationPrefs((current) => current ? ({ ...current, [key]: value }) : current);

        try {
            const response = await fetch('/api/internal/notifications/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value }),
            });

            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const payload = await response.json() as NotificationPreferences;
            applyNotificationPrefs(payload);
            addToast('success', 'Preferência de notificação atualizada.');
        } catch (error) {
            setNotificationPrefs((current) => current ? ({ ...current, [key]: previous }) : current);
            addToast('error', error instanceof Error ? error.message : 'Falha ao salvar notificação.');
        } finally {
            setUpdatingNotification(null);
        }
    }

    async function onSaveQuietHours(nextEnabled?: boolean) {
        setSavingQuietHours(true);

        try {
            const enabled = nextEnabled ?? notificationPrefs?.quiet_hours_enabled ?? false;
            const response = await fetch('/api/internal/notifications/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quiet_hours_enabled: enabled,
                    quiet_hours_start: quietHoursStart,
                    quiet_hours_end: quietHoursEnd,
                }),
            });
            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const payload = await response.json() as NotificationPreferences;
            applyNotificationPrefs(payload);
            addToast('success', 'Janela de silêncio atualizada.');
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao salvar janela de silêncio.');
        } finally {
            setSavingQuietHours(false);
        }
    }

    async function copyToClipboard(key: string, value: string, message: string) {
        try {
            setCopyingKey(key);
            await navigator.clipboard.writeText(value);
            addToast('success', message);
        } catch {
            addToast('error', 'Não foi possível copiar este valor.');
        } finally {
            window.setTimeout(() => setCopyingKey((current) => (current === key ? null : current)), 500);
        }
    }

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        void refreshUsers(true);
    }, []);

    useEffect(() => {
        if (activeTab !== 'whatsapp') {
            return;
        }

        if (!didLoadWhatsApp) {
            void refreshWhatsAppStatus(true);
            setDidLoadWhatsApp(true);
        }

        const intervalId = window.setInterval(() => {
            void refreshWhatsAppStatus(false);
        }, 10_000);

        return () => window.clearInterval(intervalId);
    }, [activeTab, didLoadWhatsApp]);

    useEffect(() => {
        if (activeTab !== 'whatsapp' || whatsAppStatus.status === 'CONNECTED') {
            return;
        }

        void loadQrCode(false);
        const intervalId = window.setInterval(() => {
            void loadQrCode(false);
        }, 30_000);

        return () => window.clearInterval(intervalId);
    }, [activeTab, whatsAppStatus.status]);

    useEffect(() => {
        if (activeTab !== 'integracoes' || didLoadIntegrations) {
            return;
        }

        void refreshIntegrations(true);
        setDidLoadIntegrations(true);
    }, [activeTab, didLoadIntegrations]);

    useEffect(() => {
        if (activeTab !== 'notificacoes' || didLoadNotifications) {
            return;
        }

        void refreshNotificationPrefs(true);
        setDidLoadNotifications(true);
    }, [activeTab, didLoadNotifications]);

    useEffect(() => {
        if (!integrations) {
            return;
        }

        metaIntegrationForm.reset({
            access_token: '',
            phone_number_id: integrations.meta.phone_number_id ?? '',
            waba_id: integrations.meta.waba_id ?? '',
            verify_token: integrations.meta.verify_token ?? '',
        });

        n8nIntegrationForm.reset({
            base_url: integrations.n8n.base_url ?? '',
            api_key: '',
            webhook_url: integrations.n8n.webhook_url ?? '',
        });

        mercadoPagoIntegrationForm.reset({
            access_token: '',
            public_key: '',
            sandbox_access_token: '',
            sandbox_mode: integrations.mercadopago.sandbox_mode ?? false,
        });
    }, [integrations, metaIntegrationForm, n8nIntegrationForm, mercadoPagoIntegrationForm]);

    useEffect(() => {
        if (editingUser) {
            editForm.reset({
                name: editingUser.name,
                email: editingUser.email,
                role: editingUser.role === 'ADMIN' ? 'ADMIN' : 'ATENDENTE',
                personal_whatsapp: editingUser.personal_whatsapp ?? '',
                commission_rate: Number(editingUser.commission_rate || 0),
            });
        }
    }, [editingUser, editForm]);

    useEffect(() => {
        personalWhatsappForm.reset({
            personal_whatsapp: currentUser?.personal_whatsapp ?? '',
        });
    }, [currentUser, personalWhatsappForm]);

    useEffect(() => {
        if (settings.logo_url) {
            setLogoPreview(settings.logo_url);
        }
    }, [settings.logo_url]);

    const qrCodeSrc = qrCodeBase64
        ? (qrCodeBase64.startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`)
        : null;

    const selectedColor = companyForm.watch('primary_color') || '#C8A97A';

    const renderCompanyTab = () => (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <SectionCard
                title="Identidade da Empresa"
                description="Nome, CNPJ, telefone e endereço usados no CRM e na loja pública."
            >
                <form className="grid gap-5" onSubmit={companyForm.handleSubmit(onSaveCompany)}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <FieldMeta label="Nome da empresa" />
                            <input className={fieldClassName} {...companyForm.register('company_name')} />
                            {companyForm.formState.errors.company_name ? (
                                <p className="text-xs text-[color:var(--orion-red)]">{companyForm.formState.errors.company_name.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <FieldMeta label="Telefone" />
                            <input
                                className={fieldClassName}
                                placeholder="(11) 99999-9999"
                                {...companyForm.register('phone', {
                                    onChange: (event) => {
                                        event.target.value = maskPhone(event.target.value);
                                    },
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            <FieldMeta label="CNPJ" />
                            <input
                                className={fieldClassName}
                                placeholder="00.000.000/0000-00"
                                {...companyForm.register('cnpj', {
                                    onChange: (event) => {
                                        event.target.value = maskCnpj(event.target.value);
                                    },
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            <FieldMeta label="Plano atual" />
                            <div className={readOnlyFieldClassName}>
                                <span className="capitalize">{settings.plan}</span>
                                <ShieldCheck className="h-4 w-4 text-brand-gold" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <FieldMeta label="Endereço" hint="Linha resumida para operação, loja e emissão futura." />
                        <input className={fieldClassName} placeholder="Rua, número, bairro e cidade" {...companyForm.register('address')} />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
                        <div className={panelClassName}>
                            <div className="border-b border-white/5 px-4 py-3">
                                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text)]">
                                    Cor primária
                                </div>
                            </div>
                            <div className="space-y-4 px-4 py-4">
                                <input className={fieldClassName} placeholder="#C8A97A" {...companyForm.register('primary_color')} />
                                <HexColorPicker
                                    color={selectedColor}
                                    onChange={(value) => {
                                        companyForm.setValue('primary_color', value, { shouldValidate: true });
                                    }}
                                />
                            </div>
                        </div>

                        <div className={panelClassName}>
                            <div className="border-b border-white/5 px-4 py-3">
                                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text)]">
                                    Preview ao vivo
                                </div>
                                <div className="mt-1 text-[11px] text-[color:var(--orion-text-secondary)]">
                                    Simulação compacta da navegação e de um KPI com a cor da marca.
                                </div>
                            </div>
                            <div className="grid gap-4 px-4 py-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                                <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-nav)] p-4">
                                    <div
                                        className="rounded-xl px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-[#0A0A0C]"
                                        style={{ backgroundColor: selectedColor }}
                                    >
                                        Orion
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        <div className="rounded-lg bg-white/5 px-3 py-2 text-[11px] text-[color:var(--orion-text-secondary)]">
                                            Dashboard
                                        </div>
                                        <div
                                            className="rounded-lg px-3 py-2 text-[11px] font-semibold text-[#0A0A0C]"
                                            style={{ backgroundColor: selectedColor }}
                                        >
                                            Ajustes
                                        </div>
                                        <div className="rounded-lg bg-white/5 px-3 py-2 text-[11px] text-[color:var(--orion-text-secondary)]">
                                            Analytics
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-base)] p-4">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                                        KPI Card
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <div className="text-sm text-[color:var(--orion-text-secondary)]">Receita projetada</div>
                                            <div
                                                className="mt-2 text-3xl font-semibold text-[color:var(--orion-text)]"
                                                style={{ fontFamily: 'var(--font-orion-serif)' }}
                                            >
                                                R$ 128.400
                                            </div>
                                        </div>
                                        <div
                                            className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0A0A0C]"
                                            style={{ backgroundColor: selectedColor }}
                                        >
                                            +14,8%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </SectionCard>

            <SectionCard
                title="Identidade Visual"
                description="Upload da logo principal e visualização imediata no shell do CRM."
                action={
                    <button
                        type="button"
                        className={primaryButtonClassName}
                        onClick={onUploadLogo}
                        disabled={uploadingLogo || !logoFile}
                    >
                        {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
                        {uploadingLogo ? 'Enviando' : 'Enviar logo'}
                    </button>
                }
            >
                <div className="space-y-5">
                    <div
                        className={cn(
                            'rounded-[14px] border border-dashed px-4 py-6 text-center transition',
                            dragActive
                                ? 'border-brand-gold/60 bg-brand-gold/10'
                                : 'border-white/10 bg-[color:var(--orion-base)]'
                        )}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={onDropLogo}
                    >
                        <UploadHint />
                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            aria-label="Upload de logotipo"
                            title="Upload de logotipo"
                            className="mt-4 block w-full text-sm text-[color:var(--orion-text-secondary)]"
                            onChange={(event) => {
                                const nextFile = event.target.files?.[0];
                                if (nextFile) {
                                    applyLogoFile(nextFile);
                                }
                            }}
                        />
                    </div>

                    <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-base)] p-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                            Preview da marca
                        </div>
                        <div
                            className="mt-4 rounded-[14px] border border-white/10 p-4"
                            style={{ backgroundColor: `${selectedColor}18` }}
                        >
                            {logoPreview ? (
                                <div className="flex items-end gap-3">
                                    <div
                                        className="inline-block rounded-xl p-2"
                                        style={{
                                            backgroundImage: 'linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%, #e5e5e5), linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%, #e5e5e5)',
                                            backgroundSize: '16px 16px',
                                            backgroundPosition: '0 0, 8px 8px',
                                        }}
                                    >
                                        <img src={logoPreview} alt="Logo preview" className="h-16 w-auto rounded-lg" />
                                    </div>
                                    <button
                                        type="button"
                                        className={secondaryButtonClassName}
                                        onClick={onRemoveLogo}
                                        title="Remover logo atual"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Remover
                                    </button>
                                </div>
                            ) : (
                                <div
                                    className="text-2xl font-semibold text-[color:var(--orion-text)]"
                                    style={{ fontFamily: 'var(--font-orion-serif)' }}
                                >
                                    {companyForm.watch('company_name') || 'ORION'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </SectionCard>
        </div>
    );

    const renderUsersTab = () => (
        <SectionCard
            title="Equipe e Permissões"
            description="Lista operacional de usuários com role, comissão, status e ações administrativas."
            action={
                <button type="button" className={primaryButtonClassName} onClick={() => setInviteOpen(true)}>
                    <Users2 className="h-3.5 w-3.5" />
                    Convidar usuário
                </button>
            }
        >
            {usersLoading ? (
                <div className="space-y-3">
                    <div className="h-11 animate-pulse rounded-xl bg-white/5" />
                    <div className="h-24 animate-pulse rounded-xl bg-white/5" />
                    <div className="h-24 animate-pulse rounded-xl bg-white/5" />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-[980px] w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                                <th className="pb-4 pr-4 font-bold">Nome</th>
                                <th className="pb-4 pr-4 font-bold">E-mail</th>
                                <th className="pb-4 pr-4 font-bold">Role</th>
                                <th className="pb-4 pr-4 font-bold">Comissão</th>
                                <th className="pb-4 pr-4 font-bold">Status</th>
                                <th className="pb-4 pr-4 font-bold">Criado em</th>
                                <th className="pb-4 font-bold">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-b border-white/5 last:border-b-0">
                                    <td className="py-4 pr-4">
                                        <div className="font-medium text-[color:var(--orion-text)]">{user.name}</div>
                                        <div className="mt-1 text-xs text-[color:var(--orion-text-muted)]">
                                            Último login: {user.last_login_at ? formatDate(user.last_login_at) : 'Nunca'}
                                        </div>
                                    </td>
                                    <td className="py-4 pr-4 text-[color:var(--orion-text-secondary)]">{user.email}</td>
                                    <td className="py-4 pr-4">
                                        <span className={cn('inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]', roleBadgeClass(user.role))}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="py-4 pr-4 text-[color:var(--orion-text)]">
                                        {Number(user.commission_rate).toFixed(2)}%
                                    </td>
                                    <td className="py-4 pr-4">
                                        <span className={cn('inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]', userStatusBadgeClass(user.status))}>
                                            {user.status === 'active' ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="py-4 pr-4 text-[color:var(--orion-text-secondary)]">{formatDate(user.created_at)}</td>
                                    <td className="py-4">
                                        <div className="flex flex-wrap gap-2">
                                            <button type="button" className={secondaryButtonClassName} onClick={() => setEditingUser(user)}>
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                className={secondaryButtonClassName}
                                                disabled={togglingUserId === user.id}
                                                onClick={() => void onToggleUserStatus(user)}
                                            >
                                                {togglingUserId === user.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Power className="h-3.5 w-3.5" />
                                                )}
                                                {user.status === 'active' ? 'Desativar' : 'Ativar'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </SectionCard>
    );

    const renderWhatsAppTab = () => (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <SectionCard
                title="Instância Evolution API"
                description="Status da instância operacional e ações de reconexão do número oficial."
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]', statusBadgeClass(whatsAppStatus.status))}>
                            {statusLabel(whatsAppStatus.status)}
                        </span>
                        <button type="button" className={secondaryButtonClassName} onClick={() => void refreshWhatsAppStatus(false)}>
                            <RefreshCw className="h-3.5 w-3.5" />
                            Atualizar
                        </button>
                    </div>
                }
            >
                {whatsAppLoading ? (
                    <div className="space-y-3">
                        <div className="h-10 animate-pulse rounded-xl bg-white/5" />
                        <div className="h-32 animate-pulse rounded-xl bg-white/5" />
                    </div>
                ) : (
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-base)] p-4">
                                    <FieldMeta label="Número conectado" />
                                    <div className="mt-2 text-lg font-semibold text-[color:var(--orion-text)]">
                                        {whatsAppStatus.connected_number ?? 'Não conectado'}
                                    </div>
                                </div>
                                <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-base)] p-4">
                                    <FieldMeta label="Última conexão" />
                                    <div className="mt-2 text-lg font-semibold text-[color:var(--orion-text)]">
                                        {whatsAppStatus.connected_at ? formatDate(whatsAppStatus.connected_at) : 'Sem registro'}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-base)] p-4">
                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                                    Passo a passo
                                </div>
                                <div className="mt-3 space-y-2 text-sm text-[color:var(--orion-text-secondary)]">
                                    <p>1. Abra o WhatsApp no celular oficial da operação.</p>
                                    <p>2. Entre em Dispositivos vinculados e escaneie o QR.</p>
                                    <p>3. O status troca automaticamente para conectado.</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[14px] border border-white/10 bg-[color:var(--orion-base)] p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                                    QR Code
                                </div>
                                {whatsAppStatus.status !== 'CONNECTED' ? (
                                    <button type="button" className={secondaryButtonClassName} onClick={() => void loadQrCode(true)} disabled={qrLoading}>
                                        {qrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                                        Gerar QR
                                    </button>
                                ) : null}
                            </div>
                            <div className="mt-4 flex min-h-[240px] items-center justify-center rounded-[14px] border border-dashed border-white/10 bg-[#0A0A0C] p-4">
                                {whatsAppStatus.status === 'CONNECTED' ? (
                                    <div className="text-center">
                                        <Check className="mx-auto h-10 w-10 text-[color:var(--orion-green)]" />
                                        <p className="mt-3 text-sm font-medium text-[color:var(--orion-text)]">Número conectado.</p>
                                        <button type="button" className={cn(secondaryButtonClassName, 'mt-4')} onClick={onDisconnectWhatsApp}>
                                            <Power className="h-3.5 w-3.5" />
                                            Desconectar
                                        </button>
                                    </div>
                                ) : qrCodeSrc ? (
                                    <img src={qrCodeSrc} alt="QR Code WhatsApp" className="h-56 w-56 rounded-xl bg-white p-2" />
                                ) : (
                                    <p className="text-sm text-[color:var(--orion-text-secondary)]">QR Code ainda não carregado.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </SectionCard>

            <SectionCard
                title="Handoff do Número"
                description="Use este painel para trocar o aparelho ou iniciar nova autenticação."
            >
                <div className="rounded-[14px] border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-[color:var(--orion-amber)]">
                    Para trocar o número, desconecte a instância atual e escaneie o novo QR Code. O histórico operacional continua no CRM.
                </div>
            </SectionCard>
        </div>
    );

    const renderNotificationsTab = () => {
        if (notificationsLoading || !notificationPrefs) {
            return <LoadingPanel title="Notificações" />;
        }

        return (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <SectionCard title="Preferências Operacionais" description="Preferências individuais do usuário logado.">
                    <div className="space-y-3">
                        {notificationItems.map((item) => (
                            <div key={item.key} className="flex items-center justify-between gap-4 rounded-[14px] border border-white/10 bg-[color:var(--orion-base)] px-4 py-4">
                                <div>
                                    <div className="text-sm font-medium text-[color:var(--orion-text)]">{item.label}</div>
                                    <div className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">{item.description}</div>
                                </div>
                                <Switch
                                    checked={Boolean(notificationPrefs[item.key])}
                                    onCheckedChange={(checked) => void onToggleNotification(item.key, checked)}
                                    disabled={updatingNotification === item.key}
                                />
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <div className="space-y-5">
                    <SectionCard title="WhatsApp Pessoal" description="Número usado para receber alertas de operação.">
                        <form className="space-y-4" onSubmit={personalWhatsappForm.handleSubmit(onSavePersonalWhatsapp)}>
                            <div className="space-y-2">
                                <FieldMeta label="Número pessoal" hint="Pode ser diferente do número oficial da empresa." />
                                <input
                                    className={fieldClassName}
                                    placeholder="(11) 99999-9999"
                                    {...personalWhatsappForm.register('personal_whatsapp', {
                                        onChange: (event) => {
                                            event.target.value = maskPhone(event.target.value);
                                        },
                                    })}
                                />
                            </div>
                            <button type="submit" className={primaryButtonClassName} disabled={savingPersonalWhatsapp}>
                                {savingPersonalWhatsapp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Salvar número
                            </button>
                        </form>
                    </SectionCard>

                    <SectionCard
                        title="Janela de Silêncio"
                        description="Defina o horário em que notificações não serão enviadas."
                        action={
                            <button type="button" className={primaryButtonClassName} onClick={() => void onSaveQuietHours()} disabled={savingQuietHours}>
                                {savingQuietHours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Salvar horário
                            </button>
                        }
                    >
                        <div className="space-y-4">
                            <div className="flex items-center justify-between rounded-[14px] border border-white/10 bg-[color:var(--orion-base)] px-4 py-4">
                                <div>
                                    <div className="text-sm font-medium text-[color:var(--orion-text)]">Silenciar notificações</div>
                                    <div className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">
                                        Das {quietHoursStart} às {quietHoursEnd}
                                    </div>
                                </div>
                                <Switch
                                    checked={notificationPrefs.quiet_hours_enabled}
                                    onCheckedChange={(checked) => {
                                        setNotificationPrefs((current) => current ? ({ ...current, quiet_hours_enabled: checked }) : current);
                                        void onSaveQuietHours(checked);
                                    }}
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                    type="time"
                                    className={fieldClassName}
                                    value={quietHoursStart}
                                    onChange={(event) => setQuietHoursStart(event.target.value)}
                                    disabled={!notificationPrefs.quiet_hours_enabled}
                                />
                                <input
                                    type="time"
                                    className={fieldClassName}
                                    value={quietHoursEnd}
                                    onChange={(event) => setQuietHoursEnd(event.target.value)}
                                    disabled={!notificationPrefs.quiet_hours_enabled}
                                />
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </div>
        );
    };

    const renderIntegrationsTab = () => {
        if (integrationsLoading || !integrations) {
            return <LoadingPanel title="Integrações" />;
        }

        return (
            <div className="space-y-5">
                <SectionCard
                    title="Meta Cloud API"
                    description="WhatsApp Business + Instagram Direct · configuração de webhook e token."
                    action={
                        <div className="flex items-center gap-2">
                            <span className={cn('inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]', integrationBadgeClass(integrations.meta.status))}>
                                {integrationStatusText(integrations.meta.status)}
                            </span>
                            <button
                                type="button"
                                className={primaryButtonClassName}
                                onClick={metaIntegrationForm.handleSubmit(onSaveMetaIntegration)}
                                disabled={savingMetaIntegration}
                            >
                                {savingMetaIntegration ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Salvar
                            </button>
                            <a href={integrations.meta.docs_url} target="_blank" rel="noreferrer" className={secondaryButtonClassName}>
                                <ExternalLink className="h-3.5 w-3.5" />
                                Docs
                            </a>
                        </div>
                    }
                >
                    <form className="grid gap-4 md:grid-cols-2" onSubmit={metaIntegrationForm.handleSubmit(onSaveMetaIntegration)}>
                        <div className="space-y-2 md:col-span-2">
                            <FieldMeta
                                label="Token de acesso permanente"
                                hint={integrations.meta.access_token_masked ? `Atual: ${integrations.meta.access_token_masked}` : 'Informe o token permanente do Meta.'}
                            />
                            <input
                                type="password"
                                className={fieldClassName}
                                placeholder="Cole o token permanente"
                                {...metaIntegrationForm.register('access_token')}
                            />
                            {metaIntegrationForm.formState.errors.access_token ? (
                                <p className="text-xs text-[color:var(--orion-red)]">{metaIntegrationForm.formState.errors.access_token.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <FieldMeta label="Phone Number ID" />
                            <input className={fieldClassName} placeholder="Ex: 102648374921847" {...metaIntegrationForm.register('phone_number_id')} />
                            {metaIntegrationForm.formState.errors.phone_number_id ? (
                                <p className="text-xs text-[color:var(--orion-red)]">{metaIntegrationForm.formState.errors.phone_number_id.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <FieldMeta label="WhatsApp Business Account ID" />
                            <input className={fieldClassName} placeholder="Ex: 198473920847362" {...metaIntegrationForm.register('waba_id')} />
                            {metaIntegrationForm.formState.errors.waba_id ? (
                                <p className="text-xs text-[color:var(--orion-red)]">{metaIntegrationForm.formState.errors.waba_id.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <FieldMeta label="Verify Token (gerado pelo ORION)" />
                            <input className={fieldClassName} placeholder="orion_verify_xxx" {...metaIntegrationForm.register('verify_token')} />
                            {metaIntegrationForm.formState.errors.verify_token ? (
                                <p className="text-xs text-[color:var(--orion-red)]">{metaIntegrationForm.formState.errors.verify_token.message}</p>
                            ) : null}
                        </div>
                    </form>

                    <div className="mt-5 border-t border-white/5 pt-5">
                        <div className="space-y-2">
                            <FieldMeta label="Webhook URL · configure no Meta Developer Console" hint="Cole esta URL em Meta Developer → Webhooks → WhatsApp." />
                            <div className={readOnlyFieldClassName}>
                                <span className="truncate text-[12px]">{integrations.meta.webhook_url || 'Não configurado'}</span>
                                {integrations.meta.webhook_url ? (
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-gold"
                                        onClick={() => void copyToClipboard('meta-webhook', integrations.meta.webhook_url, 'Webhook da Meta copiado.')}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        {copyingKey === 'meta-webhook' ? 'Copiado' : 'Copiar'}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard
                    title="n8n"
                    description="Motor de automações do ORION, com snapshot dos workflows sistêmicos."
                    action={
                        <div className="flex items-center gap-2">
                            <span className={cn('inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]', integrationBadgeClass(integrations.n8n.status))}>
                                {integrations.n8n.status === 'connected' ? 'Online' : 'Não configurado'}
                            </span>
                            <button
                                type="button"
                                className={primaryButtonClassName}
                                onClick={n8nIntegrationForm.handleSubmit(onSaveN8nIntegration)}
                                disabled={savingN8nIntegration}
                            >
                                {savingN8nIntegration ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Salvar
                            </button>
                            <button type="button" className={secondaryButtonClassName} onClick={() => void testN8nConnection()}>
                                <RefreshCw className="h-3.5 w-3.5" />
                                Testar conexão
                            </button>
                        </div>
                    }
                >
                    <form className="grid gap-4 md:grid-cols-2" onSubmit={n8nIntegrationForm.handleSubmit(onSaveN8nIntegration)}>
                        <div className="space-y-2">
                            <FieldMeta label="URL da instância" hint={integrations.n8n.base_url ?? 'Informe a URL do n8n.'} />
                            <input className={fieldClassName} placeholder="https://n8n.seudominio.com" {...n8nIntegrationForm.register('base_url')} />
                            {n8nIntegrationForm.formState.errors.base_url ? (
                                <p className="text-xs text-[color:var(--orion-red)]">{n8nIntegrationForm.formState.errors.base_url.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <FieldMeta label="API Key" hint={integrations.n8n.api_key_masked ? `Atual: ${integrations.n8n.api_key_masked}` : 'Cole sua API Key.'} />
                            <input type="password" className={fieldClassName} placeholder="n8n_api_xxx" {...n8nIntegrationForm.register('api_key')} />
                            {n8nIntegrationForm.formState.errors.api_key ? (
                                <p className="text-xs text-[color:var(--orion-red)]">{n8nIntegrationForm.formState.errors.api_key.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <FieldMeta label="Webhook URL (opcional)" hint={integrations.n8n.webhook_url ?? 'URL de callback, se aplicável.'} />
                            <input className={fieldClassName} placeholder="https://n8n.seudominio.com/webhook/orion" {...n8nIntegrationForm.register('webhook_url')} />
                            {n8nIntegrationForm.formState.errors.webhook_url ? (
                                <p className="text-xs text-[color:var(--orion-red)]">{n8nIntegrationForm.formState.errors.webhook_url.message}</p>
                            ) : null}
                        </div>
                    </form>

                    <div className="mt-5 border-t border-white/5 pt-5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">
                            Workflows ativos conhecidos pelo ORION
                        </div>
                        <div className="mt-3 space-y-0">
                            {integrations.n8n.workflows.map((workflow) => (
                                <div key={workflow.id} className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-b-0">
                                    <div>
                                        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--orion-text)]">
                                            <span
                                                className={cn(
                                                    'h-2 w-2 rounded-full',
                                                    workflow.status === 'active' ? 'bg-[color:var(--orion-green)]' : 'bg-[color:var(--orion-amber)]'
                                                )}
                                            />
                                            {workflow.label}
                                        </div>
                                        <div className="mt-1 text-[10px] font-mono text-[color:var(--orion-text-muted)]">ID: {workflow.id}</div>
                                    </div>
                                    <span
                                        className={cn(
                                            'inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]',
                                            workflow.status === 'active'
                                                ? 'border-emerald-500/20 bg-emerald-500/10 text-[color:var(--orion-green)]'
                                                : 'border-amber-500/20 bg-amber-500/10 text-[color:var(--orion-amber)]'
                                        )}
                                    >
                                        {workflow.status === 'active' ? 'Ativo' : 'Pausado'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </SectionCard>

                <SectionCard
                    title="Mercado Pago"
                    description="Checkout da loja pública com webhook interno e credenciais mascaradas."
                    action={
                        <div className="flex items-center gap-2">
                            <span className={cn('inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]', integrationBadgeClass(integrations.mercadopago.status))}>
                                {integrationStatusText(integrations.mercadopago.status)}
                            </span>
                            <button
                                type="button"
                                className={primaryButtonClassName}
                                onClick={mercadoPagoIntegrationForm.handleSubmit(onSaveMercadoPagoIntegration)}
                                disabled={savingMpIntegration}
                            >
                                {savingMpIntegration ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Salvar
                            </button>
                            <button type="button" className={secondaryButtonClassName} onClick={() => void testMercadoPagoConnection()}>
                                <RefreshCw className="h-3.5 w-3.5" />
                                Testar credencial
                            </button>
                        </div>
                    }
                >
                    <form className="space-y-4" onSubmit={mercadoPagoIntegrationForm.handleSubmit(onSaveMercadoPagoIntegration)}>
                        <div className="flex items-center justify-between rounded-[10px] border border-white/10 bg-[color:var(--orion-base)] px-4 py-3">
                            <div>
                                <div className="text-sm font-medium text-[color:var(--orion-text)]">Ambiente Sandbox</div>
                                <div className="mt-1 text-xs text-[color:var(--orion-text-secondary)]">Ative para usar credenciais de teste.</div>
                            </div>
                            <Switch
                                checked={Boolean(mercadoPagoIntegrationForm.watch('sandbox_mode'))}
                                onCheckedChange={(checked) => mercadoPagoIntegrationForm.setValue('sandbox_mode', checked)}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <FieldMeta
                                    label="Access Token (produção)"
                                    hint={integrations.mercadopago.access_token_masked ? `Atual: ${integrations.mercadopago.access_token_masked}` : 'Cole seu token de produção.'}
                                />
                                <input type="password" className={fieldClassName} placeholder="APP_USR-..." {...mercadoPagoIntegrationForm.register('access_token')} />
                                {mercadoPagoIntegrationForm.formState.errors.access_token ? (
                                    <p className="text-xs text-[color:var(--orion-red)]">{mercadoPagoIntegrationForm.formState.errors.access_token.message}</p>
                                ) : null}
                            </div>
                            <div className="space-y-2">
                                <FieldMeta
                                    label="Public Key (produção)"
                                    hint={integrations.mercadopago.public_key_masked ? `Atual: ${integrations.mercadopago.public_key_masked}` : 'Cole sua public key.'}
                                />
                                <input type="password" className={fieldClassName} placeholder="APP_USR-..." {...mercadoPagoIntegrationForm.register('public_key')} />
                                {mercadoPagoIntegrationForm.formState.errors.public_key ? (
                                    <p className="text-xs text-[color:var(--orion-red)]">{mercadoPagoIntegrationForm.formState.errors.public_key.message}</p>
                                ) : null}
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <FieldMeta
                                    label="Access Token (sandbox)"
                                    hint={integrations.mercadopago.sandbox_access_token_masked ? `Atual: ${integrations.mercadopago.sandbox_access_token_masked}` : 'Cole o token de teste.'}
                                />
                                <input type="password" className={fieldClassName} placeholder="TEST-..." {...mercadoPagoIntegrationForm.register('sandbox_access_token')} />
                                {mercadoPagoIntegrationForm.formState.errors.sandbox_access_token ? (
                                    <p className="text-xs text-[color:var(--orion-red)]">{mercadoPagoIntegrationForm.formState.errors.sandbox_access_token.message}</p>
                                ) : null}
                            </div>
                        </div>
                    </form>

                    <div className="mt-5 border-t border-white/5 pt-5">
                        <div className="space-y-2">
                            <FieldMeta label="Webhook URL · configure em MP → Notificações IPN" />
                            <div className={readOnlyFieldClassName}>
                                <span className="truncate text-[12px]">{integrations.mercadopago.webhook_url || 'Não configurado'}</span>
                                {integrations.mercadopago.webhook_url ? (
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-gold"
                                        onClick={() => void copyToClipboard('mp-webhook', integrations.mercadopago.webhook_url, 'Webhook do Mercado Pago copiado.')}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        {copyingKey === 'mp-webhook' ? 'Copiado' : 'Copiar'}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </SectionCard>
            </div>
        );
    };

    const renderActiveTab = () => {
        if (activeTab === 'empresa') return renderCompanyTab();
        if (activeTab === 'usuarios') return renderUsersTab();
        if (activeTab === 'whatsapp') return <WhatsAppTab onToast={addToast} />;
        if (activeTab === 'notificacoes') return renderNotificationsTab();
        if (activeTab === 'integracoes') return <IntegracoesTab onToast={addToast} />;
        return null;
    };

    const headerAction = activeTab === 'empresa' ? (
        <button
            type="button"
            className={primaryButtonClassName}
            onClick={companyForm.handleSubmit(onSaveCompany)}
            disabled={savingCompany}
        >
            {savingCompany ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {savingCompany ? 'Salvando' : 'Salvar'}
        </button>
    ) : null;

    return (
        <div className="orion-page">
            <div className="flex items-center justify-between gap-4">
                <h1
                    className="text-[34px] font-semibold tracking-tight text-[color:var(--orion-text)]"
                    style={{ fontFamily: 'var(--font-orion-serif)' }}
                >
                    Ajustes
                </h1>
                {headerAction}
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-white/5">
                {tabItems.map((tab) => {
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className={cn(
                                'inline-flex h-10 items-center border-b-2 px-4 text-[12px] font-medium transition',
                                isActive
                                    ? 'border-brand-gold text-[color:var(--orion-text)]'
                                    : 'border-transparent text-[color:var(--orion-text-secondary)] hover:text-[color:var(--orion-text)]'
                            )}
                            onClick={() => syncTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="py-6">{renderActiveTab()}</div>

            {inviteOpen ? (
                <DialogContainer
                    title="Convidar Usuário"
                    description="Novo acesso para equipe comercial e administrativa."
                    onClose={() => setInviteOpen(false)}
                >
                    <form className="grid gap-4" onSubmit={inviteForm.handleSubmit(onInviteUser)}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <input className={fieldClassName} placeholder="Nome completo" {...inviteForm.register('name')} />
                            <input className={fieldClassName} placeholder="E-mail" type="email" {...inviteForm.register('email')} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <select aria-label="Função do usuário" {...inviteForm.register('role')} className={fieldClassName}>
                                <option value="ADMIN">ADMIN</option>
                                <option value="ATENDENTE">ATENDENTE</option>
                            </select>
                            <input
                                className={fieldClassName}
                                placeholder="WhatsApp pessoal"
                                {...inviteForm.register('personal_whatsapp', {
                                    onChange: (event) => {
                                        event.target.value = maskPhone(event.target.value);
                                    },
                                })}
                            />
                        </div>
                        <input className={fieldClassName} placeholder="Comissão (%)" type="number" min="0" max="100" step="0.01" {...inviteForm.register('commission_rate')} />
                        <div className="flex justify-end">
                            <button type="submit" className={primaryButtonClassName} disabled={savingInvite}>
                                {savingInvite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users2 className="h-3.5 w-3.5" />}
                                Convidar
                            </button>
                        </div>
                    </form>
                </DialogContainer>
            ) : null}

            {editingUser ? (
                <DialogContainer
                    title="Editar Usuário"
                    description={`Ajuste de permissões e dados de ${editingUser.name}.`}
                    onClose={() => setEditingUser(null)}
                >
                    <form className="grid gap-4" onSubmit={editForm.handleSubmit(onSaveUserEdit)}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <input className={fieldClassName} placeholder="Nome completo" {...editForm.register('name')} />
                            <input className={fieldClassName} placeholder="E-mail" type="email" {...editForm.register('email')} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <select aria-label="Função do usuário" {...editForm.register('role')} className={fieldClassName}>
                                <option value="ADMIN">ADMIN</option>
                                <option value="ATENDENTE">ATENDENTE</option>
                            </select>
                            <input
                                className={fieldClassName}
                                placeholder="WhatsApp pessoal"
                                {...editForm.register('personal_whatsapp', {
                                    onChange: (event) => {
                                        event.target.value = maskPhone(event.target.value);
                                    },
                                })}
                            />
                        </div>
                        <input className={fieldClassName} placeholder="Comissão (%)" type="number" min="0" max="100" step="0.01" {...editForm.register('commission_rate')} />
                        <div className="flex justify-end">
                            <button type="submit" className={primaryButtonClassName} disabled={savingEdit}>
                                {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Salvar alterações
                            </button>
                        </div>
                    </form>
                </DialogContainer>
            ) : null}

            <div className="fixed bottom-28 right-6 z-[60] space-y-2">
                {toastItems.map((toast) => (
                    <div
                        key={toast.id}
                        className={cn(
                            'min-w-[260px] rounded-xl border px-4 py-3 text-sm shadow-xl',
                            toast.kind === 'success'
                                ? 'border-emerald-500/20 bg-[#0F1712] text-[color:var(--orion-green)]'
                                : 'border-rose-500/20 bg-[#170F10] text-[color:var(--orion-red)]'
                        )}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </div>
    );
}

function UploadHint() {
    return (
        <div className="space-y-2">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand-gold">
                <ImageUp className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium text-[color:var(--orion-text)]">Arraste a logo aqui ou selecione um arquivo</div>
            <div className="text-xs text-[color:var(--orion-text-secondary)]">PNG, JPG ou SVG até 2MB.</div>
        </div>
    );
}
