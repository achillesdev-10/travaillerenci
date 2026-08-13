/**
 *  TravaillerEnCi — src/lib/cronAuth.ts
 *  Sécurité des routes cron Vercel : refus de toute requête non autorisée.
 *
 *  Mécanisme recommandé par Vercel : en-tête `Authorization: Bearer <CRON_SECRET>`
 *  envoyé par Vercel Cron. La fonction est pure et testable.
 */

import type { NextRequest } from 'next/server';

/** Secret attendu (CRON_SECRET) — jamais exposé. */
export function getCronSecret(): string | null {
  return process.env.CRON_SECRET || null;
}

/**
 * Compare le secret fourni (en-tête Authorization Bearer) au CRON_SECRET.
 * Comparaison à temps constant pour éviter les attaques de timing.
 */
export function isCronAuthorized(request: NextRequest): boolean {
  const expected = getCronSecret();
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const provided = match[1].trim();
  return safeEqual(expected, provided);
}

/** Comparaison à temps constant. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Vrai si la route cron est activée (CRON_SECRET défini). */
export function isCronEnabled(): boolean {
  return Boolean(getCronSecret());
}
