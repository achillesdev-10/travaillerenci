/**
 *  TravaillerEnCi — src/lib/newsletter.ts
 *
 *  Architecture « newsletter / futures alertes email » (master prompt §20).
 *  Module PUR : validation, normalisation et constantes — aucun envoi
 *  n'est implémenté ici, seuls les champs nécessaires sont prévus.
 *
 *  Aucune donnée personnelle n'est produite par ce module : il ne fait que
 *  contrôler/normaliser ce que l'utilisateur a saisi.
 */

/** Longueur maximale d'une adresse email (RFC 5321). */
export const MAX_EMAIL_LENGTH = 254;

/**
 * Validation volontairement souple (une adresse « info+x@domaine.tld » doit
 * passer) : pas d'espace, un seul @, un domaine avec au moins un point.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Source d'inscription — permettra de savoir quels formulaires convertissent. */
export const NEWSLETTER_SOURCES = ['footer', 'contact', 'dashboard', 'inscription', 'autre'] as const;
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];
export const DEFAULT_NEWSLETTER_SOURCE: NewsletterSource = 'footer';

/**
 * Cycle de vie de l'abonné :
 *  - pending      : inscription enregistrée, confirmation (double opt-in) à venir
 *  - active       : abonné confirmé, recevra les envois
 *  - unsubscribed : désinscrit (ou lien de désinscription utilisé)
 *  - bounced      : adresse signalée comme invalide par le serveur de messagerie
 */
export const NEWSLETTER_STATUSES = ['pending', 'active', 'unsubscribed', 'bounced'] as const;
export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number];
export const DEFAULT_NEWSLETTER_STATUS: NewsletterStatus = 'pending';

/** Fréquence d'envoi prévue (champ conservé pour la future mise en place). */
export const NEWSLETTER_FREQUENCIES = ['hebdomadaire', 'mensuelle'] as const;
export type NewsletterFrequency = (typeof NEWSLETTER_FREQUENCIES)[number];
export const DEFAULT_NEWSLETTER_FREQUENCY: NewsletterFrequency = 'hebdomadaire';

/** Mention de consentement affichée au moment de l'inscription et stockée. */
export const NEWSLETTER_CONSENT_TEXT =
  "J'accepte de recevoir la newsletter TravaillerEnCi (offres, concours, bourses). " +
  'Je peux me désinscrire à tout moment en un clic.';

/** Désinscription en un clic : même mécanique que les alertes (§20 / RGPD). */
export const NEWSLETTER_UNSUBSCRIBE_LABEL = 'Désinscription de la newsletter TravaillerEnCi';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Nettoie une adresse : espaces superflus, casse réduite (unicité fiable). */
export function normalizeNewsletterEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);
}

/** Vrai si l'adresse normalisée est syntaxiquement valide. */
export function isValidNewsletterEmail(value: unknown): boolean {
  const email = normalizeNewsletterEmail(value);
  return email.length > 3 && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
}

/** Retombe sur la source par défaut si la valeur est inconnue. */
export function normalizeNewsletterSource(value: unknown): NewsletterSource {
  return typeof value === 'string' && (NEWSLETTER_SOURCES as readonly string[]).includes(value)
    ? (value as NewsletterSource)
    : DEFAULT_NEWSLETTER_SOURCE;
}

/** Retombe sur la fréquence par défaut si la valeur est inconnue. */
export function normalizeNewsletterFrequency(value: unknown): NewsletterFrequency {
  return typeof value === 'string' && (NEWSLETTER_FREQUENCIES as readonly string[]).includes(value)
    ? (value as NewsletterFrequency)
    : DEFAULT_NEWSLETTER_FREQUENCY;
}

/** Retombe sur « pending » si la valeur est inconnue (jamais « active » à tort). */
export function normalizeNewsletterStatus(value: unknown): NewsletterStatus {
  return typeof value === 'string' && (NEWSLETTER_STATUSES as readonly string[]).includes(value)
    ? (value as NewsletterStatus)
    : DEFAULT_NEWSLETTER_STATUS;
}

/** Vrai si l'abonné doit recevoir les prochains envois. */
export function isSendableNewsletterStatus(value: unknown): boolean {
  return normalizeNewsletterStatus(value) === 'active';
}

/**
 * Extrait les paramètres UTM d'une URL (champ d'origine du trafic, §21).
 * Retourne null si l'entrée n'est pas une URL ou n'en contient pas.
 */
export function extractUtmParams(value: unknown): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
} | null {
  if (!isRecord(value) && typeof value !== 'string') return null;
  let params: URLSearchParams;
  try {
    params =
      typeof value === 'string'
        ? new URL(value, 'https://placeholder.local').searchParams
        : new URLSearchParams(
            Object.entries(value)
              .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
              .map(([k, v]) => [k, v]),
          );
  } catch {
    return null;
  }
  const read = (key: string) => {
    const raw = params.get(key);
    if (!raw) return null;
    return raw.trim().slice(0, 80) || null;
  };
  const utm_source = read('utm_source');
  const utm_medium = read('utm_medium');
  const utm_campaign = read('utm_campaign');
  if (!utm_source && !utm_medium && !utm_campaign) return null;
  return { utm_source, utm_medium, utm_campaign };
}
