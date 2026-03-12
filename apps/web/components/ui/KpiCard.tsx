import { Card } from '@/components/ui/Card';

export function KpiCard({
    label,
    value,
    helper,
}: {
    label: string;
    value: string;
    helper?: string;
}) {
    return (
        <Card className="min-h-[130px] overflow-hidden p-0">
            <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold" />
            <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--orion-text-secondary)]">{label}</p>
                <p className="mt-3 font-serif text-3xl font-semibold text-[color:var(--orion-text)]">{value}</p>
                {helper ? <p className="mt-3 text-sm text-[color:var(--orion-text-secondary)]">{helper}</p> : null}
            </div>
        </Card>
    );
}
