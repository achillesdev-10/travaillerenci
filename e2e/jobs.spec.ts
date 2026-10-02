import { test, expect } from '@playwright/test';

/**
 * §36 — Offres : recherche, filtres, listing, fiche d'offre, état vide.
 * §36 — Pages SEO : stages, offres du jour, landing métier×ville, sitemap.
 */

test.describe('Recherche et filtres (§36)', () => {
  test('filtre ville puis contrat : URL + compteur « (filtrées) »', async ({ page }) => {
    await page.goto('/jobs');
    await expect(page.locator('#search-keyword')).toBeVisible({ timeout: 20_000 });

    // Filtre ville (appliqué au changement, debounce 350 ms + rendu serveur).
    await page.locator('#search-city').selectOption('Abidjan');
    await expect(page).toHaveURL(/city=Abidjan/, { timeout: 30_000 });
    await expect(
      page.getByRole('heading', { level: 2, name: /\d+ offres? trouvée?s? \(filtrées\)/ }),
    ).toBeVisible({ timeout: 20_000 });

    // Filtre contrat (soumission explicite).
    await page.locator('#search-contract').selectOption('CDI');
    await page.getByRole('search').getByRole('button', { name: /Rechercher/ }).click();
    await expect(page).toHaveURL(/contract=CDI/, { timeout: 30_000 });
    await expect(page).toHaveURL(/city=Abidjan/);
  });

  test('mot-clé : résultats ou état vide', async ({ page }) => {
    await page.goto('/jobs?q=zzzaucunresultatzzz');
    await expect(
      page.getByRole('heading', { level: 3, name: 'Aucune offre ne correspond à vos critères' }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Voir toutes les offres' })).toBeVisible();
  });
});

test.describe('Listing et fiche d’offre (§36)', () => {
  test('le listing affiche des offres cliquables vers la fiche', async ({ page }) => {
    await page.goto('/jobs');
    await expect(page.getByRole('heading', { level: 1, name: /Offres d'emploi/ })).toBeVisible({
      timeout: 20_000,
    });

    const firstCard = page.locator('a[href^="/jobs/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });
    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/^\/jobs\/[0-9a-f-]{36}$/);

    // Compteur de résultats cohérent.
    await expect(
      page.getByRole('heading', { level: 2, name: /\d+ offres? trouvée?s?/ }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('la fiche d’offre affiche titre, candidature et partages', async ({ page }) => {
    await page.goto('/jobs');
    const firstCard = page.locator('a[href^="/jobs/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });
    const title = (await firstCard.locator('h3').first().innerText()).trim();

    // Clic sur le titre : le centre de la carte est occupé par le bouton
    // « Sauvegarder cette offre » (imbriqué dans le lien), qui ne navigue pas.
    await firstCard.locator('h3').first().click();
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/, { timeout: 30_000 });

    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('a[data-apply]').first()).toBeVisible({ timeout: 20_000 });

    // §14/§15 — boutons de partage avec tracking.
    await expect(page.getByRole('link', { name: 'Partager sur Facebook' })).toHaveAttribute(
      'data-share',
      'offre',
    );
    await expect(page.getByRole('link', { name: 'Partager sur LinkedIn' })).toHaveAttribute(
      'data-share-network',
      'linkedin',
    );
    await expect(page.locator('a[data-share-network="whatsapp"]')).toContainText(
      'Partager sur WhatsApp',
    );
  });
});

test.describe('Pages SEO (§36)', () => {
  test('page /stages', async ({ page }) => {
    const response = await page.goto('/stages');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: /stage/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('page /jobs/today (offres fraîches)', async ({ page }) => {
    const response = await page.goto('/jobs/today');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  });

  test('landing SEO métier × ville : /emplois-informatique-abidjan', async ({ page }) => {
    const response = await page.goto('/emplois-informatique-abidjan');
    expect(response?.status()).toBe(200);

    const title = await page.title();
    expect(title).toContain('Informatique');
    expect(title).toContain('Abidjan');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    // La landing ne s'affiche que si le garde-fou anti-page-pauvre est satisfait.
    expect(await page.locator('a[href^="/jobs/"]').count()).toBeGreaterThan(0);
  });

  test('§12 : aucun chip de maillage villes/métiers ne pointe vers un 404', async ({ page }) => {
    test.setTimeout(240_000);
    const hrefs = new Set<string>();

    // Collecte des chips sur les deux verticales (22 liens par page).
    for (const url of ['/jobs', '/stages']) {
      await page.goto(url);
      await expect(page.locator('section[aria-label*="par métier"]').first()).toBeVisible({
        timeout: 20_000,
      });
      const links = page.locator('section[aria-label*="par métier"] a');
      const count = await links.count();
      expect(count, `${url} doit exposer les chips villes/métiers`).toBeGreaterThanOrEqual(20);
      for (let i = 0; i < count; i++) {
        const href = await links.nth(i).getAttribute('href');
        if (href) hrefs.add(href);
      }
    }

    expect(hrefs.size).toBeGreaterThanOrEqual(40);
    // Le test ne prouve quelque chose que si des landings SEO réelles sont proposées.
    expect([...hrefs].some((h) => /^\/(emplois|stages)-/.test(h))).toBe(true);

    // Chaque chip répond 200 : page SEO éligible OU recherche filtrée de repli.
    const list = [...hrefs];
    for (let i = 0; i < list.length; i += 8) {
      const batch = list.slice(i, i + 8);
      const statuses = await Promise.all(
        batch.map(async (href) => ({
          href,
          status: (await page.request.get(href)).status(),
        })),
      );
      for (const { href, status } of statuses) {
        expect(status, `${href} doit répondre 200 (pas de lien vers un 404)`).toBe(200);
      }
    }
  });

  test('sitemap.xml et robots.txt', async ({ page }) => {
    const sitemap = await page.request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain('<urlset');
    expect(xml).toContain('/jobs');

    const robots = await page.request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('Sitemap:');
  });
});
