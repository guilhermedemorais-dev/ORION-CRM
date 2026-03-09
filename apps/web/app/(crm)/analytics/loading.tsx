import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AnalyticsLoading() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Analytics"
                description="Carregando indicadores executivos..."
                actions={(
                    <div className="flex flex-wrap gap-3">
                        <Skeleton className="h-11 w-64" />
                        <Skeleton className="h-11 w-72" />
                        <Skeleton className="h-11 w-40" />
                    </div>
                )}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index}>
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="mt-4 h-10 w-36" />
                        <Skeleton className="mt-3 h-4 w-40" />
                        <Skeleton className="mt-2 h-4 w-44" />
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
                <Card title="Faturamento por período">
                    <Skeleton className="h-[340px] w-full" />
                </Card>
                <Card title="Leitura executiva">
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card title="Faturamento por canal">
                    <Skeleton className="h-[320px] w-full" />
                </Card>
                <Card title="Top categorias por receita">
                    <Skeleton className="h-[320px] w-full" />
                </Card>
            </div>
        </div>
    );
}
