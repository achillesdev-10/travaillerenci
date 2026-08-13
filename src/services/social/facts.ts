/**
 *  TravaillerEnCi — src/services/social/facts.ts
 *  Extraction des FAITS d'un contenu TravaillerEnCI (offre / stage / bourse /
 *  concours) vers une structure unique utilisée par :
 *    • les templates déterministes (templates.ts)
 *    • la validation des textes IA (aiEnhancer.ts)
 *    • la génération d'images (image.ts)
 *    • le calcul de priorité (priority.ts)
 *
 *  RÈGLE ABSOLUE : ces faits proviennent UNIQUEMENT des données réellement
 *  présentes en base. Rien n'est inventé, complété ou déduit au-delà des
 *  champs existants.
 */

import type { JobOfferSchema } from '@/types';
import type { Exam } from '@/types/exam';
import type { SocialContentType } from '@/types/social';
import { examPhase } from '@/lib/examConstants';
import { formatDate } from '@/lib/utils';

export interface SocialContentFacts {
  type: SocialContentType;
  id: string;
  slug: string | null;
  title: string;
  /** Entreprise / organisme. */
  company: string | null;
  location: string | null;
  /** Ville « propre » (avant virgule / tiret), pour le hashtag. */
  city: string | null;
  contractType: string | null;
  /** Date limite (deadline offre / fin d'inscription concours) — ISO ou null. */
  deadline: string | null;
  /** Date limite formatée fr-FR (affichage) ou null. */
  deadlineLabel: string | null;
  /** Diplômes acceptés (ex: ['BAC', 'BTS/DUT']) — concours uniquement. */
  diplomaLevels: string[];
  /** Nombre de places (concours) — null si inconnu. */
  positionsCount: number | null;
  /** Frais d'inscription (concours, texte brut) — null si inconnu. */
  registrationFee: string | null;
  /** Description (nettoyée des marqueurs markdown légers). */
  description: string | null;
  /** Indique si le contenu est expiré (ne pas publier). */
  expired: boolean;
}

function cleanCity(location: string | null): string | null {
  if (!location) return null;
  const city = location.split(',')[0].split(' - ')[0].trim();
  return city || null;
}

function cleanDescription(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || null;
}

function formatDeadline(deadline: string | null): string | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return formatDate(d);
}

/** Faits extraits d'une ligne job_offers (job / internship / scholarship). */
export function factsFromJob(job: JobOfferSchema): SocialContentFacts {
  const deadline = job.deadline || null;
  const deadlinePassed =
    deadline && !Number.isNaN(new Date(deadline).getTime())
      ? new Date(deadline).getTime() < Date.now()
      : false;
  return {
    type: (job.category as SocialContentType) || 'job',
    id: job.id,
    slug: job.slug || null,
    title: job.title,
    company: job.company || null,
    location: job.location || null,
    city: cleanCity(job.location || null),
    contractType: job.contract_type || null,
    deadline,
    deadlineLabel: formatDeadline(deadline),
    diplomaLevels: [],
    positionsCount: null,
    registrationFee: null,
    description: cleanDescription(job.description),
    expired: Boolean(job.is_expired) || job.is_archived || deadlinePassed,
  };
}

/** Faits extraits d'un concours (table exams). */
export function factsFromExam(exam: Exam): SocialContentFacts {
  const phase = examPhase(exam);
  return {
    type: 'exam',
    id: exam.id,
    slug: exam.slug || null,
    title: exam.title,
    company: exam.organizer || null,
    location: exam.location || (exam.cities && exam.cities.length > 0 ? exam.cities.join(', ') : null),
    city: cleanCity(exam.location || (exam.cities && exam.cities.length > 0 ? exam.cities[0] : null)),
    contractType: null,
    deadline: exam.registration_end || null,
    deadlineLabel: formatDeadline(exam.registration_end || null),
    diplomaLevels: Array.isArray(exam.diplomas) ? exam.diplomas : [],
    positionsCount: exam.positions_count ?? null,
    registrationFee: exam.registration_fee || null,
    description: cleanDescription(exam.description_md),
    expired: phase === 'closed' || phase === 'results',
  };
}

/** Faits depuis un contenu résolu (worker / API). */
export function factsFromContent(
  contentType: SocialContentType,
  content: JobOfferSchema | Exam,
): SocialContentFacts {
  if (contentType === 'exam') {
    return factsFromExam(content as Exam);
  }
  return factsFromJob(content as JobOfferSchema);
}

/** Nom du hashtag de ville (ex: « Abidjan » → « Abidjan »). */
export function cityHashtag(city: string | null): string | null {
  if (!city) return null;
  const clean = city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim();
  return clean || null;
}
