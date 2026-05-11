'use client';

// Renderizador de markdown muito simples: cobre H1/H2/H3, parágrafos, listas (-),
// bold (**texto**), inline code (`code`). Não usa dep externa pra manter o bundle leve.
// Se a complexidade crescer, trocar por react-markdown depois.

import { Fragment } from 'react';

function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        const token = match[0];
        if (token.startsWith('**')) {
            parts.push(<strong key={key++} className="font-semibold text-[color:var(--orion-text)]">{token.slice(2, -2)}</strong>);
        } else {
            parts.push(<code key={key++} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-[color:var(--orion-gold)]">{token.slice(1, -1)}</code>);
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
}

export function MarkdownLite({ source }: { source: string }) {
    const lines = source.split('\n');
    const blocks: React.ReactNode[] = [];
    let listBuffer: string[] = [];
    let paragraphBuffer: string[] = [];

    const flushList = () => {
        if (listBuffer.length === 0) return;
        blocks.push(
            <ul key={`ul-${blocks.length}`} className="mb-4 ml-5 list-disc space-y-1.5 text-[14px] text-[color:var(--orion-text-secondary)]">
                {listBuffer.map((item, i) => (
                    <li key={i}>{renderInline(item)}</li>
                ))}
            </ul>,
        );
        listBuffer = [];
    };

    const flushParagraph = () => {
        if (paragraphBuffer.length === 0) return;
        blocks.push(
            <p key={`p-${blocks.length}`} className="mb-3 text-[14px] leading-relaxed text-[color:var(--orion-text-secondary)]">
                {renderInline(paragraphBuffer.join(' '))}
            </p>,
        );
        paragraphBuffer = [];
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        if (line.startsWith('# ')) {
            flushParagraph();
            flushList();
            blocks.push(
                <h1 key={`h1-${blocks.length}`} className="mb-5 mt-1 font-serif text-[28px] font-semibold text-[color:var(--orion-text)]">
                    {renderInline(line.slice(2))}
                </h1>,
            );
            continue;
        }
        if (line.startsWith('## ')) {
            flushParagraph();
            flushList();
            blocks.push(
                <h2 key={`h2-${blocks.length}`} className="mb-3 mt-6 text-[16px] font-bold uppercase tracking-[0.06em] text-[color:var(--orion-gold)]">
                    {renderInline(line.slice(3))}
                </h2>,
            );
            continue;
        }
        if (line.startsWith('### ')) {
            flushParagraph();
            flushList();
            blocks.push(
                <h3 key={`h3-${blocks.length}`} className="mb-2 mt-4 text-[15px] font-semibold text-[color:var(--orion-text)]">
                    {renderInline(line.slice(4))}
                </h3>,
            );
            continue;
        }
        if (line.startsWith('- ')) {
            flushParagraph();
            listBuffer.push(line.slice(2));
            continue;
        }
        if (line.trim() === '') {
            flushParagraph();
            flushList();
            continue;
        }
        paragraphBuffer.push(line);
    }
    flushParagraph();
    flushList();

    return <Fragment>{blocks}</Fragment>;
}
