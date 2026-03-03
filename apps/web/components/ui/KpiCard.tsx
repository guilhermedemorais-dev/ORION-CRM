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
        <Card className="min-h-[130px]">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">{label}</p>
            <p className="mt-3 font-serif text-3xl font-semibold text-gray-900">{value}</p>
            {helper ? <p className="mt-3 text-sm text-gray-500">{helper}</p> : null}
        </Card>
    );
}
