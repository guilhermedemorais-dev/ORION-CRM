import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

export function KpiCard({
    label,
    value,
    helper,
    icon,
    trend,
    trendValue,
}: {
    label: string;
    value: string;
    helper?: string;
    icon?: ReactNode;
    trend?: 'up' | 'down' | 'flat';
    trendValue?: string;
}) {
    const trendColor = trend === 'up' ? 'text-[color:var(--orion-green)]' : trend === 'down' ? 'text-[color:var(--orion-red)]' : 'text-[color:var(--orion-text-muted)]';
    const trendLabel = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

    return (
        <div className="rounded-lg border border-[color:var(--orion-border-low)] bg-[color:var(--orion-surface)] p-4 shadow-[var(--orion-shadow-card)] min-w-[160px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-[10px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--orion-text-secondary)]">{label}</p>
                {icon && (
                    <div className="w-7 h-7 rounded-md bg-[color:var(--orion-gold-bg)] flex items-center justify-center text-[color:var(--orion-gold)]">
                        {icon}
                    </div>
                )}
            </div>
            {/* Value */}
            <p className="text-[22px] font-bold text-[color:var(--orion-text)] leading-none mb-1">{value}</p>
            {/* Trend */}
            {trend && (
                <div className={`flex items-center gap-1 text-[11px] font-semibold ${trendColor}`}>
                    <span>{trendLabel}</span>
                    {trendValue && <span>{trendValue}</span>}
                </div>
            )}
            {helper && <p className="mt-1 text-[11px] text-[color:var(--orion-text-muted)]">{helper}</p>}
        </div>
    );
}
