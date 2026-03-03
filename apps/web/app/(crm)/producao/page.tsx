import { advanceProductionStepAction } from '@/app/(crm)/producao/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ApiListResponse, ProductionOrderRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default async function ProductionPage({
    searchParams,
}: {
    searchParams?: {
        selected?: string;
        status?: ProductionOrderRecord['status'] | '';
        error?: string;
    };
}) {
    const query = new URLSearchParams({ limit: '100' });
    if (searchParams?.status) {
        query.set('status', searchParams.status);
    }

    const productionResponse = await apiRequest<ApiListResponse<ProductionOrderRecord>>(
        `/production-orders?${query.toString()}`
    );

    const selectedProduction = searchParams?.selected
        ? await apiRequest<ProductionOrderRecord>(`/production-orders/${searchParams.selected}`).catch(() => null)
        : productionResponse.data[0]
            ? await apiRequest<ProductionOrderRecord>(`/production-orders/${productionResponse.data[0].id}`).catch(() => null)
            : null;

    const overdue = productionResponse.data.filter((order) => order.is_overdue);
    const inProgress = productionResponse.data.filter((order) => !order.is_overdue);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Produção"
                description="Painel de execução por etapa, com atraso visível e avanço operacional sem sair do CRM."
                actions={
                    <form method="get">
                        <select
                            name="status"
                            defaultValue={searchParams?.status ?? ''}
                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                        >
                            <option value="">Todos os status</option>
                            <option value="PENDENTE">Pendente</option>
                            <option value="EM_ANDAMENTO">Em andamento</option>
                            <option value="PAUSADA">Pausada</option>
                            <option value="CONCLUIDA">Concluída</option>
                            <option value="REPROVADA">Reprovada</option>
                        </select>
                    </form>
                }
            />

            {searchParams?.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchParams.error}
                </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                    <Card title={`Atrasados (${overdue.length})`} description="Ordens com prazo estourado ganham destaque imediato para priorização.">
                        <div className="space-y-3">
                            {overdue.length === 0 ? (
                                <p className="text-sm text-gray-500">Nenhuma ordem atrasada.</p>
                            ) : (
                                overdue.map((order) => (
                                    <a
                                        key={order.id}
                                        href={`/producao?selected=${order.id}`}
                                        className="block rounded-xl border border-red-200 bg-red-50 px-4 py-4 transition hover:shadow-card-hover"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{order.order.order_number}</p>
                                                <p className="mt-1 text-sm text-gray-600">{order.order.customer_name}</p>
                                            </div>
                                            <StatusBadge status={order.status} />
                                        </div>
                                        <p className="mt-3 text-sm text-gray-700">Etapa atual: {order.current_step}</p>
                                        <div className="mt-3 h-2 rounded-full bg-red-100">
                                            <div className="h-full rounded-full bg-red-400" style={{ width: `${order.progress_percent}%` }} />
                                        </div>
                                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-red-600">
                                            Prazo: {formatDate(order.deadline)}
                                        </p>
                                    </a>
                                ))
                            )}
                        </div>
                    </Card>

                    <Card title={`Em andamento (${inProgress.length})`} description="Fila ativa da bancada, com progresso calculado por etapa.">
                        <div className="space-y-3">
                            {inProgress.length === 0 ? (
                                <p className="text-sm text-gray-500">Nenhuma ordem em andamento.</p>
                            ) : (
                                inProgress.map((order) => (
                                    <a
                                        key={order.id}
                                        href={`/producao?selected=${order.id}`}
                                        className="block rounded-xl border border-canvas-border bg-white px-4 py-4 transition hover:border-brand-gold-light hover:shadow-card-hover"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{order.order.order_number}</p>
                                                <p className="mt-1 text-sm text-gray-600">{order.order.customer_name}</p>
                                            </div>
                                            <StatusBadge status={order.status} />
                                        </div>
                                        <p className="mt-3 text-sm text-gray-700">Etapa atual: {order.current_step}</p>
                                        <div className="mt-3 h-2 rounded-full bg-gray-100">
                                            <div className="h-full rounded-full bg-brand-gold" style={{ width: `${order.progress_percent}%` }} />
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-gray-500">
                                            <span>{order.assigned_to?.name ?? 'Sem ourives'}</span>
                                            <span>{formatDate(order.deadline)}</span>
                                        </div>
                                    </a>
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                <div className="xl:sticky xl:top-20 xl:self-start">
                    {selectedProduction ? (
                        <Card
                            title={selectedProduction.order.order_number}
                            description={`${selectedProduction.order.customer_name} · ${selectedProduction.current_step}`}
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <StatusBadge status={selectedProduction.status} />
                                    <span className="text-xs uppercase tracking-[0.16em] text-gray-500">
                                        {selectedProduction.progress_percent}%
                                    </span>
                                </div>

                                <div className="h-2 rounded-full bg-gray-100">
                                    <div className="h-full rounded-full bg-brand-gold" style={{ width: `${selectedProduction.progress_percent}%` }} />
                                </div>

                                <div className="rounded-lg border border-canvas-border bg-white px-4 py-3">
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Timeline</p>
                                    <div className="mt-3 space-y-3">
                                        {selectedProduction.steps?.length ? (
                                            selectedProduction.steps.map((step) => (
                                                <div key={step.id} className="rounded-lg border border-canvas-border px-3 py-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-semibold text-gray-900">{step.step_name}</p>
                                                        <span className="text-xs uppercase tracking-[0.16em] text-gray-500">
                                                            {step.approved ? 'Aprovada' : 'Reprovada'}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 text-xs text-gray-500">{step.completed_by.name} · {formatDate(step.completed_at)}</p>
                                                    {step.notes ? <p className="mt-2 text-sm text-gray-700">{step.notes}</p> : null}
                                                    {step.rejection_reason ? <p className="mt-2 text-sm text-red-600">{step.rejection_reason}</p> : null}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500">Nenhuma etapa concluída ainda.</p>
                                        )}
                                    </div>
                                </div>

                                <form action={advanceProductionStepAction} className="space-y-3">
                                    <input type="hidden" name="production_order_id" value={selectedProduction.id} />
                                    <textarea
                                        name="notes"
                                        rows={3}
                                        placeholder="Observações da bancada"
                                        className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                                    />
                                    <select
                                        name="approved"
                                        defaultValue="true"
                                        className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                    >
                                        <option value="true">Avançar etapa</option>
                                        <option value="false">Reprovar e retornar</option>
                                    </select>
                                    <textarea
                                        name="rejection_reason"
                                        rows={2}
                                        placeholder="Motivo da reprovação (somente quando necessário)"
                                        className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                                    />
                                    <Button type="submit" className="w-full justify-center">Registrar etapa</Button>
                                </form>
                            </div>
                        </Card>
                    ) : (
                        <EmptyState
                            title="Nenhuma ordem de produção selecionada"
                            description="Selecione uma ordem na lista para ver a timeline e avançar a próxima etapa."
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
