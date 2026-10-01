import { seedFixtures } from './fixtures';

/**
 * GlobalSetup Playwright : insère les fixtures locales (offres de test)
 * avant la suite E2E. Les fixtures sont supprimées par `global-teardown.ts`.
 */
export default async function globalSetup(): Promise<void> {
  const count = seedFixtures();
  console.log(`🌱 [e2e] ${count} offres de test insérées (source_url = e2e-fixture://).`);
}
