import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// Force Node.js runtime so cookies() and getSession() always work as expected.
export const runtime = 'nodejs';
// Disable any caching: every internal proxy call must be evaluated against the
// current session — never serve a cached response that could leak data.
export const dynamic = 'force-dynamic';

function getApiBaseUrl(): string {
    return process.env.ORION_API_URL ?? 'http://localhost:4000/api/v1';
}

// Paths that don't require a user session (public system data).
// Keep this list intentionally minimal. Anything not listed here REQUIRES a valid session.
const PUBLIC_PREFIXES = ['system/timeline', 'system/activity'];

function isPublicPath(pathSegments: string[]): boolean {
    if (pathSegments.length === 0) {
        return false;
    }
    const joined = pathSegments.join('/');
    return PUBLIC_PREFIXES.some(p => joined === p || joined.startsWith(`${p}/`));
}

function unauthorizedResponse(): NextResponse {
    return NextResponse.json(
        {
            error: 'UNAUTHENTICATED',
            message: 'Sessão expirada. Faça login novamente.',
        },
        { status: 401 },
    );
}

async function forward(request: Request, params: { path: string[] }) {
    if (!params.path || params.path.length === 0) {
        return NextResponse.json(
            { error: 'INVALID_ROUTE', message: 'Rota inválida.' },
            { status: 400 },
        );
    }

    const isPublic = isPublicPath(params.path);
    const session = getSession();

    // Defense in depth: any non-public path without a validated session is rejected
    // BEFORE we open a connection to the backend. getSession() validates shape, so
    // a forged/stale cookie cannot leak through as a truthy value.
    if (!isPublic && !session) {
        return unauthorizedResponse();
    }

    const url = new URL(request.url);
    const backendUrl = `${getApiBaseUrl()}/${params.path.join('/')}${url.search}`;

    const headers = new Headers();
    if (session) {
        headers.set('Authorization', `Bearer ${session.accessToken}`);
    }

    const contentType = request.headers.get('content-type');
    let body: BodyInit | undefined;

    if (!['GET', 'HEAD'].includes(request.method)) {
        if (contentType?.includes('multipart/form-data')) {
            body = await request.formData();
        } else if (contentType?.includes('application/json')) {
            const rawBody = await request.text();
            body = rawBody || undefined;
            if (rawBody) {
                headers.set('Content-Type', 'application/json');
            }
        } else {
            const rawBody = await request.arrayBuffer();
            body = rawBody.byteLength > 0 ? rawBody : undefined;
            if (contentType) {
                headers.set('Content-Type', contentType);
            }
        }
    }

    let response: Response;

    try {
        response = await fetch(backendUrl, {
            method: request.method,
            headers,
            body,
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ message: 'Falha ao conectar com a API.' }, { status: 503 });
    }

    const payload = await response.text();
    const responseContentType = response.headers.get('content-type') ?? 'application/json';

    return new NextResponse(payload, {
        status: response.status,
        headers: {
            'content-type': responseContentType,
        },
    });
}

export async function GET(request: Request, context: { params: { path: string[] } }) {
    return forward(request, context.params);
}

export async function POST(request: Request, context: { params: { path: string[] } }) {
    return forward(request, context.params);
}

export async function PUT(request: Request, context: { params: { path: string[] } }) {
    return forward(request, context.params);
}

export async function PATCH(request: Request, context: { params: { path: string[] } }) {
    return forward(request, context.params);
}

export async function DELETE(request: Request, context: { params: { path: string[] } }) {
    return forward(request, context.params);
}
