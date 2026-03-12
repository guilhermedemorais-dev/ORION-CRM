import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cn(
                'h-10 w-full rounded-md border border-white/10 bg-[color:var(--orion-base)] px-3 text-sm text-[color:var(--orion-text)] outline-none transition focus:border-[color:var(--orion-gold-border)] focus:ring-2 focus:ring-brand-gold/10',
                className
            )}
            {...props}
        />
    );
}
