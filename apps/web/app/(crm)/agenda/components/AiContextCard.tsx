import { Sparkles, Target, Diamond, CalendarClock, DollarSign, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AiContextData {
    interesse?: string;
    material?: string;
    ocasiao?: string;
    orcamento?: string;
    urgencia?: string;
}

export function AiContextCard({ context, className }: { context: AiContextData; className?: string }) {
    if (!context || Object.keys(context).length === 0) {
        return null;
    }

    return (
        <div className={cn("overflow-hidden rounded-xl border border-brand-gold/20 bg-gradient-to-br from-brand-gold/5 to-transparent relative", className)}>
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-gold/10 blur-2xl"></div>
            
            <div className="border-b border-brand-gold/10 bg-brand-gold/5 px-4 py-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-gold" />
                <h3 className="text-sm font-medium text-brand-gold">Contexto da IA</h3>
            </div>
            
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {context.interesse && (
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sidebar border border-white/5">
                            <Target className="h-4 w-4 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-[10px] items-center font-bold uppercase tracking-wider text-gray-500">Interesse</p>
                            <p className="mt-0.5 text-sm text-gray-300">{context.interesse}</p>
                        </div>
                    </div>
                )}
                {context.material && (
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sidebar border border-white/5">
                            <Diamond className="h-4 w-4 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-[10px] items-center font-bold uppercase tracking-wider text-gray-500">Material</p>
                            <p className="mt-0.5 text-sm text-gray-300">{context.material}</p>
                        </div>
                    </div>
                )}
                {context.ocasiao && (
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sidebar border border-white/5">
                            <CalendarClock className="h-4 w-4 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-[10px] items-center font-bold uppercase tracking-wider text-gray-500">Ocasião</p>
                            <p className="mt-0.5 text-sm text-gray-300">{context.ocasiao}</p>
                        </div>
                    </div>
                )}
                {context.orcamento && (
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sidebar border border-white/5">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-[10px] items-center font-bold uppercase tracking-wider text-gray-500">Orçamento</p>
                            <p className="mt-0.5 text-sm text-gray-300">{context.orcamento}</p>
                        </div>
                    </div>
                )}
                {context.urgencia && (
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sidebar border border-white/5">
                            <Clock className="h-4 w-4 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-[10px] items-center font-bold uppercase tracking-wider text-gray-500">Urgência</p>
                            <p className="mt-0.5 text-sm text-gray-300">{context.urgencia}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
