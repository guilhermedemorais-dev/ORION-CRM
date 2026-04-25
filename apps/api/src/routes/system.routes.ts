import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../lib/errors.js';

const router = Router();

interface TimelineEntry {
    version: string;
    date: string;
    title: string;
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

function parseReleases(markdown: string): TimelineEntry[] {
    const lines = markdown.split(/\r?\n/);
    const entries: TimelineEntry[] = [];

    let current: TimelineEntry | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        // Match: ## [vX.Y.Z] — YYYY-MM-DD  (em-dash or hyphen)
        const versionMatch = line.match(/^##\s*\[([^\]]+)\]\s*[—–-]\s*(\d{4}-\d{2}-\d{2})\s*$/);
        if (versionMatch && versionMatch[1] && versionMatch[2]) {
            if (current) entries.push(current);
            current = {
                version: versionMatch[1],
                date: versionMatch[2],
                title: '',
                items: [],
            };
            continue;
        }

        if (!current) continue;

        // Section title: ### Title
        const titleMatch = line.match(/^###\s+(.+)$/);
        if (titleMatch && titleMatch[1] && !current.title) {
            current.title = titleMatch[1].trim();
            continue;
        }

        // Bullet items: - item or * item
        const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
        if (bulletMatch && bulletMatch[1]) {
            current.items.push(bulletMatch[1].trim());
        }
    }

    if (current) entries.push(current);

    // Sort by date descending (most recent first)
    entries.sort((a, b) => b.date.localeCompare(a.date));
    return entries;
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
            const markdown = await readReleasesFile();
            const entries = parseReleases(markdown);

            if (wantsPending) {
                const resolved = await readResolvedFile();
                const pending = resolved ? parsePendingFromResolved(resolved) : [];
                res.json({ timeline: entries, pending });
                return;
            }

            res.json(entries);
        } catch (err) {
            if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
                next(AppError.notFound('Arquivo de releases não encontrado.'));
                return;
            }
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
    (_req: Request, res: Response): void => {
        res.json({ days: COMMIT_ACTIVITY, stats: ACTIVITY_STATS });
    }
);

export default router;
