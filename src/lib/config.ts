export interface DatabaseConfig {
  provider: 'supabase' | 'sqlite';
}

export function getDatabaseConfig(): DatabaseConfig {
  const provider = (process.env.NEXT_PUBLIC_DB_PROVIDER as 'supabase' | 'sqlite') || 'sqlite';
  return { provider };
}

/**
 * Vérification d'email par lien (envoi via Resend).
 *
 * DÉSACTIVÉE par défaut (EMAIL_VERIFICATION_ENABLED absent ou ≠ true) : le
 * compte est créé directement vérifié et utilisable immédiatement — aucune
 * dépendance à Resend, compatible avec le domaine Vercel actuel.
 *
 * RÉACTIVATION FUTURE : une fois le domaine personnalisé acheté et Resend
 * configuré (voir docs/EMAIL_DELIVERY.md), définir
 * `EMAIL_VERIFICATION_ENABLED=true` dans Vercel → Settings → Environment
 * Variables. L'inscription renverra alors un lien de confirmation par email
 * (createEmailVerificationToken + sendVerificationEmail dans /api/auth/register).
 */
export function isEmailVerificationEnabled(): boolean {
  const v = process.env.EMAIL_VERIFICATION_ENABLED;
  return v === 'true' || v === '1';
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
