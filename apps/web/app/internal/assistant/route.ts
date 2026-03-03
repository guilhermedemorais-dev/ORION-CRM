import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

function getApiBaseUrl(): string {
    return process.env.ORION_API_URL ?? 'http://localhost:4000/api/v1';
}

export async function POST(request: Request) {
    const session = getSession();

    if (!session?.accessToken) {
        return NextResponse.json(
            { message: 'Sessão expirada. Faça login novamente.' },
            { status: 401 }
        );
    }

    const response = await fetch(`${getApiBaseUrl()}/assistant/chat`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: await request.text(),
    });

    const payload = await response.text();

    return new NextResponse(payload || '{}', {
        status: response.status,
        headers: {
            'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
        },
    });
}
