import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

function getApiBaseUrl(): string {
    return process.env.ORION_API_URL ?? 'http://localhost:4000/api/v1';
}

async function forward(request: Request, params: { path: string[] }) {
    const session = getSession();

    if (!session) {
        return NextResponse.json({ message: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    if (!params.path.length) {
        return NextResponse.json({ message: 'Rota inválida.' }, { status: 400 });
    }

    const url = new URL(request.url);
    const backendUrl = `${getApiBaseUrl()}/${params.path.join('/')}${url.search}`;

    const headers = new Headers();
    headers.set('Authorization', `Bearer ${session.accessToken}`);

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
