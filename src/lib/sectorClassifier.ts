/**
 *  TravaillerEnCi — src/lib/sectorClassifier.ts
 *
 *  Classification déterministe d'une offre dans un secteur / métier, à partir
 *  du titre et de la description. Aucune IA : comptage de mots-clés.
 *
 *  Vocabulaire unique : `SECTOR_KEYWORDS` (recommendationScoring.ts) — les
 *  slugs correspondent à `SECTORS` de src/lib/constants.ts.
 *
 *  Utilisé par :
 *    • le script de backfill `scripts/classify-job-sectors.ts` ;
 *    • (repli) les recommandations et les pages SEO quand `sector` est NULL.
 *
 *  Module PUR (aucun import serveur / Next) → testable directement.
 */

import { SECTOR_KEYWORDS, matchesKeyword, normalizeText } from '@/lib/recommendationScoring';

/** Slugs de secteurs valides (source unique : le dictionnaire de mots-clés). */
export const VALID_SECTOR_SLUGS: ReadonlySet<string> = new Set(Object.keys(SECTOR_KEYWORDS));

export interface ClassifiableOffer {
  title: string;
  description?: string | null;
}

export interface SectorMatch {
  /** Slug du secteur, ou null si aucun mot-clé ne correspond. */
  sector: string | null;
  /** Nombre de mots-clés distincts trouvés (indicateur de confiance). */
  score: number;
}

/**
 * Retourne le secteur le plus probable pour une offre, ou null si indéterminé.
 *
 * Règle : on compte les mots-clés distincts de chaque secteur présents dans
 * « titre + description ». Le secteur avec le plus de correspondances gagne.
 * À égalité, l'ordre de déclaration de `SECTOR_KEYWORDS` tranche (déterministe).
 *
 * Le titre pèse double (signal plus fiable que la description).
 */
export function classifyOffer(offer: ClassifiableOffer): SectorMatch {
  const titleHaystack = normalizeText(offer.title);
  const bodyHaystack = normalizeText(offer.description ?? '');
  if (!titleHaystack && !bodyHaystack) return { sector: null, score: 0 };

  let best: { sector: string; score: number } | null = null;

  for (const [slug, entry] of Object.entries(SECTOR_KEYWORDS)) {
    let score = 0;
    for (const keyword of entry.keywords) {
      const kw = normalizeText(keyword);
      if (!kw) continue;
      if (matchesKeyword(titleHaystack, kw)) score += 2;
      else if (matchesKeyword(bodyHaystack, kw)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { sector: slug, score };
    }
  }

  return best ? { sector: best.sector, score: best.score } : { sector: null, score: 0 };
}

/** Raccourci : slug de secteur, ou null. */
export function classifySector(offer: ClassifiableOffer): string | null {
  return classifyOffer(offer).sector;
}
