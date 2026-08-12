import { defineConfig, devices } from '@playwright/test';

/**
 * Tests E2E — Playwright contre le SITE DE PRODUCTION (travaillerenci.vercel.app).
 *
 * Suite « smoke » mobile : chatbot + pages clés, sur deux viewports mobiles :
 *   • mobile-portrait   (iPhone 14, 390×844) — comportement général ;
 *   • mobile-landscape  (844×390, écran bas) — le panneau ouvert ne doit
 *     jamais recouvrir le header sticky (il est démonté).
 *
 * Aucun serveur local n'est démarré (pas de webServer) : on teste le site
 * réellement déployé, API /api/assistant réelle comprise.
 *
 * Lancement :  npm run test:e2e:prod        (headless)
 *              npm run test:e2e:prod:headed  (navigateur visible)
 *
 * Le site de production peut être lent au premier accès (cold start Vercel) :
 * timeouts volontairement généreux. Comme pour la suite locale, on pilote le
 * Chrome système via `channel: 'chrome'`. Sur une machine sans Chrome :
 *   npx playwright install chromium
 * puis retirer `channel: 'chrome'`.
 *
 * ATTENTION : cette suite consomme une requête IA réelle (Gemini/Groq) et des
 * données de production. Le quota IA est limité à 5/min/IP — lancer la suite
 * en boucle peut déclencher une réponse « trop de messages » (tolérée par le
 * test). Les deux projets exécutent le MÊME fichier : la répartition des tests
 * se fait dans la spec via test.skip sur la hauteur du viewport (les projets
 * ont des viewports fixes) — ne pas « nettoyer » ces skips au risque de faire
 * tourner les deux moitiés dans chaque projet.
 */
export default defineConfig({
  testDir: './e2e',
  // Seule la spec dédiée production est exécutée (jamais la suite locale,
  // qui elle passe par le serveur de dev et une API mockée).
  testMatch: /chatbot\.prod\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Un seul worker : lancements Chrome parallèles instables sous Windows.
  workers: 1,
  forbidOnly: !!process.env.CI,
  // 1 retry : lisse les aléas réseau/AI propres à la production.
  retries: process.env.CI ? 2 : 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://travaillerenci.vercel.app',
    channel: 'chrome',
    headless: true,
    // Navigations lentes en prod (cold start Vercel, images externes).
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // Smartphone classique (390×844) : comportement général du chatbot.
      name: 'mobile-portrait',
      use: {
        ...devices['iPhone 14'],
        // Le descripteur iPhone pointe par défaut sur WebKit ; on force
        // Chromium pour utiliser le Chrome système (channel: 'chrome').
        defaultBrowserType: 'chromium',
      },
    },
    {
      // Paysage mobile / écran court (844×390) : même smartphone, viewport bas.
      name: 'mobile-landscape',
      use: {
        ...devices['iPhone 14'],
        defaultBrowserType: 'chromium',
        viewport: { width: 844, height: 390 },
      },
    },
  ],
});
