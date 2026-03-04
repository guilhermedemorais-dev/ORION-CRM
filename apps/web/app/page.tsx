import type { Metadata } from 'next';
import { CatalogPreview } from '@/components/landing/CatalogPreview';
import { LandingHero } from '@/components/landing/LandingHero';
import { LeadCapturePanel } from '@/components/landing/LeadCapturePanel';
import { fetchPublicCatalog, fetchPublicSettings } from '@/lib/api';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = {
    title: 'ORION CRM | Landing',
    description: 'Landing publica com catalogo e captacao conectada ao ORION CRM.',
};

export default async function LandingPage({
    searchParams,
}: {
    searchParams?: {
        lead_status?: string;
        message?: string;
        fallback?: string;
    };
}) {
    const [settings, catalog] = await Promise.all([
        fetchPublicSettings(),
        fetchPublicCatalog({ limit: 6 }),
    ]);
    const session = getSession();

    return (
        <main className="min-h-screen bg-[#f6f1e7]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 lg:px-6 lg:py-8">
                <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-canvas-border bg-white/90 px-5 py-3 shadow-card backdrop-blur">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dark">ORION</p>
                        <p className="text-sm font-medium text-gray-900">{settings.company_name}</p>
                    </div>
                    <nav className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        <a href="/catalogo" className="transition hover:text-gray-900">Catalogo</a>
                        <a href="#captacao" className="transition hover:text-gray-900">Atendimento</a>
                        <a
                            href={session ? '/dashboard' : '/login'}
                            className="rounded-full bg-stone-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white"
                        >
                            {session ? 'Ir para o painel' : 'Login do CRM'}
                        </a>
                    </nav>
                </header>

                <LandingHero
                    companyName={settings.company_name}
                    ctaHref={session ? '/dashboard' : '/login'}
                    ctaLabel={session ? 'Abrir painel' : 'Entrar no CRM'}
                />

                <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="space-y-6">
                        <div className="rounded-[28px] border border-canvas-border bg-white p-6 shadow-card lg:p-8">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dark">Direcao visual</p>
                            <h2 className="mt-4 font-serif text-3xl text-gray-900 lg:text-4xl">
                                Luxury minimal com operacao rastreavel.
                            </h2>
                            <div className="mt-6 grid gap-4 md:grid-cols-3">
                                <div className="rounded-2xl bg-[#f8f7f5] p-4">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Captacao</p>
                                    <p className="mt-2 text-sm leading-7 text-gray-700">Lead da landing entra no CRM e pode acionar automacao interna.</p>
                                </div>
                                <div className="rounded-2xl bg-[#f8f7f5] p-4">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Catalogo</p>
                                    <p className="mt-2 text-sm leading-7 text-gray-700">A vitrine usa os produtos ativos do backoffice e respeita disponibilidade.</p>
                                </div>
                                <div className="rounded-2xl bg-[#f8f7f5] p-4">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Operacao</p>
                                    <p className="mt-2 text-sm leading-7 text-gray-700">Tudo converge para o mesmo fluxo de vendas, atendimento e producao.</p>
                                </div>
                            </div>
                        </div>

                        <section>
                            <div className="mb-4 flex items-end justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dark">Vitrine</p>
                                    <h2 className="mt-2 font-serif text-3xl text-gray-900">Catalogo publico em tempo real</h2>
                                </div>
                                <a href="/catalogo" className="text-sm font-semibold text-gray-700 underline underline-offset-4">
                                    Ver tudo
                                </a>
                            </div>
                            <CatalogPreview products={catalog.data} compact />
                        </section>
                    </div>

                    <div id="captacao" className="lg:sticky lg:top-6 lg:self-start">
                        <LeadCapturePanel
                            status={searchParams?.lead_status}
                            message={searchParams?.message}
                            fallbackUrl={searchParams?.fallback}
                        />
                    </div>
                </section>
            </div>
        </main>
    );
}
