import { HardHat } from 'lucide-react';
import Link from 'next/link';

export function UnderConstruction() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-2xl border border-[color:var(--orion-gold-border)] bg-[#111111] p-8 text-center shadow-2xl">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--orion-gold-bg)] text-[color:var(--orion-gold)] mb-6 ring-4 ring-black">
                    <HardHat size={32} />
                </div>
                <h2 className="text-xl font-bold text-[color:var(--orion-text)] tracking-wider uppercase mb-3 text-brand-gold">
                    Página em construção
                </h2>
                <p className="text-[color:var(--orion-text-secondary)] text-sm mb-8 leading-relaxed">
                    Este módulo está passando por melhorias e estará disponível na próxima atualização do sistema. 
                    Estamos trabalhando para trazer mais recursos para a sua operação.
                </p>
                <div className="flex flex-col gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-full bg-[color:var(--orion-gold)] px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-black transition hover:bg-[#d4b060] hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Voltar ao Início
                    </Link>
                </div>
            </div>
        </div>
    );
}
