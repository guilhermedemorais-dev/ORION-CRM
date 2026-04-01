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
    if (!actions) return null;

    return (
        <div className="flex items-center justify-end mb-4">
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
        </div>
    );
}
