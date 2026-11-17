import { test, expect, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForHydration } from './helpers';

/**
 * Tests E2E : panneau « Postuler » sur mobile (viewport iPhone 12 — 390×844).
 * On vérifie le CTA compact sticky, l'ouverture du panneau et l'absence de
 * débordement horizontal, y compris avec le panneau ouvert.
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function openFirstJob(page: Page): Promise<string> {
  await waitForHydration(page, '/jobs');
  const link = page.locator('a[href^="/jobs/"]').first();
  await link.waitFor({ state: 'attached', timeout: 15_000 });
  const href = await link.getAttribute('href');
  const jobId = href?.split('/jobs/')?.[1];
  expect(jobId).toBeTruthy();

  await waitForHydration(page, `/jobs/${jobId}`);
  return jobId!;
}

function mobileApplyBar(page: Page) {
  return page.locator('div.sticky.bottom-0.z-40');
}

function applyTrigger(page: Page) {
  return mobileApplyBar(page).getByRole('button', { name: /Postuler/i }).first();
}

async function openApplyPanel(page: Page) {
  const trigger = applyTrigger(page);
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Postuler à cette offre' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('Boutons postuler — mobile (390px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('pas de scroll horizontal sur une page offre (aucun élément ne déborde)', async ({ page }) => {
    await openFirstJob(page);
    await expectNoHorizontalOverflow(page);
  });

  // Plage Android demandée par l'audit : 360 à 430 px, panneau ouvert inclus.
  for (const width of [360, 430]) {
    test(`aucun débordement horizontal à ${width}px (panneau ouvert)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openFirstJob(page);
      await expectNoHorizontalOverflow(page);
      await openApplyPanel(page);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('le CTA compact « Postuler » reste dans l’écran', async ({ page }) => {
    await openFirstJob(page);

    const trigger = applyTrigger(page);
    await expect(trigger).toBeVisible();
    const bbox = await trigger.boundingBox();
    expect(bbox).not.toBeNull();
    expect(bbox!.x).toBeGreaterThanOrEqual(-2);
    expect(bbox!.x + bbox!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 2);
  });

  test('le panneau s’ouvre et propose les actions de candidature', async ({ page }) => {
    const jobId = await openFirstJob(page);
    const dialog = await openApplyPanel(page);

    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('TravaillerEnCi ne transmet pas votre candidature')).toBeVisible();

    const registerLink = dialog.getByRole('link', { name: /Créer mon compte/i });
    const registerHref = await registerLink.getAttribute('href');
    expect(registerHref).toBeTruthy();
    const next = new URL(registerHref!, 'http://localhost').searchParams.get('next');
    expect(next).toBe(`/jobs/${jobId}?postuler=1`);

    await expect(dialog.getByRole('link', { name: /J.ai déjà un compte/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Fermer/i })).toBeVisible();
  });

  test('la barre sticky contient des boutons sans débordement', async ({ page }) => {
    await openFirstJob(page);

    const bar = mobileApplyBar(page);
    await expect(bar).toBeVisible();
    const barBBox = await bar.boundingBox();
    expect(barBBox).not.toBeNull();
    expect(barBBox!.x).toBeGreaterThanOrEqual(-2);
    expect(barBBox!.x + barBBox!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 2);

    const buttons = bar.getByRole('button');
    expect(await buttons.count()).toBeGreaterThan(0);
    for (let i = 0; i < (await buttons.count()); i++) {
      const bbox = await buttons.nth(i).boundingBox();
      if (bbox) {
        expect(bbox.x).toBeGreaterThanOrEqual(-2);
        expect(bbox.x + bbox.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 2);
      }
    }
  });

  test('le panneau ouvert ne crée pas de débordement horizontal', async ({ page }) => {
    await openFirstJob(page);
    await openApplyPanel(page);
    await expectNoHorizontalOverflow(page);
  });

  test('un seul panneau s’ouvre au retour ?postuler=1', async ({ page }) => {
    const jobId = await openFirstJob(page);
    await waitForHydration(page, `/jobs/${jobId}?postuler=1`);

    await expect(page.getByRole('dialog', { name: 'Postuler à cette offre' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });
});
