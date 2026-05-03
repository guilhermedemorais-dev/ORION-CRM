import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
    const email = process.env['TEST_EMAIL'] ?? 'guilhermemp.business@gmail.com';
    const password = process.env['TEST_PASSWORD'] ?? '***Orin@2026';

    await page.goto('/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('Agenda layout', () => {
    test('keeps the page shell fixed while the calendar owns vertical scrolling', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await login(page);

        await page.goto('/agenda?view=week');
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByText('01:00')).toBeVisible();

        const metrics = await page.evaluate(() => {
            const main = document.querySelector('main');
            if (!main) {
                throw new Error('main element not found');
            }

            const rect = main.getBoundingClientRect();
            return {
                viewportHeight: window.innerHeight,
                mainBottom: rect.bottom,
                mainClientHeight: main.clientHeight,
                mainScrollHeight: main.scrollHeight,
            };
        });

        expect(metrics.mainBottom).toBeLessThanOrEqual(metrics.viewportHeight);
        expect(metrics.mainScrollHeight).toBeLessThanOrEqual(metrics.mainClientHeight + 1);
    });
});
