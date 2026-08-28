/**
 * TravaillerenCi — Types du module Blog
 *
 * Miroir STRICT de la table `public.blog_posts` (Supabase / SQLite).
 * Le contenu des articles est écrit en Markdown simple (mêmes conventions
 * que les descriptions d'offres : ## titres, puces, **gras**, *italique*).
 */

export type BlogPostStatus = 'draft' | 'published' | 'archived';

export interface BlogPost {
  id: string;
  title: string;
  /** Identifiant d'URL unique et lisible (ex: "bienvenue-sur-le-blog"). */
  slug: string;
  /** Résumé affiché dans les listes et les cartes de partage. */
  excerpt: string | null;
  /** Corps de l'article au format Markdown simple. */
  content: string;
  /** URL d'image de couverture (optionnelle). */
  cover_image: string | null;
  author: string;
  /** Étiquettes séparées par des virgules (ex: "emploi, cv, conseils"). */
  tags: string | null;
  status: BlogPostStatus;
  /** Date de publication (ISO 8601) — affichée une fois le statut "published". */
  published_at: string | null;
  /** Nombre de vues (incrémenté à chaque visite de la page article). */
  view_count: number;
  created_at: string;
  updated_at: string;
}

/** DTO d'insertion — id, created_at, updated_at, view_count générés par la BDD. */
export type BlogPostInsert = Omit<BlogPost, 'id' | 'created_at' | 'updated_at' | 'view_count'>;

export interface BlogPostFilters {
  status?: BlogPostStatus | BlogPostStatus[];
  keyword?: string;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'published_at' | 'title';
  order_dir?: 'asc' | 'desc';
}
