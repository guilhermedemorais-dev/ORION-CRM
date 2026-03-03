import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    title?: ReactNode;
    description?: ReactNode;
}

export function Card({ className, title, description, children, ...props }: CardProps) {
    return (
        <section
            className={cn('rounded-xl border border-canvas-border bg-canvas-card p-5 shadow-card', className)}
            {...props}
        >
            {(title || description) && (
                <header className="mb-4">
                    {title ? <h2 className="text-base font-semibold text-gray-900">{title}</h2> : null}
                    {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
                </header>
            )}
            {children}
        </section>
    );
}
