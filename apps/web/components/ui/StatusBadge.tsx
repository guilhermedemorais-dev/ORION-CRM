import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
    NOVO: { label: 'Novo', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    QUALIFICADO: { label: 'Qualificado', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    PROPOSTA_ENVIADA: { label: 'Proposta', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    NEGOCIACAO: { label: 'Negociação', color: 'bg-pink-100 text-pink-800 border-pink-200' },
    CONVERTIDO: { label: 'Convertido', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    PERDIDO: { label: 'Perdido', color: 'bg-gray-100 text-gray-600 border-gray-200' },
    BOT: { label: 'Bot', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    AGUARDANDO_HUMANO: { label: 'Aguardando humano', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    EM_ATENDIMENTO: { label: 'Em atendimento', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    ENCERRADA: { label: 'Encerrada', color: 'bg-gray-100 text-gray-600 border-gray-200' },
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
    const config = STATUS_CONFIG[status];

    return (
        <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', config.color)}>
            {config.label}
        </span>
    );
}
