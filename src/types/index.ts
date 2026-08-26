import type { ContentCategory } from '@/types/content-types';

export type { ContentCategory } from '@/types/content-types';

export type UserRole = 'candidate' | 'employer' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  user_id: string;
  title?: string;
  bio?: string;
  location?: string;
  resume_url?: string;
  skills?: string[];
  experience_years?: number;
  education_level?: EducationLevel;
  availability?: 'immediate' | '1_month' | '3_months' | 'flexible';
  salary_expectation_min?: number;
  salary_expectation_max?: number;
  linkedin_url?: string;
  portfolio_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  linkedin_url?: string;
  industry?: string;
  size?: CompanySize;
  location?: string;
  founded_year?: number;
  email?: string;
  phone?: string;
  verified?: boolean;
  created_at: string;
  updated_at: string;
}

export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';

export type EducationLevel = 'baccalaureat' | 'bts_dut' | 'licence' | 'master' | 'doctorat' | 'other';

export type JobType = 'CDI' | 'CDD' | 'Stage' | 'Alternance' | 'Freelance' | 'Temps plein' | 'Temps partiel';

export type JobLevel = 'Junior' | 'Intermédiaire' | 'Senior' | 'Expert' | 'Manager' | 'Cadre dirigeant';

// ============================================================================
//  Types EXACT DU NOUVEAU SCHÉMA "job_offers" (Supabase + SQLite)
//  → Champs demandés par TravaillerEnCi :
//    id, title, company, location, contract_type, description,
//    apply_link OU apply_email, source_url, is_verified, created_at (+ updated_at)
// ============================================================================
export type JobContractType =
  | 'CDI'
  | 'CDD'
  | 'Stage'
  | 'Prestation'
  | 'Alternance'
  | 'Freelance';

export type JobOfferSchemaStatus = 'pending' | 'published' | 'rejected' | 'archived';

/**
 * JobOfferSchema — miroir STRICT de la table `public.job_offers` (Supabase / SQLite).
 * Une offre DOIT avoir AU MOINS un moyen de postuler : apply_link XOR apply_email (ou les deux).
 *
 * `category` discrimine le type de contenu (dépôt UNIFIÉ) :
 *   job (défaut) | internship | scholarship | exam
 *
 * NOTE : renommée volontairement pour ne pas rentrer en conflit avec
 * le type JobOffer "étendu" utilisé par l'ancien JobService mocké.
 * → Utiliser JobOfferSchema pour tout ce qui va écrire / lire dans la table SQL.
 */
export interface JobOfferSchema {
  id: string;
  category?: ContentCategory;
  title: string;
  company: string;
  location: string;
  contract_type: JobContractType;
  description: string;
  apply_link: string | null;
  apply_email: string | null;
  /** Date limite de candidature (scrapée, ISO 8601) — null si inconnue. */
  deadline: string | null;
  source_url: string | null;
  source_website: string | null;
  status: JobOfferSchemaStatus;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  slug: string | null;
  is_verified: boolean;
  is_archived: boolean;
  is_expired: boolean;
  clicks_count?: number;
  created_at: string;
  updated_at: string;
}

/** DTO d'insertion — id, created_at, updated_at générés par la BDD. */
export type JobOfferSchemaInsert = Omit<JobOfferSchema, 'id' | 'created_at' | 'updated_at'>;

/** Filtres supportés par les queries SQL (list / search). */
export interface JobOfferSchemaFilters {
  category?: ContentCategory | ContentCategory[];
  keyword?: string;
  location?: string;
  contract_type?: JobContractType | JobContractType[];
  status?: JobOfferSchemaStatus | JobOfferSchemaStatus[];
  is_verified?: boolean;
  is_archived?: boolean;
  is_expired?: boolean;
  company?: string;
  source_website?: string;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'title' | 'company';
  order_dir?: 'asc' | 'desc';
}

/** Retour typé paginé générique (utilisé par les queries). */
export interface PaginatedRows<T> {
  rows: T[];
  total: number;
}


export type JobStatus = 'draft' | 'active' | 'paused' | 'closed';

export interface JobOffer {
  id: string;
  company_id: string;
  title: string;
  description: string;
  requirements?: string;
  benefits?: string;
  location?: string;
  type?: JobType;
  level?: JobLevel;
  sector?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: 'monthly' | 'yearly' | 'hourly';
  remote?: 'no' | 'partial' | 'full';
  posted_by?: string;
  status: JobStatus;
  published_at?: string;
  application_deadline?: string;
  views_count?: number;
  applications_count?: number;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  candidate_id: string;
  cover_letter?: string;
  resume_url?: string;
  status: ApplicationStatus;
  rating?: number;
  notes?: string;
  applied_at: string;
  updated_at: string;
}

export type ApplicationStatus = 'submitted' | 'reviewing' | 'shortlisted' | 'interview' | 'rejected' | 'hired';

export interface SavedJob {
  id: string;
  user_id: string;
  job_id: string;
  saved_at: string;
}

export interface JobAlert {
  id: string;
  user_id: string;
  keyword?: string;
  location?: string;
  sector?: string;
  job_type?: JobType;
  min_salary?: number;
  frequency?: 'daily' | 'weekly';
  created_at: string;
}

export interface Experience {
  id?: string;
  candidate_id?: string;
  title: string;
  company: string;
  location?: string;
  start_date: string;
  end_date?: string;
  current?: boolean;
  description?: string;
}

export interface Education {
  id?: string;
  candidate_id?: string;
  degree: string;
  school: string;
  field?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface JobFilters {
  keyword?: string;
  location?: string;
  sector?: string;
  type?: JobType;
  level?: JobLevel;
  min_salary?: number;
  remote?: 'no' | 'partial' | 'full';
  company_id?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
