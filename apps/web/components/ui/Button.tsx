import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold-ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: 'sm' | 'md' | 'lg';
    icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
    primary:
        'bg-[color:var(--orion-gold)] text-[#0A0A0C] font-bold border border-transparent hover:bg-[color:var(--orion-gold-light)] hover:translate-y-[-1px] hover:shadow-[0_4px_16px_rgba(191,160,106,0.3)] active:translate-y-0 active:shadow-none',
    secondary:
        'bg-white/6 text-[color:var(--orion-text-secondary)] border border-[color:var(--orion-border-mid)] hover:bg-white/9 hover:border-[color:var(--orion-border-high)] hover:text-[color:var(--orion-text)] active:bg-white/4',
    ghost:
        'bg-transparent text-[color:var(--orion-text-secondary)] border border-[color:var(--orion-border-mid)] hover:bg-[color:var(--orion-hover)] hover:text-[color:var(--orion-text)]',
    danger:
        'bg-[color:rgba(224,82,82,0.1)] text-[color:var(--orion-red)] border border-[color:rgba(224,82,82,0.25)] hover:bg-[color:rgba(224,82,82,0.18)] hover:border-[color:rgba(224,82,82,0.4)]',
    'gold-ghost':
        'bg-[color:var(--orion-gold-bg)] text-[color:var(--orion-gold)] border border-[color:var(--orion-gold-border)] hover:bg-[color:rgba(191,160,106,0.14)] hover:border-[color:rgba(191,160,106,0.35)]',
};

const sizes: Record<string, string> = {
    sm: 'h-7 px-3 text-[11px]',
    md: 'h-9 px-4 text-[12px]',
    lg: 'h-[42px] px-6 text-[13px]',
};

export function Button({
    className,
    children,
    variant = 'primary',
    size = 'md',
    icon,
    type = 'button',
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            disabled={disabled}
            className={cn(
                'inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-md font-bold transition-all duration-180 disabled:opacity-35 disabled:pointer-events-none',
                'text-[12px]',
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        >
            {icon}
            {children}
        </button>
    );
}
