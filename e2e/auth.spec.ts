import { test, expect } from '@playwright/test';
import { registerCandidate, login, logout, waitForHydration } from './helpers';

/**
 * §36 — Tests automatisés : inscription, connexion, déconnexion,
 * utilisateur connecté et non connecté.
 */

test.describe('Authentification (§36)', () => {
  test("utilisateur non connecté : /dashboard redirige vers la connexion", async ({ page }) => {
    await page.goto('/dashboard/candidate');

    await expect(page).toHaveURL(/\/login\?next=/, { timeout: 20_000 });

    // L'en-tête propose bien les entrées anonymes.
    await expect(page.getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: /S.inscrire/ })).toBeVisible();
  });

  test('inscription, déconnexion puis connexion', async ({ page }) => {
    // --- Inscription → session posée → dashboard candidat ---
    const account = await registerCandidate(page);

    await expect(page.getByRole('heading', { level: 1, name: /Bonjour, .+ !/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('#profil')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mon Tableau de Bord' })).toBeVisible();

    // --- Déconnexion → retour accueil, état anonyme ---
    await logout(page);
    await expect(page.getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();

    // Une zone protégée reste inaccessible après déconnexion.
    await page.goto('/dashboard/candidate');
    await expect(page).toHaveURL(/\/login\?next=/, { timeout: 20_000 });

    // --- Re-connexion avec les mêmes identifiants ---
    await login(page, account.email, account.password);
    await expect(page).toHaveURL(/\/dashboard\/candidate/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1, name: /Bonjour, .+ !/ })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('identifiants invalides : message d’erreur, pas de session', async ({ page }) => {
    await waitForHydration(page, '/login');
    await page.getByPlaceholder('vous@exemple.ci').first().fill('e2e-inconnu@test.ci');
    await page.getByPlaceholder('••••••••').first().fill('MauvaisMotDePasse!1');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();

    await expect(page.getByText('Identifiants incorrects.')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
