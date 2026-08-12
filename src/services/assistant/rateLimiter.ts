/**
 *  TravaillerenCi — Assistant : limites d'utilisation
 *  Chemin : src/services/assistant/rateLimiter.ts
 *
 *  Limites configurables via variables d'environnement :
 *
 *    ASSISTANT_RATE_LIMIT_PER_MINUTE   (défaut 10)  — messages / minute / IP
 *    ASSISTANT_RATE_LIMIT_PER_HOUR     (défaut 30)  — messages / heure / IP
 *    ASSISTANT_RATE_LIMIT_PER_DAY      (défaut 100) — messages / jour / IP
 *    ASSISTANT_AI_RATE_LIMIT_PER_MINUTE (défaut 5)  — requêtes IA / minute / IP
 *    ASSISTANT_AI_RATE_LIMIT_PER_HOUR  (défaut 20)  — requêtes IA / heure / IP
 *    ASSISTANT_MAX_MESSAGE_LENGTH      (défaut 500) — longueur max d'un message
 *
 *  Réutilise le limiteur en mémoire existant (src/lib/rateLimit.ts), déjà
 *  utilisé par l'authentification — cohérent avec l'architecture du site.
 */

import { isRateLimited } from '@/lib/rateLimit';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Longueur maximale d'un message utilisateur. */
export function getMaxMessageLength(): number {
  return intFromEnv('ASSISTANT_MAX_MESSAGE_LENGTH', 500);
}

export interface AssistantLimitCheck {
  allowed: boolean;
  /** Message d'erreur utilisateur (en français, sans détails internes). */
  error?: string;
}

/** Vérifie les limites de messages (par IP). */
export function checkMessageLimits(ip: string): AssistantLimitCheck {
  const perMinute = intFromEnv('ASSISTANT_RATE_LIMIT_PER_MINUTE', 10);
  const perHour = intFromEnv('ASSISTANT_RATE_LIMIT_PER_HOUR', 30);
  const perDay = intFromEnv('ASSISTANT_RATE_LIMIT_PER_DAY', 100);

  const minuteKey = `assistant:msg:${ip}:min`;
  const hourKey = `assistant:msg:${ip}:hour`;
  const dayKey = `assistant:msg:${ip}:day`;

  if (isRateLimited(minuteKey, perMinute, MINUTE_MS)) {
    return {
      allowed: false,
      error: 'Vous envoyez trop de messages d\'un coup. Patientez un instant puis réessayez.',
    };
  }
  if (isRateLimited(hourKey, perHour, HOUR_MS)) {
    return {
      allowed: false,
      error: 'Vous avez atteint la limite horaire de messages. Réessayez plus tard.',
    };
  }
  if (isRateLimited(dayKey, perDay, DAY_MS)) {
    return {
      allowed: false,
      error: 'Vous avez atteint la limite journalière de messages. Réessayez demain.',
    };
  }
  return { allowed: true };
}

/** Vérifie les limites de requêtes IA (par IP). */
export function checkAiLimits(ip: string): AssistantLimitCheck {
  const perMinute = intFromEnv('ASSISTANT_AI_RATE_LIMIT_PER_MINUTE', 5);
  const perHour = intFromEnv('ASSISTANT_AI_RATE_LIMIT_PER_HOUR', 20);

  const minuteKey = `assistant:ai:${ip}:min`;
  const hourKey = `assistant:ai:${ip}:hour`;

  if (isRateLimited(minuteKey, perMinute, MINUTE_MS)) {
    return {
      allowed: false,
      error: 'Trop de demandes IA dans la minute. Réessayez dans quelques instants.',
    };
  }
  if (isRateLimited(hourKey, perHour, HOUR_MS)) {
    return {
      allowed: false,
      error: 'Vous avez atteint la limite horaire des réponses IA. Réessayez plus tard.',
    };
  }
  return { allowed: true };
}
