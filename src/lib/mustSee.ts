/**
 *  TravaillerEnCi — src/lib/mustSee.ts
 *
 *  Sélection des « offres à ne pas manquer » (master prompt §35).
 *
 *  Critères exclusivement gratuits et non commerciaux :
 *    • popularité  → nombre de consultations (`clicks_count`) ;
 *    • fraîcheur   → date de publication ;
 *    • urgence     → date limite de candidature proche.
 *
 *  Algorithme déterministe (aucune IA, aucun coût) → le même jeu de
 *  données produit toujours le même classement. Module PUR → testable.
 */

export const DAY_MS = 86_400_000;

export interface MustSeeOffer {
  id?: string;
  status?: string | null;
  /** Horodatage ISO de publication. */
  created_at?: string | null;
  /** Date limite de candidature (ISO), null si inconnue. */
  deadline?: string | null;
  /** Nombre de consultations de l'offre. */
  clicks_count?: number;
  is_archived?: boolean;
  is_expired?: boolean;
}

/** Raison pour laquelle une offre est mise en avant (affichée en badge). */
export type MustSeeReason = 'populaire' | 'recente' | 'deadline';

const RECENT_PUBLISHED_MS = 3 * DAY_MS;
const POPULAR_CLICKS = 20;
const DEADLINE_SOON_MS = 7 * DAY_MS;

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** Vrai si l'offre est éligible : publiée, active et encore postulable. */
export function isMustSeeEligible(offer: MustSeeOffer, now: Date = new Date()): boolean {
  if (offer.is_archived || offer.is_expired) return false;
  if (offer.status && offer.status !== 'published') return false;
  const published = parseTime(offer.created_at);
  if (published === null) return false;
  const deadline = parseTime(offer.deadline);
  // Deadline dépassée → l'offre n'est plus postulable, on ne la met pas en avant.
  if (deadline !== null && deadline < now.getTime()) return false;
  return true;
}

/**
 * Score déterministe (plus haut = plus prioritaire).
 * Détail des points : fraîcheur 40/30/20/10/4, popularité ≤ 30,
 * urgence de deadline 30/20/10, offre vérifiée +5.
 */
export function mustSeeScore(offer: MustSeeOffer, now: Date = new Date()): number {
  const published = parseTime(offer.created_at) ?? now.getTime();
  const age = Math.max(0, now.getTime() - published);

  let score = 0;
  if (age <= DAY_MS) score += 40;
  else if (age <= 3 * DAY_MS) score += 30;
  else if (age <= 7 * DAY_MS) score += 20;
  else if (age <= 30 * DAY_MS) score += 10;
  else score += 4;

  score += Math.min(Math.max(offer.clicks_count || 0, 0), 100) * 0.3;

  const deadline = parseTime(offer.deadline);
  if (deadline !== null) {
    const left = deadline - now.getTime();
    if (left >= 0 && left <= 3 * DAY_MS) score += 30;
    else if (left >= 0 && left <= 7 * DAY_MS) score += 20;
    else if (left >= 0 && left <= 14 * DAY_MS) score += 10;
  }

  return Math.round(score * 10) / 10;
}

/** Raisons d'affichage d'une offre (badges éditoriaux). */
export function mustSeeReasons(offer: MustSeeOffer, now: Date = new Date()): MustSeeReason[] {
  const reasons: MustSeeReason[] = [];
  const published = parseTime(offer.created_at);
  const deadline = parseTime(offer.deadline);

  if ((offer.clicks_count || 0) >= POPULAR_CLICKS) reasons.push('populaire');
  if (published !== null && now.getTime() - published <= RECENT_PUBLISHED_MS) reasons.push('recente');
  if (deadline !== null && deadline >= now.getTime() && deadline - now.getTime() <= DEADLINE_SOON_MS) {
    reasons.push('deadline');
  }
  return reasons;
}

export interface PickMustSeeOptions {
  now?: Date;
  limit?: number;
}

/**
 * Classe les offres éligibles et retourne les `limit` premières.
 * Ordre : score décroissant, puis publication décroissante, puis id.
 */
export function pickMustSeeOffers<T extends MustSeeOffer>(
  offers: T[],
  { now = new Date(), limit = 8 }: PickMustSeeOptions = {},
): T[] {
  return offers
    .filter((offer) => isMustSeeEligible(offer, now))
    .map((offer) => ({ offer, score: mustSeeScore(offer, now) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const pa = parseTime(a.offer.created_at) ?? 0;
      const pb = parseTime(b.offer.created_at) ?? 0;
      if (pb !== pa) return pb - pa;
      return String(a.offer.id || '').localeCompare(String(b.offer.id || ''));
    })
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.offer);
}

/**
 * Offres publiées dans les `hours` dernières heures, les plus récentes
 * d'abord. Exclut les offres archivées, expirées, non publiées et celles
 * dont la date limite de candidature est déjà passée.
 * Sert à la page « Offres du jour » (§34).
 */
export function filterRecentOffers<T extends MustSeeOffer>(
  offers: T[],
  hours: number,
  now: Date = new Date(),
): T[] {
  const since = now.getTime() - hours * 3_600_000;
  return offers
    .filter((offer) => {
      const published = parseTime(offer.created_at);
      if (published === null || published > now.getTime()) return false;
      if (published < since) return false;
      if (offer.is_archived || offer.is_expired) return false;
      if (offer.status && offer.status !== 'published') return false;
      const deadline = parseTime(offer.deadline);
      if (deadline !== null && deadline < now.getTime()) return false;
      return true;
    })
    .sort((a, b) => (parseTime(b.created_at) ?? 0) - (parseTime(a.created_at) ?? 0));
}
