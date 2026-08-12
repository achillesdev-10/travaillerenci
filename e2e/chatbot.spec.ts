import { test, expect, type Page } from '@playwright/test';
import type { AssistantResponse } from '@/services/assistant/types';

/**
 * Tests E2E du chatbot flottant (AssistantFloat).
 *
 * L'appel POST /api/assistant est simulé (`page.route`) pour rendre les tests
 * déterministes : aucune dépendance à la base de données ni aux API d'IA.
 */

/** Sélecteur du bouton flottant (title du bouton, stable dans le temps). */
const BUTTON = '[title="Assistant IA TravaillerenCi"]';

/** Réponse API simulée, conforme au type AssistantResponse. */
const MOCK_REPLY: AssistantResponse = {
  reply: {
    text: 'Voici quelques opportunités qui correspondent à votre recherche.',
    results: [
      {
        id: 'test-job-1',
        title: 'Développeur Web (Test)',
        subtitle: 'Entreprise Test CI',
        location: 'Abidjan - Plateau',
        meta: 'CDI · Publié récemment',
        url: '/jobs/test-job-1',
        category: 'job',
      },
    ],
    seeMoreUrl: '/jobs?q=emploi',
    aiUsed: true,
  },
};

/** Intercepte POST /api/assistant et renvoie la réponse simulée. */
async function mockAssistantApi(page: Page): Promise<void> {
  await page.route('**/api/assistant', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REPLY),
    }),
  );
}

/**
 * Navigation rapide : l'événement `load` peut ne jamais arriver (images
 * externes lentes), ce qui ferait échouer page.goto par défaut.
 */
async function gotoHome(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

test.beforeEach(async ({ page }) => {
  await mockAssistantApi(page);
});

test('le bouton flottant apparaît et ouvre le chat avec le message d’accueil', async ({ page }) => {
  await gotoHome(page);

  // Le bouton apparaît après ~2 s (ou au premier scroll).
  const button = page.locator(BUTTON);
  await expect(button).toBeVisible({ timeout: 10_000 });

  await button.click();

  const dialog = page.getByRole('dialog', { name: 'Assistant TravaillerenCi' });
  await expect(dialog).toBeVisible();
  // Message d'accueil ajouté à l'état (sans la phrase du bloc statique).
  await expect(dialog.getByText(/trouver un emploi, un stage/)).toBeVisible();
});

test('envoyer un message affiche la question, la réponse et une carte résultat', async ({ page }) => {
  await gotoHome(page);
  await page.locator(BUTTON).click();

  const input = page.getByRole('textbox', { name: 'Votre message' });
  await input.fill('Je cherche un emploi à Abidjan');
  await input.press('Enter');

  // Bulle utilisateur immédiate, puis réponse assistante (mockée).
  await expect(page.getByText('Je cherche un emploi à Abidjan')).toBeVisible();
  await expect(page.getByText(/Voici quelques opportunités/)).toBeVisible();
  await expect(page.getByText('Développeur Web (Test)')).toBeVisible();
  await expect(page.getByText(/Réponse assistée par IA/)).toBeVisible();
});

test('le widget se masque quand le footer est visible puis réapparaît', async ({ page }) => {
  await gotoHome(page);
  const button = page.locator(BUTTON);
  await expect(button).toBeVisible({ timeout: 10_000 });

  // Panneau ouvert : il doit lui aussi disparaître au niveau du footer.
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Assistant TravaillerenCi' });
  await expect(dialog).toBeVisible();

  // Bas de page → le footer entre à l'écran → bouton et panneau masqués.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(button).toHaveCSS('visibility', 'hidden');
  await expect(dialog).toBeHidden();

  // Remontée → le widget réapparaît.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(button).toHaveCSS('visibility', 'visible');
  await expect(dialog).toBeVisible();
});

test('l’historique survit au rechargement et « Effacer la discussion » le vide', async ({ page }) => {
  await gotoHome(page);
  await page.locator(BUTTON).click();

  const input = page.getByRole('textbox', { name: 'Votre message' });
  await input.fill('Conserver ce message après rechargement');
  await input.press('Enter');
  await expect(page.getByText(/Voici quelques opportunités/)).toBeVisible();

  // Rechargement : la conversation doit être restaurée depuis localStorage.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator(BUTTON)).toBeVisible({ timeout: 10_000 });
  await page.locator(BUTTON).click();
  await expect(page.getByText('Conserver ce message après rechargement')).toBeVisible();
  await expect(page.getByText(/Voici quelques opportunités/)).toBeVisible();

  // Effacement : retour au message d'accueil, historique supprimé.
  await page.getByRole('button', { name: 'Effacer la discussion' }).click();
  await expect(page.getByText('Conserver ce message après rechargement')).toBeHidden();
  await expect(page.getByText(/Que recherchez-vous \?/)).toBeVisible();
});
