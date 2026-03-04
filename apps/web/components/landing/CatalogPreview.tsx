import { Card } from '@/components/ui/Card';
import type { PublicCatalogProduct } from '@/lib/api';
import { formatCurrencyFromCents } from '@/lib/utils';

export function CatalogPreview({
    products,
    compact = false,
}: {
    products: PublicCatalogProduct[];
    compact?: boolean;
}) {
    if (products.length === 0) {
        return (
            <Card title="Catalogo em curadoria" description="A vitrine publica aparece aqui assim que os produtos ativos forem cadastrados.">
                <p className="text-sm text-gray-500">
                    O CRM ja esta pronto para publicar o catalogo; falta apenas alimentar o estoque comercial ativo.
                </p>
            </Card>
        );
    }

    return (
        <div className={compact ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-4'}>
            {products.map((product) => (
                <article
                    key={product.id}
                    className="overflow-hidden rounded-2xl border border-canvas-border bg-white shadow-card"
                >
                    <div className="relative h-40 overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(232,213,176,0.35),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_50%)]" />
                        <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold-light">
                                {product.category ?? 'Colecao ORION'}
                            </p>
                            <p className="mt-2 text-lg font-semibold text-white">{product.name}</p>
                        </div>
                    </div>

                    <div className="space-y-3 px-5 py-5">
                        <p className="line-clamp-3 min-h-[60px] text-sm text-gray-600">
                            {product.description ?? 'Peca pronta para apresentacao comercial e atendimento consultivo.'}
                        </p>

                        <div className="flex items-center justify-between gap-3">
                            <p className="text-base font-semibold text-gray-900">
                                {formatCurrencyFromCents(product.price_cents)}
                            </p>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                product.is_available
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-stone-100 text-stone-500'
                            }`}>
                                {product.is_available ? 'Disponivel' : 'Sob consulta'}
                            </span>
                        </div>
                    </div>
                </article>
            ))}
        </div>
    );
}
