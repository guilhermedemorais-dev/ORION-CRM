import { adjustStockAction, createProductAction, updateProductAction } from '@/app/(crm)/estoque/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import type { ApiListResponse, ProductDetailRecord, ProductRecord } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { formatCurrencyFromCents, formatDate } from '@/lib/utils';

export default async function StockPage({
    searchParams,
}: {
    searchParams?: {
        q?: string;
        category?: string;
        selected?: string;
        error?: string;
    };
}) {
    const query = new URLSearchParams();

    if (searchParams?.q) {
        query.set('q', searchParams.q);
    }

    if (searchParams?.category) {
        query.set('category', searchParams.category);
    }

    query.set('limit', '100');

    const productResponse = await apiRequest<ApiListResponse<ProductRecord>>(`/products?${query.toString()}`);
    const selectedProduct = searchParams?.selected
        ? await apiRequest<ProductDetailRecord>(`/products/${searchParams.selected}`).catch(() => null)
        : null;

    const categories = Array.from(
        new Set(productResponse.data.map((product) => product.category).filter((category): category is string => Boolean(category)))
    ).sort((left, right) => left.localeCompare(right));

    const lowStockProducts = productResponse.data.filter((product) => product.is_low_stock);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Estoque"
                description="Catálogo interno, ajustes auditáveis e alertas de reposição em uma visão operacional."
                actions={
                    <form method="get" className="flex flex-wrap gap-3">
                        <Input
                            className="w-56"
                            name="q"
                            placeholder="Buscar por nome ou código"
                            defaultValue={searchParams?.q ?? ''}
                        />
                        <select
                            name="category"
                            defaultValue={searchParams?.category ?? ''}
                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                        >
                            <option value="">Todas as categorias</option>
                            {categories.map((category) => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                        <Button type="submit" variant="secondary">
                            Filtrar
                        </Button>
                    </form>
                }
            />

            {searchParams?.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchParams.error}
                </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
                <Card title="Produtos ativos" description="Base operacional disponível para pedidos, PDV e reposição.">
                    <p className="font-serif text-3xl font-semibold text-gray-900">{productResponse.meta.total}</p>
                </Card>
                <Card title="Em estoque crítico" description="Itens no limite ou abaixo do estoque mínimo configurado.">
                    <p className="font-serif text-3xl font-semibold text-amber-700">{lowStockProducts.length}</p>
                </Card>
                <Card title="Foco imediato" description="Produtos que exigem ação do estoque.">
                    <p className="text-sm text-gray-600">
                        {lowStockProducts.length > 0
                            ? lowStockProducts
                                .slice(0, 3)
                                .map((product) => product.code)
                                .join(', ')
                            : 'Nenhum item em ruptura nesta consulta.'}
                    </p>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-6">
                    <Card title="Novo produto" description="Cadastro base para catálogo interno e operação do PDV.">
                        <form action={createProductAction} className="grid gap-3 md:grid-cols-2">
                            <Input name="code" placeholder="Código interno" required />
                            <Input name="name" placeholder="Nome do produto" required />
                            <Input name="price_cents" type="number" min="1" step="1" placeholder="Preço em centavos" required />
                            <Input name="stock_quantity" type="number" min="0" step="1" placeholder="Estoque inicial" required />
                            <Input name="minimum_stock" type="number" min="0" step="1" placeholder="Estoque mínimo" required />
                            <Input name="category" placeholder="Categoria" />
                            <Input name="metal" placeholder="Metal" />
                            <Input name="weight_grams" type="number" min="0.01" step="0.01" placeholder="Peso (g)" />
                            <textarea
                                name="description"
                                placeholder="Descrição interna"
                                className="min-h-[100px] rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none md:col-span-2"
                            />
                            <label className="flex items-center gap-2 text-sm text-gray-600 md:col-span-2">
                                <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 rounded border-canvas-border" />
                                Produto ativo
                            </label>
                            <Button className="justify-center md:col-span-2" type="submit">
                                Cadastrar produto
                            </Button>
                        </form>
                    </Card>

                    <Card title="Catálogo interno" description="Clique em um item para abrir o painel lateral de edição e ajustes.">
                        {productResponse.data.length === 0 ? (
                            <p className="text-sm text-gray-500">Nenhum produto encontrado com os filtros atuais.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="text-xs uppercase tracking-[0.18em] text-gray-500">
                                        <tr>
                                            <th className="pb-3 pr-4 font-medium">Código</th>
                                            <th className="pb-3 pr-4 font-medium">Produto</th>
                                            <th className="pb-3 pr-4 font-medium">Preço</th>
                                            <th className="pb-3 pr-4 font-medium">Estoque</th>
                                            <th className="pb-3 font-medium">Situação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-canvas-border">
                                        {productResponse.data.map((product) => (
                                            <tr key={product.id}>
                                                <td className="py-3 pr-4 font-medium text-gray-900">
                                                    <a href={`/estoque?selected=${product.id}`} className="hover:text-brand-gold-dark">
                                                        {product.code}
                                                    </a>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <div className="font-medium text-gray-900">{product.name}</div>
                                                    <div className="text-xs text-gray-500">{product.category ?? 'Sem categoria'}</div>
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">{formatCurrencyFromCents(product.price_cents)}</td>
                                                <td className="py-3 pr-4 text-gray-700">
                                                    {product.stock_quantity} un.
                                                    <div className="text-xs text-gray-500">mín: {product.minimum_stock}</div>
                                                </td>
                                                <td className="py-3">
                                                    {product.is_low_stock ? (
                                                        <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                            Reposição urgente
                                                        </span>
                                                    ) : product.is_active ? (
                                                        <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                            Operacional
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                                                            Inativo
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>

                <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
                    {selectedProduct ? (
                        <>
                            <Card title={selectedProduct.name} description={`Código ${selectedProduct.code}`}>
                                <form action={updateProductAction} className="grid gap-3">
                                    <input type="hidden" name="product_id" value={selectedProduct.id} />
                                    <Input name="code" defaultValue={selectedProduct.code} required />
                                    <Input name="name" defaultValue={selectedProduct.name} required />
                                    <Input
                                        name="price_cents"
                                        type="number"
                                        min="1"
                                        step="1"
                                        defaultValue={selectedProduct.price_cents}
                                        required
                                    />
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Input
                                            name="stock_quantity"
                                            type="number"
                                            min="0"
                                            step="1"
                                            defaultValue={selectedProduct.stock_quantity}
                                            required
                                        />
                                        <Input
                                            name="minimum_stock"
                                            type="number"
                                            min="0"
                                            step="1"
                                            defaultValue={selectedProduct.minimum_stock}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Input name="category" defaultValue={selectedProduct.category ?? ''} />
                                        <Input name="metal" defaultValue={selectedProduct.metal ?? ''} />
                                    </div>
                                    <Input
                                        name="weight_grams"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        defaultValue={selectedProduct.weight_grams ?? ''}
                                    />
                                    <textarea
                                        name="description"
                                        defaultValue={selectedProduct.description ?? ''}
                                        className="min-h-[100px] rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                    />
                                    <label className="flex items-center gap-2 text-sm text-gray-600">
                                        <input
                                            type="checkbox"
                                            name="is_active"
                                            defaultChecked={selectedProduct.is_active}
                                            className="h-4 w-4 rounded border-canvas-border"
                                        />
                                        Produto ativo
                                    </label>
                                    <Button className="justify-center" type="submit">
                                        Salvar alterações
                                    </Button>
                                </form>
                            </Card>

                            <Card title="Ajuste de estoque" description="Toda movimentação gera trilha auditável e histórico do produto.">
                                <form action={adjustStockAction} className="grid gap-3">
                                    <input type="hidden" name="product_id" value={selectedProduct.id} />
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <select
                                            name="type"
                                            defaultValue="ENTRADA"
                                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                        >
                                            <option value="ENTRADA">Entrada</option>
                                            <option value="SAIDA">Saída</option>
                                            <option value="AJUSTE">Ajuste absoluto</option>
                                        </select>
                                        <Input name="quantity" type="number" min="1" step="1" placeholder="Quantidade" required />
                                    </div>
                                    <textarea
                                        name="reason"
                                        placeholder="Motivo do ajuste (mín. 10 caracteres)"
                                        className="min-h-[100px] rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                        required
                                    />
                                    <Button className="justify-center" type="submit" variant="secondary">
                                        Registrar ajuste
                                    </Button>
                                </form>
                            </Card>

                            <Card title="Movimentações recentes" description="Últimas 15 operações vinculadas a este item.">
                                {selectedProduct.recent_stock_movements.length === 0 ? (
                                    <p className="text-sm text-gray-500">Ainda não há movimentos registrados para este produto.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedProduct.recent_stock_movements.map((movement) => (
                                            <article key={movement.id} className="rounded-lg border border-canvas-border bg-white p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-sm font-medium text-gray-900">{movement.type}</span>
                                                    <span className="text-xs text-gray-500">{formatDate(movement.created_at)}</span>
                                                </div>
                                                <p className="mt-1 text-sm text-gray-600">
                                                    {movement.previous_stock} → {movement.new_stock} (qtd. {movement.quantity})
                                                </p>
                                                <p className="mt-2 text-xs text-gray-500">{movement.reason}</p>
                                                <p className="mt-2 text-xs text-gray-500">Por {movement.created_by.name}</p>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </>
                    ) : (
                        <EmptyState
                            title="Nenhum produto selecionado"
                            description="Abra um item da tabela para editar, ajustar estoque e revisar o histórico recente."
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
