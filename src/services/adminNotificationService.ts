/**
 *  TravaillerenCi — Service Notifications Admin
 *  Chemin : src/services/adminNotificationService.ts
 *
 *  Gestion des notifications du centre de notifications admin :
 *   • Local : via `node:sqlite`
 *   • Prod  : via le SDK Supabase
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminNotificationType =
  | 'scraper_error'
  | 'scraper_alert'
  | 'new_report'
  | 'new_recruiter_pending'
  | 'new_comment_reported'
  | 'system';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// SQLite (module natif)
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
    const { existsSync: exists, mkdirSync: mkdir } = (await import('node:fs')) as typeof import('node:fs');
    const dataDir = resolvePath(process.cwd(), 'data');
    if (!exists(dataDir)) mkdir(dataDir, { recursive: true });
    const dbPath = resolvePath(dataDir, 'travaillerenci.sqlite3');
    cachedDb = new DatabaseSync(dbPath);
    ensureSchema(cachedDb);
    return cachedDb;
  } catch (err) {
    console.error('[adminNotificationService] SQLite indisponible :', err);
    return null;
  }
}

function ensureSchema(db: DatabaseSyncInstance) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      type        TEXT NOT NULL DEFAULT 'system',
      message     TEXT NOT NULL,
      link        TEXT,
      read        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT admin_notif_type CHECK (type IN ('scraper_error','scraper_alert','new_report','new_recruiter_pending','new_comment_reported','system'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_notif_read ON admin_notifications (read, created_at DESC);`);
}

function rowToNotification(row: any): AdminNotification {
  return {
    id: String(row.id),
    type: String(row.type) as AdminNotificationType,
    message: String(row.message),
    link: row.link ?? null,
    read: row.read === 1 || row.read === true,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function rowToNotificationFromSupabase(row: any): AdminNotification {
  return {
    id: String(row.id),
    type: String(row.type) as AdminNotificationType,
    message: String(row.message),
    link: row.link ?? null,
    read: Boolean(row.read),
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AdminNotificationService {
  /**
   * Récupère les notifications (les plus récentes d'abord), avec un filtre optionnel.
   */
  static async list(options: { unreadOnly?: boolean; limit?: number } = {}): Promise<AdminNotification[]> {
    if (isSupabaseConfigured()) return this.listSupabase(options);

    const db = await getDb();
    if (!db) return [];

    const limit = Math.min(Math.max(options.limit || 30, 1), 100);
    const where = options.unreadOnly ? 'WHERE read = 0' : '';

    try {
      const rows = db
        .prepare(
          `SELECT * FROM admin_notifications ${where} ORDER BY created_at DESC LIMIT ?`,
        )
        .all({ $limit: limit }) as any[];
      return rows.map(rowToNotification);
    } catch {
      return [];
    }
  }

  /**
   * Nombre de notifications non lues.
   */
  static async unreadCount(): Promise<number> {
    if (isSupabaseConfigured()) return this.unreadCountSupabase();

    const db = await getDb();
    if (!db) return 0;

    try {
      const row = db
        .prepare('SELECT COUNT(*) AS c FROM admin_notifications WHERE read = 0')
        .get() as { c?: number };
      return Number(row?.c ?? 0);
    } catch {
      return 0;
    }
  }

  /**
   * Crée une notification.
   */
  static async create(
    type: AdminNotificationType,
    message: string,
    link?: string | null,
  ): Promise<AdminNotification | null> {
    if (isSupabaseConfigured()) return this.createSupabase(type, message, link);

    const db = await getDb();
    if (!db) return null;

    try {
      const row = db
        .prepare(
          `INSERT INTO admin_notifications (type, message, link) VALUES ($type, $message, $link) RETURNING id`,
        )
        .get({ $type: type, $message: message, $link: link ?? null }) as any;
      return row?.id ? this.getById(row.id) : null;
    } catch {
      return null;
    }
  }

  /**
   * Marque une notification comme lue.
   */
  static async markAsRead(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) return this.markAsReadSupabase(id);

    const db = await getDb();
    if (!db) return false;

    try {
      const result = db
        .prepare('UPDATE admin_notifications SET read = 1 WHERE id = $id')
        .run({ $id: id }) as { changes?: number };
      return (result.changes ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Marque toutes les notifications comme lues.
   */
  static async markAllAsRead(): Promise<number> {
    if (isSupabaseConfigured()) return this.markAllAsReadSupabase();

    const db = await getDb();
    if (!db) return 0;

    try {
      const result = db
        .prepare('UPDATE admin_notifications SET read = 1 WHERE read = 0')
        .run() as { changes?: number };
      return result.changes ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Récupère une notification par ID.
   */
  static async getById(id: string): Promise<AdminNotification | null> {
    if (isSupabaseConfigured()) return this.getByIdSupabase(id);

    const db = await getDb();
    if (!db) return null;

    try {
      const row = db
        .prepare('SELECT * FROM admin_notifications WHERE id = $id')
        .get({ $id: id }) as any;
      return row ? rowToNotification(row) : null;
    } catch {
      return null;
    }
  }

  /**
   * Supprime les notifications de plus de 30 jours.
   */
  static async purge(): Promise<number> {
    if (isSupabaseConfigured()) return this.purgeSupabase();

    const db = await getDb();
    if (!db) return 0;

    try {
      const result = db
        .prepare(
          `DELETE FROM admin_notifications WHERE created_at < datetime('now', '-30 days')`,
        )
        .run() as { changes?: number };
      return result.changes ?? 0;
    } catch {
      return 0;
    }
  }

  // =========================================================================
  //  Supabase
  // =========================================================================

  private static async listSupabase(options: { unreadOnly?: boolean; limit?: number }): Promise<AdminNotification[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const limit = Math.min(Math.max(options.limit || 30, 1), 100);
    let query = supabase.from('admin_notifications').select('*');
    if (options.unreadOnly) query = query.eq('read', false);
    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(rowToNotificationFromSupabase);
  }

  private static async unreadCountSupabase(): Promise<number> {
    const supabase = getSupabaseClient();
    if (!supabase) return 0;

    const { count } = await supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false);
    return count || 0;
  }

  private static async createSupabase(
    type: AdminNotificationType,
    message: string,
    link?: string | null,
  ): Promise<AdminNotification | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('admin_notifications')
      .insert({ type, message, link: link ?? null })
      .select()
      .maybeSingle();
    if (error || !data) return null;
    return rowToNotificationFromSupabase(data);
  }

  private static async markAsReadSupabase(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from('admin_notifications')
      .update({ read: true })
      .eq('id', id);
    return !error;
  }

  private static async markAllAsReadSupabase(): Promise<number> {
    const supabase = getSupabaseClient();
    if (!supabase) return 0;

    const { data, error } = await supabase
      .from('admin_notifications')
      .update({ read: true })
      .eq('read', false)
      .select('id');
    return error ? 0 : (data?.length ?? 0);
  }

  private static async getByIdSupabase(id: string): Promise<AdminNotification | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('admin_notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToNotificationFromSupabase(data);
  }

  private static async purgeSupabase(): Promise<number> {
    const supabase = getSupabaseClient();
    if (!supabase) return 0;

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('admin_notifications')
      .delete()
      .lt('created_at', cutoff)
      .select('id');
    return error ? 0 : (data?.length ?? 0);
  }
}
