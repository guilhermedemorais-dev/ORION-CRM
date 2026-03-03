import { createPdvSaleAction } from '@/app/(crm)/pdv/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import type { ApiListResponse, CustomerRecord, ProductRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { formatCurrencyFromCents } from '@/lib/utils';

const paymentMethods = [
    { value: 'DINHEIRO', label: 'Dinheiro' },
    { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
    { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
    { value: 'PIX', label: 'PIX' },
    { value: 'LINK_PAGAMENTO', label: 'Link de pagamento' },
] as const;

export default async function PdvPage({
    searchParams,
}: {
    searchParams?: {
        q?: string;
        error?: string;
        receipt_order?: string;
        receipt_payment?: string;
        receipt_total?: string;
    };
}) {
    const session = requireSession();

    if (!['ADMIN', 'ATENDENTE'].includes(session.user.role)) {
        return (
            <EmptyState
                title="Acesso restrito"
                description="O PDV é restrito aos perfis ADMIN e ATENDENTE."
            />
        );
    }

    const productQuery = new URLSearchParams({ limit: '100' });

    if (searchParams?.q) {
        productQuery.set('q', searchParams.q);
    }

    const [productResponse, customerResponse] = await Promise.all([
        apiRequest<ApiListResponse<ProductRecord>>(`/products?${productQuery.toString()}`),
        apiRequest<ApiListResponse<CustomerRecord>>('/customers?limit=100'),
    ]);

    const activeProducts = productResponse.data.filter((product) => product.is_active);
    const topProducts = activeProducts.slice(0, 8);

    return (
        <div className="space-y-6">
            <PageHeader
                title="PDV"
                description="Venda de balcão com baixa imediata de estoque e reflexo financeiro no mesmo fluxo."
                actions={
                    <form method="get" className="flex flex-wrap gap-3">
                        <Input
                            className="w-64"
                            name="q"
                            placeholder="Buscar produto por nome ou código"
                            defaultValue={searchParams?.q ?? ''}
                        />
                        <Button type="submit" variant="secondary">
                            Filtrar catálogo
                        </Button>
                    </form>
                }
            />

            {searchParams?.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchParams.error}
                </div>
            ) : null}

            {searchParams?.receipt_order && searchParams?.receipt_payment && searchParams?.receipt_total ? (
                <Card title="Venda finalizada" description="Recibo operacional da última venda registrada no PDV.">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Pedido</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{searchParams.receipt_order}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Pagamento</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{searchParams.receipt_payment}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Total</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                                {formatCurrencyFromCents(Number(searchParams.receipt_total))}
                            </p>
                        </div>
                    </div>
                </Card>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card title="Fechar venda" description="Monte o carrinho, escolha a forma de pagamento e conclua a venda em uma transação única.">
                    <form action={createPdvSaleAction} className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Cliente</label>
                                <select
                                    name="customer_id"
                                    defaultValue=""
                                    className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                >
                                    <option value="">Cliente Balcão (padrão)</option>
                                    {customerResponse.data.map((customer) => (
                                        <option key={customer.id} value={customer.id}>
                                            {customer.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Forma de pagamento</label>
                                <select
                                    name="payment_method"
                                    defaultValue="PIX"
                                    className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                >
                                    {paymentMethods.map((method) => (
                                        <option key={method.value} value={method.value}>
                                            {method.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-gray-900">Carrinho</h2>
                                <p className="text-xs text-gray-500">Preencha até 5 linhas. Campos vazios são ignorados.</p>
                            </div>
                            {[1, 2, 3, 4, 5].map((line) => (
                                <div key={line} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
                                    <select
                                        name={`product_id_${line}`}
                                        defaultValue=""
                                        className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                    >
                                        <option value="">Selecione um produto</option>
                                        {activeProducts.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {product.code} • {product.name} • {formatCurrencyFromCents(product.price_cents)}
                                            </option>
                                        ))}
                                    </select>
                                    <Input
                                        name={`quantity_${line}`}
                                        type="number"
                                        min="1"
                                        step="1"
                                        defaultValue="1"
                                        placeholder="Qtd."
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Input name="discount_cents" type="number" min="0" step="1" defaultValue="0" placeholder="Desconto em centavos" />
                            <Input name="notes" placeholder="Observações da venda" />
                        </div>

                        <Button className="justify-center" type="submit">
                            Finalizar venda
                        </Button>
                    </form>
                </Card>

                <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
                    <Card title="Catálogo rápido" description="Produtos ativos carregados para atendimento de balcão.">
                        {topProducts.length === 0 ? (
                            <p className="text-sm text-gray-500">Nenhum produto ativo disponível para venda.</p>
                        ) : (
                            <div className="space-y-3">
                                {topProducts.map((product) => (
                                    <article key={product.id} className="rounded-lg border border-canvas-border bg-white p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                                                <p className="mt-1 text-xs text-gray-500">{product.code}</p>
                                            </div>
                                            <span className="text-sm font-semibold text-gray-900">
                                                {formatCurrencyFromCents(product.price_cents)}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                            <span>Estoque: {product.stock_quantity}</span>
                                            <span>Mín.: {product.minimum_stock}</span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card title="Regras operacionais" description="Invariantes que o PDV preserva ao concluir a venda.">
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li>Pedido nasce como pronta entrega e sai como retirado.</li>
                            <li>Baixa de estoque, pagamento e financeiro são gravados no mesmo commit.</li>
                            <li>Falha de rede ou validação aborta a venda sem persistência parcial.</li>
                        </ul>
                    </Card>
                </div>
            </div>
        </div>
    );
}
