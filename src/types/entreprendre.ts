/**
 *  TravaillerEnCi — Types du module "Entreprendre" (guides business)
 *
 *  Miroir du schéma SQLite + Supabase pour les tables
 *  `entreprendre_articles` et `entreprendre_comments`.
 */

// ---------------------------------------------------------------------------
//  Enums / literals
// ---------------------------------------------------------------------------

export type EntreprendreArticleStatus = 'draft' | 'published' | 'archived';

/**
 * Secteurs d'activité pour les articles Entreprendre.
 * Correspondance libre avec les secteurs du constants.ts mais dédiée au
 * module entrepreneuriat (noms affichés en français dans l'UI).
 */
export type EntreprendreSector =
  | 'restauration'
  | 'coiffure-beaute'
  | 'commerce-grossiste'
  | 'commerce-detail'
  | 'agroalimentaire'
  | 'it-digital'
  | 'transport-logistique'
  | 'btp-immobilier'
  | 'sante'
  | 'education-formation'
  | 'tourisme-hotellerie'
  | 'artisanat'
  | 'services-professionnels'
  | 'agriculture'
  | 'autre';

export type BudgetRange = 'petit' | 'moyen' | 'gros';

// ---------------------------------------------------------------------------
//  EntreprendreArticle
// ---------------------------------------------------------------------------

export interface EntreprendreArticle {
  id: string;
  /** Identifiant d'URL unique et lisible (ex: "comment-ouvrir-salon-coiffure"). */
  slug: string;
  title: string;
  /** Résumé affiché dans les listes et les cartes de partage. */
  excerpt: string | null;
  /** Corps de l'article au format Markdown simple. */
  content: string;
  /** URL d'image de couverture. */
  cover_image: string | null;
  /** Secteur d'activité (catégorisation). */
  sector: EntreprendreSector;
  /** Niveau d'investissement requis. */
  budget_range: BudgetRange;
  /** Temps de lecture estimé en minutes. */
  reading_time: number;
  status: EntreprendreArticleStatus;
  /** Mise en avant sur la page d'accueil de la section. */
  featured: boolean;
  /** Nombre de vues de l'article. */
  view_count: number;
  /** Nombre de votes "Cet article vous a aidé ?". */
  helpful_count: number;
  /** Auteur / rédacteur. */
  author: string;
  /** Meta description SEO (optionnel — fallback sur excerpt). */
  meta_description: string | null;
  /** Date de publication (ISO 8601). */
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** DTO d'insertion — id, created_at, updated_at générés par la BDD. */
export type EntreprendreArticleInsert = Omit<
  EntreprendreArticle,
  'id' | 'created_at' | 'updated_at' | 'view_count' | 'helpful_count'
>;

// ---------------------------------------------------------------------------
//  EntreprendreComment
// ---------------------------------------------------------------------------

export type EntreprendreCommentStatus = 'visible' | 'hidden' | 'reported';

export interface EntreprendreComment {
  id: string;
  /** ID de l'article parent. */
  article_id: string;
  /** ID de l'utilisateur auteur (FK users). */
  user_id: string;
  /** Nom d'affichage de l'auteur (snapshot au moment de la publication). */
  user_display_name: string | null;
  /** Contenu du commentaire. */
  content: string;
  status: EntreprendreCommentStatus;
  created_at: string;
}

/** DTO d'insertion — id et created_at générés par la BDD. */
export type EntreprendreCommentInsert = Omit<
  EntreprendreComment,
  'id' | 'created_at'
>;

// ---------------------------------------------------------------------------
//  Filtres & paginés
// ---------------------------------------------------------------------------

export interface EntreprendreArticleFilters {
  keyword?: string;
  sector?: EntreprendreSector | EntreprendreSector[];
  budget_range?: BudgetRange | BudgetRange[];
  status?: EntreprendreArticleStatus | EntreprendreArticleStatus[];
  featured?: boolean;
  limit?: number;
  offset?: number;
  order_by?: 'published_at' | 'created_at' | 'title' | 'view_count' | 'helpful_count';
  order_dir?: 'asc' | 'desc';
}

export interface EntreprendreCommentFilters {
  article_id?: string;
  status?: EntreprendreCommentStatus | EntreprendreCommentStatus[];
  limit?: number;
  offset?: number;
}

/** Retour paginé. */
export interface PaginatedEntreprendreArticles {
  rows: EntreprendreArticle[];
  total: number;
}

export interface PaginatedEntreprendreComments {
  rows: EntreprendreComment[];
  total: number;
}
