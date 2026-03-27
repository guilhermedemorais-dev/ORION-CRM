'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { setSession } from '@/lib/auth';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

export async function loginAction(formData: FormData) {
    const parsed = loginSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
    });

    if (!parsed.success) {
        redirect('/login?error=Verifique%20os%20campos%20informados.');
    }

    let response: Response;
    try {
        response = await fetch(`${process.env.ORION_API_URL ?? 'http://localhost:4000/api/v1'}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(parsed.data),
            cache: 'no-store',
        });
    } catch {
        redirect('/login?error=Servi%C3%A7o%20indispon%C3%ADvel.%20Tente%20novamente.');
    }

    let payload: {
        message?: string;
        accessToken?: string;
        session_timeout_minutes?: number;
        user?: {
            id: string;
            name: string;
            email: string;
            role: string;
        };
    };
    try {
        payload = await response.json() as typeof payload;
    } catch {
        redirect('/login?error=Erro%20ao%20processar%20resposta%20do%20servidor.');
    }

    if (!response.ok || !payload.accessToken || !payload.user) {
        const message = payload.message ?? 'Não foi possível autenticar.';
        redirect(`/login?error=${encodeURIComponent(message)}`);
    }

    const maxAgeSec = payload.session_timeout_minutes != null
        ? payload.session_timeout_minutes * 60
        : undefined;

    setSession({
        accessToken: payload.accessToken,
        user: payload.user,
    }, maxAgeSec);

    redirect('/dashboard');
}
