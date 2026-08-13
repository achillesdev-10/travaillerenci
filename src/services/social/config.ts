/**
 *  TravaillerEnCi — src/services/social/config.ts
 *  Configuration du système de distribution sociale.
 *
 *  Toutes les valeurs sont lues depuis les variables d'environnement
 *  (côté serveur uniquement — jamais exposées au navigateur).
 *
 *  Variables :
 *    FACEBOOK_APP_ID / FACEBOOK_APP_SECRET / FACEBOOK_PAGE_ID / FACEBOOK_ACCESS_TOKEN
 *    LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / LINKEDIN_ORGANIZATION_ID / LINKEDIN_ACCESS_TOKEN
 *    SOCIAL_FACEBOOK_DAILY_LIMIT (défaut 5)
 *    SOCIAL_LINKEDIN_DAILY_LIMIT (défaut 3)
 *    SOCIAL_MAX_RETRIES          (défaut 3)
 *    SOCIAL_PUBLISH_SLOTS        (défaut "09:00,11:30,14:00,16:30,18:30")
 *    SOCIAL_DRY_RUN              ("true" → aucune publication réelle)
 *    SOCIAL_AI_ENABLED           ("true" → amélioration IA optionnelle)
 *    CRON_SECRET                 (protection de la route cron)
 */

import type { SocialPlatform } from '@/types/social';

export const SOCIAL_TABLE = 'social_posts';

/** Défauts appliqués quand la variable d'env est absente. */
export const SOCIAL_DEFAULTS = {
  facebookDailyLimit: 5,
  linkedinDailyLimit: 3,
  maxRetries: 3,
  publishSlots: ['09:00', '11:30', '14:00', '16:30', '18:30'],
} as const;

export function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Limite quotidienne configurée pour une plateforme. */
export function getDailyLimit(platform: SocialPlatform): number {
  if (platform === 'facebook') {
    return parsePositiveInt(
      process.env.SOCIAL_FACEBOOK_DAILY_LIMIT,
      SOCIAL_DEFAULTS.facebookDailyLimit,
    );
  }
  return parsePositiveInt(
    process.env.SOCIAL_LINKEDIN_DAILY_LIMIT,
    SOCIAL_DEFAULTS.linkedinDailyLimit,
  );
}

/** Nombre maximal de tentatives avant passage en 'failed'. */
export function getMaxRetries(): number {
  return parsePositiveInt(process.env.SOCIAL_MAX_RETRIES, SOCIAL_DEFAULTS.maxRetries);
}

/**
 * Plateformes actives pour la publication AUTOMATIQUE.
 *
 * Focus actuel : FACEBOOK UNIQUEMENT. LinkedIn est désactivé de la file
 * d'attente (l'enfilement, la programmation et le worker ne traitent que
 * Facebook) tant que SOCIAL_LINKEDIN_ENABLED=true n'est pas défini — la Page
 * Organisation LinkedIn n'étant pas encore connectée. Les providers et le
 * diagnostic LinkedIn restent en place et s'activeront dès que la Page sera
 * disponible.
 */
export function getEnabledPlatforms(): SocialPlatform[] {
  const platforms: SocialPlatform[] = ['facebook'];
  const linkedinEnabled = process.env.SOCIAL_LINKEDIN_ENABLED;
  if (linkedinEnabled === 'true' || linkedinEnabled === '1') {
    platforms.push('linkedin');
  }
  return platforms;
}

/** Créneaux horaires de publication progressive ("HH:MM"). */
export function getPublishSlots(): string[] {
  const raw = process.env.SOCIAL_PUBLISH_SLOTS;
  if (!raw) return [...SOCIAL_DEFAULTS.publishSlots];
  const slots = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s));
  return slots.length > 0 ? slots : [...SOCIAL_DEFAULTS.publishSlots];
}

/** Mode dry-run : aucune publication réelle n'est envoyée. */
export function isSocialDryRun(): boolean {
  const v = process.env.SOCIAL_DRY_RUN;
  return v === 'true' || v === '1';
}

/** Amélioration IA optionnelle des textes (désactivée par défaut). */
export function isSocialAiEnabled(): boolean {
  const v = process.env.SOCIAL_AI_ENABLED;
  return v === 'true' || v === '1';
}

// -----------------------------------------------------------------------------
//  Connexions plateformes
// -----------------------------------------------------------------------------

export function getFacebookConfig() {
  return {
    appId: process.env.FACEBOOK_APP_ID || null,
    appSecret: process.env.FACEBOOK_APP_SECRET || null,
    pageId: process.env.FACEBOOK_PAGE_ID || null,
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN || null,
  };
}

/** Facebook est configuré si la Page et le token (longue durée) sont présents. */
export function isFacebookConfigured(): boolean {
  const { pageId, accessToken } = getFacebookConfig();
  return Boolean(pageId && accessToken);
}

export function getLinkedInConfig() {
  return {
    clientId: process.env.LINKEDIN_CLIENT_ID || null,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || null,
    organizationId: process.env.LINKEDIN_ORGANIZATION_ID || null,
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN || null,
  };
}

/**
 * LinkedIn est configuré UNIQUEMENT si une vraie Page Organisation est
 * renseignée (LINKEDIN_ORGANIZATION_ID) avec un token valide. Tant que le
 * profil fourni (linkedin.com/in/…) n'est pas une organisation, l'intégration
 * reste « Non configurée » — aucune supposition, aucun contournement.
 */
export function isLinkedInConfigured(): boolean {
  const { organizationId, accessToken } = getLinkedInConfig();
  return Boolean(organizationId && accessToken);
}

/** Résumé de configuration exposé à l'admin (jamais de secret). */
export function getSocialConfigSummary() {
  return {
    dryRun: isSocialDryRun(),
    facebookDailyLimit: getDailyLimit('facebook'),
    linkedinDailyLimit: getDailyLimit('linkedin'),
    maxRetries: getMaxRetries(),
    publishSlots: getPublishSlots(),
    aiEnabled: isSocialAiEnabled(),
    facebookConfigured: isFacebookConfigured(),
    linkedinConfigured: isLinkedInConfigured(),
  };
}
