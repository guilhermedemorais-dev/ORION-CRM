/**
 * ORION CRM — Testes de Autenticação
 *
 * Verifica login, proteção de rotas e logout.
 */
import { test, expect } from '@playwright/test';

test.describe('Página de Login', () => {
    test('Exibe formulário de login', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('Mostra erro com credenciais inválidas', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="email"]', 'invalido@teste.com');
        await page.fill('input[name="password"]', 'senhaerrada123');
        await page.click('button[type="submit"]');

        // Deve aparecer mensagem de erro (não redirecionar)
        await page.waitForURL(/\/login/);
        const errorText = page.locator('text=/inválid|incorret|não encontrad|error/i');
        await expect(errorText).toBeVisible({ timeout: 8_000 });
    });

    test('Toggle de senha funciona', async ({ page }) => {
        await page.goto('/login');
        const passwordInput = page.locator('input[name="password"]');
        const toggleBtn = page.locator('button[aria-label*="senha"], button:near(input[name="password"])').first();

        await expect(passwordInput).toHaveAttribute('type', 'password');

        if (await toggleBtn.count() > 0) {
            await toggleBtn.click();
            await expect(passwordInput).toHaveAttribute('type', 'text');
        }
    });

    test('Login com credenciais válidas redireciona para dashboard', async ({ page }) => {
        const email = process.env['TEST_EMAIL'] ?? 'guilhermemp.business@gmail.com';
        const password = process.env['TEST_PASSWORD'] ?? '***Orin@2026';

        await page.goto('/login');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');

        await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('Rota protegida sem login redireciona para /login', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForURL(/\/login/);
        await expect(page).toHaveURL(/\/login/);
    });
});
