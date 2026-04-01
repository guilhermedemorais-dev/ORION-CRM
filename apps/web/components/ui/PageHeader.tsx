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
        <div className="flex items-center justify-between px-6 py-3 -mx-6 -mt-4 mb-4 bg-gradient-to-r from-brand-gold/20 via-brand-gold/10 to-transparent border-b border-brand-gold/20">
            <h1 className="text-lg font-semibold text-brand-gold tracking-wide">{title}</h1>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
    );
}
