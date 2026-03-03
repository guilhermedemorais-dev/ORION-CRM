import {
    createCustomOrderAction,
    createReadyOrderAction,
    updateOrderStatusAction,
} from '@/app/(crm)/pedidos/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type {
    ApiListResponse,
    CustomerRecord,
    OrderRecord,
} from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { formatCurrencyFromCents, formatDate } from '@/lib/utils';

const orderStatuses: OrderRecord['status'][] = [
    'RASCUNHO',
    'AGUARDANDO_PAGAMENTO',
    'PAGO',
    'SEPARANDO',
    'ENVIADO',
    'RETIRADO',
    'CANCELADO',
    'AGUARDANDO_APROVACAO_DESIGN',
    'APROVADO',
    'EM_PRODUCAO',
    'CONTROLE_QUALIDADE',
];

export default async function OrdersPage({
    searchParams,
}: {
    searchParams?: {
        selected?: string;
        status?: OrderRecord['status'] | '';
        type?: OrderRecord['type'] | '';
        error?: string;
    };
}) {
    const ordersQuery = new URLSearchParams({ limit: '100' });
    if (searchParams?.status) {
        ordersQuery.set('status', searchParams.status);
    }
    if (searchParams?.type) {
        ordersQuery.set('type', searchParams.type);
    }

    const [ordersResponse, customersResponse] = await Promise.all([
        apiRequest<ApiListResponse<OrderRecord>>(`/orders?${ordersQuery.toString()}`),
        apiRequest<ApiListResponse<CustomerRecord>>('/customers?limit=100'),
    ]);

    const selectedOrder = searchParams?.selected
        ? await apiRequest<OrderRecord>(`/orders/${searchParams.selected}`).catch(() => null)
        : ordersResponse.data[0]
            ? await apiRequest<OrderRecord>(`/orders/${ordersResponse.data[0].id}`).catch(() => null)
            : null;

    const quickFilters = [
        { label: 'Todos', href: '/pedidos' },
        { label: 'Aguard. Pag.', href: '/pedidos?status=AGUARDANDO_PAGAMENTO' },
        { label: 'Em Produção', href: '/pedidos?status=EM_PRODUCAO' },
        { label: 'Prontos', href: '/pedidos?status=RETIRADO' },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pedidos"
                description="Operação comercial com criação rápida de pronta entrega e personalizados, já conectada à fila de produção."
                actions={
                    <div className="flex flex-wrap gap-2">
                        {quickFilters.map((filter) => (
                            <a
                                key={filter.href}
                                href={filter.href}
                                className="rounded-full border border-canvas-border bg-white px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-gray-600 transition hover:border-brand-gold hover:text-gray-900"
                            >
                                {filter.label}
                            </a>
                        ))}
                    </div>
                }
            />

            {searchParams?.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchParams.error}
                </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card title="Novo pedido · Pronta entrega" description="Fluxo rápido para venda de joia pronta, sem depender do catálogo completo ainda.">
                            <form action={createReadyOrderAction} className="grid gap-3">
                                <select
                                    name="customer_id"
                                    required
                                    className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                >
                                    <option value="">Selecionar cliente</option>
                                    {customersResponse.data.map((customer) => (
                                        <option key={customer.id} value={customer.id}>
                                            {customer.name}
                                        </option>
                                    ))}
                                </select>
                                <Input name="item_description" placeholder="Descrição do item" required />
                                <div className="grid gap-3 md:grid-cols-3">
                                    <Input name="quantity" type="number" min={1} defaultValue={1} required />
                                    <Input name="unit_price_cents" type="number" min={1} placeholder="Preço em centavos" required />
                                    <Input name="discount_cents" type="number" min={0} defaultValue={0} />
                                </div>
                                <select
                                    name="delivery_type"
                                    defaultValue="RETIRADA"
                                    className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                >
                                    <option value="RETIRADA">Retirada</option>
                                    <option value="ENTREGA">Entrega</option>
                                </select>
                                <textarea
                                    name="notes"
                                    rows={3}
                                    placeholder="Observações do pedido"
                                    className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                                />
                                <Button type="submit" className="justify-center">Criar pedido PE</Button>
                            </form>
                        </Card>

                        <Card title="Novo pedido · Personalizado" description="Captura comercial da peça sob medida, já pronta para aprovação e produção.">
                            <form action={createCustomOrderAction} className="grid gap-3">
                                <select
                                    name="customer_id"
                                    required
                                    className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                >
                                    <option value="">Selecionar cliente</option>
                                    {customersResponse.data.map((customer) => (
                                        <option key={customer.id} value={customer.id}>
                                            {customer.name}
                                        </option>
                                    ))}
                                </select>
                                <Input name="item_description" placeholder="Resumo comercial da peça" required />
                                <div className="grid gap-3 md:grid-cols-3">
                                    <Input name="quantity" type="number" min={1} defaultValue={1} required />
                                    <Input name="unit_price_cents" type="number" min={1} placeholder="Valor estimado (centavos)" required />
                                    <Input name="discount_cents" type="number" min={0} defaultValue={0} />
                                </div>
                                <Input name="metal_type" placeholder="Metal (ex: Ouro 18k)" required />
                                <textarea
                                    name="design_description"
                                    rows={3}
                                    required
                                    placeholder="Descreva a peça, medidas, referências e acabamentos"
                                    className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                                />
                                <Input name="production_deadline" type="datetime-local" />
                                <Button type="submit" className="justify-center">Criar personalizado</Button>
                            </form>
                        </Card>
                    </div>

                    <Card title="Pipeline de pedidos" description="Visão operacional da fila com status, tipo e próximos passos.">
                        <form method="get" className="mb-4 grid gap-3 md:grid-cols-3">
                            <select
                                name="status"
                                defaultValue={searchParams?.status ?? ''}
                                className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                            >
                                <option value="">Todos os status</option>
                                {orderStatuses.map((status) => (
                                    <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                                ))}
                            </select>
                            <select
                                name="type"
                                defaultValue={searchParams?.type ?? ''}
                                className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                            >
                                <option value="">Todos os tipos</option>
                                <option value="PRONTA_ENTREGA">Pronta entrega</option>
                                <option value="PERSONALIZADO">Personalizado</option>
                            </select>
                            <Button type="submit" variant="secondary" className="justify-center">Filtrar</Button>
                        </form>

                        <div className="space-y-3">
                            {ordersResponse.data.length === 0 ? (
                                <p className="text-sm text-gray-500">Nenhum pedido encontrado.</p>
                            ) : (
                                ordersResponse.data.map((order) => (
                                    <a
                                        key={order.id}
                                        href={`/pedidos?selected=${order.id}`}
                                        className="block rounded-xl border border-canvas-border bg-white px-4 py-4 transition hover:border-brand-gold-light hover:shadow-card-hover"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
                                                <p className="mt-1 text-sm text-gray-600">{order.customer.name}</p>
                                            </div>
                                            <StatusBadge status={order.status} />
                                        </div>
                                        <div className="mt-3 grid gap-2 text-xs uppercase tracking-[0.16em] text-gray-500 md:grid-cols-4">
                                            <span>{order.type === 'PRONTA_ENTREGA' ? 'Pronta entrega' : 'Personalizado'}</span>
                                            <span>{formatCurrencyFromCents(order.final_amount_cents)}</span>
                                            <span>{order.assigned_to.name}</span>
                                            <span>{formatDate(order.created_at)}</span>
                                        </div>
                                    </a>
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                <div className="xl:sticky xl:top-20 xl:self-start">
                    {selectedOrder ? (
                        <Card
                            title={selectedOrder.order_number}
                            description={`${selectedOrder.customer.name} · ${selectedOrder.type === 'PRONTA_ENTREGA' ? 'Pronta entrega' : 'Personalizado'}`}
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <StatusBadge status={selectedOrder.status} />
                                    <span className="text-xs uppercase tracking-[0.16em] text-gray-500">
                                        {formatCurrencyFromCents(selectedOrder.final_amount_cents)}
                                    </span>
                                </div>

                                <div className="grid gap-3 text-sm text-gray-700">
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Responsável</p>
                                        <p className="mt-1">{selectedOrder.assigned_to.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Entrega</p>
                                        <p className="mt-1">{selectedOrder.delivery_type}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Observações</p>
                                        <p className="mt-1">{selectedOrder.notes ?? 'Sem observações.'}</p>
                                    </div>
                                </div>

                                {selectedOrder.custom_details ? (
                                    <div className="rounded-lg border border-canvas-border bg-white px-4 py-3">
                                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Detalhes do personalizado</p>
                                        <p className="mt-2 text-sm text-gray-800">{selectedOrder.custom_details.design_description}</p>
                                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-500">{selectedOrder.custom_details.metal_type}</p>
                                    </div>
                                ) : null}

                                <div className="rounded-lg border border-canvas-border bg-white px-4 py-3">
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Itens</p>
                                    <div className="mt-3 space-y-2">
                                        {selectedOrder.order_items?.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between gap-3 text-sm text-gray-800">
                                                <span>{item.quantity}x {item.description}</span>
                                                <span>{formatCurrencyFromCents(item.total_price_cents)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <form action={updateOrderStatusAction} className="space-y-3">
                                    <input type="hidden" name="order_id" value={selectedOrder.id} />
                                    <select
                                        name="status"
                                        defaultValue={selectedOrder.status}
                                        className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                    >
                                        {orderStatuses.map((status) => (
                                            <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                                        ))}
                                    </select>
                                    <Button type="submit" variant="secondary" className="w-full justify-center">
                                        Atualizar status
                                    </Button>
                                </form>
                            </div>
                        </Card>
                    ) : (
                        <EmptyState
                            title="Nenhum pedido selecionado"
                            description="Selecione um pedido na lista para visualizar itens, dados do cliente e avançar o status."
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
