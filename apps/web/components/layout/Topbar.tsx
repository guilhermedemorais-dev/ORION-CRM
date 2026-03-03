import { Search, Bell } from 'lucide-react';

export function Topbar({ userName }: { userName: string }) {
    return (
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-canvas-border bg-white px-6">
            <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Painel operacional</p>
                <p className="text-sm font-medium text-gray-900">Tudo que importa para o atendimento e a operação.</p>
            </div>
            <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-md border border-canvas-border px-3 py-2 text-sm text-gray-500 md:flex">
                    <Search className="h-4 w-4" />
                    <span>Busca global (em breve)</span>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-canvas-border text-gray-500">
                    <Bell className="h-4 w-4" />
                </div>
                <div className="rounded-full bg-brand-gold px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-surface-sidebar">
                    {userName}
                </div>
            </div>
        </header>
    );
}
