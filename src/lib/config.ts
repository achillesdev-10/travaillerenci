export interface DatabaseConfig {
  provider: 'supabase' | 'sqlite';
}

export function getDatabaseConfig(): DatabaseConfig {
  const provider = (process.env.NEXT_PUBLIC_DB_PROVIDER as 'supabase' | 'sqlite') || 'sqlite';
  return { provider };
}

/**
 * Visibilité du bouton « Se connecter avec Google » côté UI.
 *
 * Le SSO Google est entièrement implémenté côté serveur (src/lib/googleOAuth.ts)
 * mais nécessite GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET. Tant que ces
 * credentials ne sont pas configurés, le bouton est MASQUÉ (option retenue :
 * on ne propose jamais une option qui échoue).
 *
 * Pour activer l'affichage : définir `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1` en
 * même temps que les credentials OAuth (variable publique, lue côté client).
 */
export function isGoogleAuthVisible(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === '1';
}
