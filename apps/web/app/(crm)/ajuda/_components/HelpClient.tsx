'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { HELP_SECTIONS, HELP_GROUPS, type HelpSection } from '../_content';
import { MarkdownLite } from './MarkdownLite';

interface Props {
    initialSectionId?: string | null;
}

export function HelpClient({ initialSectionId }: Props) {
    const [selectedId, setSelectedId] = useState<string>(
        initialSectionId && HELP_SECTIONS.find((s) => s.id === initialSectionId)
            ? initialSectionId
            : HELP_SECTIONS[0]?.id ?? 'bem-vindo',
    );
    const [query, setQuery] = useState('');

    const filteredSections = useMemo<HelpSection[]>(() => {
        if (!query.trim()) return HELP_SECTIONS;
        const q = query.trim().toLowerCase();
        return HELP_SECTIONS.filter((section) =>
            section.title.toLowerCase().includes(q) ||
            section.group.toLowerCase().includes(q) ||
            section.body.toLowerCase().includes(q),
        );
    }, [query]);

    const grouped = useMemo(() => {
        const map = new Map<string, HelpSection[]>();
        for (const group of HELP_GROUPS) {
            const list = filteredSections.filter((s) => s.group === group);
            if (list.length > 0) map.set(group, list);
        }
        return map;
    }, [filteredSections]);

    const current = HELP_SECTIONS.find((s) => s.id === selectedId) ?? HELP_SECTIONS[0];

    return (
        <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-[#0A0A0C]">
            {/* Sidebar */}
            <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-[#0F0F11]">
                <div className="border-b border-white/10 px-5 py-4">
                    <div className="flex items-center gap-2 text-[color:var(--orion-gold)]">
                        <BookOpen className="h-4 w-4" />
                        <h1 className="font-serif text-lg font-semibold text-[color:var(--orion-text)]">Central de Ajuda</h1>
                    </div>
                    <p className="mt-1 text-[11px] text-[color:var(--orion-text-muted)]">
                        Como usar cada módulo do sistema.
                    </p>
                </div>

                <div className="border-b border-white/10 px-4 py-3">
                    <label className="relative block">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--orion-text-muted)]" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar..."
                            className="h-9 w-full rounded-[8px] border border-white/10 bg-[#15151A] pl-8 pr-3 text-[12px] text-[color:var(--orion-text)] outline-none focus:border-[color:var(--orion-gold)]"
                        />
                    </label>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
                    {grouped.size === 0 ? (
                        <p className="px-2 py-4 text-center text-[11px] text-[color:var(--orion-text-muted)]">
                            Nenhuma seção encontrada.
                        </p>
                    ) : null}
                    {Array.from(grouped.entries()).map(([group, sections]) => (
                        <div key={group} className="mb-4">
                            <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-disabled)]">
                                {group}
                            </p>
                            <ul className="space-y-0.5">
                                {sections.map((section) => {
                                    const isActive = section.id === selectedId;
                                    return (
                                        <li key={section.id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedId(section.id)}
                                                className={`w-full rounded-[8px] px-2.5 py-1.5 text-left text-[12px] transition ${
                                                    isActive
                                                        ? 'bg-[rgba(200,169,122,0.08)] font-semibold text-[color:var(--orion-gold)]'
                                                        : 'text-[color:var(--orion-text-secondary)] hover:bg-white/5 hover:text-[color:var(--orion-text)]'
                                                }`}
                                            >
                                                {section.title}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Content */}
            <main className="min-w-0 flex-1 overflow-y-auto">
                <article className="mx-auto max-w-3xl px-8 py-10">
                    {current ? (
                        <>
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--orion-text-muted)]">
                                {current.group}
                            </p>
                            <MarkdownLite source={current.body} />
                        </>
                    ) : (
                        <p className="text-sm text-[color:var(--orion-text-secondary)]">Selecione uma seção à esquerda.</p>
                    )}
                </article>
            </main>
        </div>
    );
}
