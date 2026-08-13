/**
 *  TravaillerEnCi — src/services/social/socialPostService.ts
 *  Couche d'accès BDD des tâches sociales (table `social_posts`).
 *
 *  Même convention que les autres services : SQLite (local, node:sqlite) et
 *  Supabase (production) derrière une interface unique `SocialPostRepo`.
 *  La logique SQL est implémentée UNE fois (repo SQLite), et un adaptateur
 *  Supabase fournit la même interface. Les tests utilisent un repo en
 *  mémoire (`createSocialPostRepo` sur une DatabaseSync ':memory:').
 *
 *  Anti-doublon : contrainte UNIQUE (content_type, content_id, platform).
 *  Idempotence : `claim()` passe atomiquement queued|scheduled → publishing.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import type {
  SocialPlatform,
  SocialPost,
  SocialPostFilters,
  SocialPostStatus,
  SocialStats,
} from '@/types/social';
import { SOCIAL_TABLE } from './config';

// -----------------------------------------------------------------------------
//  Types locaux (node:sqlite)
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
//  Interface du repo
// -----------------------------------------------------------------------------

export interface SocialPostRepo {
  list(filters: SocialPostFilters): Promise<{ rows: SocialPost[]; total: number }>;
  getById(id: string): Promise<SocialPost | null>;
  /** Crée une tâche (ignore si (content_type, content_id, platform) existe déjà). */
  create(row: SocialCreateInput): Promise<SocialPost | null>;
  update(id: string, patch: Partial<SocialPost>): Promise<SocialPost | null>;
  /** Verrou atomique : queued|scheduled → publishing. Retourne null si déjà pris. */
  claim(id: string): Promise<SocialPost | null>;
  countByStatus(): Promise<SocialStats>;
  /** Tâches « utilisées » aujourd'hui (publiées + programmées + en cours). */
  countPlatformUsedToday(platform: SocialPlatform, nowIso: string): Promise<number>;
  /** Tâches dues (programmées, échéance atteinte, prêtes pour retry). */
  getDue(platform: SocialPlatform, nowIso: string, limit: number): Promise<SocialPost[]>;
  /** Tâche existante pour un contenu + plateforme (déduplication). */
  findForContent(
    contentType: string,
    contentId: string,
    platform: SocialPlatform,
  ): Promise<SocialPost | null>;
}

export interface SocialCreateInput {
  content_type: 'job' | 'internship' | 'scholarship' | 'exam';
  content_id: string;
  /** Instantané de l'intitulé (affichage admin) — optionnel. */
  content_title?: string | null;
  platform: SocialPlatform;
  status?: SocialPostStatus;
  priority?: number;
  scheduled_at?: string | null;
  text?: string | null;
  link_url?: string | null;
}

// -----------------------------------------------------------------------------
//  Normalisation des lignes
// -----------------------------------------------------------------------------

function rowToSocialPost(row: any): SocialPost {
  return {
    id: String(row.id),
    content_type: row.content_type,
    content_id: String(row.content_id),
    content_title: row.content_title ?? null,
    platform: row.platform,
    status: row.status,
    priority: Number(row.priority || 0),
    text: row.text ?? null,
    image_url: row.image_url ?? null,
    link_url: row.link_url ?? null,
    scheduled_at: row.scheduled_at ?? null,
    published_at: row.published_at ?? null,
    external_post_id: row.external_post_id ?? null,
    error_code: row.error_code ?? null,
    error_message: row.error_message ?? null,
    attempt_count: Number(row.attempt_count || 0),
    next_attempt_at: row.next_attempt_at ?? null,
    dry_run: row.dry_run === 1 || row.dry_run === true,
    payload_json: normalizePayload(row.payload_json),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizePayload(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

// -----------------------------------------------------------------------------
//  Repo SQLite (utilisé aussi en mémoire par les tests)
// -----------------------------------------------------------------------------

export function ensureSocialSchema(db: DatabaseSyncInstance) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_posts (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      content_type    TEXT NOT NULL,
      content_id      TEXT NOT NULL,
      content_title   TEXT,
      platform        TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'queued',
      priority        INTEGER NOT NULL DEFAULT 0,
      text            TEXT,
      image_url       TEXT,
      link_url        TEXT,
      scheduled_at    TEXT,
      published_at    TEXT,
      external_post_id TEXT,
      error_code      TEXT,
      error_message   TEXT,
      attempt_count   INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      dry_run         INTEGER NOT NULL DEFAULT 0,
      payload_json    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (content_type, content_id, platform)
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts (status);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts (scheduled_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_social_posts_platform_status ON social_posts (platform, status);');
}

export function createSocialPostRepo(db: DatabaseSyncInstance): SocialPostRepo {
  ensureSocialSchema(db);

  return {
    async list(filters) {
      const { status, platform, limit = 100, offset = 0 } = filters;
      const clauses: string[] = [];
      const params: Record<string, unknown> = {};
      if (status) {
        const list = Array.isArray(status) ? status : [status];
        const placeholders = list.map((_, i) => `$st${i}`).join(',');
        list.forEach((t, i) => (params[`$st${i}`] = t));
        clauses.push(`status IN (${placeholders})`);
      }
      if (platform) {
        clauses.push('platform = $pf');
        params.$pf = platform;
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = db
        .prepare(
          `SELECT * FROM social_posts ${where} ORDER BY created_at DESC LIMIT $limit OFFSET $offset`,
        )
        .all({ ...params, $limit: limit, $offset: offset })
        .map(rowToSocialPost);
      const total = (db.prepare(`SELECT COUNT(*) AS total FROM social_posts ${where}`).get(params) as any).total;
      return { rows, total: total || 0 };
    },

    async getById(id) {
      const row = db.prepare('SELECT * FROM social_posts WHERE id = $id').get({ $id: id });
      return row ? rowToSocialPost(row) : null;
    },

    async create(input) {
      const res = db
        .prepare(
          `INSERT OR IGNORE INTO social_posts (
            content_type, content_id, content_title, platform, status, priority,
            scheduled_at, text, link_url
          ) VALUES (
            $content_type, $content_id, $content_title, $platform, $status, $priority,
            $scheduled_at, $text, $link_url
          ) RETURNING id`,
        )
        .get({
          $content_type: input.content_type,
          $content_id: input.content_id,
          $content_title: input.content_title ?? null,
          $platform: input.platform,
          $status: input.status || 'queued',
          $priority: input.priority || 0,
          $scheduled_at: input.scheduled_at ?? null,
          $text: input.text ?? null,
          $link_url: input.link_url ?? null,
        }) as any;
      if (!res?.id) return null;
      return this.getById(res.id);
    },

    async update(id, patch) {
      const existing = await this.getById(id);
      if (!existing) return null;
      const allowed = new Set([
        'status', 'text', 'image_url', 'link_url', 'scheduled_at', 'published_at',
        'external_post_id', 'error_code', 'error_message', 'attempt_count',
        'next_attempt_at', 'dry_run', 'payload_json', 'priority', 'content_title',
      ]);
      const fields: string[] = [];
      const params: Record<string, unknown> = { $id: id };
      for (const [key, value] of Object.entries(patch)) {
        if (!allowed.has(key)) continue;
        fields.push(`${key} = $${key}`);
        if (key === 'dry_run') params[`$${key}`] = value ? 1 : 0;
        else if (key === 'payload_json' && value !== null && value !== undefined) {
          params[`$${key}`] = typeof value === 'string' ? value : JSON.stringify(value);
        } else params[`$${key}`] = value ?? null;
      }
      if (fields.length === 0) return existing;
      db.prepare(
        `UPDATE social_posts SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = $id`,
      ).run(params);
      return this.getById(id);
    },

    async claim(id) {
      const res = db
        .prepare(
          `UPDATE social_posts SET status = 'publishing', updated_at = datetime('now')
           WHERE id = $id AND status IN ('queued', 'scheduled')`,
        )
        .run({ $id: id });
      if ((res.changes || 0) === 0) return null;
      return this.getById(id);
    },

    async countByStatus() {
      const row = db
        .prepare(
          `SELECT
            SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queued,
            SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END) AS scheduled,
            SUM(CASE WHEN status='publishing' THEN 1 ELSE 0 END) AS publishing,
            SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) AS published,
            SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN status='ignored' THEN 1 ELSE 0 END) AS ignored,
            SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
            COUNT(*) AS total
           FROM social_posts`,
        )
        .get() as any;
      return {
        queued: row.queued || 0,
        scheduled: row.scheduled || 0,
        publishing: row.publishing || 0,
        published: row.published || 0,
        failed: row.failed || 0,
        ignored: row.ignored || 0,
        cancelled: row.cancelled || 0,
        total: row.total || 0,
      };
    },

    async countPlatformUsedToday(platform, nowIso) {
      const today = nowIso.slice(0, 10);
      const rows = db
        .prepare(
          `SELECT status, published_at, scheduled_at, created_at
           FROM social_posts WHERE platform = $pf AND status IN ('published','scheduled','publishing')`,
        )
        .all({ $pf: platform }) as Array<{
        status: string;
        published_at: string | null;
        scheduled_at: string | null;
        created_at: string | null;
      }>;
      return countUsedTodayRows(rows, today);
    },

    async getDue(platform, nowIso, limit) {
      const rows = db
        .prepare(
          `SELECT * FROM social_posts
           WHERE platform = $pf AND status = 'scheduled'
             AND scheduled_at <= $now
             AND (next_attempt_at IS NULL OR next_attempt_at <= $now)
           ORDER BY priority DESC, scheduled_at ASC
           LIMIT $limit`,
        )
        .all({ $pf: platform, $now: nowIso, $limit: limit })
        .map(rowToSocialPost);
      return rows;
    },

    async findForContent(contentType, contentId, platform) {
      const row = db
        .prepare(
          `SELECT * FROM social_posts
           WHERE content_type = $ct AND content_id = $cid AND platform = $pf
           LIMIT 1`,
        )
        .get({ $ct: contentType, $cid: contentId, $pf: platform });
      return row ? rowToSocialPost(row) : null;
    },
  };
}

/** Compte les tâches « utilisées » un jour donné (réutilisé côté Supabase). */
export function countUsedTodayRows(
  rows: Array<{ status: string; published_at: string | null; scheduled_at: string | null; created_at: string | null }>,
  today: string,
): number {
  return rows.filter((row) => {
    if (row.status === 'published') return (row.published_at || '').slice(0, 10) === today;
    if (row.status === 'publishing') return (row.created_at || '').slice(0, 10) === today;
    if (row.status === 'scheduled') return (row.scheduled_at || '').slice(0, 10) === today;
    return false;
  }).length;
}

// -----------------------------------------------------------------------------
//  Adapter Supabase (production)
// -----------------------------------------------------------------------------

function createSupabaseRepo(): SocialPostRepo {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase non configuré.');

  return {
    async list(filters) {
      let query = supabase.from(SOCIAL_TABLE).select('*', { count: 'exact' });
      if (filters.status) {
        const list = Array.isArray(filters.status) ? filters.status : [filters.status];
        query = query.in('status', list);
      }
      if (filters.platform) query = query.eq('platform', filters.platform);
      query = query.order('created_at', { ascending: false });
      const limit = Math.min(Math.max(filters.limit || 100, 1), 500);
      query = query.range(filters.offset || 0, (filters.offset || 0) + limit - 1);
      const { data, count, error } = await query;
      if (error) {
        console.error('social list error:', error.message);
        return { rows: [], total: 0 };
      }
      return { rows: (data || []).map(rowToSocialPost), total: count || 0 };
    },

    async getById(id) {
      const { data, error } = await supabase
        .from(SOCIAL_TABLE)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return null;
      return rowToSocialPost(data);
    },

    async create(input) {
      const { data, error } = await supabase
        .from(SOCIAL_TABLE)
        .upsert(
          {
            content_type: input.content_type,
            content_id: input.content_id,
            content_title: input.content_title ?? null,
            platform: input.platform,
            status: input.status || 'queued',
            priority: input.priority || 0,
            scheduled_at: input.scheduled_at ?? null,
            text: input.text ?? null,
            link_url: input.link_url ?? null,
          },
          { onConflict: 'content_type,content_id,platform', ignoreDuplicates: true },
        )
        .select()
        .maybeSingle();
      if (error || !data) return null;
      return rowToSocialPost(data);
    },

    async update(id, patch) {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        clean[key] = value;
      }
      if (Object.keys(clean).length === 0) return this.getById(id);
      const { data, error } = await supabase
        .from(SOCIAL_TABLE)
        .update(clean)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error || !data) return null;
      return rowToSocialPost(data);
    },

    async claim(id) {
      const { data, error } = await supabase
        .from(SOCIAL_TABLE)
        .update({ status: 'publishing', updated_at: new Date().toISOString() })
        .eq('id', id)
        .in('status', ['queued', 'scheduled'])
        .select()
        .maybeSingle();
      if (error || !data) return null;
      return rowToSocialPost(data);
    },

    async countByStatus() {
      const { data, error } = await supabase
        .from(SOCIAL_TABLE)
        .select('status');
      if (error || !data) {
        return { queued: 0, scheduled: 0, publishing: 0, published: 0, failed: 0, ignored: 0, cancelled: 0, total: 0 };
      }
      const count = (s: string) => data.filter((r) => r.status === s).length;
      return {
        queued: count('queued'),
        scheduled: count('scheduled'),
        publishing: count('publishing'),
        published: count('published'),
        failed: count('failed'),
        ignored: count('ignored'),
        cancelled: count('cancelled'),
        total: data.length,
      };
    },

    async countPlatformUsedToday(platform, nowIso) {
      const today = nowIso.slice(0, 10);
      const { data, error } = await supabase
        .from(SOCIAL_TABLE)
        .select('status,published_at,scheduled_at,created_at')
        .eq('platform', platform)
        .in('status', ['published', 'scheduled', 'publishing']);
      if (error || !data) return 0;
      return countUsedTodayRows(
        data as Array<{
          status: string;
          published_at: string | null;
          scheduled_at: string | null;
          created_at: string | null;
        }>,
        today,
      );
    },

    async getDue(platform, nowIso, limit) {
      const { data, error } = await supabase
        .from(SOCIAL_TABLE)
        .select('*')
        .eq('platform', platform)
        .eq('status', 'scheduled')
        .lte('scheduled_at', nowIso)
        .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
        .order('priority', { ascending: false })
        .order('scheduled_at', { ascending: true })
        .limit(Math.min(limit, 100));
      if (error || !data) return [];
      return data.map(rowToSocialPost);
    },

    async findForContent(contentType, contentId, platform) {
      const { data, error } = await supabase
        .from(SOCIAL_TABLE)
        .select('*')
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .eq('platform', platform)
        .maybeSingle();
      if (error || !data) return null;
      return rowToSocialPost(data);
    },
  };
}

// -----------------------------------------------------------------------------
//  Service public
// -----------------------------------------------------------------------------

/**
 * Override de test : permet aux tests unitaires d'injecter un repo en mémoire
 * (DatabaseSync ':memory:') sans toucher à la base locale ni à Supabase.
 */
let testRepoOverride: SocialPostRepo | null = null;

export function __setTestRepo(repo: SocialPostRepo | null): void {
  testRepoOverride = repo;
}

export class SocialPostService {
  /** Retourne le repo actif (SQLite local ou Supabase), ou null. */
  static async getRepo(): Promise<SocialPostRepo | null> {
    if (testRepoOverride) return testRepoOverride;
    if (isSupabaseConfigured()) {
      try {
        return createSupabaseRepo();
      } catch {
        return null;
      }
    }
    const db = await getLocalDb();
    if (!db) return null;
    return createSocialPostRepo(db);
  }

  static async list(filters: SocialPostFilters = {}): Promise<{ rows: SocialPost[]; total: number }> {
    const repo = await this.getRepo();
    if (!repo) return { rows: [], total: 0 };
    return repo.list(filters);
  }

  static async getById(id: string): Promise<SocialPost | null> {
    const repo = await this.getRepo();
    if (!repo) return null;
    return repo.getById(id);
  }

  static async create(input: SocialCreateInput): Promise<SocialPost | null> {
    const repo = await this.getRepo();
    if (!repo) return null;
    return repo.create(input);
  }

  static async update(id: string, patch: Partial<SocialPost>): Promise<SocialPost | null> {
    const repo = await this.getRepo();
    if (!repo) return null;
    return repo.update(id, patch);
  }

  static async claim(id: string): Promise<SocialPost | null> {
    const repo = await this.getRepo();
    if (!repo) return null;
    return repo.claim(id);
  }

  static async countByStatus(): Promise<SocialStats> {
    const repo = await this.getRepo();
    if (!repo) return { queued: 0, scheduled: 0, publishing: 0, published: 0, failed: 0, ignored: 0, cancelled: 0, total: 0 };
    return repo.countByStatus();
  }

  static async countPlatformUsedToday(platform: SocialPlatform): Promise<number> {
    const repo = await this.getRepo();
    if (!repo) return 0;
    return repo.countPlatformUsedToday(platform, new Date().toISOString());
  }

  static async getDue(platform: SocialPlatform, limit: number): Promise<SocialPost[]> {
    const repo = await this.getRepo();
    if (!repo) return [];
    return repo.getDue(platform, new Date().toISOString(), limit);
  }
}

// -----------------------------------------------------------------------------
//  DB SQLite locale
// -----------------------------------------------------------------------------

let cachedDb: DatabaseSyncInstance | null = null;

async function getLocalDb(): Promise<DatabaseSyncInstance | null> {
  if (cachedDb) return cachedDb;
  try {
    const mod = await import('node:sqlite');
    const { DatabaseSync } = mod as unknown as { DatabaseSync: new (path: string) => DatabaseSyncInstance };
    const { resolve: resolvePath } = (await import('node:path')) as typeof import('node:path');
    const { existsSync: exists, mkdirSync: mkdir } = (await import('node:fs')) as typeof import('node:fs');
    const dataDir = resolvePath(process.cwd(), 'data');
    if (!exists(dataDir)) mkdir(dataDir, { recursive: true });
    cachedDb = new DatabaseSync(resolvePath(dataDir, 'travaillerenci.sqlite3'));
    ensureSocialSchema(cachedDb);
    return cachedDb;
  } catch {
    return null;
  }
}

/**
 * Export de test : instance DatabaseSync (fichier ou ':memory:').
 * L'appelant peut ensuite créer un repo via `createSocialPostRepo(db)`.
 */
export async function openSocialDatabase(path: string = ':memory:'): Promise<DatabaseSyncInstance> {
  const mod = await import('node:sqlite');
  const { DatabaseSync } = mod as unknown as { DatabaseSync: new (p: string) => DatabaseSyncInstance };
  const db = new DatabaseSync(path);
  ensureSocialSchema(db);
  return db;
}
