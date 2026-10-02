import 'server-only';

/**
 *  TravaillerEnCi — src/lib/rateLimit.ts
 *  Limiteur de débit léger en mémoire (anti brute-force / anti-spam).
 *
 *  NB : en déploiement serverless multi-instances, chaque instance a son
 *  propre compteur — suffisant pour ralentir les attaques opportunistes, pas
 *  pour une protection distribuée stricte.
 */

const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_REQUESTS = 10;

const hits = new Map<string, number[]>();

/**
 * Multiplicateur de quota (finalement appliqué à `max`).
 *
 * - Jamais honoré en production : le quota dur reste celui du code.
 * - Utile en local (suite E2E) où toutes les requêtes partagent la même IP.
 */
function quotaMultiplier(): number {
  if (process.env.NODE_ENV === 'production') return 1;
  const raw = Number(process.env.RATE_LIMIT_MULTIPLIER);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 100) return Math.floor(raw);
  return 1;
}

/** Extrait une adresse IP depuis les en-têtes du proxy/Vercel. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function isRateLimited(
  key: string,
  max: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  const now = Date.now();
  const limit = Math.max(1, Math.floor(max * quotaMultiplier()));
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);

  if (list.length >= limit) {
    hits.set(key, list);
    return true;
  }

  list.push(now);
  hits.set(key, list);

  // Nettoyage opportuniste : évite la croissance mémoire de la Map.
  if (hits.size > 1000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }

  return false;
}
