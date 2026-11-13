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

const SQLITE_ARTICLE_COLUMNS = `
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
      review_deadline TEXT,
      auto_publish    INTEGER NOT NULL DEFAULT 0,
      admin_action    TEXT,
      admin_action_at TEXT,
      rejection_reason TEXT,
      validation_error TEXT,
      validation_checks TEXT,
      sources         TEXT,
      source_count    INTEGER NOT NULL DEFAULT 0,
      topic_key       TEXT,
      content_hash    TEXT,
      title_normalized TEXT,
      ai_model        TEXT,
      ai_confidence   REAL,
      manually_edited INTEGER NOT NULL DEFAULT 0,
      published_by    TEXT,
      view_count      INTEGER NOT NULL DEFAULT 0,
      archived_at     TEXT,
      last_error_at   TEXT,
      CONSTRAINT articles_status_check CHECK (status IN ('draft','pending_review','published','archived','rejected')),
      CONSTRAINT articles_category_check CHECK (category IN ('emploi','formation','concours','economie','carriere','guide','societe','technologie','afrique','entrepreneuriat','opportunites'))`;

/** Miroir SQLite de la table `articles`. */
function ensureSchema(db: DatabaseSyncInstance) {
  db.exec(`CREATE TABLE IF NOT EXISTS articles (${SQLITE_ARTICLE_COLUMNS}\n    );`);

  // Migration des bases locales créées avant le pipeline automatisé :
  // SQLite ne sait pas modifier une contrainte CHECK → reconstruction.
  const table = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='articles'`)
    .get() as { sql?: string } | undefined;
  const schemaSql = table?.sql || '';
  const legacy =
    !schemaSql.includes('review_deadline') ||
    !schemaSql.includes('pending_review') ||
    !schemaSql.includes('societe');

  if (legacy) {
    const existing = (db.prepare(`PRAGMA table_info(articles)`).all() as Array<{ name: string }>).map(
      (column) => column.name,
    );
    const desired = [
      'id', 'title', 'slug', 'excerpt', 'content', 'category', 'source_url',
      'cover_image', 'author', 'status', 'seo_title', 'seo_description',
      'seo_keywords', 'published_at', 'created_at', 'updated_at', 'review_deadline',
      'auto_publish', 'admin_action', 'admin_action_at', 'rejection_reason',
      'validation_error', 'validation_checks', 'sources', 'source_count',
      'topic_key', 'content_hash', 'title_normalized', 'ai_model', 'ai_confidence',
      'manually_edited', 'published_by', 'view_count', 'archived_at', 'last_error_at',
    ];
    const common = desired.filter((column) => existing.includes(column));
    db.exec(`ALTER TABLE articles RENAME TO articles_legacy;`);
    db.exec(`CREATE TABLE articles (${SQLITE_ARTICLE_COLUMNS}\n    );`);
    db.exec(
      `INSERT INTO articles (${common.join(',')}) SELECT ${common.join(',')} FROM articles_legacy;`,
    );
    db.exec(`DROP TABLE articles_legacy;`);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles (slug);`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles (published_at DESC);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_articles_review_deadline ON articles (status, review_deadline);`,
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_articles_view_count ON articles (view_count DESC);`);
}

// ---------------------------------------------------------------------------
// Normalisation des lignes
// ---------------------------------------------------------------------------
const ARTICLE_FULL_COLUMNS =
  'id,title,slug,excerpt,content,category,source_url,cover_image,author,status,seo_title,seo_description,seo_keywords,published_at,created_at,updated_at,review_deadline,auto_publish,admin_action,admin_action_at,rejection_reason,validation_error,validation_checks,sources,source_count,topic_key,content_hash,title_normalized,ai_model,ai_confidence,manually_edited,published_by,view_count,archived_at';

/** Toutes les colonnes sauf `content` (listes publiques et similaires). */
const ARTICLE_CARD_COLUMNS =
  'id,title,slug,excerpt,category,source_url,cover_image,author,status,seo_title,seo_description,seo_keywords,published_at,created_at,updated_at,review_deadline,auto_publish,admin_action,sources,source_count,ai_model,ai_confidence,manually_edited,published_by,view_count,archived_at';

function safeJsonArray(value: unknown): Article['sources'] {
  if (Array.isArray(value)) return value as Article['sources'];
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function safeJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return Boolean(value);
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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
    review_deadline: row.review_deadline || null,
    auto_publish: toBoolean(row.auto_publish),
    admin_action: row.admin_action || null,
    admin_action_at: row.admin_action_at || null,
    rejection_reason: row.rejection_reason || null,
    validation_error: row.validation_error || null,
    validation_checks: safeJsonObject(row.validation_checks),
    sources: safeJsonArray(row.sources),
    source_count: toNumber(row.source_count),
    topic_key: row.topic_key || null,
    content_hash: row.content_hash || null,
    title_normalized: row.title_normalized || null,
    ai_model: row.ai_model || null,
    ai_confidence: toNumber(row.ai_confidence) ?? null,
    manually_edited: toBoolean(row.manually_edited),
    published_by: (row.published_by as Article['published_by']) || null,
    view_count: toNumber(row.view_count) ?? 0,
    archived_at: row.archived_at || null,
  };
}

function rowToArticleFromSupabase(row: any): Article {
  return rowToArticle(row);
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
    const orderSafe = ['published_at', 'created_at', 'title', 'view_count', 'review_deadline'].includes(
      order_by!,
    )
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

    const status = data.status || 'draft';
    const res = db
      .prepare(
        `INSERT INTO articles (
          id, title, slug, excerpt, content, category, source_url, cover_image,
          author, status, seo_title, seo_description, seo_keywords,
          published_at, created_at, updated_at,
          review_deadline, auto_publish, admin_action, admin_action_at,
          rejection_reason, validation_error, validation_checks, sources,
          source_count, topic_key, content_hash, title_normalized,
          ai_model, ai_confidence, manually_edited, published_by,
          view_count, archived_at
        ) VALUES (
          $id, $title, $slug, $excerpt, $content, $category, $source_url, $cover_image,
          $author, $status, $seo_title, $seo_description, $seo_keywords,
          $published_at, $created_at, $updated_at,
          $review_deadline, $auto_publish, $admin_action, $admin_action_at,
          $rejection_reason, $validation_error, $validation_checks, $sources,
          $source_count, $topic_key, $content_hash, $title_normalized,
          $ai_model, $ai_confidence, $manually_edited, $published_by,
          $view_count, $archived_at
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
        $status: status,
        $seo_title: data.seo_title || null,
        $seo_description: data.seo_description || null,
        $seo_keywords: data.seo_keywords || null,
        $published_at: data.published_at || (status === 'published' ? now : null),
        $created_at: now,
        $updated_at: now,
        $review_deadline: data.review_deadline || null,
        $auto_publish: data.auto_publish ? 1 : 0,
        $admin_action: data.admin_action || null,
        $admin_action_at: data.admin_action_at || null,
        $rejection_reason: data.rejection_reason || null,
        $validation_error: data.validation_error || null,
        $validation_checks: data.validation_checks
          ? JSON.stringify(data.validation_checks)
          : null,
        $sources: data.sources?.length ? JSON.stringify(data.sources) : null,
        $source_count: data.source_count ?? data.sources?.length ?? 0,
        $topic_key: data.topic_key || null,
        $content_hash: data.content_hash || null,
        $title_normalized: data.title_normalized || null,
        $ai_model: data.ai_model || null,
        $ai_confidence: data.ai_confidence ?? null,
        $manually_edited: data.manually_edited ? 1 : 0,
        $published_by: data.published_by || (status === 'published' ? 'admin' : null),
        $view_count: data.view_count ?? 0,
        $archived_at: data.archived_at || null,
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

    const allowed = new Set([
      'title', 'slug', 'excerpt', 'content', 'category', 'source_url', 'cover_image',
      'author', 'status', 'seo_title', 'seo_description', 'seo_keywords', 'published_at',
      'review_deadline', 'auto_publish', 'admin_action', 'admin_action_at',
      'rejection_reason', 'validation_error', 'validation_checks', 'sources',
      'source_count', 'topic_key', 'content_hash', 'title_normalized', 'ai_model',
      'ai_confidence', 'manually_edited', 'published_by', 'view_count', 'archived_at',
      'last_error_at',
    ]);

    const fields: string[] = [];
    const params: Record<string, unknown> = { $id: id };
    let idx = 0;

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || !allowed.has(key)) continue;
      const paramName = `$v${idx++}`;
      fields.push(`${key} = ${paramName}`);
      if (key === 'slug' && typeof value === 'string') {
        params[paramName] = slugify(value);
      } else if (key === 'sources' || key === 'validation_checks') {
        params[paramName] = value ? JSON.stringify(value) : null;
      } else if (typeof value === 'boolean') {
        params[paramName] = value ? 1 : 0;
      } else {
        params[paramName] = value;
      }
    }

    if (patch.status === 'published' && !existing.published_at) {
      fields.push(`published_at = $publishedAt`);
      params.$publishedAt = new Date().toISOString();
    }
    if (patch.status === 'pending_review') {
      fields.push(`published_at = NULL`);
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

    const columns: string =
      filters.fields === 'card' ? ARTICLE_CARD_COLUMNS : ARTICLE_FULL_COLUMNS;
    let query = supabase.from('articles').select(columns as any, { count: 'exact' });

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

    const orderSafe = ['published_at', 'created_at', 'title', 'view_count', 'review_deadline'].includes(
      order_by!,
    )
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
    const status = input.status || 'draft';
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
      status,
      seo_title: input.seo_title || null,
      seo_description: input.seo_description || null,
      seo_keywords: input.seo_keywords || null,
      published_at: input.published_at || (status === 'published' ? new Date().toISOString() : null),
      review_deadline: input.review_deadline || null,
      auto_publish: input.auto_publish ?? false,
      admin_action: input.admin_action || null,
      admin_action_at: input.admin_action_at || null,
      rejection_reason: input.rejection_reason || null,
      validation_error: input.validation_error || null,
      validation_checks: input.validation_checks ?? {},
      sources: input.sources ?? [],
      source_count: input.source_count ?? input.sources?.length ?? 0,
      topic_key: input.topic_key || null,
      content_hash: input.content_hash || null,
      title_normalized: input.title_normalized || null,
      ai_model: input.ai_model || null,
      ai_confidence: input.ai_confidence ?? null,
      manually_edited: input.manually_edited ?? false,
      published_by: input.published_by || (status === 'published' ? 'admin' : null),
      view_count: input.view_count ?? 0,
      archived_at: input.archived_at || null,
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

    const allowed = new Set([
      'title', 'slug', 'excerpt', 'content', 'category', 'source_url', 'cover_image',
      'author', 'status', 'seo_title', 'seo_description', 'seo_keywords', 'published_at',
      'review_deadline', 'auto_publish', 'admin_action', 'admin_action_at',
      'rejection_reason', 'validation_error', 'validation_checks', 'sources',
      'source_count', 'topic_key', 'content_hash', 'title_normalized', 'ai_model',
      'ai_confidence', 'manually_edited', 'published_by', 'view_count', 'archived_at',
      'last_error_at',
    ]);

    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || !allowed.has(key)) continue;
      payload[key] = key === 'slug' ? slugify(String(value)) : value;
    }

    if (patch.status === 'published' && !existing.published_at) {
      payload.published_at = new Date().toISOString();
    }
    if (patch.status === 'pending_review') {
      payload.published_at = null;
    }

    if (Object.keys(payload).length === 0) return existing;
    payload.updated_at = new Date().toISOString();

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
