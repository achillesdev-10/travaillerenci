import { cleanupFixtures } from './fixtures';

/**
 * GlobalTeardown Playwright : remet la base locale propre
 * (fixtures de test + comptes `e2e-*@test.ci`).
 */
export default async function globalTeardown(): Promise<void> {
  const result = cleanupFixtures();
  console.log(
    `🧹 [e2e] nettoyage : ${result.offers} offre(s) et ${result.users} compte(s) de test supprimé(s).`,
  );
}
