import type { Metadata } from 'next';
import Link from 'next/link';
import { StoreProductCard } from '@/components/modules/store/StoreProductCard';
import { EmptyState } from '@/components/ui/EmptyState';
import {
    fetchStorefrontCategories,
    fetchStorefrontConfig,
    fetchStorefrontProducts,
} from '@/lib/api';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = {
    title: 'Loja ORION',
    description: 'Loja pública conectada ao catálogo operacional do ORIN CRM.',
};

export default async function StorePage({
    searchParams,
}: {
    searchParams?: {
        search?: string;
        category?: string;
    };
}) {
    const [config, categoriesPayload, productsPayload] = await Promise.all([
        fetchStorefrontConfig(),
        fetchStorefrontCategories(),
        fetchStorefrontProducts({
            search: searchParams?.search,
            category: searchParams?.category,
            limit: 24,
        }),
    ]);
    const session = getSession();
    const categories = categoriesPayload.data;

    return (
        <main className="min-h-screen bg-[#f4efe7] text-stone-950">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 lg:px-6 lg:py-8">
                <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-black/5 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: config.accent_color }}>
                            ORION STORE
                        </p>
                        <p className="text-sm font-medium text-stone-900">{config.store_name}</p>
                    </div>
                    <nav className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
                        <Link href="/" className="transition hover:text-stone-950">Landing</Link>
                        <Link href="/catalogo" className="transition hover:text-stone-950">Legado catálogo</Link>
                        <a
                            href={session ? '/dashboard' : '/login'}
                            className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white"
                            style={{ backgroundColor: config.accent_color }}
                        >
                            {session ? 'Painel do CRM' : 'Login do CRM'}
                        </a>
                    </nav>
                </header>

                <section
                    className="relative overflow-hidden rounded-[36px] px-6 py-10 text-white shadow-[0_36px_120px_rgba(15,23,42,0.16)] lg:px-10 lg:py-14"
                    style={{
                        background: `radial-gradient(circle at top right, ${config.accent_color}55, transparent 26%), linear-gradient(135deg, #0f0f10, #2c2116 60%, #55402b 100%)`,
                    }}
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_36%)]" />
                    <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/60">Loja pública do ORION</p>
                            <h1 className="mt-5 max-w-4xl font-serif text-4xl leading-tight lg:text-6xl">
                                {config.hero_title}
                            </h1>
                            <p className="mt-5 max-w-3xl text-base leading-8 text-white/80 lg:text-lg">
                                {config.hero_subtitle ?? config.slogan ?? 'Catálogo online, checkout integrado e atendimento comercial no mesmo stack.'}
                            </p>
                        </div>
                        <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Curadoria</p>
                            <p className="mt-2 text-3xl font-semibold text-white">{productsPayload.meta.total}</p>
                            <p className="mt-2 text-sm leading-7 text-white/75">
                                Produtos publicados com conexão direta ao checkout e fallback consultivo via WhatsApp.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm lg:p-8">
                    <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                        <input
                            name="search"
                            defaultValue={searchParams?.search ?? ''}
                            placeholder="Buscar por nome, slug ou coleção"
                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                        />
                        <select
                            name="category"
                            defaultValue={searchParams?.category ?? ''}
                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                        >
                            <option value="">Todas as categorias</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.slug}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            className="rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-white"
                            style={{ backgroundColor: config.accent_color }}
                        >
                            Filtrar
                        </button>
                    </form>
                </section>

                {!config.is_active ? (
                    <EmptyState
                        title="Loja em preparação"
                        description="A configuração pública existe, mas ainda não foi ativada no backoffice."
                    />
                ) : productsPayload.data.length === 0 ? (
                    <EmptyState
                        title="Nenhum produto publicado"
                        description="Assim que os produtos forem publicados em /settings/loja, a vitrine aparece aqui."
                    />
                ) : (
                    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {productsPayload.data.map((product) => (
                            <StoreProductCard key={product.id} product={product} accentColor={config.accent_color} />
                        ))}
                    </section>
                )}
            </div>
        </main>
    );
}
