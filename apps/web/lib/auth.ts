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

export function getSession(): WebSession | null {
    const raw = cookies().get(SESSION_COOKIE)?.value;

    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as WebSession;
    } catch {
        cookies().delete(SESSION_COOKIE);
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
    cookies().set(SESSION_COOKIE, JSON.stringify(session), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: effectiveMaxAge > 0 ? effectiveMaxAge : 60 * 60 * 24 * 365, // 0 = never expire (1 year)
    });
}

export function clearSession(): void {
    cookies().delete(SESSION_COOKIE);
}
