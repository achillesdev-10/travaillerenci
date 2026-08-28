/**
 *  TravaillerEnCi — Service "Entreprendre" (guides business + commentaires)
 *  Chemin : src/services/entreprendreService.ts
 *
 *  Couche d'abstraction typée sur les tables `entreprendre_articles` et
 *  `entreprendre_comments` :
 *   • Local : via `node:sqlite` (module natif Node 22+, fichier ./data/travaillerenci.sqlite3)
 *   • Prod  : via le SDK Supabase (mêmes signatures, mêmes types).
 */

import type {
  EntreprendreArticle,
  EntreprendreArticleFilters,
  EntreprendreArticleInsert,
  EntreprendreArticleStatus,
  EntreprendreComment,
  EntreprendreCommentFilters,
  EntreprendreCommentInsert,
  EntreprendreCommentStatus,
  PaginatedEntreprendreArticles,
  PaginatedEntreprendreComments,
} from '@/types/entreprendre';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { slugify } from '@/lib/slugify';

// ---------------------------------------------------------------------------
// Types SQLite (module natif — mêmes formes que dans blogService)
// ---------------------------------------------------------------------------
type DatabaseSyncInstance = {
  prepare(sql: string): StatementInstance;
  exec(sql: string): void;
  close(): void;
};
type StatementInstance = {
  run(params?: unknown): { changes: number; lastInsertRowid: unknown };
  get(params?: unknown): any | undefined;
  all(params?: unknown): any[];
};

const DEFAULT_AUTHOR = 'TravaillerenCi';

let cachedDb: DatabaseSyncInstance | null = null;
async function getDb(): Promise<DatabaseSyncInstance | null> {
  if (cachedDb) return cachedDb;
  try {
    const mod = await import('node:sqlite');
    const { DatabaseSync } = mod as unknown as {
      DatabaseSync: new (path: string) => DatabaseSyncInstance;
    };
    const { resolve: resolvePath } = (await import('node:path')) as typeof import('node:path');
    const { existsSync: exists, mkdirSync: mkdir } = (await import('node:fs')) as typeof import('node:fs');
    const dataDir = resolvePath(process.cwd(), 'data');
    if (!exists(dataDir)) mkdir(dataDir, { recursive: true });
    const dbPath = resolvePath(dataDir, 'travaillerenci.sqlite3');
    cachedDb = new DatabaseSync(dbPath);
    ensureSchema(cachedDb);
    return cachedDb;
  } catch (err) {
    console.error('[entreprendreService] SQLite indisponible :', err);
    return null;
  }
}

function ensureSchema(db: DatabaseSyncInstance) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entreprendre_articles (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      slug            TEXT NOT NULL UNIQUE,
      title           TEXT NOT NULL,
      excerpt         TEXT,
      content         TEXT NOT NULL DEFAULT '',
      cover_image     TEXT,
      sector          TEXT NOT NULL DEFAULT 'autre',
      budget_range    TEXT NOT NULL DEFAULT 'petit',
      reading_time    INTEGER NOT NULL DEFAULT 5,
      status          TEXT NOT NULL DEFAULT 'draft',
      featured        INTEGER NOT NULL DEFAULT 0,
      view_count      INTEGER NOT NULL DEFAULT 0,
      helpful_count   INTEGER NOT NULL DEFAULT 0,
      author          TEXT NOT NULL DEFAULT '${DEFAULT_AUTHOR}',
      meta_description TEXT,
      published_at    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT entreprendre_articles_status CHECK (status IN ('draft','published','archived')),
      CONSTRAINT entreprendre_articles_sector CHECK (sector IN (
        'restauration','coiffure-beaute','commerce-grossiste','commerce-detail',
        'agroalimentaire','it-digital','transport-logistique','btp-immobilier',
        'sante','education-formation','tourisme-hotellerie','artisanat',
        'services-professionnels','agriculture','autre'
      )),
      CONSTRAINT entreprendre_articles_budget CHECK (budget_range IN ('petit','moyen','gros'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_entreprendre_status_published ON entreprendre_articles (status, published_at DESC);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_entreprendre_slug ON entreprendre_articles (slug);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_entreprendre_sector ON entreprendre_articles (sector);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS entreprendre_comments (
      id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      article_id        TEXT NOT NULL REFERENCES entreprendre_articles(id) ON DELETE CASCADE,
      user_id           TEXT,
      user_display_name TEXT,
      content           TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'visible',
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT entreprendre_comments_status CHECK (status IN ('visible','hidden','reported'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_entreprendre_comments_article ON entreprendre_comments (article_id, created_at DESC);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_entreprendre_comments_status ON entreprendre_comments (status);`);
}

// ---------------------------------------------------------------------------
// Normalisation des lignes
// ---------------------------------------------------------------------------

function rowToArticle(row: any): EntreprendreArticle {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    excerpt: row.excerpt ?? null,
    content: String(row.content || ''),
    cover_image: row.cover_image ?? null,
    sector: row.sector || 'autre',
    budget_range: row.budget_range || 'petit',
    reading_time: Number(row.reading_time || 5),
    status: (['draft', 'published', 'archived'].includes(row.status) ? row.status : 'draft') as EntreprendreArticleStatus,
    featured: row.featured === 1 || row.featured === true,
    view_count: Number(row.view_count || 0),
    helpful_count: Number(row.helpful_count || 0),
    author: String(row.author || DEFAULT_AUTHOR),
    meta_description: row.meta_description ?? null,
    published_at: row.published_at ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function rowToArticleFromSupabase(row: any): EntreprendreArticle {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    excerpt: row.excerpt ?? null,
    content: String(row.content || ''),
    cover_image: row.cover_image ?? null,
    sector: row.sector || 'autre',
    budget_range: row.budget_range || 'petit',
    reading_time: Number(row.reading_time || 5),
    status: (['draft', 'published', 'archived'].includes(row.status) ? row.status : 'draft') as EntreprendreArticleStatus,
    featured: Boolean(row.featured),
    view_count: Number(row.view_count || 0),
    helpful_count: Number(row.helpful_count || 0),
    author: String(row.author || DEFAULT_AUTHOR),
    meta_description: row.meta_description ?? null,
    published_at: row.published_at ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function rowToComment(row: any): EntreprendreComment {
  return {
    id: String(row.id),
    article_id: String(row.article_id),
    user_id: String(row.user_id || ''),
    user_display_name: row.user_display_name ?? null,
    content: String(row.content || ''),
    status: (['visible', 'hidden', 'reported'].includes(row.status) ? row.status : 'visible') as EntreprendreCommentStatus,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function rowToCommentFromSupabase(row: any): EntreprendreComment {
  return {
    id: String(row.id),
    article_id: String(row.article_id),
    user_id: String(row.user_id || ''),
    user_display_name: row.user_display_name ?? null,
    content: String(row.content || ''),
    status: (['visible', 'hidden', 'reported'].includes(row.status) ? row.status : 'visible') as EntreprendreCommentStatus,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Colonnes autorisées pour les mises à jour (protection injections SQL)
// ---------------------------------------------------------------------------
const ARTICLE_UPDATE_COLUMNS = new Set([
  'slug', 'title', 'excerpt', 'content', 'cover_image',
  'sector', 'budget_range', 'reading_time', 'status',
  'featured', 'author', 'meta_description', 'published_at',
]);



// ============================================================================
//  Service Article
// ============================================================================
export class EntreprendreArticleService {
  // ---------------------------------------------------------- LIST
  static async list(filters: EntreprendreArticleFilters = {}): Promise<PaginatedEntreprendreArticles> {
    if (isSupabaseConfigured()) return this.listSupabase(filters);

    const db = await getDb();
    if (!db) return { rows: [], total: 0 };

    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters.keyword) {
      clauses.push('(title LIKE $kw OR excerpt LIKE $kw OR content LIKE $kw)');
      params.$kw = `%${filters.keyword}%`;
    }
    if (filters.sector) {
      const list = Array.isArray(filters.sector) ? filters.sector : [filters.sector];
      const placeholders = list.map((_, i) => `$sec${i}`).join(',');
      list.forEach((s, i) => (params[`$sec${i}`] = s));
      clauses.push(`sector IN (${placeholders})`);
    }
    if (filters.budget_range) {
      const list = Array.isArray(filters.budget_range) ? filters.budget_range : [filters.budget_range];
      const placeholders = list.map((_, i) => `$bud${i}`).join(',');
      list.forEach((b, i) => (params[`$bud${i}`] = b));
      clauses.push(`budget_range IN (${placeholders})`);
    }
    if (filters.status) {
      const list = Array.isArray(filters.status) ? filters.status : [filters.status];
      const placeholders = list.map((_, i) => `$st${i}`).join(',');
      list.forEach((s, i) => (params[`$st${i}`] = s));
      clauses.push(`status IN (${placeholders})`);
    }
    if (filters.featured !== undefined) {
      clauses.push('featured = $featured');
      params.$featured = filters.featured ? 1 : 0;
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderSafe = ['published_at', 'created_at', 'title', 'view_count', 'helpful_count'].includes(
      filters.order_by || 'published_at',
    )
      ? filters.order_by!
      : 'published_at';
    const dirSafe = filters.order_dir === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const offset = Math.max(filters.offset || 0, 0);

    const rows = db
      .prepare(
        `SELECT * FROM entreprendre_articles ${whereSql} ORDER BY ${orderSafe} ${dirSafe} LIMIT $limit OFFSET $offset`,
      )
      .all({ ...params, $limit: limit, $offset: offset })
      .map(rowToArticle);
    const total = (
      db.prepare(`SELECT COUNT(*) AS total FROM entreprendre_articles ${whereSql}`).get(params) as any
    ).total;
    return { rows, total };
  }

  // ---------------------------------------------------------- GET
  static async getById(id: string): Promise<EntreprendreArticle | null> {
    if (isSupabaseConfigured()) return this.getByIdSupabase(id);
    const db = await getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM entreprendre_articles WHERE id = $id').get({ $id: id });
    return row ? rowToArticle(row) : null;
  }

  static async getBySlug(slug: string): Promise<EntreprendreArticle | null> {
    if (isSupabaseConfigured()) return this.getBySlugSupabase(slug);
    const db = await getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM entreprendre_articles WHERE slug = $slug').get({ $slug: slug });
    return row ? rowToArticle(row) : null;
  }

  // ---------------------------------------------------------- SLUG
  static async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    const base = slugify(slug) || 'article';
    let candidate = base;
    let i = 2;
    while (await this.slugExists(candidate, excludeId)) {
      candidate = `${base}-${i++}`;
    }
    return candidate;
  }

  private static async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return false;
      let query = supabase.from('entreprendre_articles').select('id').eq('slug', slug);
      if (excludeId) query = query.neq('id', excludeId);
      const { data } = await query.limit(1);
      return Boolean(data && data.length > 0);
    }
    const db = await getDb();
    if (!db) return false;
    const row = db
      .prepare(
        excludeId
          ? 'SELECT id FROM entreprendre_articles WHERE slug = $slug AND id != $id LIMIT 1'
          : 'SELECT id FROM entreprendre_articles WHERE slug = $slug LIMIT 1',
      )
      .get(excludeId ? { $slug: slug, $id: excludeId } : { $slug: slug });
    return Boolean(row);
  }

  // ---------------------------------------------------------- CREATE
  static async create(data: Partial<EntreprendreArticleInsert>): Promise<EntreprendreArticle | null> {
    if (isSupabaseConfigured()) return this.createSupabase(data);

    const db = await getDb();
    if (!db) return null;

    const title = String(data.title || '').trim();
    if (!title) return null;

    const status = (['draft', 'published', 'archived'].includes(data.status as string)
      ? data.status
      : 'draft') as EntreprendreArticleStatus;
    const now = new Date().toISOString();
    const slug = await this.ensureUniqueSlug(data.slug || title);

    const res = db
      .prepare(
        `INSERT INTO entreprendre_articles (
          slug, title, excerpt, content, cover_image, sector, budget_range,
          reading_time, status, featured, author, meta_description,
          published_at, created_at, updated_at
        ) VALUES (
          $slug, $title, $excerpt, $content, $cover_image, $sector, $budget_range,
          $reading_time, $status, $featured, $author, $meta_description,
          $published_at, datetime('now'), datetime('now')
        ) RETURNING id`,
      )
      .get({
        $slug: slug,
        $title: title,
        $excerpt: data.excerpt ? String(data.excerpt).trim() || null : null,
        $content: String(data.content || '').trim(),
        $cover_image: data.cover_image ? String(data.cover_image).trim() || null : null,
        $sector: data.sector || 'autre',
        $budget_range: data.budget_range || 'petit',
        $reading_time: data.reading_time || 5,
        $status: status,
        $featured: data.featured ? 1 : 0,
        $author: String(data.author || DEFAULT_AUTHOR).trim() || DEFAULT_AUTHOR,
        $meta_description: data.meta_description ? String(data.meta_description).trim() || null : null,
        $published_at:
          status === 'published' && data.published_at
            ? String(data.published_at).trim() || now
            : status === 'published'
              ? now
              : data.published_at
                ? String(data.published_at).trim() || null
                : null,
      }) as any;

    return res?.id ? this.getById(res.id) : null;
  }

  // ---------------------------------------------------------- UPDATE
  static async update(id: string, patch: Partial<EntreprendreArticleInsert>): Promise<EntreprendreArticle | null> {
    if (isSupabaseConfigured()) return this.updateSupabase(id, patch);

    const db = await getDb();
    if (!db) return null;
    const existing = await this.getById(id);
    if (!existing) return null;

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!ARTICLE_UPDATE_COLUMNS.has(key)) continue;
      if (typeof value === 'string') {
        clean[key] = value.trim();
      } else if (value === null) {
        clean[key] = null;
      } else if (typeof value === 'boolean') {
        clean[key] = value ? 1 : 0;
      } else {
        clean[key] = value;
      }
    }

    if (typeof clean.slug === 'string' && clean.slug.trim()) {
      clean.slug = await this.ensureUniqueSlug(clean.slug, id);
    } else {
      delete clean.slug;
    }

    if (clean.status === 'published' && !existing.published_at) {
      clean.published_at = new Date().toISOString();
    }

    if (Object.keys(clean).length === 0) return existing;

    const fields = Object.keys(clean).map((k) => `${k} = $${k}`).join(', ');
    const params: Record<string, unknown> = { $id: id };
    Object.entries(clean).forEach(([k, v]) => (params[`$${k}`] = v));
    db.prepare(`UPDATE entreprendre_articles SET ${fields}, updated_at = datetime('now') WHERE id = $id`).run(params);
    return this.getById(id);
  }

  // ---------------------------------------------------------- REMOVE
  static async remove(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) return this.removeSupabase(id);
    const db = await getDb();
    if (!db) return false;
    return (db.prepare('DELETE FROM entreprendre_articles WHERE id = $id').run({ $id: id }).changes || 0) > 0;
  }

  // ---------------------------------------------------------- INCREMENT
  static async incrementViewCount(id: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      // Read then increment (safe fallback if RPC doesn't exist)
      const { data } = await supabase.from('entreprendre_articles').select('view_count').eq('id', id).single();
      if (data) {
        await supabase.from('entreprendre_articles').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id);
      }
      return;
    }
    const db = await getDb();
    if (!db) return;
    db.prepare('UPDATE entreprendre_articles SET view_count = view_count + 1 WHERE id = $id').run({ $id: id });
  }

  static async incrementHelpfulCount(id: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.from('entreprendre_articles').select('helpful_count').eq('id', id).single();
      if (data) {
        await supabase.from('entreprendre_articles').update({ helpful_count: (data.helpful_count || 0) + 1 }).eq('id', id);
      }
      return;
    }
    const db = await getDb();
    if (!db) return;
    db.prepare('UPDATE entreprendre_articles SET helpful_count = helpful_count + 1 WHERE id = $id').run({ $id: id });
  }

  // ---------------------------------------------------------- COUNT COMMENTS
  static async countComments(articleId: string): Promise<number> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return 0;
      const { count } = await supabase
        .from('entreprendre_comments')
        .select('id', { count: 'exact', head: true })
        .eq('article_id', articleId)
        .eq('status', 'visible');
      return count || 0;
    }
    const db = await getDb();
    if (!db) return 0;
    const row = db
      .prepare(`SELECT COUNT(*) AS total FROM entreprendre_comments WHERE article_id = $aid AND status = 'visible'`)
      .get({ $aid: articleId }) as any;
    return row?.total || 0;
  }

  // =========================================================================
  //  Implémentations Supabase (production)
  // =========================================================================

  private static async listSupabase(filters: EntreprendreArticleFilters): Promise<PaginatedEntreprendreArticles> {
    const supabase = getSupabaseClient();
    if (!supabase) return { rows: [], total: 0 };

    let query = supabase.from('entreprendre_articles').select('*', { count: 'exact' });

    if (filters.keyword) {
      const safe = String(filters.keyword).replace(/[,.( )*!]/g, ' ').trim();
      if (safe) {
        const pattern = `%${safe}%`;
        query = query.or(`title.ilike.${pattern},excerpt.ilike.${pattern},content.ilike.${pattern}`);
      }
    }
    if (filters.sector) {
      const list = Array.isArray(filters.sector) ? filters.sector : [filters.sector];
      if (list.length > 0) query = query.in('sector', list);
    }
    if (filters.budget_range) {
      const list = Array.isArray(filters.budget_range) ? filters.budget_range : [filters.budget_range];
      if (list.length > 0) query = query.in('budget_range', list);
    }
    if (filters.status) {
      const list = Array.isArray(filters.status) ? filters.status : [filters.status];
      if (list.length > 0) query = query.in('status', list);
    }
    if (filters.featured !== undefined) {
      query = query.eq('featured', filters.featured);
    }

    const orderBy = (['published_at', 'created_at', 'title', 'view_count', 'helpful_count'] as const).includes(
      (filters.order_by || 'published_at') as 'published_at',
    )
      ? filters.order_by!
      : 'published_at';
    query = query.order(orderBy, { ascending: filters.order_dir === 'asc' });

    const safeLimit = Math.min(Math.max(filters.limit || 20, 1), 100);
    query = query.range(filters.offset || 0, (filters.offset || 0) + safeLimit - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error('[entreprendreService] listSupabase error:', error.message);
      return { rows: [], total: 0 };
    }
    return { rows: (data || []).map(rowToArticleFromSupabase), total: count || 0 };
  }

  private static async getByIdSupabase(id: string): Promise<EntreprendreArticle | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('entreprendre_articles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToArticleFromSupabase(data);
  }

  private static async getBySlugSupabase(slug: string): Promise<EntreprendreArticle | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('entreprendre_articles')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return rowToArticleFromSupabase(data);
  }

  private static async createSupabase(data: Partial<EntreprendreArticleInsert>): Promise<EntreprendreArticle | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const title = String(data.title || '').trim();
    if (!title) return null;

    const status = (['draft', 'published', 'archived'].includes(data.status as string)
      ? data.status
      : 'draft') as EntreprendreArticleStatus;
    const now = new Date().toISOString();
    const slug = await this.ensureUniqueSlug(data.slug || title);

    const payload = {
      slug,
      title,
      excerpt: data.excerpt ? String(data.excerpt).trim() || null : null,
      content: String(data.content || '').trim(),
      cover_image: data.cover_image ? String(data.cover_image).trim() || null : null,
      sector: data.sector || 'autre',
      budget_range: data.budget_range || 'petit',
      reading_time: data.reading_time || 5,
      status,
      featured: data.featured || false,
      author: String(data.author || DEFAULT_AUTHOR).trim() || DEFAULT_AUTHOR,
      meta_description: data.meta_description ? String(data.meta_description).trim() || null : null,
      published_at:
        status === 'published' && data.published_at
          ? String(data.published_at).trim() || now
          : status === 'published'
            ? now
            : data.published_at
              ? String(data.published_at).trim() || null
              : null,
    };

    const { data: created, error } = await supabase
      .from('entreprendre_articles')
      .insert(payload)
      .select()
      .maybeSingle();
    if (error || !created) {
      console.error('[entreprendreService] createSupabase error:', error?.message);
      return null;
    }
    return rowToArticleFromSupabase(created);
  }

  private static async updateSupabase(
    id: string,
    patch: Partial<EntreprendreArticleInsert>,
  ): Promise<EntreprendreArticle | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const existing = await this.getByIdSupabase(id);
    if (!existing) return null;

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!ARTICLE_UPDATE_COLUMNS.has(key)) continue;
      if (typeof value === 'string') {
        clean[key] = value.trim();
      } else {
        clean[key] = value;
      }
    }
    if (typeof clean.slug === 'string' && clean.slug.trim()) {
      clean.slug = await this.ensureUniqueSlug(clean.slug, id);
    } else {
      delete clean.slug;
    }
    if (clean.status === 'published' && !existing.published_at) {
      clean.published_at = new Date().toISOString();
    }
    if (Object.keys(clean).length === 0) return existing;

    const { data, error } = await supabase
      .from('entreprendre_articles')
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error || !data) {
      console.error('[entreprendreService] updateSupabase error:', error?.message);
      return null;
    }
    return rowToArticleFromSupabase(data);
  }

  private static async removeSupabase(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { data, error } = await supabase
      .from('entreprendre_articles')
      .delete()
      .eq('id', id)
      .select('id');
    return !error && Array.isArray(data) && data.length > 0;
  }
}

// ============================================================================
//  Service Commentaire
// ============================================================================
export class EntreprendreCommentService {
  // ---------------------------------------------------------- LIST
  static async list(filters: EntreprendreCommentFilters = {}): Promise<PaginatedEntreprendreComments> {
    if (isSupabaseConfigured()) return this.listSupabase(filters);

    const db = await getDb();
    if (!db) return { rows: [], total: 0 };

    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters.article_id) {
      clauses.push('article_id = $aid');
      params.$aid = filters.article_id;
    }
    if (filters.status) {
      const list = Array.isArray(filters.status) ? filters.status : [filters.status];
      const placeholders = list.map((_, i) => `$st${i}`).join(',');
      list.forEach((s, i) => (params[`$st${i}`] = s));
      clauses.push(`status IN (${placeholders})`);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(filters.limit || 50, 1), 200);
    const offset = Math.max(filters.offset || 0, 0);

    const rows = db
      .prepare(
        `SELECT * FROM entreprendre_comments ${whereSql} ORDER BY created_at DESC LIMIT $limit OFFSET $offset`,
      )
      .all({ ...params, $limit: limit, $offset: offset })
      .map(rowToComment);
    const total = (
      db.prepare(`SELECT COUNT(*) AS total FROM entreprendre_comments ${whereSql}`).get(params) as any
    ).total;
    return { rows, total };
  }

  // ---------------------------------------------------------- GET
  static async getById(id: string): Promise<EntreprendreComment | null> {
    if (isSupabaseConfigured()) return this.getByIdSupabase(id);
    const db = await getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM entreprendre_comments WHERE id = $id').get({ $id: id });
    return row ? rowToComment(row) : null;
  }

  // ---------------------------------------------------------- CREATE
  static async create(data: EntreprendreCommentInsert): Promise<EntreprendreComment | null> {
    if (isSupabaseConfigured()) return this.createSupabase(data);

    const db = await getDb();
    if (!db) return null;

    const content = String(data.content || '').trim();
    if (!content) return null;

    const res = db
      .prepare(
        `INSERT INTO entreprendre_comments (
          article_id, user_id, user_display_name, content, status, created_at
        ) VALUES (
          $article_id, $user_id, $user_display_name, $content, $status, datetime('now')
        ) RETURNING id`,
      )
      .get({
        $article_id: data.article_id,
        $user_id: data.user_id || null,
        $user_display_name: data.user_display_name || null,
        $content: content,
        $status: data.status || 'visible',
      }) as any;

    return res?.id ? this.getById(res.id) : null;
  }

  // ---------------------------------------------------------- UPDATE STATUS
  static async updateStatus(id: string, status: EntreprendreCommentStatus): Promise<EntreprendreComment | null> {
    if (isSupabaseConfigured()) return this.updateStatusSupabase(id, status);

    const db = await getDb();
    if (!db) return null;
    db.prepare('UPDATE entreprendre_comments SET status = $status WHERE id = $id').run({ $id: id, $status: status });
    return this.getById(id);
  }

  // ---------------------------------------------------------- REMOVE
  static async remove(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) return this.removeSupabase(id);
    const db = await getDb();
    if (!db) return false;
    return (db.prepare('DELETE FROM entreprendre_comments WHERE id = $id').run({ $id: id }).changes || 0) > 0;
  }

  // =========================================================================
  //  Implémentations Supabase (production)
  // =========================================================================

  private static async listSupabase(filters: EntreprendreCommentFilters): Promise<PaginatedEntreprendreComments> {
    const supabase = getSupabaseClient();
    if (!supabase) return { rows: [], total: 0 };

    let query = supabase.from('entreprendre_comments').select('*', { count: 'exact' });

    if (filters.article_id) {
      query = query.eq('article_id', filters.article_id);
    }
    if (filters.status) {
      const list = Array.isArray(filters.status) ? filters.status : [filters.status];
      if (list.length > 0) query = query.in('status', list);
    }

    query = query.order('created_at', { ascending: false });

    const safeLimit = Math.min(Math.max(filters.limit || 50, 1), 200);
    query = query.range(filters.offset || 0, (filters.offset || 0) + safeLimit - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error('[entreprendreService] listSupabase (comments) error:', error.message);
      return { rows: [], total: 0 };
    }
    return { rows: (data || []).map(rowToCommentFromSupabase), total: count || 0 };
  }

  private static async getByIdSupabase(id: string): Promise<EntreprendreComment | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('entreprendre_comments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToCommentFromSupabase(data);
  }

  private static async createSupabase(data: EntreprendreCommentInsert): Promise<EntreprendreComment | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const content = String(data.content || '').trim();
    if (!content) return null;

    const payload = {
      article_id: data.article_id,
      user_id: data.user_id || null,
      user_display_name: data.user_display_name || null,
      content,
      status: data.status || 'visible',
    };

    const { data: created, error } = await supabase
      .from('entreprendre_comments')
      .insert(payload)
      .select()
      .maybeSingle();
    if (error || !created) {
      console.error('[entreprendreService] createSupabase (comment) error:', error?.message);
      return null;
    }
    return rowToCommentFromSupabase(created);
  }

  private static async updateStatusSupabase(
    id: string,
    status: EntreprendreCommentStatus,
  ): Promise<EntreprendreComment | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('entreprendre_comments')
      .update({ status })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error || !data) return null;
    return rowToCommentFromSupabase(data);
  }

  private static async removeSupabase(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { data, error } = await supabase
      .from('entreprendre_comments')
      .delete()
      .eq('id', id)
      .select('id');
    return !error && Array.isArray(data) && data.length > 0;
  }
}
