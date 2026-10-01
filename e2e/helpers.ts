import { expect, type Page } from '@playwright/test';

/**
 * Helpers E2E partagés : inscription, connexion, déconnexion.
 *
 * Les comptes créés utilisent un email `e2e-*@test.ci` : ils sont supprimés
 * par `global-teardown.ts` en fin de suite.
 */

export const E2E_PASSWORD = 'E2ePass!2026';

/** Email unique (marqué `e2e-…@test.ci` pour le nettoyage). */
export function uniqueEmail(prefix = 'e2e'): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${rand}@test.ci`;
}

/** Attend que la page soit hydratée (le rendu statique seul ne déclenche pas les onSubmit). */
export async function waitForHydration(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
}

/** Inscription candidat via l'UI → session active + redirection dashboard. */
export async function registerCandidate(
  page: Page,
  name = 'Test E2E',
): Promise<{ email: string; password: string }> {
  const email = uniqueEmail();

  await waitForHydration(page, '/register');
  await page.getByPlaceholder('Koffi Kouadio').fill(name);
  await page.getByPlaceholder('vous@exemple.ci').first().fill(email);

  const passwords = page.getByPlaceholder('••••••••');
  await passwords.nth(0).fill(E2E_PASSWORD);
  await passwords.nth(1).fill(E2E_PASSWORD);

  await page.getByRole('button', { name: /S.inscrire/ }).click();
  await page.waitForURL('**/dashboard/candidate', { timeout: 30_000 });

  return { email, password: E2E_PASSWORD };
}

/** Connexion via l'UI. */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await waitForHydration(page, '/login');
  await page.getByPlaceholder('vous@exemple.ci').first().fill(email);
  await page.getByPlaceholder('••••••••').first().fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
}

/** Déconnexion via l'en-tête (bouton « Déconnexion »). */
export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Déconnexion' }).first().click();
  await page.waitForURL('/', { timeout: 20_000 });
}

/** Attends qu'une réponse API correspondante soit reçue pendant une action. */
export async function withResponse(
  page: Page,
  matcher: (url: string, method: string) => boolean,
  action: () => Promise<unknown>,
): Promise<{ status: number }> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => matcher(r.url(), r.request().method()),
      { timeout: 20_000 },
    ),
    action(),
  ]);
  return { status: response.status() };
}

/** Vérifie qu'une page n'a aucun débordement horizontal (§26). */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(
    metrics.scrollWidth,
    `Débordement horizontal : scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`,
  ).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
}
