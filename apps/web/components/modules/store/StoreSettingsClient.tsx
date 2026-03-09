'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLink, Package, Plus, RefreshCw, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import type { ProductRecord } from '@/lib/api';
import type {
    StoreAdminCategory,
    StoreAdminConfig,
    StoreAdminOrder,
    StoreAdminProduct,
} from '@/lib/store-types';
import { formatCurrencyFromCents } from '@/lib/utils';

async function requestInternal<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/internal/${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
    });

    const payload = await response.text();
    const data = payload ? JSON.parse(payload) as Record<string, unknown> : {};

    if (!response.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Falha ao processar a solicitação.');
    }

    return data as T;
}

function StoreOrderStatusBadge({ status }: { status: StoreAdminOrder['status'] }) {
    const className = status === 'approved'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : status === 'pending'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : status === 'cancelled'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-slate-200 bg-slate-100 text-slate-700';

    return (
        <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-[0.14em] ${className}`}>
            {status}
        </span>
    );
}

function toNumberOrNull(value: string): number | null {
    if (!value.trim()) {
        return null;
    }

    const normalized = Number(value);
    return Number.isFinite(normalized) ? Math.round(normalized) : null;
}

export function StoreSettingsClient({
    initialConfig,
    initialCategories,
    initialProducts,
    initialOrders,
    stockProducts,
    simulationEnabled,
}: {
    initialConfig: StoreAdminConfig;
    initialCategories: StoreAdminCategory[];
    initialProducts: StoreAdminProduct[];
    initialOrders: StoreAdminOrder[];
    stockProducts: ProductRecord[];
    simulationEnabled: boolean;
}) {
    const [isPending, startTransition] = useTransition();
    const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
    const [config, setConfig] = useState(initialConfig);
    const [categories, setCategories] = useState(initialCategories);
    const [products, setProducts] = useState(initialProducts);
    const [orders, setOrders] = useState(initialOrders);
    const [categoryForm, setCategoryForm] = useState({
        name: '',
        slug: '',
        description: '',
        image_url: '',
    });
    const [productForm, setProductForm] = useState({
        stock_product_id: '',
        category_id: '',
        name: '',
        slug: '',
        description: '',
        price_cents: '',
        price_from_cents: '',
        badge: '',
        is_custom: false,
        is_published: false,
        is_featured: false,
    });

    function showError(error: unknown) {
        setNotice({
            tone: 'error',
            message: error instanceof Error ? error.message : 'Falha ao atualizar a loja.',
        });
    }

    function showSuccess(message: string) {
        setNotice({ tone: 'success', message });
    }

    function updateConfigField<Key extends keyof StoreAdminConfig>(key: Key, value: StoreAdminConfig[Key]) {
        setConfig((current) => ({
            ...current,
            [key]: value,
        }));
    }

    function saveConfig() {
        startTransition(async () => {
            try {
                const payload = await requestInternal<StoreAdminConfig>('settings/store', {
                    method: 'PATCH',
                    body: JSON.stringify({
                        is_active: config.is_active,
                        theme: config.theme,
                        accent_color: config.accent_color,
                        logo_url: config.logo_url,
                        store_name: config.store_name,
                        slogan: config.slogan,
                        custom_domain: config.custom_domain,
                        hero_image_url: config.hero_image_url,
                        hero_title: config.hero_title,
                        hero_subtitle: config.hero_subtitle,
                        hero_cta_label: config.hero_cta_label,
                        wa_number: config.wa_number,
                        wa_message_tpl: config.wa_message_tpl,
                        checkout_success_url: config.checkout_success_url,
                        checkout_failure_url: config.checkout_failure_url,
                        seo_title: config.seo_title,
                        seo_description: config.seo_description,
                    }),
                });

                setConfig(payload);
                showSuccess('Configuração da loja salva.');
            } catch (error) {
                showError(error);
            }
        });
    }

    function createCategory() {
        startTransition(async () => {
            try {
                const payload = await requestInternal<StoreAdminCategory>('settings/store/categories', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: categoryForm.name,
                        slug: categoryForm.slug || undefined,
                        description: categoryForm.description || undefined,
                        image_url: categoryForm.image_url || undefined,
                    }),
                });

                setCategories((current) => [...current, payload].sort((left, right) => left.position - right.position));
                setCategoryForm({ name: '', slug: '', description: '', image_url: '' });
                showSuccess('Categoria criada na loja.');
            } catch (error) {
                showError(error);
            }
        });
    }

    function toggleCategory(category: StoreAdminCategory) {
        startTransition(async () => {
            try {
                const payload = await requestInternal<StoreAdminCategory>(`settings/store/categories/${category.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        is_active: !category.is_active,
                    }),
                });

                setCategories((current) => current.map((item) => item.id === payload.id ? payload : item));
                showSuccess(`Categoria ${payload.is_active ? 'ativada' : 'desativada'}.`);
            } catch (error) {
                showError(error);
            }
        });
    }

    function deleteCategory(categoryId: string) {
        startTransition(async () => {
            try {
                await requestInternal(`settings/store/categories/${categoryId}`, {
                    method: 'DELETE',
                });
                setCategories((current) => current.filter((category) => category.id !== categoryId));
                showSuccess('Categoria removida.');
            } catch (error) {
                showError(error);
            }
        });
    }

    function createProduct() {
        startTransition(async () => {
            try {
                const payload = await requestInternal<StoreAdminProduct>('settings/store/products', {
                    method: 'POST',
                    body: JSON.stringify({
                        stock_product_id: productForm.stock_product_id || null,
                        category_id: productForm.category_id || null,
                        name: productForm.name,
                        slug: productForm.slug || undefined,
                        description: productForm.description || undefined,
                        price_cents: toNumberOrNull(productForm.price_cents),
                        price_from_cents: toNumberOrNull(productForm.price_from_cents),
                        badge: productForm.badge || null,
                        is_custom: productForm.is_custom,
                        is_published: productForm.is_published,
                        is_featured: productForm.is_featured,
                    }),
                });

                setProducts((current) => [payload, ...current]);
                setProductForm({
                    stock_product_id: '',
                    category_id: '',
                    name: '',
                    slug: '',
                    description: '',
                    price_cents: '',
                    price_from_cents: '',
                    badge: '',
                    is_custom: false,
                    is_published: false,
                    is_featured: false,
                });
                showSuccess('Produto da loja criado.');
            } catch (error) {
                showError(error);
            }
        });
    }

    function patchProduct(productId: string, data: Record<string, unknown>, message: string) {
        startTransition(async () => {
            try {
                const payload = await requestInternal<StoreAdminProduct>(`settings/store/products/${productId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data),
                });

                setProducts((current) => current.map((item) => item.id === payload.id ? payload : item));
                showSuccess(message);
            } catch (error) {
                showError(error);
            }
        });
    }

    function deleteProduct(productId: string) {
        startTransition(async () => {
            try {
                await requestInternal(`settings/store/products/${productId}`, {
                    method: 'DELETE',
                });

                setProducts((current) => current.filter((product) => product.id !== productId));
                showSuccess('Produto removido da loja.');
            } catch (error) {
                showError(error);
            }
        });
    }

    function simulateApprovedOrder(productId: string) {
        startTransition(async () => {
            try {
                const payload = await requestInternal<StoreAdminOrder>(`settings/store/products/${productId}/simulate-approved-order`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                });

                setOrders((current) => [payload, ...current]);
                showSuccess('Venda simulada criada e sincronizada com pedido interno.');
            } catch (error) {
                showError(error);
            }
        });
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Loja"
                description="Backoffice da vitrine pública do ORION. Aqui você ativa a loja, organiza categorias, publica produtos e acompanha pedidos."
                actions={(
                    <>
                        <Link href="/loja" className="inline-flex items-center gap-2 rounded-md border border-canvas-border bg-white px-4 py-2 text-sm font-medium text-gray-700">
                            <ExternalLink className="h-4 w-4" />
                            Abrir loja pública
                        </Link>
                        <Button type="button" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => window.location.reload()}>
                            Recarregar
                        </Button>
                    </>
                )}
            />

            {notice ? (
                <div className={`rounded-md border px-4 py-3 text-sm ${
                    notice.tone === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}>
                    {notice.message}
                </div>
            ) : null}

            <Tabs defaultValue="config">
                <TabsList>
                    <TabsTrigger value="config">Configuração</TabsTrigger>
                    <TabsTrigger value="categories">Categorias</TabsTrigger>
                    <TabsTrigger value="products">Produtos</TabsTrigger>
                    <TabsTrigger value="orders">Pedidos</TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <Card title="Configuração pública" description="Ativação da loja, hero, identidade visual e URLs de retorno do checkout.">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm text-gray-700">
                                <span>Nome da loja</span>
                                <Input value={config.store_name ?? ''} onChange={(event) => updateConfigField('store_name', event.target.value)} />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700">
                                <span>Domínio customizado</span>
                                <Input value={config.custom_domain ?? ''} onChange={(event) => updateConfigField('custom_domain', event.target.value)} />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700">
                                <span>Logo URL</span>
                                <Input value={config.logo_url ?? ''} onChange={(event) => updateConfigField('logo_url', event.target.value)} />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700">
                                <span>Hero image URL</span>
                                <Input value={config.hero_image_url ?? ''} onChange={(event) => updateConfigField('hero_image_url', event.target.value)} />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700">
                                <span>Título hero</span>
                                <Input value={config.hero_title ?? ''} onChange={(event) => updateConfigField('hero_title', event.target.value)} />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700">
                                <span>CTA hero</span>
                                <Input value={config.hero_cta_label} onChange={(event) => updateConfigField('hero_cta_label', event.target.value)} />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700">
                                <span>WhatsApp da loja</span>
                                <Input value={config.wa_number ?? ''} onChange={(event) => updateConfigField('wa_number', event.target.value)} />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700">
                                <span>Accent color</span>
                                <Input value={config.accent_color} onChange={(event) => updateConfigField('accent_color', event.target.value)} />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                                <span>Slogan</span>
                                <textarea
                                    value={config.slogan ?? ''}
                                    onChange={(event) => updateConfigField('slogan', event.target.value)}
                                    className="min-h-[88px] w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                                />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                                <span>Subtítulo hero</span>
                                <textarea
                                    value={config.hero_subtitle ?? ''}
                                    onChange={(event) => updateConfigField('hero_subtitle', event.target.value)}
                                    className="min-h-[88px] w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                                />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700">
                                <span>URL sucesso checkout</span>
                                <Input value={config.checkout_success_url ?? ''} onChange={(event) => updateConfigField('checkout_success_url', event.target.value)} />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700">
                                <span>URL falha checkout</span>
                                <Input value={config.checkout_failure_url ?? ''} onChange={(event) => updateConfigField('checkout_failure_url', event.target.value)} />
                            </label>
                            <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                                <span>SEO description</span>
                                <textarea
                                    value={config.seo_description ?? ''}
                                    onChange={(event) => updateConfigField('seo_description', event.target.value)}
                                    className="min-h-[88px] w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                                />
                            </label>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-3">
                                <Switch checked={config.is_active} onCheckedChange={(checked) => updateConfigField('is_active', checked)} />
                                <span className="text-sm font-medium text-gray-700">Loja ativa</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-700">Tema</span>
                                <select
                                    value={config.theme}
                                    onChange={(event) => updateConfigField('theme', event.target.value as StoreAdminConfig['theme'])}
                                    className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900"
                                >
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                </select>
                            </div>
                            <Button type="button" disabled={isPending} onClick={saveConfig}>
                                Salvar configuração
                            </Button>
                        </div>
                    </Card>

                    <Card title="Resumo de ativação" description="Checklist mínimo para subir a vitrine hoje.">
                        <div className="space-y-4 text-sm text-gray-600">
                            <div className="rounded-xl border border-canvas-border bg-[#FBFBFD] p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Status</p>
                                <p className="mt-2 text-xl font-semibold text-gray-900">
                                    {config.is_active ? 'Loja ativa' : 'Loja em preparação'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-canvas-border bg-[#FBFBFD] p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Categorias</p>
                                <p className="mt-2 text-xl font-semibold text-gray-900">{categories.length}</p>
                            </div>
                            <div className="rounded-xl border border-canvas-border bg-[#FBFBFD] p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Produtos publicados</p>
                                <p className="mt-2 text-xl font-semibold text-gray-900">
                                    {products.filter((product) => product.is_published).length}
                                </p>
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="categories" className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <Card title="Nova categoria" description="Base de navegação e curadoria da vitrine.">
                        <div className="grid gap-3">
                            <Input placeholder="Nome" value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} />
                            <Input placeholder="Slug (opcional)" value={categoryForm.slug} onChange={(event) => setCategoryForm((current) => ({ ...current, slug: event.target.value }))} />
                            <Input placeholder="Imagem URL" value={categoryForm.image_url} onChange={(event) => setCategoryForm((current) => ({ ...current, image_url: event.target.value }))} />
                            <textarea
                                placeholder="Descrição"
                                value={categoryForm.description}
                                onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                                className="min-h-[120px] w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                            />
                            <Button type="button" icon={<Plus className="h-4 w-4" />} disabled={isPending} onClick={createCategory}>
                                Criar categoria
                            </Button>
                        </div>
                    </Card>

                    <Card title="Categorias ativas e arquivo" description="Ative, pause ou remova categorias já publicadas.">
                        {categories.length === 0 ? (
                            <EmptyState title="Sem categorias" description="Crie a primeira categoria da loja para organizar o catálogo." />
                        ) : (
                            <div className="space-y-3">
                                {categories.map((category) => (
                                    <article key={category.id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-canvas-border bg-white p-4">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{category.name}</p>
                                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">{category.slug}</p>
                                            {category.description ? (
                                                <p className="mt-2 max-w-2xl text-sm text-gray-600">{category.description}</p>
                                            ) : null}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs uppercase tracking-[0.16em] text-gray-400">Ativa</span>
                                                <Switch checked={category.is_active} onCheckedChange={() => toggleCategory(category)} />
                                            </div>
                                            <Button type="button" variant="ghost" icon={<Trash2 className="h-4 w-4" />} disabled={isPending} onClick={() => deleteCategory(category.id)}>
                                                Remover
                                            </Button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                <TabsContent value="products" className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                    <Card title="Novo produto da loja" description="Publique uma peça do estoque ou um item exclusivo da vitrine.">
                        <div className="grid gap-3">
                            <select
                                value={productForm.stock_product_id}
                                onChange={(event) => {
                                    const stockProduct = stockProducts.find((item) => item.id === event.target.value);
                                    setProductForm((current) => ({
                                        ...current,
                                        stock_product_id: event.target.value,
                                        name: current.name || stockProduct?.name || '',
                                        price_cents: current.price_cents || (stockProduct ? String(stockProduct.price_cents) : ''),
                                    }));
                                }}
                                className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900"
                            >
                                <option value="">Produto de estoque (opcional)</option>
                                {stockProducts.map((product) => (
                                    <option key={product.id} value={product.id}>
                                        {product.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={productForm.category_id}
                                onChange={(event) => setProductForm((current) => ({ ...current, category_id: event.target.value }))}
                                className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900"
                            >
                                <option value="">Categoria</option>
                                {categories.filter((category) => category.is_active).map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            <Input placeholder="Nome do produto" value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} />
                            <Input placeholder="Slug (opcional)" value={productForm.slug} onChange={(event) => setProductForm((current) => ({ ...current, slug: event.target.value }))} />
                            <textarea
                                placeholder="Descrição comercial"
                                value={productForm.description}
                                onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                                className="min-h-[120px] w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Input placeholder="Preço em centavos" value={productForm.price_cents} onChange={(event) => setProductForm((current) => ({ ...current, price_cents: event.target.value }))} />
                                <Input placeholder="Preço base (opcional)" value={productForm.price_from_cents} onChange={(event) => setProductForm((current) => ({ ...current, price_from_cents: event.target.value }))} />
                            </div>
                            <select
                                value={productForm.badge}
                                onChange={(event) => setProductForm((current) => ({ ...current, badge: event.target.value }))}
                                className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900"
                            >
                                <option value="">Badge</option>
                                <option value="novo">Novo</option>
                                <option value="sale">Sale</option>
                                <option value="hot">Hot</option>
                            </select>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                                <label className="flex items-center gap-2">
                                    <Switch checked={productForm.is_custom} onCheckedChange={(checked) => setProductForm((current) => ({ ...current, is_custom: checked }))} />
                                    Personalizado
                                </label>
                                <label className="flex items-center gap-2">
                                    <Switch checked={productForm.is_published} onCheckedChange={(checked) => setProductForm((current) => ({ ...current, is_published: checked }))} />
                                    Publicado
                                </label>
                                <label className="flex items-center gap-2">
                                    <Switch checked={productForm.is_featured} onCheckedChange={(checked) => setProductForm((current) => ({ ...current, is_featured: checked }))} />
                                    Destaque
                                </label>
                            </div>
                            <Button type="button" icon={<Plus className="h-4 w-4" />} disabled={isPending} onClick={createProduct}>
                                Criar produto
                            </Button>
                        </div>
                    </Card>

                    <Card title="Produtos publicados" description="Controle rápido de publicação, destaque e limpeza do catálogo.">
                        {products.length === 0 ? (
                            <EmptyState title="Sem produtos na loja" description="Crie o primeiro produto para abrir a vitrine pública." />
                        ) : (
                            <div className="space-y-3">
                                {products.map((product) => (
                                    <article key={product.id} className="rounded-xl border border-canvas-border bg-white p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                                                    {product.badge ? (
                                                        <span className="rounded-full bg-[#F6EFE2] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8B6B3F]">
                                                            {product.badge}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <p className="text-xs uppercase tracking-[0.16em] text-gray-400">{product.slug}</p>
                                                <p className="text-sm text-gray-600">
                                                    {product.category?.name ?? 'Sem categoria'}
                                                    {product.stock_product_name ? ` · estoque: ${product.stock_product_name}` : ''}
                                                </p>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {product.price_cents ? formatCurrencyFromCents(product.price_cents) : 'Sob consulta'}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {simulationEnabled ? (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        icon={<RefreshCw className="h-4 w-4" />}
                                                        disabled={isPending}
                                                        onClick={() => simulateApprovedOrder(product.id)}
                                                    >
                                                        Simular venda
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    icon={<Store className="h-4 w-4" />}
                                                    disabled={isPending}
                                                    onClick={() => patchProduct(product.id, { is_published: !product.is_published }, `Produto ${!product.is_published ? 'publicado' : 'retirado da vitrine'}.`)}
                                                >
                                                    {product.is_published ? 'Despublicar' : 'Publicar'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    icon={<Package className="h-4 w-4" />}
                                                    disabled={isPending}
                                                    onClick={() => patchProduct(product.id, { is_featured: !product.is_featured }, `Produto ${!product.is_featured ? 'marcado' : 'retirado'} como destaque.`)}
                                                >
                                                    {product.is_featured ? 'Remover destaque' : 'Destacar'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    icon={<Trash2 className="h-4 w-4" />}
                                                    disabled={isPending}
                                                    onClick={() => deleteProduct(product.id)}
                                                >
                                                    Excluir
                                                </Button>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                <TabsContent value="orders">
                    <Card title="Pedidos da loja" description="Leitura operacional do checkout público já conectado ao Mercado Pago.">
                        {orders.length === 0 ? (
                            <EmptyState title="Sem pedidos da loja" description="Assim que um checkout for iniciado na vitrine, os pedidos aparecerão aqui." />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-canvas-border text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-[0.18em] text-gray-500">
                                            <th className="px-3 py-3 font-medium">Produto</th>
                                            <th className="px-3 py-3 font-medium">Cliente</th>
                                            <th className="px-3 py-3 font-medium">Valor</th>
                                            <th className="px-3 py-3 font-medium">Status</th>
                                            <th className="px-3 py-3 font-medium">Criado em</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-canvas-border">
                                        {orders.map((order) => (
                                            <tr key={order.id}>
                                                <td className="px-3 py-3">
                                                    <div className="font-medium text-gray-900">{order.product_name}</div>
                                                    <div className="text-xs text-gray-500">{order.id.slice(0, 8).toUpperCase()}</div>
                                                    {order.crm_order_id ? (
                                                        <div className="text-xs text-emerald-700">
                                                            CRM {order.crm_order_id.slice(0, 8).toUpperCase()}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className="px-3 py-3 text-gray-600">
                                                    {order.customer_name ?? 'Sem nome'}
                                                    <div className="text-xs text-gray-500">{order.customer_email ?? order.customer_phone ?? 'Sem contato'}</div>
                                                    {order.crm_payment_id ? (
                                                        <div className="text-xs text-emerald-700">
                                                            Pgto {order.crm_payment_id.slice(0, 8).toUpperCase()}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className="px-3 py-3 text-gray-900">{formatCurrencyFromCents(order.amount_cents)}</td>
                                                <td className="px-3 py-3"><StoreOrderStatusBadge status={order.status} /></td>
                                                <td className="px-3 py-3 text-gray-600">
                                                    {new Intl.DateTimeFormat('pt-BR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    }).format(new Date(order.created_at))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
