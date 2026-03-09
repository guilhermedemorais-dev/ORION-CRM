import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AjustesLoading() {
    return (
        <div className="space-y-6">
            <PageHeader title="Ajustes" description="Carregando configurações..." />
            <Card>
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </Card>
        </div>
    );
}
