import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getApiBaseUrl(): string {
    return process.env.ORION_API_URL ?? 'http://localhost:4000/api/v1';
}

export async function GET(request: Request) {
    const session = getSession();

    if (!session?.accessToken) {
        return NextResponse.json(
            { message: 'Sessão expirada. Faça login novamente.' },
            { status: 401 }
        );
    }

    const url = new URL(request.url);
    const upstreamUrl = `${getApiBaseUrl()}/inbox/stream${url.search}`;

    let response: Response;

    try {
        response = await fetch(upstreamUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${session.accessToken}`,
                Accept: 'text/event-stream',
            },
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ message: 'Falha ao conectar com a API.' }, { status: 503 });
    }

    if (!response.body) {
        return NextResponse.json({ message: 'Stream indisponível.' }, { status: 503 });
    }

    return new NextResponse(response.body, {
        status: response.status,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
