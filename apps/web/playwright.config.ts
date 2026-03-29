import { defineConfig, devices } from '@playwright/test';

/**
 * ORION CRM — Playwright E2E Config
 *
 * Por padrão testa a URL de produção.
 * Para testar local: BASE_URL=http://localhost:3000 npx playwright test
 */
const BASE_URL = process.env['BASE_URL'] ?? 'https://crm.orinjoias.com';
const API_URL = process.env['API_URL'] ?? 'https://api.crm.orinjoias.com';

export { BASE_URL, API_URL };

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    retries: process.env['CI'] ? 2 : 0,
    workers: 1, // sequencial — evita conflito de dados no banco

    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ],

    use: {
        baseURL: BASE_URL,
        headless: true,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
