'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { HexColorPicker } from 'react-colorful';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import type {
    AdminSettings,
    AdminUser,
    AdminUsersResponse,
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

type CompanyFormValues = z.infer<typeof companySchema>;
type InviteFormValues = z.infer<typeof inviteSchema>;

type ToastKind = 'success' | 'error';

interface ToastRecord {
    id: number;
    kind: ToastKind;
    message: string;
}

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

async function parseError(response: Response): Promise<string> {
    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    return typeof payload.message === 'string' ? payload.message : 'Não foi possível concluir a ação.';
}

function statusLabel(status: WhatsAppStatusPayload['status']): string {
    if (status === 'CONNECTED') return 'Conectado';
    if (status === 'CONNECTING') return 'Conectando';
    return 'Desconectado';
}

function statusClassName(status: WhatsAppStatusPayload['status']): string {
    if (status === 'CONNECTED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'CONNECTING') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-rose-200 bg-rose-50 text-rose-700';
}

function roleBadgeClass(role: AdminUser['role']): string {
    if (role === 'ADMIN') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-blue-200 bg-blue-50 text-blue-700';
}

function statusBadgeClass(status: AdminUser['status']): string {
    if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    return 'border-gray-200 bg-gray-100 text-gray-700';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-xl border border-canvas-border bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                        {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
                    </div>
                    <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900">
                        Fechar
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function AjustesClient({
    initialSettings,
    initialUsers,
    currentUserId,
}: {
    initialSettings: AdminSettings;
    initialUsers: AdminUser[];
    currentUserId: string;
}) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('empresa');
    const [settings, setSettings] = useState(initialSettings);
    const [users, setUsers] = useState(initialUsers);
    const [usersLoading, setUsersLoading] = useState(false);
    const [toastItems, setToastItems] = useState<ToastRecord[]>([]);
    const [savingCompany, setSavingCompany] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState(initialSettings.logo_url);
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

    const notificationItems = useMemo(() => ([
        {
            key: 'notify_new_lead_whatsapp' as const,
            label: 'Notificar no WhatsApp pessoal quando chegar novo lead',
        },
        {
            key: 'notify_order_paid' as const,
            label: 'Notificar quando pedido for pago',
        },
        {
            key: 'notify_production_delayed' as const,
            label: 'Notificar quando produção estiver atrasada',
        },
        {
            key: 'notify_low_stock' as const,
            label: 'Notificar quando estoque estiver baixo',
        },
    ]), []);

    function addToast(kind: ToastKind, message: string) {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToastItems((current) => [...current, { id, kind, message }]);
        window.setTimeout(() => {
            setToastItems((current) => current.filter((item) => item.id !== id));
        }, 4000);
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
            const response = await fetch('/api/internal/settings/whatsapp/status', { cache: 'no-store' });
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

    async function loadQrCode(showErrorToast = true) {
        setQrLoading(true);

        try {
            const response = await fetch('/api/internal/settings/whatsapp/qrcode', {
                method: 'GET',
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

    useEffect(() => {
        void refreshUsers(true);
        void refreshWhatsAppStatus(true);
    }, []);

    useEffect(() => {
        if (whatsAppStatus.status !== 'DISCONNECTED') {
            return;
        }

        const intervalId = window.setInterval(() => {
            void refreshWhatsAppStatus(false);
            void loadQrCode(false);
        }, 30_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [whatsAppStatus.status]);

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

            const response = await fetch('/api/internal/settings', {
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

            const response = await fetch('/api/internal/settings/logo', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            const payload = await response.json() as { url: string };
            setLogoPreview(payload.url);
            setLogoFile(null);
            addToast('success', 'Logo atualizada com sucesso.');
            router.refresh();
        } catch (error) {
            addToast('error', error instanceof Error ? error.message : 'Falha ao enviar logo.');
        } finally {
            setUploadingLogo(false);
        }
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
        if (!editingUser) {
            return;
        }

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
            const response = await fetch('/api/internal/settings/whatsapp/disconnect', {
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

    async function onToggleNotification(
        key: 'notify_new_lead_whatsapp' | 'notify_order_paid' | 'notify_production_delayed' | 'notify_low_stock',
        value: boolean
    ) {
        const previous = settings[key];
        setUpdatingNotification(key);
        setSettings((current) => ({ ...current, [key]: value }));

        try {
            const response = await fetch('/api/internal/settings/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value }),
            });

            if (!response.ok) {
                throw new Error(await parseError(response));
            }

            addToast('success', 'Preferência de notificação atualizada.');
        } catch (error) {
            setSettings((current) => ({ ...current, [key]: previous }));
            addToast('error', error instanceof Error ? error.message : 'Falha ao salvar notificação.');
        } finally {
            setUpdatingNotification(null);
        }
    }

    const qrCodeSrc = qrCodeBase64
        ? (qrCodeBase64.startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`)
        : null;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Ajustes"
                description="Configurações administrativas da operação ORION."
            />

            <Tabs value={activeTab} defaultValue="empresa" onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="empresa">Empresa</TabsTrigger>
                    <TabsTrigger value="usuarios">Usuários</TabsTrigger>
                    <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                    <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
                </TabsList>

                <TabsContent value="empresa">
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <Card title="Dados da Empresa" description="Identidade da marca e informações oficiais.">
                            <form className="grid gap-4" onSubmit={companyForm.handleSubmit(onSaveCompany)}>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Nome da empresa</label>
                                    <Input {...companyForm.register('company_name')} />
                                    {companyForm.formState.errors.company_name ? (
                                        <p className="mt-1 text-xs text-red-600">{companyForm.formState.errors.company_name.message}</p>
                                    ) : null}
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-700">CNPJ</label>
                                        <Input
                                            {...companyForm.register('cnpj', {
                                                onChange: (event) => {
                                                    event.target.value = maskCnpj(event.target.value);
                                                },
                                            })}
                                            placeholder="00.000.000/0000-00"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-700">Telefone</label>
                                        <Input
                                            {...companyForm.register('phone', {
                                                onChange: (event) => {
                                                    event.target.value = maskPhone(event.target.value);
                                                },
                                            })}
                                            placeholder="(11) 99999-9999"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Endereço</label>
                                    <Input {...companyForm.register('address')} placeholder="Rua, número, bairro e cidade" />
                                </div>

                                <div className="grid gap-3 rounded-lg border border-canvas-border p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-gray-700">Cor primária</p>
                                        <Input
                                            className="w-28"
                                            {...companyForm.register('primary_color')}
                                            placeholder="#C8A97A"
                                        />
                                    </div>
                                    <HexColorPicker
                                        color={companyForm.watch('primary_color') || '#C8A97A'}
                                        onChange={(value) => {
                                            companyForm.setValue('primary_color', value, { shouldValidate: true });
                                        }}
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <Button type="submit" disabled={savingCompany}>
                                        {savingCompany ? 'Salvando...' : 'Salvar'}
                                    </Button>
                                </div>
                            </form>
                        </Card>

                        <Card title="Branding" description="Upload de logo e preview em tempo real.">
                            <div className="space-y-4">
                                <div
                                    className={cn(
                                        'rounded-lg border border-dashed border-canvas-border p-4 text-center transition',
                                        dragActive ? 'border-brand-gold bg-brand-gold/10' : 'bg-white'
                                    )}
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        setDragActive(true);
                                    }}
                                    onDragLeave={() => setDragActive(false)}
                                    onDrop={onDropLogo}
                                >
                                    <p className="text-sm text-gray-700">
                                        Arraste e solte o logo aqui (PNG/JPG/SVG) ou selecione um arquivo.
                                    </p>
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/svg+xml"
                                        className="mt-3 w-full text-sm"
                                        onChange={(event) => {
                                            const nextFile = event.target.files?.[0];
                                            if (nextFile) {
                                                applyLogoFile(nextFile);
                                            }
                                        }}
                                    />
                                </div>

                                <div className="rounded-lg border border-canvas-border p-4">
                                    <p className="mb-3 text-sm font-medium text-gray-700">Preview</p>
                                    <div
                                        className="rounded-lg p-4"
                                        style={{ backgroundColor: companyForm.watch('primary_color') || '#C8A97A' }}
                                    >
                                        {logoPreview ? (
                                            <img src={logoPreview} alt="Logo preview" className="h-14 w-auto rounded bg-white p-2" />
                                        ) : (
                                            <p className="text-sm font-medium text-surface-sidebar">{companyForm.watch('company_name')}</p>
                                        )}
                                    </div>
                                </div>

                                <Button className="w-full justify-center" onClick={onUploadLogo} disabled={uploadingLogo || !logoFile}>
                                    {uploadingLogo ? 'Enviando logo...' : 'Enviar logo'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="usuarios">
                    <Card
                        title="Equipe"
                        description="Gerencie usuários, perfis de acesso e status de ativação."
                    >
                        <div className="mb-4 flex justify-end">
                            <Button onClick={() => setInviteOpen(true)}>+ Convidar Usuário</Button>
                        </div>

                        {usersLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-[820px] text-left text-sm">
                                    <thead className="text-xs uppercase tracking-[0.18em] text-gray-500">
                                        <tr>
                                            <th className="pb-3 pr-4 font-medium">Nome</th>
                                            <th className="pb-3 pr-4 font-medium">Email</th>
                                            <th className="pb-3 pr-4 font-medium">Role</th>
                                            <th className="pb-3 pr-4 font-medium">Status</th>
                                            <th className="pb-3 pr-4 font-medium">Comissão %</th>
                                            <th className="pb-3 font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-canvas-border">
                                        {users.map((user) => (
                                            <tr key={user.id}>
                                                <td className="py-3 pr-4">
                                                    <p className="font-medium text-gray-900">{user.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        Último login: {user.last_login_at ? formatDate(user.last_login_at) : 'Nunca'}
                                                    </p>
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">{user.email}</td>
                                                <td className="py-3 pr-4">
                                                    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', roleBadgeClass(user.role))}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', statusBadgeClass(user.status))}>
                                                        {user.status === 'active' ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">{Number(user.commission_rate).toFixed(2)}</td>
                                                <td className="py-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button variant="secondary" onClick={() => setEditingUser(user)}>
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            disabled={togglingUserId === user.id}
                                                            onClick={() => onToggleUserStatus(user)}
                                                        >
                                                            {togglingUserId === user.id
                                                                ? 'Atualizando...'
                                                                : user.status === 'active'
                                                                    ? 'Desativar'
                                                                    : 'Ativar'}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </TabsContent>

                <TabsContent value="whatsapp">
                    <Card title="Instância Evolution API" description="Gerencie conexão do número operacional da joalheria.">
                        {whatsAppLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-8 w-48" />
                                <Skeleton className="h-20 w-full" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className={cn('inline-flex rounded-md border px-3 py-1 text-sm font-medium', statusClassName(whatsAppStatus.status))}>
                                    {statusLabel(whatsAppStatus.status)}
                                </div>
                                <div className="grid gap-2 text-sm text-gray-700">
                                    <p>
                                        <span className="font-medium text-gray-900">Número conectado:</span>{' '}
                                        {whatsAppStatus.connected_number ?? 'Não conectado'}
                                    </p>
                                    <p>
                                        <span className="font-medium text-gray-900">Data de conexão:</span>{' '}
                                        {whatsAppStatus.connected_at ? formatDate(whatsAppStatus.connected_at) : 'Sem registro'}
                                    </p>
                                </div>

                                {whatsAppStatus.status !== 'CONNECTED' ? (
                                    <div className="space-y-3 rounded-lg border border-canvas-border p-4">
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="secondary" onClick={() => void loadQrCode(true)} disabled={qrLoading}>
                                                {qrLoading ? 'Gerando QR...' : 'Gerar QR Code'}
                                            </Button>
                                            <Button variant="ghost" onClick={() => void refreshWhatsAppStatus(false)}>
                                                Atualizar status
                                            </Button>
                                        </div>

                                        {qrCodeSrc ? (
                                            <img src={qrCodeSrc} alt="QR Code WhatsApp" className="h-56 w-56 rounded border border-canvas-border bg-white p-2" />
                                        ) : (
                                            <p className="text-sm text-gray-500">QR Code ainda não carregado.</p>
                                        )}
                                    </div>
                                ) : (
                                    <Button variant="secondary" onClick={onDisconnectWhatsApp}>
                                        Desconectar número
                                    </Button>
                                )}

                                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                    Para trocar de número, clique em Desconectar e escaneie o QR com o novo número.
                                </p>
                            </div>
                        )}
                    </Card>
                </TabsContent>

                <TabsContent value="notificacoes">
                    <Card title="Notificações Operacionais" description="Preferências de alertas para eventos críticos da operação.">
                        <div className="space-y-4">
                            {notificationItems.map((item) => (
                                <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-canvas-border p-3">
                                    <p className="text-sm text-gray-800">{item.label}</p>
                                    <Switch
                                        checked={settings[item.key]}
                                        onCheckedChange={(checked) => void onToggleNotification(item.key, checked)}
                                        disabled={updatingNotification === item.key}
                                    />
                                </div>
                            ))}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            {inviteOpen ? (
                <DialogContainer
                    title="Convidar Usuário"
                    description="Novo acesso para equipe comercial e administrativa."
                    onClose={() => setInviteOpen(false)}
                >
                    <form className="grid gap-3" onSubmit={inviteForm.handleSubmit(onInviteUser)}>
                        <Input placeholder="Nome" {...inviteForm.register('name')} />
                        <Input placeholder="Email" type="email" {...inviteForm.register('email')} />
                        <select
                            {...inviteForm.register('role')}
                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                        >
                            <option value="ADMIN">ADMIN</option>
                            <option value="ATENDENTE">ATENDENTE</option>
                        </select>
                        <Input
                            placeholder="WhatsApp pessoal"
                            {...inviteForm.register('personal_whatsapp', {
                                onChange: (event) => {
                                    event.target.value = maskPhone(event.target.value);
                                },
                            })}
                        />
                        <Input placeholder="Comissão (%)" type="number" min="0" max="100" step="0.01" {...inviteForm.register('commission_rate')} />
                        <div className="flex justify-end">
                            <Button type="submit" disabled={savingInvite}>
                                {savingInvite ? 'Convidando...' : 'Convidar'}
                            </Button>
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
                    <form className="grid gap-3" onSubmit={editForm.handleSubmit(onSaveUserEdit)}>
                        <Input placeholder="Nome" {...editForm.register('name')} />
                        <Input placeholder="Email" type="email" {...editForm.register('email')} />
                        <select
                            {...editForm.register('role')}
                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                        >
                            <option value="ADMIN">ADMIN</option>
                            <option value="ATENDENTE">ATENDENTE</option>
                        </select>
                        <Input
                            placeholder="WhatsApp pessoal"
                            {...editForm.register('personal_whatsapp', {
                                onChange: (event) => {
                                    event.target.value = maskPhone(event.target.value);
                                },
                            })}
                        />
                        <Input placeholder="Comissão (%)" type="number" min="0" max="100" step="0.01" {...editForm.register('commission_rate')} />
                        <div className="flex justify-end">
                            <Button type="submit" disabled={savingEdit}>
                                {savingEdit ? 'Salvando...' : 'Salvar alterações'}
                            </Button>
                        </div>
                    </form>
                </DialogContainer>
            ) : null}

            <div className="fixed right-4 top-16 z-[60] space-y-2">
                {toastItems.map((toast) => (
                    <div
                        key={toast.id}
                        className={cn(
                            'min-w-[240px] rounded-lg border px-3 py-2 text-sm shadow-lg',
                            toast.kind === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-rose-200 bg-rose-50 text-rose-800'
                        )}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </div>
    );
}
