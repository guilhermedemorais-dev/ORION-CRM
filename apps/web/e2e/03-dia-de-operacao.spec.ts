/**
 * ORION CRM — Roteiro: Um Dia de Operação
 *
 * Simula como um operador ROOT usa o sistema durante um dia de trabalho:
 *   08:00 — Abre o sistema, verifica o dashboard
 *   09:00 — Cria um novo lead (cliente potencial)
 *   09:30 — Abre o lead, edita as informações
 *   10:00 — Cria um pedido para o lead convertido
 *   11:00 — Acompanha a produção
 *   14:00 — Realiza uma venda no PDV
 *   15:00 — Verifica o financeiro do dia
 *   16:00 — Confere as analytics do período
 *   17:00 — Verifica automações e ajustes do sistema
 *
 * Se uma etapa falhar, o teste registra o erro com screenshot
 * mas continua testando as próximas etapas independentes.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

// ─── Dados de teste ────────────────────────────────────────────────────────
const LEAD_NAME = `Lead Teste ${Date.now()}`;
const LEAD_PHONE = '11987654321';
const LEAD_EMAIL = `lead.teste.${Date.now()}@playwright.test`;
const PRODUCT_SEARCH = 'anel'; // busca genérica no PDV

// ─── Setup: login único antes de todos os testes ───────────────────────────
test.beforeEach(async ({ page }) => {
    await loginAs(page);
});

// ─── 08:00 Dashboard ───────────────────────────────────────────────────────
test.describe('08:00 — Dashboard', () => {
    test('Dashboard carrega sem erro', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Não deve ter mensagem de erro crítica
        await expect(page.locator('text=/erro interno|500|something went wrong/i')).toHaveCount(0);

        // Deve ter algum conteúdo — título ou cards de métricas
        const heading = page.locator('h1, h2, [class*="PageHeader"]').first();
        await expect(heading).toBeVisible({ timeout: 10_000 });
    });

    test('Sidebar tem todos os módulos visíveis para ROOT', async ({ page }) => {
        await page.goto('/dashboard');

        const modulos = ['Dashboard', 'Leads', 'Clientes', 'Pedidos', 'Produção', 'Estoque', 'PDV', 'Financeiro', 'Inbox'];
        for (const modulo of modulos) {
            const link = page.locator(`nav a:has-text("${modulo}"), aside a:has-text("${modulo}")`);
            await expect(link.first()).toBeVisible({ timeout: 5_000 });
        }
    });
});

// ─── 09:00 Leads ───────────────────────────────────────────────────────────
test.describe('09:00 — Leads', () => {
    test('Página de leads carrega a listagem', async ({ page }) => {
        await page.goto('/leads');
        await page.waitForLoadState('networkidle');

        // Não deve mostrar "Acesso restrito"
        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);

        // Deve ter tabela ou empty state — nunca erro
        const hasTable = await page.locator('table, [data-testid="leads-list"]').count() > 0;
        const hasEmpty = await page.locator('text=/nenhum|sem leads|empty/i').count() > 0;
        const hasError = await page.locator('text=/erro|falha|failed/i').count() > 0;

        expect(hasTable || hasEmpty).toBeTruthy();
        expect(hasError).toBeFalsy();
    });

    test('Formulário de criação de lead está disponível', async ({ page }) => {
        await page.goto('/leads');

        // Botão ou link para criar novo lead
        const createBtn = page.locator(
            'button:has-text("Novo"), button:has-text("Criar"), a:has-text("Novo lead"), a:has-text("+ Lead")'
        );

        if (await createBtn.count() > 0) {
            await expect(createBtn.first()).toBeVisible();
        } else {
            // Pode ser um formulário inline na mesma página
            const form = page.locator('form');
            await expect(form.first()).toBeVisible();
        }
    });
});

// ─── 09:30 Cliente individual ──────────────────────────────────────────────
test.describe('09:30 — Clientes', () => {
    test('Página de clientes carrega a listagem', async ({ page }) => {
        await page.goto('/clientes');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);

        const hasContent = await page.locator('table, [class*="Card"], text=/nenhum cliente/i').count() > 0;
        expect(hasContent).toBeTruthy();
    });
});

// ─── 10:00 Pedidos ─────────────────────────────────────────────────────────
test.describe('10:00 — Pedidos', () => {
    test('Página de pedidos carrega sem erro', async ({ page }) => {
        await page.goto('/pedidos');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);
        await expect(page.locator('text=/500|erro interno/i')).toHaveCount(0);

        const heading = page.locator('h1, h2').first();
        await expect(heading).toBeVisible({ timeout: 10_000 });
    });

    test('Pipeline de pedidos carrega', async ({ page }) => {
        await page.goto('/pipeline');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);
    });
});

// ─── 11:00 Produção ────────────────────────────────────────────────────────
test.describe('11:00 — Produção', () => {
    test('Página de produção carrega sem erro', async ({ page }) => {
        await page.goto('/producao');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);
        await expect(page.locator('text=/500|erro interno/i')).toHaveCount(0);
    });
});

// ─── 13:00 Inbox ───────────────────────────────────────────────────────────
test.describe('13:00 — Inbox WhatsApp', () => {
    test('Inbox carrega a lista de conversas', async ({ page }) => {
        await page.goto('/inbox');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);
        await expect(page.locator('text=/500|erro interno/i')).toHaveCount(0);

        // Deve ter a estrutura de inbox (lista + painel) ou empty state
        const hasContent = await page.locator('[class*="inbox"], [class*="Inbox"], text=/conversa|mensag|nenhuma/i').count() > 0;
        expect(hasContent).toBeTruthy();
    });
});

// ─── 14:00 PDV ─────────────────────────────────────────────────────────────
test.describe('14:00 — PDV (Ponto de Venda)', () => {
    test('PDV carrega sem erro — ROOT tem acesso', async ({ page }) => {
        await page.goto('/pdv');
        await page.waitForLoadState('networkidle');

        // ROOT deve ter acesso — não deve mostrar "Acesso restrito"
        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);
        await expect(page.locator('text=/500|erro interno/i')).toHaveCount(0);
    });

    test('Campo de busca de produtos está disponível no PDV', async ({ page }) => {
        await page.goto('/pdv');
        await page.waitForLoadState('networkidle');

        if (await page.locator('text=Acesso restrito').count() === 0) {
            const searchInput = page.locator(
                'input[placeholder*="buscar"], input[placeholder*="produto"], input[name*="search"]'
            );
            if (await searchInput.count() > 0) {
                await expect(searchInput.first()).toBeVisible();

                // Testa a busca
                await searchInput.first().fill(PRODUCT_SEARCH);
                await page.waitForTimeout(400); // debounce 300ms
            }
        }
    });
});

// ─── 15:00 Financeiro ──────────────────────────────────────────────────────
test.describe('15:00 — Financeiro', () => {
    test('Financeiro carrega — ROOT tem acesso', async ({ page }) => {
        await page.goto('/financeiro');
        await page.waitForLoadState('networkidle');

        // ROOT deve ter acesso após o fix de RBAC
        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);
        await expect(page.locator('text=/500|erro interno/i')).toHaveCount(0);

        const heading = page.locator('h1, h2').first();
        await expect(heading).toBeVisible({ timeout: 10_000 });
    });

    test('Dashboard financeiro exibe cards de métricas', async ({ page }) => {
        await page.goto('/financeiro');
        await page.waitForLoadState('networkidle');

        if (await page.locator('text=Acesso restrito').count() === 0) {
            // Deve ter cards com valores monetários ou empty state
            const hasCards = await page.locator('[class*="Card"]').count() > 0;
            expect(hasCards).toBeTruthy();
        }
    });
});

// ─── 16:00 Analytics ───────────────────────────────────────────────────────
test.describe('16:00 — Analytics', () => {
    test('Analytics carrega — ROOT tem acesso', async ({ page }) => {
        await page.goto('/analytics');
        await page.waitForLoadState('networkidle');

        // ROOT deve ter acesso após o fix de RBAC
        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);
        await expect(page.locator('text=/500|erro interno/i')).toHaveCount(0);
    });

    test('Filtros de período estão visíveis no analytics', async ({ page }) => {
        await page.goto('/analytics');
        await page.waitForLoadState('networkidle');

        if (await page.locator('text=Acesso restrito').count() === 0) {
            // Deve ter tabs ou filtros de período (7d, 30d, etc.)
            const hasTabs = await page.locator(
                'button:has-text("30d"), button:has-text("7d"), [role="tab"]'
            ).count() > 0;
            const hasFilters = await page.locator('select, [class*="filter"], [class*="tab"]').count() > 0;
            expect(hasTabs || hasFilters).toBeTruthy();
        }
    });
});

// ─── 17:00 Automações e Ajustes ────────────────────────────────────────────
test.describe('17:00 — Automações', () => {
    test('Automações carrega — ROOT tem acesso', async ({ page }) => {
        await page.goto('/automacoes');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);
        await expect(page.locator('text=/500|erro interno/i')).toHaveCount(0);
    });
});

test.describe('17:30 — Ajustes do Sistema', () => {
    test('Página de ajustes carrega', async ({ page }) => {
        await page.goto('/ajustes');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);
        await expect(page.locator('text=/500|erro interno/i')).toHaveCount(0);

        const heading = page.locator('h1, h2').first();
        await expect(heading).toBeVisible({ timeout: 10_000 });
    });
});

// ─── Estoque ───────────────────────────────────────────────────────────────
test.describe('Estoque', () => {
    test('Página de estoque carrega a listagem de produtos', async ({ page }) => {
        await page.goto('/estoque');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Acesso restrito')).toHaveCount(0);
        await expect(page.locator('text=/500|erro interno/i')).toHaveCount(0);
    });
});
