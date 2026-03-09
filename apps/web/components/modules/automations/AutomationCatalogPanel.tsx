import type { AutomationCatalogGroup } from '@/lib/api';

export function AutomationCatalogPanel({ groups }: { groups: AutomationCatalogGroup[] }) {
    return (
        <div className="grid gap-4 lg:grid-cols-3">
            {groups.map((group) => (
                <section key={group.key} className="rounded-xl border border-canvas-border bg-white p-4">
                    <header className="mb-3">
                        <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
                        <p className="mt-1 text-xs text-gray-500">{group.description}</p>
                    </header>
                    <div className="space-y-3">
                        {group.items.map((item) => (
                            <article key={item.key} className="rounded-lg border border-canvas-border bg-canvas-card px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">{item.label}</h4>
                                        <p className="mt-1 text-xs text-gray-500">{item.description}</p>
                                    </div>
                                    <span className="rounded-full border border-canvas-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">
                                        {item.group}
                                    </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {item.parameters.map((parameter) => (
                                        <span
                                            key={parameter}
                                            className="rounded-full bg-brand-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-brand-gold-dark"
                                        >
                                            {parameter}
                                        </span>
                                    ))}
                                </div>
                                <p className="mt-2 font-mono text-[11px] text-gray-500">{item.n8n_type}</p>
                            </article>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
