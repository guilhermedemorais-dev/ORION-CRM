import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
    NOVO: { label: 'Novo', color: 'border-amber-500/20 bg-amber-500/10 text-amber-300' },
    QUALIFICADO: { label: 'Qualificado', color: 'border-blue-500/20 bg-blue-500/10 text-blue-300' },
    PROPOSTA_ENVIADA: { label: 'Proposta', color: 'border-violet-500/20 bg-violet-500/10 text-violet-300' },
    NEGOCIACAO: { label: 'Negociação', color: 'border-pink-500/20 bg-pink-500/10 text-pink-300' },
    CONVERTIDO: { label: 'Convertido', color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' },
    PERDIDO: { label: 'Perdido', color: 'border-white/10 bg-white/5 text-[color:var(--orion-text-secondary)]' },
    BOT: { label: 'Bot', color: 'border-slate-500/20 bg-slate-500/10 text-slate-300' },
    AGUARDANDO_HUMANO: { label: 'Aguardando humano', color: 'border-orange-500/20 bg-orange-500/10 text-orange-300' },
    EM_ATENDIMENTO: { label: 'Em atendimento', color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' },
    ENCERRADA: { label: 'Encerrada', color: 'border-white/10 bg-white/5 text-[color:var(--orion-text-secondary)]' },
    RASCUNHO: { label: 'Rascunho', color: 'border-slate-500/20 bg-slate-500/10 text-slate-300' },
    AGUARDANDO_PAGAMENTO: { label: 'Aguard. pagamento', color: 'border-amber-500/20 bg-amber-500/10 text-amber-300' },
    PAGO: { label: 'Pago', color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' },
    SEPARANDO: { label: 'Separando', color: 'border-blue-500/20 bg-blue-500/10 text-blue-300' },
    ENVIADO: { label: 'Enviado', color: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300' },
    RETIRADO: { label: 'Retirado', color: 'border-lime-500/20 bg-lime-500/10 text-lime-300' },
    CANCELADO: { label: 'Cancelado', color: 'border-rose-500/20 bg-rose-500/10 text-rose-300' },
    AGUARDANDO_APROVACAO_DESIGN: { label: 'Aguard. aprovação', color: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300' },
    APROVADO: { label: 'Aprovado', color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' },
    EM_PRODUCAO: { label: 'Em produção', color: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300' },
    CONTROLE_QUALIDADE: { label: 'Qualidade', color: 'border-violet-500/20 bg-violet-500/10 text-violet-300' },
    PENDENTE: { label: 'Pendente', color: 'border-slate-500/20 bg-slate-500/10 text-slate-300' },
    EM_ANDAMENTO: { label: 'Em andamento', color: 'border-blue-500/20 bg-blue-500/10 text-blue-300' },
    PAUSADA: { label: 'Pausada', color: 'border-amber-500/20 bg-amber-500/10 text-amber-300' },
    CONCLUIDA: { label: 'Concluída', color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' },
    REPROVADA: { label: 'Reprovada', color: 'border-rose-500/20 bg-rose-500/10 text-rose-300' },
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
    const config = STATUS_CONFIG[status];

    return (
        <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]', config.color)}>
            {config.label}
        </span>
    );
}
