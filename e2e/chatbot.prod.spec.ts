import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke E2E du chatbot + pages clés CONTRE LA PRODUCTION
 * (https://travaillerenci.vercel.app) en viewports mobiles.
 *
 * Contraste avec la suite locale (chatbot.spec.ts, API mockée) : ici l'API
 * /api/assistant est RÉELLE (IA Gemini/Groq + base Supabase). On vérifie que
 * le flux aboutit sans dépendre du contenu exact de la réponse (ni de son
 * succès : un repli d'erreur propre est aussi un résultat acceptable).
 *
 * Lancement : npm run test:e2e:prod
 *
 * Les tests sont répartis en deux groupes par viewport (via test.skip) :
 * les projets `mobile-portrait` (390×844) et `mobile-landscape` (844×390)
 * de playwright.prod.config.ts exécutent chacun leur moitié.
 */

/** Sélecteur du bouton flottant (title du bouton, stable dans le temps). */
const BUTTON = '[title="Assistant IA TravaillerenCi"]';
/** Rôle/aria-label du panneau de chat. */
const DIALOG = { name: 'Assistant TravaillerenCi' } as const;

/**
 * Contrat de la réponse acceptable : succès (résultats ou FAQ) OU repli
 * d'erreur propre (quota IA, réseau, erreur serveur). On ne dépend jamais du
 * succès de l'IA en production. NB : ce test consomme une requête IA réelle
 * (Gemini/Groq) — le quota (5/min/IP) peut renvoyer « trop de messages ».
 */
const PROD_REPLY_OR_ERROR =
  /trouvé|correspondant|aucune opportunité|Désolé|Une erreur est survenue|rencontre actuellement|trop de messages/;

/** Navigation allégée : l'événement `load` peut ne jamais arriver en prod
 * (ressources externes lentes) — standard pour l'E2E. */
async function gotoHome(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

test.describe('Chatbot mobile — production', () => {
  test.describe('Portrait 390×844 (smartphone standard)', () => {
    test.skip(
      ({ viewport }) => (viewport?.height ?? 0) < 500,
      'Réservé au viewport portrait',
    );

    test('bouton compact et panneau responsive (pas plein écran)', async ({ page }) => {
      await gotoHome(page);
      const button = page.locator(BUTTON);
      await expect(button).toBeVisible({ timeout: 30_000 });

      // Bouton : icône circulaire ~56 px, sans texte.
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(50);
      expect(box!.width).toBeLessThanOrEqual(62);
      expect(box!.height).toBeGreaterThanOrEqual(50);
      expect(box!.height).toBeLessThanOrEqual(62);

      await button.click();
      const dialog = page.getByRole('dialog', DIALOG);
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/trouver un emploi, un stage/)).toBeVisible();

      // Panneau : plafonné à 400 px, jamais bord à bord, hauteur maîtrisée.
      const db = await dialog.boundingBox();
      const vw = page.viewportSize()!.width;
      expect(db).not.toBeNull();
      expect(db!.width).toBeLessThanOrEqual(400);
      expect(db!.width).toBeLessThan(vw - 8); // marge ~20 px de chaque côté
      expect(db!.width).toBeGreaterThan(vw * 0.7);
      expect(db!.height).toBeLessThanOrEqual(560);
    });

    test('envoyer un message : le flux de chat aboutit en production', async ({ page }) => {
      await gotoHome(page);
      await page.locator(BUTTON).click();

      const input = page.getByRole('textbox', { name: 'Votre message' });
      await input.fill('Je cherche un stage à Abidjan');
      await input.press('Enter');

      // Bulle utilisateur immédiate (preuve que le message est parti).
      await expect(page.getByText('Je cherche un stage à Abidjan')).toBeVisible();

      // Le round-trip aboutit : une réponse de l'assistant est rendue dans le
      // panneau — texte de résultats, réponse FAQ, ou repli d'erreur propre
      // (réseau, quota IA, erreur serveur). On ne dépend pas du succès de l'IA.
      // NB : l'indicateur de saisie (points animés) et le bouton Envoyer ne
      // sont pas des signaux fiables : la réponse peut être quasi instantanée,
      // et le bouton reste désactivé après l'envoi (champ vidé).
      const dialog = page.getByRole('dialog', DIALOG);
      await expect(dialog.getByText(PROD_REPLY_OR_ERROR)).toBeVisible({
        timeout: 90_000,
      });
    });

    test('le widget se masque quand le footer est visible puis réapparaît', async ({ page }) => {
      await gotoHome(page);
      const button = page.locator(BUTTON);
      await expect(button).toBeVisible({ timeout: 30_000 });

      await button.click();
      const dialog = page.getByRole('dialog', DIALOG);
      await expect(dialog).toBeVisible();

      // Bas de page → bouton et panneau masqués (ne recouvrent pas le footer).
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(button).toHaveCSS('visibility', 'hidden');
      await expect(dialog).toBeHidden();

      // Remontée → le widget réapparaît.
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(button).toHaveCSS('visibility', 'visible');
      await expect(dialog).toBeVisible();
    });

    test('la page /stages se rend sans débordement horizontal', async ({ page }) => {
      await page.goto('/stages', { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /Offres de stage en Côte d'Ivoire/,
        }),
      ).toBeVisible({ timeout: 30_000 });
      // Pas de débordement horizontal (grille 2 colonnes sur mobile).
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });

  test.describe('Paysage court 844×390 (écran bas)', () => {
    test.skip(
      ({ viewport }) => (viewport?.height ?? 0) >= 500,
      'Réservé au viewport paysage court',
    );

    test('le panneau ouvert ne chevauche jamais le header sticky', async ({ page }) => {
      await gotoHome(page);
      const button = page.locator(BUTTON);
      await expect(button).toBeVisible({ timeout: 30_000 });

      // Chat fermé : le bouton seul (bord haut ≈ 390−76 = 314 px) reste sous
      // le header sticky — aucun chevauchement.
      const headerBottom = await page
        .locator('header')
        .evaluate((el) => el.getBoundingClientRect().bottom);
      const buttonTop = await button.evaluate((el) => el.getBoundingClientRect().top);
      expect(buttonTop).toBeGreaterThan(headerBottom);

      // Ouverture : le panneau (hauteur minimale 320 px, ancré à 84 px du bas)
      // remonterait sous le header. L'effet React recalcule le chevauchement :
      // le bouton se masque — c'est LA preuve que headerOverlap est passé à
      // true — et le panneau est alors démonté du DOM. On attend le masquage
      // du bouton d'abord (signal déterministe, pas de sleep arbitraire).
      await button.click();
      await expect(button).toHaveCSS('visibility', 'hidden', { timeout: 10_000 });
      await expect(page.getByRole('dialog', DIALOG)).toHaveCount(0);

      // Retour à un écran normal : `open` est resté true pendant le masquage,
      // donc le panneau réapparaît tout seul (pas besoin de re-cliquer — un
      // clic supplémentaire FERMERAIT le chat).
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(button).toHaveCSS('visibility', 'visible', { timeout: 10_000 });
      await expect(page.getByRole('dialog', DIALOG)).toBeVisible();
    });
  });
});
