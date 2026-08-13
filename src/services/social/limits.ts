/**
 *  TravaillerEnCi — src/services/social/limits.ts
 *  Limites quotidiennes + publication progressive (créneaux configurables).
 *
 *  Exemple : 20 contenus publiés le même jour ne sont PAS diffusés d'un coup :
 *  chaque tâche reçoit un créneau parmi SOCIAL_PUBLISH_SLOTS (09:00, 11:30…),
 *  sans dépasser la limite quotidienne de la plateforme. Le trop-plein est
 *  reporté aux créneaux des jours suivants.
 */

/** Créneaux d'un jour donné (Date locales, à l'heure du serveur). */
export function slotTimesForDay(day: Date, slots: string[]): Date[] {
  return slots.map((slot) => {
    const [h, m] = slot.split(':').map(Number);
    const d = new Date(day);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  });
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Prochain créneau strictement après `now` (aujourd'hui, sinon demain). */
export function nextSlotAfter(now: Date, slots: string[]): Date | null {
  if (slots.length === 0) return null;
  const today = slotTimesForDay(now, slots).filter((t) => t.getTime() > now.getTime());
  if (today.length > 0) return today[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return slotTimesForDay(tomorrow, slots)[0];
}

/** Nombre de publications déjà utilisées aujourd'hui pour une plateforme. */
export function countUsedToday(
  rows: Array<{ status: string; published_at: string | null; scheduled_at: string | null; created_at: string | null }>,
  now: Date = new Date(),
): number {
  const dayKey = (iso: string | null): string | null => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
  };
  const today = dayKey(now.toISOString());
  return rows.filter((row) => {
    if (row.status === 'published') return dayKey(row.published_at) === today;
    if (row.status === 'publishing') return dayKey(row.created_at) === today;
    if (row.status === 'scheduled') return dayKey(row.scheduled_at) === today;
    return false;
  }).length;
}

/** Quota restant pour aujourd'hui (jamais négatif). */
export function remainingQuota(usedToday: number, dailyLimit: number): number {
  return Math.max(0, dailyLimit - usedToday);
}

/**
 * Les `count` prochaines dates de publication : créneaux restants aujourd'hui
 * (dans la limite du quota), puis créneaux des jours suivants (quota plein).
 * Permet de répartir un lot dans le temps sans « explosion » de posts.
 */
export function nextPublishTimes(
  usedToday: number,
  dailyLimit: number,
  slots: string[],
  now: Date,
  count: number,
): Date[] {
  if (dailyLimit <= 0 || slots.length === 0 || count <= 0) return [];

  const times: Date[] = [];
  const day = startOfDay(now);
  let todayRemaining = remainingQuota(usedToday, dailyLimit);
  let guard = 0;

  while (times.length < count && guard < 500) {
    const daySlots = slotTimesForDay(day, slots);
    let available: Date[];
    if (day.getTime() === startOfDay(now).getTime()) {
      available = daySlots
        .filter((t) => t.getTime() > now.getTime())
        .slice(0, Math.max(0, todayRemaining));
    } else {
      available = daySlots.slice(0, dailyLimit);
    }
    for (const t of available) {
      if (times.length < count) times.push(t);
    }
    day.setDate(day.getDate() + 1);
    todayRemaining = dailyLimit;
    guard += 1;
  }
  return times;
}

/**
 * Prochaine date de publication pour une tâche (utilisé par la programmation
 * manuelle / l'enfilement d'une seule tâche).
 */
export function computeScheduledAt(
  usedToday: number,
  dailyLimit: number,
  slots: string[],
  now: Date = new Date(),
): Date | null {
  const [next] = nextPublishTimes(usedToday, dailyLimit, slots, now, 1);
  return next ?? null;
}

/**
 * Délai (minutes) avant la prochaine tentative, selon le nombre de tentatives
 * déjà effectuées : 1 min → 5 min → 30 min (puis 30 min par la suite).
 */
export function retryBackoffMinutes(attemptsDone: number): number {
  const BACKOFFS = [1, 5, 30];
  return BACKOFFS[attemptsDone - 1] ?? 30;
}
