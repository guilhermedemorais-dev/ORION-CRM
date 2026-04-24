import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    title?: ReactNode;
    description?: ReactNode;
}

export function Card({ className, title, description, children, ...props }: CardProps) {
    return (
        <section
            className={cn(
                'rounded-lg border border-[color:var(--orion-border-low)] bg-[color:var(--orion-surface)] shadow-[var(--orion-shadow-card)] overflow-hidden',
                'transition-[border-color] duration-260 hover:border-[color:var(--orion-border-mid)]',
                className
            )}
            {...props}
        >
            {(title || description) && (
                <header className="px-[18px] pt-[14px] pb-[14px] border-b border-[color:var(--orion-border-subtle)]">
                    {title ? (
                        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--orion-text)]">
                            {title}
                        </h2>
                    ) : null}
                    {description ? <p className="mt-1 text-[13px] text-[color:var(--orion-text-secondary)]">{description}</p> : null}
                </header>
            )}
            <div className="px-[18px] py-[18px]">{children}</div>
        </section>
    );
}
