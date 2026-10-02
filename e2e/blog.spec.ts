import { test, expect } from '@playwright/test';
import { waitForHydration } from './helpers';

/**
 * §36 — Blog : liste des articles, fiche article, liens internes.
 */

test.describe('Blog (§36)', () => {
  test('la liste des articles est rendue', async ({ page }) => {
    await waitForHydration(page, '/blog');

    await expect(page.getByRole('heading', { level: 1, name: 'Conseils & actualités' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/articles? publiés?/)).toBeVisible({ timeout: 20_000 });

    const firstArticle = page.locator('a[href^="/blog/"]').first();
    await expect(firstArticle).toBeVisible({ timeout: 20_000 });
    await expect(firstArticle.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(firstArticle).toContainText("Lire l'article");
  });

  test('un article s’ouvre avec titre, date et articles liés', async ({ page }) => {
    await waitForHydration(page, '/blog');
    const firstArticle = page.locator('a[href^="/blog/"]').first();
    await expect(firstArticle).toBeVisible({ timeout: 20_000 });
    const title = (await firstArticle.getByRole('heading', { level: 2 }).innerText()).trim();

    await firstArticle.click();
    await expect(page).toHaveURL(/\/blog\/[^/]+$/, { timeout: 20_000 });

    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Publié le/)).toBeVisible({ timeout: 20_000 });

    // §15 — partage natif sur l'article de blog.
    await expect(page.getByRole('link', { name: 'Partager sur Facebook' })).toHaveAttribute(
      'data-share',
      'article-blog',
    );

    // Liens internes (offres + autres articles).
    await expect(page.getByRole('heading', { name: 'À lire aussi' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('link', { name: /Voir les offres|Créer mon CV/ }).first()).toBeVisible({
      timeout: 20_000,
    });

    // §13 — canonique + données structurées BlogPosting.
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toMatch(/\/blog\/[^/]+$/);
    const jsonLd = await page.locator('script[type="application/ld+json"]').allInnerTexts();
    expect(jsonLd.some((s) => s.includes('"BlogPosting"'))).toBe(true);
  });

  test('§17 : les étiquettes de l’article maillent la liste filtrée', async ({ page }) => {
    await waitForHydration(page, '/blog');
    await page.locator('a[href^="/blog/"]').first().click();
    await expect(page).toHaveURL(/\/blog\/[^/]+$/, { timeout: 20_000 });

    const tagLink = page.locator('a[href^="/blog?tag="]').first();
    await expect(tagLink).toBeVisible({ timeout: 20_000 });
    const tagHref = await tagLink.getAttribute('href');
    expect(tagHref).toMatch(/^\/blog\?tag=/);

    await tagLink.click();
    await expect(page).toHaveURL(/\/blog\?tag=/, { timeout: 20_000 });
    await expect(page.getByText(/Étiquette/).first()).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('link', { name: 'Voir tous les articles' }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
