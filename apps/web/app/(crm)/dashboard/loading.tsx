export default function DashboardLoading() {
    return (
        <div className="flex flex-col gap-4 p-6" style={{ background: '#0A0A0B', minHeight: '100vh' }}>
            {/* KPI cards skeleton */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/5 bg-[#111113] p-5">
                        <div className="mb-3 flex items-start justify-between">
                            <div className="h-2.5 w-24 animate-pulse rounded bg-white/8" />
                            <div className="h-7 w-7 animate-pulse rounded-lg bg-white/5" />
                        </div>
                        <div className="mb-2 h-7 w-28 animate-pulse rounded bg-white/10" />
                        <div className="mb-3 h-8 w-full animate-pulse rounded bg-white/4" />
                        <div className="h-2 w-20 animate-pulse rounded bg-white/6" />
                    </div>
                ))}
            </div>

            {/* Section divider skeleton */}
            <div className="flex items-center gap-3 py-1">
                <div className="h-5 w-5 animate-pulse rounded-md bg-white/6" />
                <div className="h-2 w-20 animate-pulse rounded bg-white/6" />
                <div className="h-px flex-1 bg-white/4" />
            </div>

            {/* Chart + meta skeleton (Financeiro) */}
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 340px' }}>
                <div className="rounded-xl border border-white/5 bg-[#111113] p-4">
                    <div className="mb-4 flex justify-between">
                        <div className="h-2.5 w-40 animate-pulse rounded bg-white/8" />
                        <div className="h-2.5 w-20 animate-pulse rounded bg-white/6" />
                    </div>
                    <div className="h-44 w-full animate-pulse rounded-lg bg-white/4" />
                    <div className="mt-3 flex gap-5">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i}>
                                <div className="mb-1 h-2 w-14 animate-pulse rounded bg-white/6" />
                                <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex-1 rounded-xl border border-white/5 bg-[#111113] p-4">
                        <div className="mb-3 h-2.5 w-24 animate-pulse rounded bg-white/8" />
                        <div className="mb-2 h-8 w-32 animate-pulse rounded bg-white/10" />
                        <div className="mb-3 h-2 w-full animate-pulse rounded-full bg-white/6" />
                        <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="rounded-lg bg-white/3 p-2">
                                    <div className="mb-1 h-2 w-12 animate-pulse rounded bg-white/6" />
                                    <div className="h-4 w-10 animate-pulse rounded bg-white/10" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-[#111113] p-4">
                        <div className="mb-3 h-2.5 w-32 animate-pulse rounded bg-white/8" />
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="mb-2">
                                <div className="mb-1 flex justify-between">
                                    <div className="h-2 w-24 animate-pulse rounded bg-white/6" />
                                    <div className="h-2 w-8 animate-pulse rounded bg-white/6" />
                                </div>
                                <div className="h-1 w-full animate-pulse rounded-full bg-white/5" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Section divider skeleton */}
            <div className="flex items-center gap-3 py-1">
                <div className="h-5 w-5 animate-pulse rounded-md bg-white/6" />
                <div className="h-2 w-24 animate-pulse rounded bg-white/6" />
                <div className="h-px flex-1 bg-white/4" />
            </div>

            {/* Alertas + Agenda + Prontos skeleton */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/5 bg-[#111113] p-4">
                        <div className="mb-3 h-2.5 w-32 animate-pulse rounded bg-white/8" />
                        {Array.from({ length: 3 }).map((_, j) => (
                            <div key={j} className="mb-2 rounded-lg bg-white/3 p-3">
                                <div className="mb-1 h-2 w-20 animate-pulse rounded bg-white/6" />
                                <div className="h-3 w-28 animate-pulse rounded bg-white/10" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Section divider skeleton */}
            <div className="flex items-center gap-3 py-1">
                <div className="h-5 w-5 animate-pulse rounded-md bg-white/6" />
                <div className="h-2 w-20 animate-pulse rounded bg-white/6" />
                <div className="h-px flex-1 bg-white/4" />
            </div>

            {/* Produção skeleton */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/5 bg-[#111113] p-4">
                        <div className="mb-3 h-2.5 w-36 animate-pulse rounded bg-white/8" />
                        {Array.from({ length: 5 }).map((_, j) => (
                            <div key={j} className="mb-2 flex items-center gap-3">
                                <div className="h-2 w-2 animate-pulse rounded-full bg-white/10" />
                                <div className="h-2 w-20 animate-pulse rounded bg-white/6" />
                                <div className="h-1 flex-1 animate-pulse rounded-full bg-white/5" />
                                <div className="h-3 w-8 animate-pulse rounded bg-white/10" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Comercial skeleton */}
            <div className="flex items-center gap-3 py-1">
                <div className="h-5 w-5 animate-pulse rounded-md bg-white/6" />
                <div className="h-2 w-20 animate-pulse rounded bg-white/6" />
                <div className="h-px flex-1 bg-white/4" />
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/5 bg-[#111113] p-4">
                        <div className="mb-3 h-2.5 w-28 animate-pulse rounded bg-white/8" />
                        {Array.from({ length: 4 }).map((_, j) => (
                            <div key={j} className="mb-2 flex items-center gap-2 border-b border-white/4 py-2">
                                <div className="h-5 w-12 animate-pulse rounded bg-white/8" />
                                <div className="h-2.5 flex-1 animate-pulse rounded bg-white/6" />
                                <div className="h-2 w-8 animate-pulse rounded bg-white/5" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
