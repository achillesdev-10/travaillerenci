/**
 *  TravaillerEnCi — src/services/social/priority.ts
 *  Score de priorité DÉTERMINISTE (aucune IA) des tâches sociales.
 *
 *  Pondération (0-100) :
 *    • Catégorie            : concours/bourses = élevée, emplois/stages = normale
 *    • Échéance proche      : deadline / fin d'inscription dans 3, 7, 14 jours
 *    • Complétude du contenu : entreprise + localisation + type + description,
 *                              moyen de postuler, date limite renseignée
 */

import type { SocialContentType } from '@/types/social';

const CATEGORY_BASE: Record<SocialContentType, number> = {
  exam: 60,
  scholarship: 60,
  job: 40,
  internship: 40,
};

/** Bonus d'échéance proche (jours restants → bonus). */
function deadlineBonus(daysUntil: number | null): number {
  if (daysUntil === null) return 0;
  if (daysUntil < 0) return 0; // échéance passée → géré ailleurs (expiré)
  if (daysUntil <= 3) return 30;
  if (daysUntil <= 7) return 20;
  if (daysUntil <= 14) return 10;
  return 0;
}

export interface PriorityInput {
  contentType: SocialContentType;
  /** Date limite (deadline offre / fin d'inscription concours) — ISO ou null. */
  deadline?: string | null;
  /** Complétude indicative. */
  hasCompany?: boolean;
  hasLocation?: boolean;
  hasContractType?: boolean;
  hasDescription?: boolean;
  hasApplyMethod?: boolean;
  hasDeadline?: boolean;
}

/** Jours restants avant une date (null si date absente ou invalide). */
export function daysUntil(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const t = new Date(dateIso).getTime();
  if (!Number.isFinite(t)) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((t - Date.now()) / msPerDay);
}

/**
 * Score de priorité 0-100. Peut être testé / comparé de façon déterministe.
 */
export function computePriority(input: PriorityInput): number {
  let score = CATEGORY_BASE[input.contentType] ?? 40;

  score += deadlineBonus(daysUntil(input.deadline));

  // Complétude : une offre riche est plus précieuse à diffuser.
  let completeness = 0;
  if (input.hasCompany) completeness += 3;
  if (input.hasLocation) completeness += 3;
  if (input.hasContractType) completeness += 2;
  if (input.hasDescription) completeness += 2;
  if (input.hasApplyMethod) completeness += 3;
  if (input.hasDeadline) completeness += 2;
  score += completeness;

  return Math.max(0, Math.min(100, score));
}
