import { test, expect, type Page } from '@playwright/test';
import { registerCandidate, expectNoHorizontalOverflow, waitForHydration } from './helpers';

/**
 * §26 — Mobile first : 320 / 360 / 390 / 412 px, tablette et desktop.
 * Vérification : aucun débordement horizontal sur les pages clés.
 */

const VIEWPORTS = [
  { label: '320px', width: 320, height: 667 },
  { label: '360px', width: 360, height: 740 },
  { label: '390px', width: 390, height: 844 },
  { label: '412px', width: 412, height: 915 },
  { label: 'tablette', width: 768, height: 1024 },
  { label: 'desktop', width: 1280, height: 800 },
];

const PUBLIC_PAGES = ['/', '/jobs', '/stages', '/blog', '/login', '/register', '/generateur-de-cv'];

async function gotoAndAssertNoOverflow(page: Page, path: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await expectNoHorizontalOverflow(page);
}

test.describe('Responsive (§26)', () => {
  for (const viewport of VIEWPORTS) {
    test(`pages publiques sans débordement — ${viewport.label}`, async ({ page }) => {
      // 7 pages à parcourir : le rendu serveur en dev est lent (FS réseau).
      test.setTimeout(180_000);
      for (const path of PUBLIC_PAGES) {
        await gotoAndAssertNoOverflow(page, path, viewport.width, viewport.height);
      }
    });
  }

  test("fiche d'offre sans débordement sur les 6 largeurs", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    const firstCard = page.locator('a[href^="/jobs/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });
    const offerUrl = (await firstCard.getAttribute('href'))!;

    for (const viewport of VIEWPORTS) {
      await gotoAndAssertNoOverflow(page, offerUrl, viewport.width, viewport.height);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    }
  });

  test('dashboard candidat sans débordement sur les 6 largeurs', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await registerCandidate(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/dashboard/candidate', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      await expect(page.locator('#profil')).toBeVisible({ timeout: 20_000 });
      await expectNoHorizontalOverflow(page);
    }
  });

  test('navigation mobile : menu hamburger atteignable à 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 667 });
    await waitForHydration(page, '/');

    const menuButton = page.getByRole('button', { name: 'Menu' }).first();
    await expect(menuButton).toBeVisible({ timeout: 20_000 });
    await menuButton.click();
    await expect(page.getByRole('link', { name: 'Connexion', exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expectNoHorizontalOverflow(page);
  });
});
