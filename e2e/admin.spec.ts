import { test, expect } from '@playwright/test';

/**
 * §36 — Dashboard admin (/cz7tk) : protection, erreurs, accès.
 *
 * Identifiants : fallbacks de `src/lib/adminSession.ts`
 * (ADMIN_EMAIL / ADMIN_PASSWORD non définis dans .env.local, 2FA inactive).
 * ⚠️ Rate-limit : 5 tentatives / 15 min par IP — on reste à 2 tentatives.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'achillesdev10@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';

test.describe('Dashboard admin (§36)', () => {
  test('anonyme : /cz7tk redirige vers la connexion admin', async ({ page }) => {
    await page.goto('/cz7tk');
    await expect(page).toHaveURL(/\/cz7tk\/login/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Administration TravaillerenCi' })).toBeVisible({
      timeout: 20_000,
    });
    // L'API admin refuse les requêtes sans session.
    const api = await page.request.get('/api/admin/users');
    expect([401, 403]).toContain(api.status());
  });

  test('mauvais mot de passe puis accès au dashboard', async ({ page }) => {
    await page.goto('/cz7tk/login');

    // 1. Identifiants invalides (tentative 1/5 du rate-limit).
    await page.getByPlaceholder('email@exemple.com').fill(ADMIN_EMAIL);
    await page.getByPlaceholder('••••••••').fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Se connecter au Dashboard' }).click();
    await expect(page.getByText('Identifiants administrateur invalides.')).toBeVisible({
      timeout: 20_000,
    });

    // 2. Connexion correcte (tentative 2/5).
    await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter au Dashboard' }).click();

    await expect(page).toHaveURL(/\/cz7tk(\?|$)/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard des offres' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Offres actives')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Liste des offres' })).toBeVisible({
      timeout: 20_000,
    });
  });
});
