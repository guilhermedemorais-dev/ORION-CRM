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
                'relative inline-flex h-6 w-11 items-center rounded-full transition',
                checked ? 'bg-brand-gold' : 'bg-gray-300',
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
                    'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                    checked ? 'translate-x-5' : 'translate-x-0.5'
                )}
            />
        </button>
    );
}
