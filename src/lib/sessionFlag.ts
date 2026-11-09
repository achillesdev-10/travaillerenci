/**
 *  TravaillerEnCi — src/lib/sessionFlag.ts
 *
 *  Cookie indicateur NON sensible `te_session=1` : posé à la connexion,
 *  supprimé à la déconnexion, synchronisé avec le cookie de session
 *  httpOnly (lequel n'est jamais exposé au JavaScript).
 *
 *  Rôle : permettre au client (Header, useAuth, SaveButton…) de savoir en
 *  O(1) sans réseau qu'une session existe probablement, avant d'appeler
 *  /api/auth/me. Réduit les invocations anonymes de cette route.
 *
 *  Module pur, sans dépendance serveur : importable côté navigateur,
 *  middleware (Edge) et route handlers Node.
 */

/** Nom du cookie indicateur (valeur « 1 »). Jamais de donnée utilisateur dedans. */
export const SESSION_FLAG_COOKIE = 'te_session';

/** Durée du drapeau alignée sur la durée de la session utilisateur (30 jours). */
export const SESSION_FLAG_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Options du drapeau : lisible par le JS client (contrairement à la session). */
export const SESSION_FLAG_COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

/**
 * Vérifie (côté client uniquement) la présence du drapeau `te_session=1`
 * dans `document.cookie`. Retourne false hors navigateur.
 */
export function hasSessionFlagCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const jar = document.cookie;
  if (!jar) return false;
  return new RegExp(`(?:^|;\\s*)${SESSION_FLAG_COOKIE}=1(?:;|$)`).test(jar);
}
