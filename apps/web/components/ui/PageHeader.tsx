import type { ReactNode } from 'react';

export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 border-b border-white/5 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
                <p className="orion-section-label">ORION CRM</p>
                <h1 className="mt-2 font-serif text-3xl font-semibold text-[color:var(--orion-text)]">{title}</h1>
                {description ? <p className="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--orion-text-secondary)]">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
    );
}
