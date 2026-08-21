/**
 *  TravaillerEnCi — Service du module Actualités (table `articles`)
 *  Chemin : src/services/articleService.ts
 *
 *  Couche d'abstraction typée sur la table `articles` :
 *   • Local  : SQLite (fichier ./data/travaillerenci.sqlite3, table `articles`)
 *   • Prod   : Supabase via le SDK — signatures 1:1.
 */

import type {
  Article,
  ArticleCategory,
  ArticleFilters,
  ArticleInsert,
  ArticleStatus,
  PaginatedArticles,
} from '@/types/article';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { slugify } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types BDD locaux (node:sqlite)
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

let cachedDb: DatabaseSyncInstance | null = null;
async function getDb(): Promise<DatabaseSyncInstance | null> {
  if (cachedDb) return cachedDb;
  try {
    const mod = await import('node:sqlite');
    const { DatabaseSync } = mod as unknown as {
      DatabaseSync: new (path: string) => DatabaseSyncInstance;
    };
    const { resolve: resolvePath } = (await import('node:path')) as typeof import('node:path');
    const {
      existsSync: exists,
      mkdirSync: mkdir,
    } = (await import('node:fs')) as typeof import('node:fs');
    const dataDir = resolvePath(process.cwd(), 'data');
    if (!exists(dataDir)) mkdir(dataDir, { recursive: true });
    cachedDb = new DatabaseSync(resolvePath(dataDir, 'travaillerenci.sqlite3'));
    ensureSchema(cachedDb);
    return cachedDb;
  } catch {
    return null;
  }
}

/** Miroir SQLite de la table `articles`. */
function ensureSchema(db: DatabaseSyncInstance) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      title           TEXT NOT NULL,
      slug            TEXT NOT NULL UNIQUE,
      excerpt         TEXT NOT NULL DEFAULT '',
      content         TEXT NOT NULL DEFAULT '',
      category        TEXT NOT NULL DEFAULT 'emploi',
      source_url      TEXT,
      cover_image     TEXT,
      author          TEXT NOT NULL DEFAULT 'TravaillerenCi',
      status          TEXT NOT NULL DEFAULT 'draft',
      seo_title       TEXT,
      seo_description TEXT,
      seo_keywords    TEXT,
      published_at    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT articles_status_check CHECK (status IN ('draft','published','archived')),
      CONSTRAINT articles_category_check CHECK (category IN ('emploi','formation','concours','economie','carriere','guide'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles (slug);`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles (published_at DESC);`,
  );
}

// ---------------------------------------------------------------------------
// Normalisation des lignes
// ---------------------------------------------------------------------------
function rowToArticle(row: any): Article {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt || '',
    content: row.content || '',
    category: (row.category as ArticleCategory) || 'emploi',
    source_url: row.source_url || null,
    cover_image: row.cover_image || null,
    author: row.author || 'TravaillerenCi',
    status: (row.status as ArticleStatus) || 'draft',
    seo_title: row.seo_title || null,
    seo_description: row.seo_description || null,
    seo_keywords: row.seo_keywords || null,
    published_at: row.published_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToArticleFromSupabase(row: any): Article {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt || '',
    content: row.content || '',
    category: (row.category as ArticleCategory) || 'emploi',
    source_url: row.source_url || null,
    cover_image: row.cover_image || null,
    author: row.author || 'TravaillerenCi',
    status: (row.status as ArticleStatus) || 'draft',
    seo_title: row.seo_title || null,
    seo_description: row.seo_description || null,
    seo_keywords: row.seo_keywords || null,
    published_at: row.published_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
export class ArticleService {
  // ------------------------------------------------------------ LIST
  static async list(filters: ArticleFilters = {}): Promise<PaginatedArticles> {
    if (isSupabaseConfigured()) return this.listSupabase(filters);
    const db = await getDb();
    if (!db) return { rows: [], total: 0 };

    const {
      keyword,
      category,
      status,
      limit = 20,
      offset = 0,
      order_by = 'published_at',
      order_dir = 'desc',
    } = filters;

    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (keyword) {
      clauses.push('(title LIKE $kw OR excerpt LIKE $kw OR content LIKE $kw)');
      params.$kw = `%${keyword}%`;
    }
    if (category) {
      const list = Array.isArray(category) ? category : [category];
      const placeholders = list.map((_, i) => `$cat${i}`).join(',');
      list.forEach((t, i) => (params[`$cat${i}`] = t));
      clauses.push(`category IN (${placeholders})`);
    }
    if (status) {
      const list = Array.isArray(status) ? status : [status];
      const placeholders = list.map((_, i) => `$st${i}`).join(',');
      list.forEach((t, i) => (params[`$st${i}`] = t));
      clauses.push(`status IN (${placeholders})`);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderSafe = ['published_at', 'created_at', 'title'].includes(order_by!)
      ? order_by!
      : 'published_at';
    const dirSafe = order_dir === 'asc' ? 'ASC' : 'DESC';

    const rows = db
      .prepare(
        `SELECT * FROM articles ${whereSql} ORDER BY ${orderSafe} ${dirSafe} LIMIT $limit OFFSET $offset`,
      )
      .all({ ...params, $limit: limit, $offset: offset })
      .map(rowToArticle);
    const total = (
      db.prepare(`SELECT COUNT(*) AS total FROM articles ${whereSql}`).get(params) as any
    ).total;
    return { rows, total };
  }

  // ------------------------------------------------------------ GET
  static async getById(id: string): Promise<Article | null> {
    if (isSupabaseConfigured()) return this.getByIdSupabase(id);
    const db = await getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM articles WHERE id = $id').get({ $id: id });
    return row ? rowToArticle(row) : null;
  }

  static async getBySlug(slug: string): Promise<Article | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data } = await supabase.from('articles').select('*').eq('slug', slug).maybeSingle();
      return data ? rowToArticleFromSupabase(data) : null;
    }
    const db = await getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM articles WHERE slug = $slug').get({ $slug: slug });
    return row ? rowToArticle(row) : null;
  }

  // ------------------------------------------------------------ CREATE
  static async create(data: Partial<ArticleInsert>): Promise<Article | null> {
    if (isSupabaseConfigured()) return this.createSupabase(data);
    const db = await getDb();
    if (!db) return null;

    const title = String(data.title || '').trim();
    const slug = data.slug?.trim() || slugify(title);
    if (!title) return null;

    const now = new Date().toISOString();
    const id = globalThis.crypto?.randomUUID?.() || slugify(`${title}-${now}`);

    const res = db
      .prepare(
        `INSERT INTO articles (
          id, title, slug, excerpt, content, category, source_url, cover_image,
          author, status, seo_title, seo_description, seo_keywords,
          published_at, created_at, updated_at
        ) VALUES (
          $id, $title, $slug, $excerpt, $content, $category, $source_url, $cover_image,
          $author, $status, $seo_title, $seo_description, $seo_keywords,
          $published_at, $created_at, $updated_at
        )`,
      )
      .run({
        $id: id,
        $title: title,
        $slug: slug,
        $excerpt: (data.excerpt || '').trim(),
        $content: (data.content || '').trim(),
        $category: data.category || 'emploi',
        $source_url: data.source_url || null,
        $cover_image: data.cover_image || null,
        $author: data.author || 'TravaillerenCi',
        $status: data.status || 'draft',
        $seo_title: data.seo_title || null,
        $seo_description: data.seo_description || null,
        $seo_keywords: data.seo_keywords || null,
        $published_at: data.status === 'published' ? now : null,
        $created_at: now,
        $updated_at: now,
      });

    return res.changes > 0 ? this.getById(id) : null;
  }

  // ------------------------------------------------------------ UPDATE
  static async update(id: string, patch: Partial<ArticleInsert>): Promise<Article | null> {
    if (isSupabaseConfigured()) return this.updateSupabase(id, patch);
    const db = await getDb();
    if (!db) return null;

    const existing = await this.getById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: Record<string, unknown> = { $id: id };
    let idx = 0;

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const paramName = `$v${idx++}`;
      if (key === 'slug' && typeof value === 'string') {
        fields.push(`slug = ${paramName}`);
        params[paramName] = slugify(value);
      } else {
        fields.push(`${key} = ${paramName}`);
        params[paramName] = value;
      }
    }

    if (fields.length === 0) return existing;

    db.prepare(`UPDATE articles SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = $id`).run(params);
    return this.getById(id);
  }

  // ------------------------------------------------------------ REMOVE
  static async remove(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) return this.removeSupabase(id);
    const db = await getDb();
    if (!db) return false;
    return (db.prepare('DELETE FROM articles WHERE id = $id').run({ $id: id }).changes || 0) > 0;
  }

  // =========================================================================
  //  Implémentations Supabase (production)
  // =========================================================================
  private static async listSupabase(filters: ArticleFilters): Promise<PaginatedArticles> {
    const supabase = getSupabaseClient();
    if (!supabase) return { rows: [], total: 0 };

    const {
      keyword,
      category,
      status,
      limit = 20,
      offset = 0,
      order_by = 'published_at',
      order_dir = 'desc',
    } = filters;

    let query = supabase.from('articles').select('*', { count: 'exact' });

    if (keyword) {
      const safe = keyword.replace(/[,.( )*!]/g, ' ').trim();
      if (safe) {
        const pattern = `%${safe}%`;
        query = query.or(
          `title.ilike.${pattern},excerpt.ilike.${pattern},content.ilike.${pattern}`,
        );
      }
    }
    if (category) {
      const list = Array.isArray(category) ? category : [category];
      if (list.length > 0) query = query.in('category', list);
    }
    if (status) {
      const list = Array.isArray(status) ? status : [status];
      if (list.length > 0) query = query.in('status', list);
    }

    const orderSafe = ['published_at', 'created_at', 'title'].includes(order_by!)
      ? order_by!
      : 'published_at';
    query = query.order(orderSafe, { ascending: order_dir !== 'desc' });

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    query = query.range(offset, offset + safeLimit - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error('ArticleService.listSupabase error:', error.message);
      return { rows: [], total: 0 };
    }
    return { rows: (data || []).map(rowToArticleFromSupabase), total: count || 0 };
  }

  private static async getByIdSupabase(id: string): Promise<Article | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToArticleFromSupabase(data);
  }

  private static async createSupabase(input: Partial<ArticleInsert>): Promise<Article | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const title = String(input.title || '').trim();
    const slug = input.slug?.trim() || slugify(title);
    if (!title) return null;

    const id = globalThis.crypto?.randomUUID?.();
    const payload: Record<string, unknown> = {
      id,
      title,
      slug,
      excerpt: input.excerpt || '',
      content: input.content || '',
      category: input.category || 'emploi',
      source_url: input.source_url || null,
      cover_image: input.cover_image || null,
      author: input.author || 'TravaillerenCi',
      status: input.status || 'draft',
      seo_title: input.seo_title || null,
      seo_description: input.seo_description || null,
      seo_keywords: input.seo_keywords || null,
      published_at: input.status === 'published' ? new Date().toISOString() : null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('articles')
      .insert(payload)
      .select()
      .maybeSingle();
    if (insertError || !inserted) return null;
    return rowToArticleFromSupabase(inserted);
  }

  private static async updateSupabase(
    id: string,
    patch: Partial<ArticleInsert>,
  ): Promise<Article | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const existing = await this.getByIdSupabase(id);
    if (!existing) return null;

    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      payload[key] = key === 'slug' ? slugify(String(value)) : value;
    }
    if (Object.keys(payload).length === 0) return existing;

    const { data, error } = await supabase
      .from('articles')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error || !data) return null;
    return rowToArticleFromSupabase(data);
  }

  private static async removeSupabase(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { error } = await supabase.from('articles').delete().eq('id', id);
    return !error;
  }
}
