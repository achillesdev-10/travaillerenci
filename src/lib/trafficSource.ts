/**
 *  TravaillerEnCi — src/lib/trafficSource.ts
 *
 *  Normalisation des « sources de trafic » affichées dans le tableau de bord
 *  administrateur (§23 « Sources de trafic »).
 *
 *  Une source est :
 *    • le paramètre `utm_source` de l'URL de la première visite, sinon ;
 *    • le domaine d'origine (`document.referrer`), sans `www.`, sinon ;
 *    • `direct` (visite tapée à la main / signet / sans referer).
 *  Une navigation interne est regroupée sous `interne`.
 *
 *  Module PUR (aucun import serveur / navigateur) : utilisable côté client
 *  (AnalyticsTracker) et côté serveur (routes, statistiques admin).
 */

/** Longueur maximale stockée pour une source. */
export const MAX_SOURCE_LENGTH = 60;

/** Source par défaut : arrivée sans referer ni UTM. */
export const DIRECT_SOURCE = 'direct';

/** Source d'une navigation provenant du même domaine. */
export const INTERNAL_SOURCE = 'interne';

/**
 * Normalise une source : espaces supprimés, longueur bornée, caractères
 * exotiques remplacés. Retourne `fallback` si le résultat est vide.
 */
export function normalizeSource(value: unknown, fallback = DIRECT_SOURCE): string {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!raw) return fallback;
  return raw.slice(0, MAX_SOURCE_LENGTH);
}

/**
 * Extrait le `utm_source` d'un chemin éventuellement suivi d'une query string
 * (ex : `/jobs?utm_source=facebook` → `facebook`). Retourne une chaîne vide
 * quand aucun paramètre n'est présent.
 */
export function sourceFromPath(pathWithQuery: string | null | undefined): string {
  const raw = String(pathWithQuery ?? '');
  const queryStart = raw.indexOf('?');
  if (queryStart === -1) return '';
  try {
    const params = new URLSearchParams(raw.slice(queryStart + 1));
    const utm = params.get('utm_source');
    return utm ? normalizeSource(utm, '') : '';
  } catch {
    return '';
  }
}

/**
 * Détermine la source d'une visite à partir de l'UTM, du referer et de
 * l'hôte courant. Les règles sont évaluées dans cet ordre.
 */
export function resolveTrafficSource(input: {
  utmSource?: string | null;
  referrer?: string | null;
  currentHost?: string | null;
}): string {
  const utm = input.utmSource ? normalizeSource(input.utmSource, '') : '';
  if (utm) return utm;

  const referrer = String(input.referrer ?? '').trim();
  if (!referrer) return DIRECT_SOURCE;

  let host = '';
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return DIRECT_SOURCE;
  }
  if (!host) return DIRECT_SOURCE;

  const current = String(input.currentHost ?? '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  if (current && host === current) return INTERNAL_SOURCE;

  return normalizeSource(host, DIRECT_SOURCE);
}
