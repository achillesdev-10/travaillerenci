import { defineConfig, devices } from '@playwright/test';

/**
 * Tests E2E — Playwright (chatbot et autres widgets).
 *
 * Aucun navigateur Playwright n'est téléchargé : on pilote le Chrome système
 * via `channel: 'chrome'`. Sur une machine sans Chrome installé :
 *   npx playwright install chromium
 * puis retirer `channel: 'chrome'` ci-dessous.
 */
export default defineConfig({
  testDir: './e2e',
  // La spec production (chatbot.prod.spec.ts) a sa propre config
  // (playwright.prod.config.ts) : elle ne doit jamais tourner contre le
  // serveur de dev local ni contre l'API mockée.
  testIgnore: /prod\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Un seul worker : les lancements Chrome parallèles sont instables sous
  // Windows ; la suite est courte, la séquentialité est indolore.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Réutilise un serveur de dev déjà lancé, sinon en démarre un.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
