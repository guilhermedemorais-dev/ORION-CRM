import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { AppError } from '../lib/errors.js';

const router = Router();
const execFileAsync = promisify(execFile);

interface TimelineEntry {
    version: string;
    date: string;
    title: string;
    /** Resumo curto pra usuário leigo (até 350 chars). */
    summary?: string;
    /** Texto explicativo do benefício no dia a dia (parágrafos). */
    user_impact?: string;
    /** Lista de novidades em linguagem clara (substitui items quando presente). */
    highlights: string[];
    /** Lista técnica para devs (colapsável no frontend). */
    technical_details: string[];
    /** Avisos críticos (opcional). */
    warning?: string;
    /** @deprecated mantido para retrocompatibilidade do frontend antigo. Vira a junção de highlights+technical_details. */
    items: string[];
}

interface PendingItem {
    section: string;
    items: string[];
}

// Locate releases.md — apps/api/src/routes → repo_root/docs/releases.md (4 levels up at runtime, dist or src)
function resolveReleasesPath(): string[] {
    const candidates = [
        path.resolve(process.cwd(), 'docs/releases.md'),
        path.resolve(process.cwd(), '../docs/releases.md'),
        path.resolve(process.cwd(), '../../docs/releases.md'),
        path.resolve(process.cwd(), '../../../docs/releases.md'),
        '/app/docs/releases.md',
    ];
    return candidates;
}

async function readReleasesFile(): Promise<string> {
    const candidates = resolveReleasesPath();
    let lastError: unknown = null;

    for (const candidate of candidates) {
        try {
            return await readFile(candidate, 'utf8');
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError ?? new Error('docs/releases.md not found in any expected location');
}

async function readReleasesFileSafe(): Promise<string | null> {
    try {
        return await readReleasesFile();
    } catch {
        return null;
    }
}

// Aceita data ISO (YYYY-MM-DD) ou data por extenso em português ("15 de maio de 2026")
const MES_PT: Record<string, string> = {
    janeiro: '01', fevereiro: '02', marco: '03', 'março': '03', abril: '04',
    maio: '05', junho: '06', julho: '07', agosto: '08',
    setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

function parseDateString(raw: string): string | null {
    const trimmed = raw.trim();
    // ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    // "DD de MES de YYYY"
    const m = trimmed.toLowerCase().match(/^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})$/);
    if (m && m[1] && m[2] && m[3]) {
        const dd = m[1].padStart(2, '0');
        const mm = MES_PT[m[2]];
        const yyyy = m[3];
        if (mm) return `${yyyy}-${mm}-${dd}`;
    }
    return null;
}

type ParserSection =
    | 'none'
    | 'summary'
    | 'user_impact'
    | 'highlights'
    | 'technical_details'
    | 'warning';

const SECTION_HEADERS: Record<string, ParserSection> = {
    'em poucas palavras': 'summary',
    'o que melhora pra você': 'user_impact',
    'o que melhora para você': 'user_impact',
    'novidades principais': 'highlights',
    'novidades': 'highlights',
    'detalhes técnicos': 'technical_details',
    'detalhes tecnicos': 'technical_details',
    'atenção': 'warning',
    'atencao': 'warning',
};

function parseReleases(markdown: string): TimelineEntry[] {
    const lines = markdown.split(/\r?\n/);
    const entries: TimelineEntry[] = [];

    let current: TimelineEntry | null = null;
    let section: ParserSection = 'none';
    let textBuffer: string[] = [];

    const flushTextBuffer = () => {
        if (!current || textBuffer.length === 0) return;
        const joined = textBuffer.join(' ').trim();
        if (joined) {
            if (section === 'summary') {
                current.summary = current.summary ? `${current.summary} ${joined}`.trim() : joined;
            } else if (section === 'user_impact') {
                current.user_impact = current.user_impact ? `${current.user_impact}\n\n${joined}` : joined;
            } else if (section === 'warning') {
                current.warning = current.warning ? `${current.warning} ${joined}`.trim() : joined;
            }
        }
        textBuffer = [];
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        // Cabeçalho da release: ## [vX.Y.Z] — data
        const versionMatch = line.match(/^##\s*\[([^\]]+)\]\s*[—–-]\s*(.+)$/);
        if (versionMatch && versionMatch[1] && versionMatch[2]) {
            flushTextBuffer();
            const isoDate = parseDateString(versionMatch[2]);
            if (current) entries.push(current);
            current = {
                version: versionMatch[1],
                date: isoDate ?? versionMatch[2].trim(),
                title: '',
                highlights: [],
                technical_details: [],
                items: [],
            };
            section = 'none';
            continue;
        }

        if (!current) continue;

        // ### Title da release (primeiro h3 do bloco — o "subtítulo")
        const h3Match = line.match(/^###\s+(.+)$/);
        if (h3Match && h3Match[1]) {
            flushTextBuffer();
            const headerText = h3Match[1].trim();
            if (!current.title) {
                current.title = headerText;
            }
            // h3 não muda de section — só serve como subtítulo da versão
            section = 'none';
            continue;
        }

        // #### Seções (h4): Em poucas palavras / O que melhora / Novidades / Detalhes técnicos / Atenção
        // Também aceita sub-headers livres dentro de Novidades (ignora)
        const h4Match = line.match(/^####\s+(.+)$/);
        if (h4Match && h4Match[1]) {
            flushTextBuffer();
            const headerText = h4Match[1].trim();
            const normalized = headerText
                .toLowerCase()
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '');
            const known = SECTION_HEADERS[normalized] ?? SECTION_HEADERS[headerText.toLowerCase()];
            if (known) {
                section = known;
            }
            // se for h4 não reconhecido (ex: "#### Limpar e exportar banco direto na tela"),
            // mantém a section atual — vira label dentro da seção pai.
            continue;
        }

        // Bullets: vão pra highlights ou technical_details conforme a seção
        const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
        if (bulletMatch && bulletMatch[1]) {
            flushTextBuffer();
            const text = bulletMatch[1].trim();
            if (section === 'technical_details') {
                current.technical_details.push(text);
            } else {
                // default: highlights (mesmo se a seção for 'none' ou outra)
                current.highlights.push(text);
            }
            current.items.push(text); // retrocompat
            continue;
        }

        // Texto livre (parágrafo) — só relevante para sections que aceitam texto
        if (line.trim().length > 0 && !line.startsWith('---') && !line.startsWith('>')) {
            if (section === 'summary' || section === 'user_impact' || section === 'warning') {
                textBuffer.push(line.trim());
            }
            continue;
        }

        // Linha em branco
        if (line.trim().length === 0 && textBuffer.length > 0) {
            // Sinaliza fim de parágrafo
            flushTextBuffer();
        }
    }

    flushTextBuffer();
    if (current) entries.push(current);

    // Ordena por data desc — usa a data ISO quando disponível
    entries.sort((a, b) => b.date.localeCompare(a.date));
    return entries;
}

interface GitCommitEntry {
    date: string;
    hash: string;
    subject: string;
}

const GITHUB_REPO_API = 'https://api.github.com/repos/guilhermedemorais-dev/ORION-CRM/commits?per_page=200';

async function readGitCommits(): Promise<GitCommitEntry[]> {
    const cwdCandidates = [
        process.cwd(),
        path.resolve(process.cwd(), '..'),
        path.resolve(process.cwd(), '../..'),
        path.resolve(process.cwd(), '../../..'),
    ];

    for (const cwd of cwdCandidates) {
        try {
            const { stdout } = await execFileAsync(
                'git',
                ['log', '--date=short', '--pretty=format:%ad\t%h\t%s', '--no-merges', '-200'],
                { cwd, timeout: 5000, maxBuffer: 1024 * 1024 },
            );

            return stdout
                .split(/\r?\n/)
                .map((line) => {
                    const [date, hash, ...subjectParts] = line.split('\t');
                    return {
                        date: date?.trim() ?? '',
                        hash: hash?.trim() ?? '',
                        subject: subjectParts.join('\t').trim(),
                    };
                })
                .filter((entry) => entry.date && entry.hash && entry.subject);
        } catch {
            // Try next cwd candidate
        }
    }

    return [];
}

async function readGithubCommits(): Promise<GitCommitEntry[]> {
    try {
        const response = await fetch(GITHUB_REPO_API, {
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': 'orion-crm-support-module',
            },
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json() as Array<{
            sha?: string;
            commit?: {
                message?: string;
                author?: { date?: string };
            };
        }>;

        return data
            .map((entry) => ({
                date: String(entry.commit?.author?.date ?? '').slice(0, 10),
                hash: String(entry.sha ?? '').slice(0, 7),
                subject: String(entry.commit?.message ?? '').split('\n')[0]?.trim() ?? '',
            }))
            .filter((entry) => entry.date && entry.hash && entry.subject);
    } catch {
        return [];
    }
}

async function readCommitFeed(): Promise<GitCommitEntry[]> {
    const localCommits = await readGitCommits();
    if (localCommits.length > 0) {
        return localCommits;
    }

    return readGithubCommits();
}

function buildTimelineEntriesFromGit(commits: GitCommitEntry[]): TimelineEntry[] {
    const grouped = new Map<string, GitCommitEntry[]>();

    for (const commit of commits) {
        const bucket = grouped.get(commit.date) ?? [];
        bucket.push(commit);
        grouped.set(commit.date, bucket);
    }

    return Array.from(grouped.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, items], index) => {
            const bullets = items.map((commit) => `${commit.subject} (${commit.hash})`);
            return {
                version: index === 0 ? 'Em desenvolvimento' : `Build ${date}`,
                date,
                title: index === 0 ? 'Commits recentes ainda não documentados' : 'Atualizações por commits',
                highlights: [],
                technical_details: bullets,
                items: bullets,
            };
        });
}

function mergeReleaseTimelineWithGit(releases: TimelineEntry[], commits: GitCommitEntry[]): TimelineEntry[] {
    const latestReleaseDate = releases[0]?.date ?? null;
    const unreleasedCommits = latestReleaseDate
        ? commits.filter((commit) => commit.date > latestReleaseDate)
        : commits;

    const gitEntries = buildTimelineEntriesFromGit(unreleasedCommits);
    return [...gitEntries, ...releases];
}

function parsePendingFromResolved(markdown: string): PendingItem[] {
    const lines = markdown.split(/\r?\n/);
    const sections: PendingItem[] = [];
    let currentSection: PendingItem | null = null;
    let inPendenciasArea = false;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        // Detect "Pendências" area opening
        if (/^##\s+.*Pend[eê]ncias.*100/i.test(line)) {
            inPendenciasArea = true;
            continue;
        }

        // Stop at next ## section after Pendências
        if (inPendenciasArea && /^##\s+(?!.*Pend)/i.test(line)) {
            inPendenciasArea = false;
            if (currentSection && currentSection.items.length > 0) {
                sections.push(currentSection);
            }
            currentSection = null;
            continue;
        }

        if (!inPendenciasArea) continue;

        // ### Section header
        const sectionMatch = line.match(/^###\s+(.+)$/);
        if (sectionMatch && sectionMatch[1]) {
            if (currentSection && currentSection.items.length > 0) {
                sections.push(currentSection);
            }
            currentSection = { section: sectionMatch[1].trim(), items: [] };
            continue;
        }

        // Pending bullet: - [ ] item
        const pendingMatch = line.match(/^-\s*\[\s*\]\s+(.+)$/);
        if (pendingMatch && pendingMatch[1] && currentSection) {
            currentSection.items.push(pendingMatch[1].trim());
        }
    }

    if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
    }

    return sections;
}

async function readResolvedFile(): Promise<string | null> {
    const candidates = [
        path.resolve(process.cwd(), 'docs/roadmap/task.md.resolved'),
        path.resolve(process.cwd(), '../docs/roadmap/task.md.resolved'),
        path.resolve(process.cwd(), '../../docs/roadmap/task.md.resolved'),
        path.resolve(process.cwd(), '../../../docs/roadmap/task.md.resolved'),
        '/app/docs/roadmap/task.md.resolved',
    ];

    for (const candidate of candidates) {
        try {
            return await readFile(candidate, 'utf8');
        } catch {
            // try next
        }
    }
    return null;
}

// GET /api/v1/system/timeline — public, no auth required (dev timeline data)
router.get(
    '/timeline',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const wantsPending = req.query['pending'] === 'true';
            const [releasesMarkdown, gitCommits, resolved] = await Promise.all([
                readReleasesFileSafe(),
                readCommitFeed(),
                wantsPending ? readResolvedFile() : Promise.resolve(null),
            ]);

            const releases = releasesMarkdown ? parseReleases(releasesMarkdown) : [];
            const entries = mergeReleaseTimelineWithGit(releases, gitCommits);

            if (wantsPending) {
                const pending = resolved ? parsePendingFromResolved(resolved) : [];
                res.json({ timeline: entries, pending });
                return;
            }

            res.json(entries);
        } catch (err) {
            next(err);
        }
    }
);

// Commit activity data — hardcoded from git log (avoids spawning git at runtime)
const COMMIT_ACTIVITY: { date: string; count: number }[] = [
    { date: '2026-03-02', count: 2 },
    { date: '2026-03-03', count: 6 },
    { date: '2026-03-09', count: 3 },
    { date: '2026-03-12', count: 4 },
    { date: '2026-03-16', count: 23 },
    { date: '2026-03-17', count: 6 },
    { date: '2026-03-18', count: 13 },
    { date: '2026-03-19', count: 9 },
    { date: '2026-03-22', count: 1 },
    { date: '2026-03-27', count: 14 },
    { date: '2026-03-28', count: 7 },
    { date: '2026-03-29', count: 6 },
    { date: '2026-03-30', count: 11 },
    { date: '2026-03-31', count: 2 },
    { date: '2026-04-01', count: 9 },
    { date: '2026-04-06', count: 1 },
    { date: '2026-04-07', count: 5 },
    { date: '2026-04-12', count: 4 },
    { date: '2026-04-13', count: 1 },
    { date: '2026-04-23', count: 2 },
    { date: '2026-04-24', count: 8 },
    { date: '2026-04-25', count: 4 },
];

const ACTIVITY_STATS = {
    totalCommits: COMMIT_ACTIVITY.reduce((s, d) => s + d.count, 0),
    activeDays: COMMIT_ACTIVITY.length,
    startDate: COMMIT_ACTIVITY[0]?.date ?? '',
};

// GET /api/v1/system/activity — public, no auth required (commit heatmap data)
router.get(
    '/activity',
    async (_req: Request, res: Response): Promise<void> => {
        const gitCommits = await readCommitFeed();

        if (gitCommits.length === 0) {
            res.json({ days: COMMIT_ACTIVITY, stats: ACTIVITY_STATS });
            return;
        }

        const grouped = new Map<string, number>();
        for (const commit of gitCommits) {
            grouped.set(commit.date, (grouped.get(commit.date) ?? 0) + 1);
        }

        const days = Array.from(grouped.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => ({ date, count }));

        res.json({
            days,
            stats: {
                totalCommits: gitCommits.length,
                activeDays: days.length,
                startDate: days[0]?.date ?? '',
            },
        });
    }
);

export default router;
