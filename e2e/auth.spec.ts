import { test, expect } from '@playwright/test';
import {
  E2E_PASSWORD,
  login,
  logout,
  registerCandidate,
  uniqueEmail,
  waitForHydration,
} from './helpers';

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

  test('connecté : /register et /login renvoient vers le dashboard', async ({ page }) => {
    await registerCandidate(page);

    // 1. Plus de formulaire d'inscription pour un compte déjà connecté.
    await page.goto('/register');
    await expect(page).toHaveURL(/\/dashboard\/candidate/, { timeout: 20_000 });

    // 2. Idem pour la page de connexion.
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard\/candidate/, { timeout: 20_000 });

    // 3. API : création de compte bloquée même en contournant l'interface.
    const res = await page.request.post('/api/auth/register', {
      data: { email: 'e2e-deja-connecte@test.ci', name: 'Doublon', password: 'MotDePasse1!' },
    });
    expect(res.status()).toBe(409);

    // 4. Formulaire embarqué (page Candidats) → panneau « déjà connecté ».
    await page.goto('/candidates');
    await expect(page.getByTestId('register-already-authenticated')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'Créer un compte' })).toHaveCount(0);

    // 5. ?next= interne respecté, ?next= externe (open redirect) ignoré.
    await page.goto('/login?next=%2Fjobs%2Ftoday');
    await expect(page).toHaveURL(/\/jobs\/today/, { timeout: 20_000 });

    await page.goto('/login?next=%2F%2Fevil.example');
    await expect(page).toHaveURL(/\/dashboard\/candidate/, { timeout: 20_000 });
  });

  test("compte entreprise : /dashboard/candidate renvoie vers l'espace entreprise", async ({
    page,
  }) => {
    await waitForHydration(page, '/register');
    await page.getByRole('button', { name: /Entreprise/ }).click();
    await page.getByPlaceholder('MTN Côte d’Ivoire').fill('E2E SARL');
    await page.getByPlaceholder('vous@exemple.ci').first().fill(uniqueEmail('e2e-entreprise'));
    const passwords = page.getByPlaceholder('••••••••');
    await passwords.nth(0).fill(E2E_PASSWORD);
    await passwords.nth(1).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: /S.inscrire/ }).click();
    await page.waitForURL('**/dashboard/company', { timeout: 30_000 });

    // Un espace candidat n'est jamais servi à un compte entreprise.
    await page.goto('/dashboard/candidate');
    await expect(page).toHaveURL(/\/dashboard\/company/, { timeout: 20_000 });
  });
});
