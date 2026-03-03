import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

export function ComingSoon({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div>
            <PageHeader title={title} description={description} />
            <Card title="Módulo em construção" description="Este bloco será implementado nas próximas etapas do roadmap.">
                <p className="text-sm text-gray-600">
                    A navegação já está pronta para preservar o shell do CRM. O conteúdo funcional deste módulo entra no próximo lote.
                </p>
            </Card>
        </div>
    );
}
