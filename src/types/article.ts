/**
 *  TravaillerEnCi — Types du module Actualités / News (table `articles`)
 *
 *  Le module existant ne connaissait que draft/published/archived.
 *  Le pipeline automatisé ajoute pending_review (fenêtre de validation de
 *  15 minutes) et rejected.
 */

export type ArticleStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'archived'
  | 'rejected';

export type ArticleCategory =
  | 'emploi'
  | 'formation'
  | 'concours'
  | 'economie'
  | 'carriere'
  | 'guide'
  | 'societe'
  | 'technologie'
  | 'afrique'
  | 'entrepreneuriat'
  | 'opportunites';

/** Source citée dans un article (RSS ou collecte manuelle). */
export interface ArticleSourceRef {
  source_id: string;
  name: string;
  url: string;
  title?: string | null;
  published_at?: string | null;
  allowed_for_citation?: boolean;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: ArticleCategory;
  source_url: string | null;
  cover_image: string | null;
  author: string;
  status: ArticleStatus;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // --- Pipeline automatisé (nullable pour les articles historiques) ---
  review_deadline?: string | null;
  auto_publish?: boolean;
  admin_action?: string | null;
  admin_action_at?: string | null;
  rejection_reason?: string | null;
  validation_error?: string | null;
  validation_checks?: Record<string, unknown>;
  sources?: ArticleSourceRef[];
  source_count?: number;
  topic_key?: string | null;
  content_hash?: string | null;
  title_normalized?: string | null;
  ai_model?: string | null;
  ai_confidence?: number | null;
  manually_edited?: boolean;
  published_by?: 'auto' | 'admin' | null;
  view_count?: number;
  archived_at?: string | null;
}

/** DTO d'insertion — id, created_at, updated_at générés par la BDD. */
export type ArticleInsert = Omit<Article, 'id' | 'created_at' | 'updated_at'>;

/** Filtres supportés par ArticleService.list(). */
export interface ArticleFilters {
  keyword?: string;
  category?: ArticleCategory | ArticleCategory[];
  status?: ArticleStatus | ArticleStatus[];
  limit?: number;
  offset?: number;
  order_by?: 'published_at' | 'created_at' | 'title' | 'view_count' | 'review_deadline';
  order_dir?: 'asc' | 'desc';
  /** `card` omet le corps de l'article (listes publiques et similaires). */
  fields?: 'full' | 'card';
}

/** Retour paginé. */
export interface PaginatedArticles {
  rows: Article[];
  total: number;
}

/** Action administrative appliquée à un article. */
export type ArticleAdminAction =
  | 'publish'
  | 'reject'
  | 'archive'
  | 'draft'
  | 'disable_auto';
