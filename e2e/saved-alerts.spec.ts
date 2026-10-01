import { test, expect } from '@playwright/test';
import { registerCandidate } from './helpers';

/**
 * §36 — Sauvegarde d'offre, suppression d'une sauvegarde,
 * création d'alerte et suppression d'alerte.
 */

test.describe('Sauvegardes et alertes (§36)', () => {
  // Parcours complet (inscription + 4 actions) : délai porté à 180 s.
  test.slow();

  test('sauvegarder une offre, la retirer, créer puis supprimer une alerte', async ({
    page,
  }) => {
    await registerCandidate(page);

    // --- 1. Sauvegarde depuis la liste des offres ---
    await page.goto('/jobs');
    const firstCard = page.locator('a[href^="/jobs/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });
    const offerTitle = (await firstCard.locator('h3').first().innerText()).trim();

    const saveIcon = firstCard.getByRole('button', { name: 'Sauvegarder cette offre' });
    await expect(saveIcon).toBeEnabled({ timeout: 15_000 });
    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/saved') && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      saveIcon.click(),
    ]);
    expect(saveResponse.status()).toBeLessThan(400);

    // --- 2. La sauvegarde apparaît sur le dashboard ---
    await page.goto('/dashboard/candidate');
    const savedRegion = page.getByRole('region', { name: 'Mes offres sauvegardées' });
    await expect(savedRegion).toBeVisible({ timeout: 20_000 });
    await expect(savedRegion.getByText('1 sauvegarde')).toBeVisible({ timeout: 20_000 });
    await expect(savedRegion.getByText(offerTitle).first()).toBeVisible({ timeout: 20_000 });

    // --- 3. Suppression de la sauvegarde ---
    const removeButton = savedRegion.getByRole('button', {
      name: /^Retirer .+ des sauvegardes$/,
    });
    const [deleteResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/saved') && r.request().method() === 'DELETE',
        { timeout: 20_000 },
      ),
      removeButton.click(),
    ]);
    expect(deleteResponse.status()).toBeLessThan(400);
    await expect(
      savedRegion.getByText(/Cliquez sur l'étoile d'une offre/),
    ).toBeVisible({ timeout: 20_000 });

    // --- 4. Création d'une alerte ---
    const alertsRegion = page.getByRole('region', { name: 'Mes alertes' });
    await expect(alertsRegion).toBeVisible({ timeout: 20_000 });
    await expect(alertsRegion.getByText('Aucune alerte pour le moment')).toBeVisible();

    const alertLabel = 'Alerte E2E Abidjan';
    await alertsRegion.getByPlaceholder('Ex. Offres IT à Abidjan').fill(alertLabel);

    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/alerts') && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      alertsRegion.getByRole('button', { name: 'Créer mon alerte' }).click(),
    ]);
    expect(createResponse.status()).toBeLessThan(400);

    await expect(alertsRegion.getByText(alertLabel)).toBeVisible({ timeout: 20_000 });
    await expect(alertsRegion.getByText('Active', { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    // --- 5. Suppression de l'alerte ---
    const [removeAlertResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/alerts') && r.request().method() === 'DELETE',
        { timeout: 20_000 },
      ),
      alertsRegion.getByRole('button', { name: `Supprimer l'alerte ${alertLabel}` }).click(),
    ]);
    expect(removeAlertResponse.status()).toBeLessThan(400);
    await expect(alertsRegion.getByText('Aucune alerte pour le moment')).toBeVisible({
      timeout: 20_000,
    });
  });
});
