import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    ({ className, type = 'text', ...props }, ref) => {
        return (
            <input
                ref={ref}
                type={type}
                className={cn(
                    'h-[38px] w-full rounded-md border border-[color:var(--orion-border-mid)] bg-[color:var(--orion-base)] px-3 text-[13px] text-[color:var(--orion-text)] outline-none transition-[border-color,box-shadow] duration-120',
                    'placeholder:text-[color:var(--orion-text-muted)]',
                    'focus:border-[color:rgba(191,160,106,0.5)] focus:shadow-[0_0_0_3px_rgba(191,160,106,0.08)]',
                    'disabled:text-[color:var(--orion-text-disabled)] disabled:border-[color:var(--orion-border-subtle)] disabled:bg-[color:var(--orion-nav)] disabled:cursor-not-allowed',
                    className
                )}
                {...props}
            />
        );
    }
);

Input.displayName = 'Input';
