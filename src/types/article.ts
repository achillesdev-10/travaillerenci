/**
 *  TravaillerEnCi — Types du module Actualités / News (table `articles`)
 *
 *  Miroir du schéma SQLite + Supabase pour la table `articles` :
 *  actualités liées au marché de l'emploi, à la formation et aux concours
 *  en Côte d'Ivoire.
 */

export type ArticleStatus = 'draft' | 'published' | 'archived';

export type ArticleCategory =
  | 'emploi'
  | 'formation'
  | 'concours'
  | 'economie'
  | 'carriere'
  | 'guide';

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
  order_by?: 'published_at' | 'created_at' | 'title';
  order_dir?: 'asc' | 'desc';
}

/** Retour paginé. */
export interface PaginatedArticles {
  rows: Article[];
  total: number;
}
