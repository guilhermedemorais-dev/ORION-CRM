import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StoreCheckoutForm } from '@/components/modules/store/StoreCheckoutForm';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchStorefrontConfig, fetchStorefrontProduct } from '@/lib/api';
import { formatCurrencyFromCents } from '@/lib/utils';

export async function generateMetadata({
    params,
}: {
    params: { slug: string };
}): Promise<Metadata> {
    const product = await fetchStorefrontProduct(params.slug);

    if (!product) {
        return {
            title: 'Produto não encontrado | Loja ORION',
        };
    }

    return {
        title: `${product.seo_title ?? product.name} | Loja ORION`,
        description: product.seo_description ?? product.description ?? 'Produto da loja pública do ORION.',
    };
}

export default async function StoreProductDetailPage({
    params,
    searchParams,
}: {
    params: { slug: string };
    searchParams?: {
        checkout?: string;
        message?: string;
    };
}) {
    const [config, product] = await Promise.all([
        fetchStorefrontConfig(),
        fetchStorefrontProduct(params.slug),
    ]);

    if (!config.is_active || !product) {
        notFound();
    }

    const toneClass = searchParams?.checkout === 'error'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

    return (
        <main className="min-h-screen bg-[#f4efe7] text-stone-950">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 lg:px-6 lg:py-8">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: config.accent_color }}>
                            Loja ORION
                        </p>
                        <h1 className="mt-2 font-serif text-4xl text-stone-950">{product.name}</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <Link href="/loja" className="rounded-full border border-black/10 px-4 py-2 text-stone-700">
                            Voltar para a loja
                        </Link>
                        {product.whatsapp_url ? (
                            <a
                                href={product.whatsapp_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full px-4 py-2 font-semibold text-white"
                                style={{ backgroundColor: config.accent_color }}
                            >
                                Falar no WhatsApp
                            </a>
                        ) : null}
                    </div>
                </header>

                <section className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_420px]">
                    <div className="space-y-6">
                        <div
                            className="relative min-h-[520px] overflow-hidden rounded-[36px] shadow-[0_36px_120px_rgba(15,23,42,0.16)]"
                            style={{
                                background: `radial-gradient(circle at top right, ${config.accent_color}55, transparent 28%), linear-gradient(135deg, #0f0f10, #2d2219 55%, #6b513a 100%)`,
                            }}
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_36%)]" />
                            <div className="absolute inset-x-0 bottom-0 p-8 text-white">
                                <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                                    {product.category?.name ?? 'Coleção ORION'}
                                </p>
                                <p className="mt-3 font-serif text-5xl">{product.name}</p>
                            </div>
                        </div>

                        <Card title="Descrição" description="Narrativa comercial da peça ou do item customizável.">
                            <p className="text-sm leading-7 text-stone-600">
                                {product.description ?? 'Produto conectado à operação comercial e logística do ORION CRM.'}
                            </p>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card title="Resumo comercial" description="Leitura rápida para decisão e checkout.">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                                        {product.price_from_cents ? 'A partir de' : 'Preço'}
                                    </p>
                                    <p className="mt-2 text-4xl font-semibold text-stone-950">
                                        {product.price_cents ? formatCurrencyFromCents(product.price_cents) : 'Sob consulta'}
                                    </p>
                                </div>

                                <div className="grid gap-3 rounded-2xl bg-[#faf6ef] p-4 text-sm text-stone-700">
                                    <div className="flex justify-between gap-4">
                                        <span>Disponibilidade</span>
                                        <span className="font-medium">
                                            {product.is_available ? 'Pronta para checkout' : product.is_custom ? 'Sob projeto' : 'Sob consulta'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span>Categoria</span>
                                        <span className="font-medium">{product.category?.name ?? 'Coleção livre'}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span>Metal</span>
                                        <span className="font-medium">{product.metal ?? 'Não informado'}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span>Peso</span>
                                        <span className="font-medium">
                                            {product.weight_grams ? `${product.weight_grams} g` : 'Não informado'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {searchParams?.message ? (
                            <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
                                {searchParams.message}
                            </div>
                        ) : null}

                        {!product.is_available || product.is_custom || !product.price_cents ? (
                            <EmptyState
                                title="Checkout consultivo"
                                description="Este item segue pelo atendimento humano. Use o WhatsApp para negociar prazo, personalização e disponibilidade."
                                action={product.whatsapp_url ? (
                                    <a
                                        href={product.whatsapp_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                                        style={{ backgroundColor: config.accent_color }}
                                    >
                                        Abrir WhatsApp
                                    </a>
                                ) : null}
                            />
                        ) : (
                            <Card title="Checkout" description="Os dados abaixo geram a preferência do Mercado Pago e redirecionam para o pagamento.">
                                <StoreCheckoutForm productId={product.id} productSlug={product.slug} />
                            </Card>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
