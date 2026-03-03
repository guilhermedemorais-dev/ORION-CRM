import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cn(
                'w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20',
                className
            )}
            {...props}
        />
    );
}
