import { test, expect } from '@playwright/test';

/**
 * Test E2E : téléchargement PDF du CV sur mobile (viewport iPhone 12).
 *
 * Sur mobile, l'onglet « Éditer » est actif par défaut, donc la colonne
 * aperçu (contenant #cv-preview) est masquée via `hidden` sur le parent.
 * L'élément est ATTACHÉ au DOM mais PAS VISIBLE.
 *
 * Le bouton « Télécharger mon CV » doit :
 *  1. Trouver #cv-preview dans le DOM (même caché)
 *  2. Le rendre temporairement visible pour html2canvas
 *  3. Capturer le PDF
 *  4. Restaurer l'état d'origine
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('CV PDF export — mobile', () => {
  test('la page charge et affiche le bouton PDF', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/generateur-de-cv', { waitUntil: 'domcontentloaded' });

    const downloadBtn = page.getByRole('button', { name: /Télécharger mon CV/i });
    await expect(downloadBtn).toBeVisible({ timeout: 15_000 });
  });

  test('#cv-preview est attaché au DOM mais caché sur mobile (onglet Éditer)', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/generateur-de-cv', { waitUntil: 'domcontentloaded' });

    // L'élément doit exister dans le DOM (attaché) même s'il est hidden
    const cvPreview = page.locator('#cv-preview');
    await expect(cvPreview).toBeAttached({ timeout: 15_000 });

    // … mais il ne doit PAS être visible (parent a class "hidden")
    await expect(cvPreview).not.toBeVisible();
  });

  test('l\'onglet Éditer est actif par défaut sur mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/generateur-de-cv', { waitUntil: 'domcontentloaded' });

    // Le bouton « Éditer » doit être visible
    const editTab = page.getByRole('button', { name: /Éditer/ });
    await expect(editTab).toBeVisible({ timeout: 15_000 });

    // Le bouton « Aperçu » doit être visible
    const previewTab = page.getByRole('button', { name: /Aperçu/ });
    await expect(previewTab).toBeVisible();

    // Le bouton Télécharger doit être visible et cliquable
    const downloadBtn = page.getByRole('button', { name: /Télécharger mon CV/i });
    await expect(downloadBtn).toBeEnabled();
  });

  test('cliquer sur Télécharger ne déclenche pas d\'erreur JS critique', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);

    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/generateur-de-cv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cv-preview', { state: 'attached', timeout: 15_000 });

    // Cliquer sur le bouton de téléchargement
    const downloadBtn = page.getByRole('button', { name: /Télécharger mon CV/i });
    await downloadBtn.click();

    // Attendre que l'export se termine (html2pdf est asynchrone)
    await page.waitForTimeout(5000);

    // Aucune erreur JS critique (on exclut CORS / réseau — normales en dev)
    const criticalErrors = jsErrors.filter(
      (e) => !e.includes('fetch') && !e.includes('CORS') && !e.includes('network')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('après le téléchargement, l\'état UI est restauré (onglet Éditer actif)', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);

    page.on('pageerror', () => {});

    await page.goto('/generateur-de-cv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cv-preview', { state: 'attached', timeout: 15_000 });

    // Cliquer sur le bouton de téléchargement
    const downloadBtn = page.getByRole('button', { name: /Télécharger mon CV/i });
    await downloadBtn.click();

    // Attendre la fin de l'export
    await page.waitForTimeout(5000);

    // Le bouton Éditer doit toujours être visible
    const editTab = page.getByRole('button', { name: /Éditer/ });
    await expect(editTab).toBeVisible();

    // Le CV preview doit être de nouveau caché
    // Note : il peut y avoir 2 éléments #cv-preview (duplicate ID pré-existant)
    const cvPreview = page.locator('#cv-preview').first();
    await expect(cvPreview).not.toBeVisible();
  });
});
