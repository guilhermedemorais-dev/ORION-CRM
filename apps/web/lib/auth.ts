import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface WebSessionUser {
    id: string;
    name: string;
    email: string;
    role: string;
}

export interface WebSession {
    accessToken: string;
    user: WebSessionUser;
}

const SESSION_COOKIE = 'orion_session';

function isWebSession(value: unknown): value is WebSession {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.accessToken !== 'string' || candidate.accessToken.length === 0) {
        return false;
    }
    if (!candidate.user || typeof candidate.user !== 'object') {
        return false;
    }
    const user = candidate.user as Record<string, unknown>;
    return (
        typeof user.id === 'string' &&
        typeof user.name === 'string' &&
        typeof user.email === 'string' &&
        typeof user.role === 'string'
    );
}

export function getSession(): WebSession | null {
    const raw = cookies().get(SESSION_COOKIE)?.value;

    if (!raw) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isWebSession(parsed)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function requireSession(): WebSession {
    const session = getSession();

    if (!session) {
        redirect('/login');
    }

    return session;
}

export function setSession(session: WebSession, maxAgeSeconds?: number): void {
    const effectiveMaxAge = maxAgeSeconds ?? 60 * 60 * 8; // default 8h
    // ORION_COOKIE_SECURE allows forcing secure=false in local Docker (NODE_ENV=production + http)
    const isSecure = process.env.ORION_COOKIE_SECURE === 'false'
        ? false
        : process.env.NODE_ENV === 'production';
    // SameSite=Strict mitigates CSRF: cookie is never sent on cross-site requests,
    // so attacker pages cannot trigger authenticated calls to /api/internal/*.
    // httpOnly prevents XSS access to the token. secure enforces HTTPS in production.
    cookies().set(SESSION_COOKIE, JSON.stringify(session), {
        httpOnly: true,
        sameSite: 'strict',
        secure: isSecure,
        path: '/',
        maxAge: effectiveMaxAge > 0 ? effectiveMaxAge : 60 * 60 * 24 * 365, // 0 = never expire (1 year)
    });
}

export function clearSession(): void {
    cookies().delete(SESSION_COOKIE);
}
