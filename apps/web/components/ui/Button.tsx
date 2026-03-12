import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
    primary: 'border border-brand-gold bg-brand-gold text-[#0A0A0C] hover:bg-brand-gold-light hover:border-brand-gold-light',
    secondary: 'border border-white/10 bg-white/5 text-[color:var(--orion-text)] hover:border-[color:var(--orion-gold-border)] hover:bg-[color:var(--orion-gold-bg)] hover:text-brand-gold',
    ghost: 'border border-transparent bg-transparent text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-[color:var(--orion-text)]',
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
                'inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-35',
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
