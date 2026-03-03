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
        <div className="mb-6 flex flex-col gap-4 border-b border-canvas-border pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
                <h1 className="font-serif text-2xl font-semibold text-gray-900">{title}</h1>
                {description ? <p className="mt-2 text-sm text-gray-500">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
    );
}
