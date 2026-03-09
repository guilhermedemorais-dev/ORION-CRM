import Link from 'next/link';
import type { StorePublicProduct } from '@/lib/store-types';
import { formatCurrencyFromCents } from '@/lib/utils';

function badgeLabel(value: StorePublicProduct['badge']): string | null {
    if (value === 'novo') return 'Novo';
    if (value === 'sale') return 'Sale';
    if (value === 'hot') return 'Hot';
    return null;
}

export function StoreProductCard({
    product,
    accentColor,
}: {
    product: StorePublicProduct;
    accentColor: string;
}) {
    const label = badgeLabel(product.badge);

    return (
        <article className="group overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.14)]">
            <Link href={`/loja/produto/${product.slug}`} className="block">
                <div
                    className="relative h-72 overflow-hidden"
                    style={{
                        background: `radial-gradient(circle at top right, ${accentColor}55, transparent 34%), linear-gradient(180deg, #161616, #3B2C20 65%, #6A5137 100%)`,
                    }}
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.14),transparent_40%)]" />
                    {label ? (
                        <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-900">
                            {label}
                        </span>
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">
                            {product.category?.name ?? 'Coleção ORION'}
                        </p>
                        <h2 className="mt-3 font-serif text-3xl">{product.name}</h2>
                    </div>
                </div>
            </Link>

            <div className="space-y-4 p-6">
                <p className="min-h-[72px] text-sm leading-6 text-stone-600">
                    {product.description ?? 'Peça preparada para conversão direta pela loja e atendimento consultivo via ORION.'}
                </p>

                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                            {product.price_from_cents ? 'A partir de' : 'Preço'}
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-stone-950">
                            {product.price_cents ? formatCurrencyFromCents(product.price_cents) : 'Sob consulta'}
                        </p>
                    </div>
                    <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            product.is_available
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-stone-100 text-stone-500'
                        }`}
                    >
                        {product.is_available ? 'Disponível' : product.is_custom ? 'Personalizado' : 'Sob consulta'}
                    </span>
                </div>
            </div>
        </article>
    );
}
