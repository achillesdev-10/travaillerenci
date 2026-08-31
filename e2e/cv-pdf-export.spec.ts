import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Test E2E complet : téléchargement PDF du CV.
 *
 * Valide que :
 *  1. Le formulaire charge avec les données d'exemple
 *  2. Le clic sur "Télécharger mon CV (PDF)" ne génère aucune erreur JS
 *     (notamment pas d'erreur "unsupported color function")
 *  3. Un fichier PDF est bien téléchargé
 *  4. Le PDF n'est pas vide (> 10 Ko)
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

function runTest(viewport: { width: number; height: number }, label: string) {
  test.describe(`CV PDF export — ${label}`, () => {
    test('télécharge un PDF sans erreur console', async ({ page }) => {
      await page.setViewportSize(viewport);

      // Collecter toutes les erreurs JS (sauf CORS/réseau et hydration)
      const jsErrors: string[] = [];
      page.on('pageerror', (err) => jsErrors.push(err.message));

      // Collecter les erreurs de console (errors uniquement)
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto('/generateur-de-cv', { waitUntil: 'domcontentloaded' });

      // Attendre que le CV preview soit chargé
      await page.waitForSelector('#cv-preview', { state: 'attached', timeout: 15_000 });

      // Vérifier que les données d'exemple sont chargées (input du formulaire)
      await expect(page.locator('input[value*="KOUASSI"]')).toBeVisible({ timeout: 10_000 });

      // Configurer le téléchargement
      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });

      // Cliquer sur "Télécharger mon CV (PDF)"
      const downloadBtn = page.getByRole('button', { name: /Télécharger mon CV/i });
      await expect(downloadBtn).toBeEnabled();
      await downloadBtn.click();

      // Attendre le téléchargement
      const download = await downloadPromise;

      // Vérifier le nom du fichier
      expect(download.suggestedFilename()).toMatch(/^CV_.*\.pdf$/);

      // Sauvegarder le fichier pour vérification
      const downloadPath = path.join(__dirname, '..', 'test-results', download.suggestedFilename());
      await download.saveAs(downloadPath);

      // Vérifier que le PDF n'est pas vide (> 10 Ko = un PDF valide)
      const fileStats = fs.statSync(downloadPath);
      expect(fileStats.size).toBeGreaterThan(10_000);
      console.log(`✅ PDF téléchargé : ${download.suggestedFilename()} (${(fileStats.size / 1024).toFixed(1)} Ko)`);

      // Vérifier qu'aucune erreur critique n'a été générée
      const criticalErrors = jsErrors.filter(
        (e) =>
          !e.includes('fetch') &&
          !e.includes('CORS') &&
          !e.includes('network') &&
          !e.includes('hydrat') &&
          !e.includes('hydratation')
      );
      expect(criticalErrors).toHaveLength(0);

      // Vérifier spécifiquement l'absence d'erreur oklch/oklab
      const allErrors = [...jsErrors, ...consoleErrors].join('\n');
      expect(allErrors).not.toContain('oklch');
      expect(allErrors).not.toContain('oklab');
      expect(allErrors).not.toContain('unsupported color');
      expect(allErrors).not.toContain('color function');

      console.log('✅ Aucune erreur "unsupported color function" dans la console');
    });

    test('l\'état UI est correctement restauré après export', async ({ page }) => {
      await page.setViewportSize(viewport);

      page.on('pageerror', () => {});

      await page.goto('/generateur-de-cv', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#cv-preview', { state: 'attached', timeout: 15_000 });

      // Cliquer sur le bouton de téléchargement
      const downloadBtn = page.getByRole('button', { name: /Télécharger mon CV/i });

      // Attendre le téléchargement (nécessaire pour que l'export soit complet)
      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
      await downloadBtn.click();
      await downloadPromise;

      // Vérifier que le bouton est de nouveau activé
      await expect(downloadBtn).toBeEnabled({ timeout: 15_000 });

      // Sur mobile : onglet Éditer doit être actif après l'export
      if (viewport.width < 1024) {
        const editTab = page.getByRole('button', { name: /Éditer/ });
        await expect(editTab).toBeVisible();
        const cvPreview = page.locator('#cv-preview').first();
        await expect(cvPreview).not.toBeVisible();
      }

      console.log('✅ État UI restauré après export');
    });
  });
}

runTest(MOBILE_VIEWPORT, 'mobile (390px)');
runTest(DESKTOP_VIEWPORT, 'desktop (1280px)');
