import { test, expect } from '@playwright/test';
import { registerCandidate } from './helpers';

/**
 * §36 — Profil candidat : utilisateur sans profil / profil incomplet /
 * profil complet, plus le consentement de visibilité (§30).
 */

test.describe('Profil candidat (§36)', () => {
  test.slow();

  test('profil absent puis incomplet : progression basse et appel à action', async ({
    page,
  }) => {
    await registerCandidate(page);

    const profileCard = page.locator('form', {
      has: page.getByRole('heading', { name: 'Mon profil candidat' }),
    });
    await expect(profileCard).toBeVisible({ timeout: 20_000 });

    // Compteur de complétion : un compte neuf est loin de 100 %.
    // La valeur n'arrive qu'après le chargement du profil côté serveur.
    const progress = page.getByRole('progressbar', { name: 'Complétion du profil' });
    await expect(progress).toBeVisible();
    await expect
      .poll(async () => Number(await progress.getAttribute('aria-valuenow')), { timeout: 20_000 })
      .toBeGreaterThan(0);
    const value = Number(await progress.getAttribute('aria-valuenow'));
    expect(value).toBeLessThan(100);

    await expect(page.getByText(/^Profil complété à \d+%$/)).toBeVisible();
    await expect(
      page.getByText('Complétez votre profil pour améliorer vos recommandations.'),
    ).toBeVisible();
  });

  test('profil complet : les 11 critères sont remplis à 100 %', async ({ page }) => {
    await registerCandidate(page);

    const profileCard = page.locator('form', {
      has: page.getByRole('heading', { name: 'Mon profil candidat' }),
    });
    await expect(profileCard).toBeVisible({ timeout: 20_000 });

    // Champs texte / selects.
    await profileCard.getByLabel('Métier recherché').fill('Développeur web');
    await profileCard.getByLabel('Ville').selectOption({ label: 'Abidjan' });
    await profileCard.getByLabel("Niveau d'expérience").selectOption({ index: 1 });
    await profileCard.getByLabel('Diplôme le plus élevé').selectOption({ index: 1 });
    await profileCard.getByLabel('Compétences').fill('React');
    await profileCard.getByLabel('Compétences').press('Enter');
    await profileCard.getByLabel('Compétences').fill('SQL');
    await profileCard.getByLabel('Compétences').press('Enter');
    await expect(profileCard.getByRole('button', { name: 'Retirer React' })).toBeVisible();
    await profileCard
      .getByLabel('Présentation professionnelle')
      .fill("Développeur web avec 5 ans d'expérience, à la recherche d'un CDI à Abidjan.");
    await profileCard.getByLabel('Téléphone WhatsApp').fill('2250700000000');
    await profileCard.getByLabel('Lien vers votre CV (facultatif)').fill('https://example.ci/cv.pdf');

    // Chips secteur + type de contrat (boutons aria-pressed).
    await profileCard.getByRole('button', { name: 'IT / Digital' }).click();
    await profileCard.getByRole('button', { name: 'CDI', exact: true }).click();

    // Consentement de visibilité (§30) : bouton toggle, pas une case à cocher.
    const recruitersToggle = profileCard.getByRole('button', {
      name: 'Visible par les recruteurs',
    });
    await recruitersToggle.click();
    await expect(recruitersToggle).toHaveAttribute('aria-pressed', 'true');

    // Enregistrement → badge « Enregistré » (transient) + PUT /api/candidate/profile.
    const saveButton = profileCard.getByRole('button', { name: 'Enregistrer mon profil' });
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/candidate/profile') && r.request().method() === 'PUT',
        { timeout: 20_000 },
      ),
      saveButton.click(),
    ]);
    expect(response.status()).toBeLessThan(400);
    await expect(profileCard.getByText('Enregistré')).toBeVisible({ timeout: 10_000 });

    // 100 % : tous les critères cochés, plus d'appel à action.
    const progress = page.getByRole('progressbar', { name: 'Complétion du profil' });
    await expect(progress).toHaveAttribute('aria-valuenow', '100', { timeout: 15_000 });
    await expect(
      page.getByText('Complétez votre profil pour améliorer vos recommandations.'),
    ).toBeHidden();

    // Le consentement persiste après rechargement.
    await page.reload();
    const reloadedToggle = page.getByRole('button', { name: 'Visible par les recruteurs' });
    await expect(reloadedToggle).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
  });
});
