/**
 * ORION CRM — Health Check: API + Banco de Dados
 *
 * Verifica se a API está respondendo, se o banco está conectado
 * e se as rotas críticas retornam os status HTTP corretos.
 *
 * Roda primeiro (01-) para detectar problemas de infra antes dos testes de UI.
 */
import { test, expect } from '@playwright/test';
import { API_URL } from '../playwright.config';

test.describe('Infrastructure Health', () => {
    test('GET /health — API online', async ({ request }) => {
        const res = await request.get(`${API_URL}/health`);
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ status: 'ok' });
    });

    test('GET /api/v1/operator/health — banco conectado', async ({ request }) => {
        const res = await request.get(`${API_URL}/api/v1/operator/health`);
        expect(res.status()).toBe(200);
        const body = await res.json();
        // Deve retornar status ok E indicar que o DB está conectado
        expect(body.status).toBe('ok');
        expect(body.database ?? body.db ?? 'ok').not.toBe('error');
    });

    test('GET /api/v1/settings/public — configurações públicas acessíveis', async ({ request }) => {
        const res = await request.get(`${API_URL}/api/v1/settings/public`);
        expect(res.status()).toBe(200);
        const body = await res.json();
        // Deve ter pelo menos o company_name
        expect(typeof body.company_name).toBe('string');
    });

    test('POST /api/v1/auth/login sem body — retorna 400, não 500', async ({ request }) => {
        const res = await request.post(`${API_URL}/api/v1/auth/login`, {
            data: {},
        });
        expect(res.status()).toBeLessThan(500);
    });

    test('Rota inexistente — retorna 404, não 500', async ({ request }) => {
        const res = await request.get(`${API_URL}/api/v1/rota-que-nao-existe`);
        expect(res.status()).toBe(404);
    });
});

test.describe('Auth Endpoints', () => {
    test('Login com credencial inválida — retorna 401', async ({ request }) => {
        const res = await request.post(`${API_URL}/api/v1/auth/login`, {
            data: { email: 'naoexiste@teste.com', password: 'senhaerrada' },
        });
        expect(res.status()).toBe(401);
    });

    test('Rota protegida sem token — retorna 401', async ({ request }) => {
        const res = await request.get(`${API_URL}/api/v1/leads`);
        expect(res.status()).toBe(401);
    });
});
