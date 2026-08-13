/**
 *  TravaillerEnCi — src/services/social/utm.ts
 *  Construction des URLs de partage : URL exacte du contenu + paramètres UTM.
 *
 *  Règles :
 *   • L'URL de base pointe TOUJOURS vers la page exacte de l'opportunité
 *     (jamais vers la page d'accueil).
 *   • utm_source = plateforme, utm_medium = social, utm_campaign = catégorie.
 *   • Encodage correct des paramètres (ne casse jamais l'URL existante).
 */

import type { SocialContentType, SocialPlatform } from '@/types/social';

/** Encodage d'un segment de chemin (ID ou slug). */
function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

/** URL relative de la page d'un contenu publié sur TravaillerEnCi. */
export function contentPath(
  contentType: SocialContentType,
  content: { id: string; slug?: string | null },
): string {
  switch (contentType) {
    case 'scholarship':
      return `/bourses/${encodeSegment(content.id)}`;
    case 'exam':
      return content.slug
        ? `/concours/${encodeSegment(content.slug)}`
        : `/concours/${encodeSegment(content.id)}`;
    case 'internship':
    case 'job':
    default:
      return `/jobs/${encodeSegment(content.id)}`;
  }
}

/**
 * URL finale de partage (chemin exact + UTM).
 * Exemple : /jobs/abc?utm_source=facebook&utm_medium=social&utm_campaign=job
 */
export function buildShareUrl(
  baseUrl: string,
  contentType: SocialContentType,
  content: { id: string; slug?: string | null },
  platform: SocialPlatform,
): string {
  const path = contentPath(contentType, content);
  const params = new URLSearchParams({
    utm_source: platform,
    utm_medium: 'social',
    utm_campaign: contentType,
  });
  return `${baseUrl}${path}?${params.toString()}`;
}
