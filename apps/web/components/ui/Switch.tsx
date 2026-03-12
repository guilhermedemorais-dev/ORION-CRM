'use client';

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange, className, disabled, ...props }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full border transition',
                checked
                    ? 'border-brand-gold bg-brand-gold'
                    : 'border-white/10 bg-white/10',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                className
            )}
            onClick={() => {
                if (!disabled) {
                    onCheckedChange(!checked);
                }
            }}
            {...props}
        >
            <span
                className={cn(
                    'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition',
                    checked ? 'translate-x-[18px]' : 'translate-x-0.5'
                )}
            />
        </button>
    );
}
