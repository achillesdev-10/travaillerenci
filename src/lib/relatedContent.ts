/**
 *  TravaillerEnCi — src/lib/relatedContent.ts
 *
 *  Liens contextuels entre contenus (master prompt §16) :
 *    ARTICLE → OFFRE  et  OFFRE → ARTICLE.
 *
 *  Le rapprochement est déterministe : le secteur est déduit du titre, du
 *  résumé et des étiquettes via le classifieur de mots-clés existant
 *  (`sectorClassifier`) — aucune IA, aucun coût.
 *
 *  Module PUR → testable directement.
 */

import { classifySector } from '@/lib/sectorClassifier';

export interface ClassifiableArticle {
  title: string;
  excerpt?: string | null;
  tags?: string | null;
}

/** Secteur le plus probable d'un article (titre + résumé + étiquettes). */
export function articleSector(article: ClassifiableArticle): string | null {
  const haystack = [article.excerpt ?? '', article.tags ?? ''].filter(Boolean).join(' ');
  return classifySector({ title: article.title, description: haystack });
}

/**
 * Articles pertinents pour un secteur donné, les plus récents d'abord
 * (l'appelant trie). Déterministe : même entrée → même sortie.
 */
export function pickRelatedArticles<T extends ClassifiableArticle>(
  articles: T[],
  sector: string | null | undefined,
  limit = 2,
): T[] {
  if (!sector || limit <= 0) return [];
  return articles.filter((article) => articleSector(article) === sector).slice(0, limit);
}
