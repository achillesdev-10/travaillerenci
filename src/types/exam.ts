/**
 *  TravaillerEnCi — Types du module Concours Administratifs (table `exams`)
 *
 *  Miroir STRICT de la table Supabase `public.exams` (migration 0010) et de la
 *  table SQLite locale équivalente. Toute donnée lue/écrite par les pages
 *  /concours, /admin/exams et le scraper passe par ces types.
 */

export type ExamCategory =
  | 'administratif'
  | 'sante'
  | 'enseignement'
  | 'securite'
  | 'militaire'
  | 'autre';

export type ExamStatus = 'pending' | 'published' | 'rejected' | 'archived';

export type ExamType =
  | 'recrutement_nouveau'
  | 'promotion'
  | 'concours_direct'
  | 'concours_professionnel'
  | 'entree_ecole'
  | 'examen';

export type ExamConfidence = 'low' | 'medium' | 'high';

/** Document PDF lié (avis, arrêté, annales…). */
export interface ExamDocument {
  name: string;
  url: string;
}

/** État « métier » dérivé (front) : annoncé / ouvert / en cours / clos / résultats publiés. */
export type ExamPhase = 'upcoming' | 'open' | 'ongoing' | 'closed' | 'results';

export interface Exam {
  id: string;
  title: string;
  slug: string | null;
  organizer: string;
  category: ExamCategory;
  exam_type: ExamType | null;
  status: ExamStatus;
  description_md: string;
  registration_start: string | null;
  registration_end: string | null;
  exam_date: string | null;
  results_date: string | null;
  age_min: number | null;
  age_max: number | null;
  age_reference_date: string | null;
  nationality: string | null;
  diplomas: string[];
  min_diploma_level: number | null;
  positions_count: number | null;
  registration_fee: string | null;
  location: string | null;
  cities: string[];
  documents: ExamDocument[];
  source_url: string | null;
  source_website: string | null;
  confidence: ExamConfidence;
  views_count: number;
  is_verified: boolean;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** DTO d'insertion — id, created_at, updated_at, views_count générés par la BDD. */
export type ExamInsert = Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'views_count'>;

/** Filtres supportés par ExamService.list(). */
export interface ExamFilters {
  keyword?: string;
  organizer?: string;
  category?: ExamCategory | ExamCategory[];
  status?: ExamStatus | ExamStatus[];
  exam_type?: ExamType | ExamType[];
  /** Diplôme possédé par le visiteur (CEPE, BEPC, BAC…) : on retient les
   *  concours dont le diplôme minimal accepté ≤ ce niveau. */
  diploma?: string;
  /** Niveau minimal de diplôme du visiteur (voir DIPLOMA_LEVELS). */
  diploma_level?: number;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'title' | 'organizer' | 'registration_end';
  order_dir?: 'asc' | 'desc';
  /** `card` omet le communiqué complet et les documents (listes publiques). */
  fields?: 'full' | 'card';
}

/** Retour paginé générique. */
export interface PaginatedExams {
  rows: Exam[];
  total: number;
}

export interface ExamAdminStats {
  total: number;
  published: number;
  pending: number;
  rejected: number;
  openNow: number;
  totalViews: number;
}
