/**
 * Helper de autenticação para os testes E2E.
 * Faz login via UI e retorna a página logada.
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const TEST_EMAIL = process.env['TEST_EMAIL'] ?? 'guilhermemp.business@gmail.com';
const TEST_PASSWORD = process.env['TEST_PASSWORD'] ?? '***Orin@2026';

export async function loginAs(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Aguarda redirecionamento para o dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

export async function logout(page: Page) {
    // Botão de logout no sidebar ou menu do usuário
    const logoutBtn = page.locator('[data-testid="logout"], a[href*="logout"], button:has-text("Sair")');
    if (await logoutBtn.count() > 0) {
        await logoutBtn.first().click();
        await page.waitForURL(/\/login/, { timeout: 10_000 });
    }
}
