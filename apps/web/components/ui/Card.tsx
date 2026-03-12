import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    title?: ReactNode;
    description?: ReactNode;
}

export function Card({ className, title, description, children, ...props }: CardProps) {
    return (
        <section
            className={cn('rounded-xl border border-white/5 bg-canvas-card p-5 shadow-card', className)}
            {...props}
        >
            {(title || description) && (
                <header className="mb-4 border-b border-white/5 pb-4">
                    {title ? (
                        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-text)]">
                            {title}
                        </h2>
                    ) : null}
                    {description ? <p className="mt-1 text-sm text-[color:var(--orion-text-secondary)]">{description}</p> : null}
                </header>
            )}
            {children}
        </section>
    );
}
