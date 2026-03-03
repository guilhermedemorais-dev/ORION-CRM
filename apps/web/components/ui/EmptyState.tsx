import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

export function EmptyState({
    title,
    description,
    action,
}: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <Card className="border-dashed text-center">
            <div className="mx-auto max-w-md py-6">
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-500">{description}</p>
                {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
            </div>
        </Card>
    );
}
