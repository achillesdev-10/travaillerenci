/**
 *  TravaillerEnCi — Constantes du module Concours Administratifs
 *  Utilisées par les pages /concours, /admin/exams et le service exams.
 */
import type {
  ExamCategory,
  ExamConfidence,
  ExamPhase,
  ExamStatus,
  ExamType,
} from '@/types/exam';

/** Échelle des diplômes ivoiriens (niveau croissant). */
export const DIPLOMA_LEVELS: Record<string, number> = {
  CEPE: 1,
  BEPC: 2,
  'CAP/BEP': 3,
  CAP: 3,
  BEP: 3,
  BAC: 4,
  'BTS/DUT': 5,
  BTS: 5,
  DUT: 5,
  DEUG: 5,
  LICENCE: 6,
  'LICENCE PRO': 6,
  MASTER: 7,
  INGENIEUR: 7,
  DOCTORAT: 8,
};

/** Ordre d'affichage des pills diplômes sur /concours. */
export const DIPLOMA_FILTERS: { label: string; value: string; level: number }[] = [
  { label: 'CEPE', value: 'CEPE', level: 1 },
  { label: 'BEPC', value: 'BEPC', level: 2 },
  { label: 'CAP/BEP', value: 'CAP/BEP', level: 3 },
  { label: 'BAC', value: 'BAC', level: 4 },
  { label: 'BTS/DUT', value: 'BTS/DUT', level: 5 },
  { label: 'Licence', value: 'LICENCE', level: 6 },
  { label: 'Master', value: 'MASTER', level: 7 },
  { label: 'Doctorat', value: 'DOCTORAT', level: 8 },
];

/** Niveau minimal d'un diplôme donné (normalisé), ou null si inconnu. */
export function diplomaLevel(diploma?: string | null): number | null {
  if (!diploma) return null;
  const key = diploma.trim().toUpperCase();
  if (DIPLOMA_LEVELS[key]) return DIPLOMA_LEVELS[key];
  // Tolérance : « Licence Pro » → « LICENCE PRO », « BTS/DUT » partiel…
  const found = Object.entries(DIPLOMA_LEVELS).find(([k]) => key.startsWith(k.split('/')[0]) || k.startsWith(key.split('/')[0]));
  return found ? found[1] : null;
}

export const EXAM_CATEGORIES: { value: ExamCategory; label: string }[] = [
  { value: 'administratif', label: 'Administratif' },
  { value: 'sante', label: 'Santé' },
  { value: 'enseignement', label: 'Enseignement' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'militaire', label: 'Militaire' },
  { value: 'autre', label: 'Autre' },
];

export const EXAM_CATEGORY_LABEL: Record<ExamCategory, string> = Object.fromEntries(
  EXAM_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<ExamCategory, string>;

export const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: 'recrutement_nouveau', label: 'Recrutement nouveau' },
  { value: 'promotion', label: 'Concours de promotion' },
  { value: 'concours_direct', label: 'Concours direct' },
  { value: 'concours_professionnel', label: 'Concours professionnel' },
  { value: 'entree_ecole', label: "Concours d'entrée" },
  { value: 'examen', label: 'Examen' },
];

export const EXAM_TYPE_LABEL: Record<ExamType, string> = Object.fromEntries(
  EXAM_TYPES.map((t) => [t.value, t.label]),
) as Record<ExamType, string>;

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  pending: 'En attente',
  published: 'Publié',
  rejected: 'Rejeté',
  archived: 'Archivé',
};

export const EXAM_CONFIDENCE_LABEL: Record<ExamConfidence, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
};

/**
 * Phase « métier » dérivée des dates (affichée sur les cartes) :
 *  - upcoming  : annoncé — inscriptions PAS encore ouvertes (date d'ouverture
 *                future, ou communiqué sans dates précises)
 *  - open      : inscriptions ouvertes (registration_end futur)
 *  - ongoing   : inscriptions closes, épreuves en cours ou à venir
 *  - results   : résultats publiés (results_date renseignée)
 *  - closed    : tout est terminé
 */
export function examPhase(exam: {
  registration_start?: string | null;
  registration_end?: string | null;
  exam_date?: string | null;
  results_date?: string | null;
}): ExamPhase {
  const now = Date.now();
  const regStart = exam.registration_start ? new Date(exam.registration_start).getTime() : null;
  const regEnd = exam.registration_end ? new Date(exam.registration_end).getTime() : null;
  const examDate = exam.exam_date ? new Date(exam.exam_date).getTime() : null;
  const results = exam.results_date ? new Date(exam.results_date).getTime() : null;

  if (results && results <= now) return 'results';
  // Inscriptions pas encore ouvertes → concours « à venir ».
  if (regStart && regStart > now) return 'upcoming';
  if (regEnd && regEnd > now) return 'open';
  // Inscriptions débutées mais sans date de fin connue (fréquent dans les
  // communiqués) → on considère que les inscriptions restent ouvertes.
  if (regStart && !regEnd) return 'open';
  if (regEnd && regEnd <= now) {
    if (examDate && examDate < now) return 'closed';
    return 'ongoing';
  }
  // Pas de fin d'inscription connue : on se cale sur les épreuves si connues,
  // sinon le concours est considéré comme annoncé (à venir).
  if (examDate) {
    return examDate >= now ? 'upcoming' : 'closed';
  }
  return 'upcoming';
}

export const EXAM_PHASE_LABEL: Record<ExamPhase, string> = {
  upcoming: 'À venir',
  open: 'Inscriptions ouvertes',
  ongoing: 'En cours',
  closed: 'Clos',
  results: 'Résultats publiés',
};

/** Classes Tailwind des badges de phase (cartes / fiche). */
export const EXAM_PHASE_BADGE: Record<ExamPhase, string> = {
  upcoming: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  open: 'bg-brand/10 text-brand dark:text-brand-accent border-brand/30',
  ongoing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  closed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
  results: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
};

/**
 * URL publique d'une fiche concours — slug SEO descriptif si disponible,
 * sinon repli sur l'ID (enregistrements legacy sans slug).
 * Convention : `${getSiteUrl()}${examUrl(exam)}` (voir src/lib/site.ts).
 */
export function examUrl(exam: { slug?: string | null; id: string }): string {
  return exam.slug ? `/concours/${exam.slug}` : `/concours/${exam.id}`;
}
