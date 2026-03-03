import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
    primary: 'bg-brand-gold text-surface-sidebar hover:bg-brand-gold-dark',
    secondary: 'bg-canvas-card text-gray-900 border border-canvas-border hover:border-brand-gold-light',
    ghost: 'bg-transparent text-gray-600 hover:bg-white hover:text-gray-900',
};

export function Button({
    className,
    children,
    variant = 'primary',
    icon,
    type = 'button',
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                variants[variant],
                className
            )}
            {...props}
        >
            {icon}
            {children}
        </button>
    );
}
