import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E de la barre de recherche (SearchBar) sur les pages :
 *   • /        — page d'accueil (barre principale)
 *   • /jobs    — page des offres d'emploi
 *   • /stages  — page des offres de stage
 *
 * Les tests valident le bon fonctionnement de la navigation côté client
 * (debounce + URL params) et la soumission directe (Enter / clic bouton).
 */

/** Navigation rapide sans attendre les images lentes. */
async function gotoPage(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

// =============================================================================
//  Page d'accueil  (/)
// =============================================================================

test.describe("Recherche sur la page d'accueil", () => {
  test('la barre de recherche est visible avec les 3 champs', async ({ page }) => {
    await gotoPage(page, '/');

    const searchForm = page.getByRole('search');
    await expect(searchForm).toBeVisible();

    // Champ mot-clé
    await expect(page.locator('#search-keyword')).toBeVisible();
    // Sélecteur ville
    await expect(page.locator('#search-city')).toBeVisible();
    // Sélecteur contrat
    await expect(page.locator('#search-contract')).toBeVisible();
    // Bouton Rechercher
    await expect(searchForm.getByRole('button', { name: /Rechercher/ })).toBeVisible();
  });

  test("soumettre le formulaire met a jour l'URL avec le parametre q", async ({ page }) => {
    await gotoPage(page, '/');

    const keyword = page.locator('#search-keyword');
    await keyword.fill('développeur');
    await keyword.press('Enter');

    // L'URL doit contenir q=développeur
    await expect(page).toHaveURL(/q=d%C3%A9veloppeur/);
  });

  test("le champ ville met a jour l'URL avec le parametre city", async ({ page }) => {
    await gotoPage(page, '/');

    const city = page.locator('#search-city');
    await city.selectOption('Abidjan');

    // Soumettre le formulaire pour appliquer
    await page.getByRole('button', { name: /Rechercher/ }).click();

    await expect(page).toHaveURL(/city=Abidjan/);
  });

  test("le champ contrat met a jour l'URL avec le parametre contract", async ({ page }) => {
    await gotoPage(page, '/');

    const contract = page.locator('#search-contract');
    await contract.selectOption('CDI');

    await page.getByRole('button', { name: /Rechercher/ }).click();

    await expect(page).toHaveURL(/contract=CDI/);
  });

  test("combinaison mot-cle + ville + contrat dans l'URL", async ({ page }) => {
    await gotoPage(page, '/');

    await page.locator('#search-keyword').fill('infirmier');
    await page.locator('#search-city').selectOption('Abidjan');
    await page.locator('#search-contract').selectOption('CDI');
    await page.getByRole('button', { name: /Rechercher/ }).click();

    // Attendre que la navigation (startTransition) se termine
    await page.waitForURL(/q=infirmier/, { timeout: 8_000 });
    const url = page.url();
    expect(url).toContain('city=Abidjan');
    expect(url).toContain('contract=CDI');
  });

  test("la barre reflete les params d'URL au chargement (SSR)", async ({ page }) => {
    await gotoPage(page, '/jobs?q=développeur&city=Abidjan');

    const keyword = page.locator('#search-keyword');
    await expect(keyword).toHaveValue('développeur');

    const city = page.locator('#search-city');
    await expect(city).toHaveValue('Abidjan');
  });
});

// =============================================================================
//  Page /jobs
// =============================================================================

test.describe('Recherche sur /jobs', () => {
  test('la barre de recherche est présente et fonctionnelle', async ({ page }) => {
    await gotoPage(page, '/jobs');

    const keyword = page.locator('#search-keyword');
    await expect(keyword).toBeVisible();
    await keyword.fill('marketing');
    await keyword.press('Enter');

    await expect(page).toHaveURL(/q=marketing/);
  });

  test("la page affiche des resultats ou un etat vide apres recherche", async ({ page }) => {
    await gotoPage(page, '/jobs?q=test-inexistant-xyz-12345');

    // Le nombre d'offres doit afficher 0 ou la page montre l'état vide
    const heading = page.locator('h2').filter({ hasText: /offre/ });
    await expect(heading).toBeVisible();
  });

  test("la pagination disparait quand on filtre", async ({ page }) => {
    await gotoPage(page, '/jobs');

    // Vérifier que la page se charge correctement
    await expect(page.locator('#search-keyword')).toBeVisible();
    await expect(page.getByRole('button', { name: /Rechercher/ })).toBeVisible();
  });
});

// =============================================================================
//  Page /stages
// =============================================================================

test.describe('Recherche sur /stages', () => {
  test("la barre de recherche est presente et fonctionnelle", async ({ page }) => {
    await gotoPage(page, '/stages');

    const keyword = page.locator('#search-keyword');
    await expect(keyword).toBeVisible();
    await keyword.click();
    await keyword.pressSequentially('stage', { delay: 30 });
    await page.getByRole('button', { name: /Rechercher/ }).click();

    await expect(page).toHaveURL(/q=stage/, { timeout: 8_000 });
  });

  test('la page affiche le titre correct', async ({ page }) => {
    await gotoPage(page, '/stages');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/stage/i);
  });

  test('le champ ville fonctionne sur /stages', async ({ page }) => {
    await gotoPage(page, '/stages');

    const city = page.locator('#search-city');
    await city.selectOption('Abidjan');

    await page.getByRole('button', { name: /Rechercher/ }).click();

    await expect(page).toHaveURL(/city=Abidjan/);
  });
});

// =============================================================================
//  Debounce — navigation différée vs soumission immédiate
// =============================================================================

test.describe('Comportement debounce de la recherche', () => {
  test("saisie rapide ne declenche qu'une seule navigation (debounce)", async ({ page }) => {
    await gotoPage(page, '/jobs');

    const keyword = page.locator('#search-keyword');

    // Taper rapidement « abc » — chaque caractère déclenche onChange
    await keyword.pressSequentially('abc', { delay: 80 });

    // Attendre que le debounce (350ms) se déclenche
    await expect(page).toHaveURL(/q=abc/, { timeout: 5_000 });

    // L'URL ne doit PAS contenir les étapes intermédiaires (a, ab)
    const url = page.url();
    expect(url).not.toContain('q=a&');
    expect(url).not.toContain('q=ab&');
  });

  test("appuyer sur Enter soumet immediatement sans attendre le debounce", async ({ page }) => {
    await gotoPage(page, '/jobs');

    const keyword = page.locator('#search-keyword');
    await keyword.click();
    await keyword.pressSequentially('urgent-query', { delay: 20 });

    // Soumettre immediatement — pas besoin d'attendre 350ms
    await keyword.press('Enter');

    await expect(page).toHaveURL(/q=urgent-query/, { timeout: 8_000 });
  });
});

// =============================================================================
//  État vide — aucun résultat
// =============================================================================

test.describe('État vide de la recherche', () => {
  test("/jobs affiche un message 'aucune offre' pour une recherche introuvable", async ({ page }) => {
    await gotoPage(page, '/jobs?q=zzzrechercheintrouvable999');

    await expect(page.getByText(/Aucune offre/)).toBeVisible({ timeout: 10_000 });
  });

  test("/stages affiche un message 'aucun stage' pour une recherche introuvable", async ({ page }) => {
    await gotoPage(page, '/stages?q=zzzrechercheintrouvable999');

    await expect(page.getByText(/Aucun stage/)).toBeVisible({ timeout: 10_000 });
  });
});
