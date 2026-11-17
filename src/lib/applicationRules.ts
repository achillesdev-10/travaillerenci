/**
 *  TravaillerEnCi — src/lib/applicationRules.ts
 *
 *  Règles pures du carnet de candidatures externes (Sprint 1) : statuts,
 *  disponibilité d'une offre, validation de la lettre / du CV, résolution de
 *  la méthode de candidature et chemins internes sûrs.
 *
 *  Module PUR (aucun import serveur / Next) → testable directement et
 *  utilisable côté client comme côté serveur.
 *
 *  RAPPEL PRODUIT : TravaillerEnCi n'envoie AUCUNE candidature. On enregistre
 *  une intention, puis on redirige vers l'employeur (site ou e-mail).
 */

export const MAX_COVER_LETTER_LENGTH = 5000;
export const MAX_RESUME_URL_LENGTH = 500;

export const APPLICATION_METHODS = ['external', 'email'] as const;
export type ApplicationMethod = (typeof APPLICATION_METHODS)[number];

/** Statuts du carnet Sprint 1. */
export const CARNET_APPLICATION_STATUSES = [
  'to_finalize',
  'sent',
  'response_received',
  'closed',
] as const;

/** Statuts historiques conservés en lecture (migration 0002 et API précédente). */
export const LEGACY_APPLICATION_STATUSES = [
  'pending',
  'submitted',
  'reviewing',
  'shortlisted',
  'interview',
  'rejected',
  'hired',
] as const;

export const APPLICATION_STATUSES = [
  ...CARNET_APPLICATION_STATUSES,
  ...LEGACY_APPLICATION_STATUSES,
] as const;

export type CarnetApplicationStatus = (typeof CARNET_APPLICATION_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Statuts qu'un candidat peut lui-même poser depuis son carnet. */
export const CANDIDATE_UPDATABLE_STATUSES = [
  'sent',
  'response_received',
  'closed',
] as const satisfies readonly CarnetApplicationStatus[];

export type CandidateUpdatableStatus = (typeof CANDIDATE_UPDATABLE_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  to_finalize: 'À finaliser',
  sent: 'Candidature envoyée',
  response_received: 'Réponse reçue',
  closed: 'Clôturée',
  pending: 'À finaliser',
  submitted: 'Candidature envoyée',
  reviewing: 'En cours d’examen',
  shortlisted: 'Présélectionné',
  interview: 'Entretien',
  rejected: 'Refusée',
  hired: 'Embauché',
};

export const APPLICATION_STATUS_TONES: Record<ApplicationStatus, string> = {
  to_finalize: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  sent: 'border-primary/30 bg-primary/10 text-primary dark:text-brand-accent',
  response_received: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  closed: 'border-line bg-surface text-ink-soft dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  submitted: 'border-primary/30 bg-primary/10 text-primary dark:text-brand-accent',
  reviewing: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  shortlisted: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  interview: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  hired: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300',
};

export interface ApplicationRecord {
  id: string;
  job_id: string;
  user_id: string;
  status: ApplicationStatus;
  apply_method: ApplicationMethod | null;
  resume_url: string | null;
  cover_letter: string | null;
  applied_at: string;
  updated_at: string;
  created_at: string;
  job_title?: string | null;
  company?: string | null;
  job_slug?: string | null;
  job_apply_link?: string | null;
  job_apply_email?: string | null;
  job_status?: string | null;
  job_is_expired?: boolean | null;
  job_is_archived?: boolean | null;
}

export interface OfferAvailability {
  status: string;
  is_archived: boolean;
  is_expired: boolean;
  deadline?: string | null;
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return (
    typeof value === 'string' &&
    (APPLICATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isCandidateUpdatableStatus(
  value: unknown,
): value is CandidateUpdatableStatus {
  return (
    typeof value === 'string' &&
    (CANDIDATE_UPDATABLE_STATUSES as readonly string[]).includes(value)
  );
}

export function statusLabel(status: string): string {
  return isApplicationStatus(status) ? APPLICATION_STATUS_LABELS[status] : status;
}

export function statusTone(status: string): string {
  return isApplicationStatus(status)
    ? APPLICATION_STATUS_TONES[status]
    : 'border-line bg-surface text-ink-soft dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
}

/**
 * Une date limite « AAAA-MM-JJ » est valable jusqu'à la fin de la journée.
 * Sinon, on utilise l'horodatage fourni. Une date invalide n'expire pas
 * artificiellement l'offre (le drapeau `is_expired` reste la source serveur).
 */
export function deadlineDate(deadline: string | null | undefined): Date | null {
  if (!deadline || typeof deadline !== 'string') return null;
  const value = deadline.trim();
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dateOnly ? `${value}T23:59:59.999` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Une offre est ouverte si elle est publiée, non archivée, non expirée et
 * que sa date limite (si elle existe) n'est pas dépassée.
 */
export function isOfferOpen(
  offer: OfferAvailability | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!offer) return false;
  if (offer.status !== 'published') return false;
  if (offer.is_archived) return false;
  if (offer.is_expired) return false;
  const deadline = deadlineDate(offer.deadline);
  if (deadline && deadline.getTime() < now.getTime()) return false;
  return true;
}

/** URL http(s) uniquement — jamais javascript:, data: ni URL relative. */
export function normalizeHttpUrl(value: unknown, maxLength = MAX_RESUME_URL_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > maxLength) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeResumeUrl(value: unknown): string | null {
  return normalizeHttpUrl(value, MAX_RESUME_URL_LENGTH);
}

export function normalizeCoverLetter(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

export function isCoverLetterTooLong(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > MAX_COVER_LETTER_LENGTH;
}

export function normalizeApplyEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (!email || email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/**
 * Choisit la méthode réellement disponible. Une méthode demandée mais absente
 * retombe sur l'autre méthode disponible ; null si l'offre n'offre aucun canal.
 */
export function resolveApplyMethod(
  offer: { apply_link?: string | null; apply_email?: string | null } | null | undefined,
  requested?: string | null,
): ApplicationMethod | null {
  if (!offer) return null;
  const external = normalizeHttpUrl(offer.apply_link, 2000);
  const email = normalizeApplyEmail(offer.apply_email);

  if (requested === 'external' && external) return 'external';
  if (requested === 'email' && email) return 'email';
  if (external) return 'external';
  if (email) return 'email';
  return null;
}

export function buildJobPath(jobId: string): string {
  return `/jobs/${encodeURIComponent(jobId)}`;
}

/** Retour après inscription/connexion : rouvre directement le panneau Postuler. */
export function buildApplyReturnPath(jobId: string): string {
  return `${buildJobPath(jobId)}?postuler=1`;
}

/**
 * Chemin interne sûr (anti open-redirect). Retourne `fallback` si la valeur
 * est externe, protocol-relative, contient un backslash ou des caractères de
 * contrôle.
 */
export function safeInternalPath(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim();
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = 'https://travaillerenci.local';
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildMailtoHref(
  email: string,
  title: string,
  company?: string | null,
): string {
  const subject = `Candidature : ${title}${company ? ` — ${company}` : ''}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
