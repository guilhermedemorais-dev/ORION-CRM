export function LandingHero({
    companyName,
    ctaHref,
    ctaLabel,
}: {
    companyName: string;
    ctaHref: string;
    ctaLabel: string;
}) {
    return (
        <section className="relative overflow-hidden rounded-[36px] border border-stone-800 bg-stone-950 px-6 py-10 text-white shadow-2xl lg:px-10 lg:py-14">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,169,122,0.35),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_35%)]" />
            <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-gold-light">Joalheria conectada ao CRM</p>
                    <h1 className="mt-5 max-w-3xl font-serif text-4xl leading-tight lg:text-6xl">
                        {companyName}
                        <span className="block text-brand-gold-light">atendimento, vitrine e operacao no mesmo fluxo.</span>
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-8 text-stone-300 lg:text-lg">
                        Landing publica, captacao direta no CRM, catalogo vivo e operacao integrada entre vendas, producao e atendimento.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                        <a
                            href="/catalogo"
                            className="inline-flex items-center rounded-full bg-brand-gold px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-surface-sidebar transition hover:bg-brand-gold-light"
                        >
                            Ver catalogo
                        </a>
                        <a
                            href={ctaHref}
                            className="inline-flex items-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:border-brand-gold-light hover:text-brand-gold-light"
                        >
                            {ctaLabel}
                        </a>
                    </div>
                </div>

                <div className="grid gap-4 rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400">Fase publica</p>
                        <p className="mt-2 text-3xl font-semibold text-white">Catalogo + Leads</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400">Backoffice</p>
                        <p className="mt-2 text-sm leading-7 text-stone-300">
                            Leads, clientes, inbox, pedidos, producao, estoque, financeiro e PDV ja no mesmo stack.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
