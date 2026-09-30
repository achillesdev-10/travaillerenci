/**
 *  TravaillerEnCi — src/lib/shareUtm.ts
 *
 *  Paramètres UTM ajoutés aux URLs partagées (master prompt §21) pour
 *  identifier le trafic provenant des partages WhatsApp / Facebook /
 *  LinkedIn / copie de lien.
 *
 *  Règles :
 *    • seules les URLs internes (même origine) sont taguées ;
 *    • une URL qui porte déjà un `utm_source` n'est jamais modifiée ;
 *    • le `utm_campaign` identifie le type d'objet partagé (offre, article…).
 *
 *  Module PUR (pas d'accès navigateur) → testable unitairement.
 */

export const SHARE_UTM_SOURCE = 'share';
export const SHARE_UTM_MEDIUM = 'link';

/** Normalise un identifiant de campagne : minuscules, [a-z0-9_-], 40 car. max. */
export function normalizeCampaign(campaign: string): string {
  return campaign
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Retourne l'URL de partage enrichie des paramètres UTM.
 *
 * @param url      URL à partager (absolue ou relative)
 * @param campaign identifiant de campagne (ex : « offre », « article-blog »)
 * @param base     origine du site (ex : window.location.origin) pour
 *                 résoudre les URLs relatives et comparer les origines
 */
export function buildShareUrl(url: string, campaign: string, base?: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url, base);
    // URLs externes : jamais de tracking imposé à des tiers.
    if (base) {
      const origin = new URL(base).origin;
      if (parsed.origin !== origin) return url;
    }
    if (parsed.searchParams.has('utm_source')) return url;
    const campaignSlug = normalizeCampaign(campaign) || 'contenu';
    parsed.searchParams.set('utm_source', SHARE_UTM_SOURCE);
    parsed.searchParams.set('utm_medium', SHARE_UTM_MEDIUM);
    parsed.searchParams.set('utm_campaign', campaignSlug);
    return parsed.toString();
  } catch {
    return url;
  }
}
