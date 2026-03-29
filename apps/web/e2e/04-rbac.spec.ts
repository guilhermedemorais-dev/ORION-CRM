/**
 * ORION CRM — Testes de RBAC
 *
 * Verifica que o usuário ROOT tem acesso a TODOS os módulos.
 * Este teste valida o fix de 2e2bb6b (adicionar ROOT a todos os guards).
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const ROTAS_ROOT = [
    '/dashboard',
    '/leads',
    '/clientes',
    '/pedidos',
    '/producao',
    '/estoque',
    '/pdv',
    '/financeiro',
    '/analytics',
    '/automacoes',
    '/inbox',
    '/ajustes',
];

test.beforeEach(async ({ page }) => {
    await loginAs(page);
});

test.describe('ROOT — Acesso total ao sistema', () => {
    for (const rota of ROTAS_ROOT) {
        test(`${rota} — ROOT não vê "Acesso restrito"`, async ({ page }) => {
            await page.goto(rota);
            await page.waitForLoadState('networkidle');

            // A condição de falha é ver "Acesso restrito"
            const bloqueado = await page.locator('text=Acesso restrito').count();
            expect(bloqueado, `ROOT foi bloqueado em ${rota}`).toBe(0);

            // Também não deve ter erro 500
            const erro500 = await page.locator('text=/500|Application error|Internal Server Error/i').count();
            expect(erro500, `Erro 500 em ${rota}`).toBe(0);
        });
    }
});
