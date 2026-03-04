import type { Metadata } from 'next';
import { CatalogPreview } from '@/components/landing/CatalogPreview';
import { fetchPublicCatalog, fetchPublicSettings } from '@/lib/api';

export const metadata: Metadata = {
    title: 'Catalogo Publico | ORION CRM',
    description: 'Vitrine publica de produtos ativos conectada ao backoffice ORION.',
};

export default async function PublicCatalogPage({
    searchParams,
}: {
    searchParams?: {
        q?: string;
        category?: string;
    };
}) {
    const [settings, catalog] = await Promise.all([
        fetchPublicSettings(),
        fetchPublicCatalog({
            q: searchParams?.q,
            category: searchParams?.category,
            limit: 36,
        }),
    ]);

    const categories = Array.from(
        new Set(catalog.data.map((product) => product.category).filter((value): value is string => Boolean(value)))
    );

    return (
        <main className="min-h-screen bg-[#f6f1e7]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 lg:px-6 lg:py-8">
                <header className="rounded-[28px] border border-canvas-border bg-white p-6 shadow-card lg:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dark">{settings.company_name}</p>
                            <h1 className="mt-3 font-serif text-4xl text-gray-900">Catalogo publico</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">
                                Esta vitrine publica reflete os produtos ativos do CRM. A disponibilidade comercial e o atendimento continuam centralizados no mesmo stack.
                            </p>
                        </div>
                        <a href="/" className="rounded-full border border-canvas-border px-4 py-2 text-sm font-semibold text-gray-700">
                            Voltar para a landing
                        </a>
                    </div>

                    <form className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                        <input
                            name="q"
                            defaultValue={searchParams?.q ?? ''}
                            placeholder="Buscar por nome ou codigo"
                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                        />
                        <select
                            name="category"
                            defaultValue={searchParams?.category ?? ''}
                            className="rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                        >
                            <option value="">Todas as categorias</option>
                            {categories.map((category) => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-white"
                        >
                            Filtrar
                        </button>
                    </form>
                </header>

                <CatalogPreview products={catalog.data} />
            </div>
        </main>
    );
}
