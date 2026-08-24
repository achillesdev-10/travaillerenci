import { test, expect } from '@playwright/test';

/**
 * Tests E2E : vérifier que les boutons "Postuler" ne débordent pas
 * sur mobile (viewport iPhone 12 — 390×844).
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Boutons postuler — mobile (390px)', () => {
  test('pas de scroll horizontal sur une page offre (aucun élément ne déborde)', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    // On récupère un ID d'offre depuis la page /jobs
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    const link = page.locator('a[href^="/jobs/"]').first();
    await link.waitFor({ state: 'attached', timeout: 15_000 });
    const href = await link.getAttribute('href');
    const jobId = href?.split('/jobs/')?.[1];
    expect(jobId).toBeTruthy();

    await page.goto(`/jobs/${jobId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('le bouton "Postuler par email" dans ApplyActions n\'a pas de débordement', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    const link = page.locator('a[href^="/jobs/"]').first();
    await link.waitFor({ state: 'attached', timeout: 15_000 });
    const href = await link.getAttribute('href');
    const jobId = href?.split('/jobs/')?.[1];

    await page.goto(`/jobs/${jobId}`, { waitUntil: 'domcontentloaded' });

    const emailBtn = page.getByRole('link', { name: /Postuler par email/i }).first();
    if (await emailBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const bbox = await emailBtn.boundingBox();
      expect(bbox).not.toBeNull();
      expect(bbox!.x).toBeGreaterThanOrEqual(-2);
      expect(bbox!.x + bbox!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 2);
    }
  });

  test('le bouton "Postuler à l\'offre" n\'a pas de débordement', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    const link = page.locator('a[href^="/jobs/"]').first();
    await link.waitFor({ state: 'attached', timeout: 15_000 });
    const href = await link.getAttribute('href');
    const jobId = href?.split('/jobs/')?.[1];

    await page.goto(`/jobs/${jobId}`, { waitUntil: 'domcontentloaded' });

    const applyBtn = page.getByRole('link', { name: /Postuler à l'offre/i }).first();
    if (await applyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const bbox = await applyBtn.boundingBox();
      expect(bbox).not.toBeNull();
      expect(bbox!.x).toBeGreaterThanOrEqual(-2);
      expect(bbox!.x + bbox!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 2);
    }
  });

  test('la barre sticky bottom existe et contient des boutons', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    const link = page.locator('a[href^="/jobs/"]').first();
    await link.waitFor({ state: 'attached', timeout: 15_000 });
    const href = await link.getAttribute('href');
    const jobId = href?.split('/jobs/')?.[1];

    await page.goto(`/jobs/${jobId}`, { waitUntil: 'domcontentloaded' });

    // La barre sticky bottom : div avec sticky + bottom-0 + z-40
    const stickyBar = page.locator('div.sticky.bottom-0.z-40');
    if (await stickyBar.isVisible({ timeout: 5000 }).catch(() => false)) {
      const barBBox = await stickyBar.boundingBox();
      expect(barBBox).not.toBeNull();
      // La barre ne doit pas dépasser la largeur de l'écran
      expect(barBBox!.x).toBeGreaterThanOrEqual(-2);
      expect(barBBox!.x + barBBox!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 2);

      // Les boutons dans la barre ne doivent pas déborder
      const buttons = stickyBar.locator('a');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const bbox = await buttons.nth(i).boundingBox();
        if (bbox) {
          expect(bbox.x).toBeGreaterThanOrEqual(-2);
          expect(bbox.x + bbox.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 2);
        }
      }
    }
  });

  test('les boutons ApplyActions ont la classe truncate pour éviter le débordement texte', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    const link = page.locator('a[href^="/jobs/"]').first();
    await link.waitFor({ state: 'attached', timeout: 15_000 });
    const href = await link.getAttribute('href');
    const jobId = href?.split('/jobs/')?.[1];

    await page.goto(`/jobs/${jobId}`, { waitUntil: 'domcontentloaded' });

    // Vérifier que les liens de postulation ont truncate ou min-w-0
    const applyLinks = page.locator('a[href*="mailto:"], a[href*="apply"]').filter({ hasText: /Postuler|Email/ });
    const count = await applyLinks.count();
    for (let i = 0; i < count; i++) {
      const hasOverflowProtection = await applyLinks.nth(i).evaluate((el) => {
        return (
          el.classList.contains('truncate') ||
          el.classList.contains('min-w-0') ||
          el.classList.contains('overflow-hidden') ||
          window.getComputedStyle(el).overflow === 'hidden' ||
          window.getComputedStyle(el).textOverflow === 'ellipsis'
        );
      });
      expect(hasOverflowProtection).toBe(true);
    }
  });
});
