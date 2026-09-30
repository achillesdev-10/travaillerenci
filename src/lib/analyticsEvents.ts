/**
 *  TravaillerEnCi — src/lib/analyticsEvents.ts
 *
 *  Catalogue des événements mesurés (master prompt §22). Module PUR :
 *  aucune requête réseau ni accès BDD → testable directement.
 *
 *  Aucune donnée personnelle (email, téléphone, texte libre) n'est envoyée :
 *  seul un identifiant d'objet (ex : id d'offre) et un chemin sont enregistrés.
 */

export const ANALYTICS_EVENTS = [
  'job_view',
  'job_save',
  'job_unsave',
  'signup',
  'profile_complete',
  'cv_upload',
  'alert_create',
  'application_click',
  'search',
  'share',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/**
 * Événements à enregistrer UNE SEULE FOIS par utilisateur
 * (une inscription ne se produit jamais deux fois, un profil complété non plus).
 */
export const ONCE_PER_USER_EVENTS: ReadonlySet<string> = new Set([
  'signup',
  'profile_complete',
]);

/**
 * Seuil de complétion à partir duquel le profil est considéré comme
 * « complet » pour les recommandations et les alertes (% du module
 * profileCompletion.ts — 11 critères).
 */
export const PROFILE_COMPLETE_THRESHOLD = 70;

export function isAnalyticsEvent(value: unknown): value is AnalyticsEventName {
  return typeof value === 'string' && (ANALYTICS_EVENTS as readonly string[]).includes(value);
}
