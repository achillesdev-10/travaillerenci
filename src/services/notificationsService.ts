/**
 *  TravaillerEnCi — src/services/notificationsService.ts
 *  Notifications récentes du candidat : alertes déclenchées, sauvegardes
 *  modifiées, événements de compte.
 *
 *  • Local : SQLite (table `notifications`, fichier ./data/travaillerenci.sqlite3)
 *  • Prod  : Supabase (migration 0020_notifications.sql) — service_role.
 *
 *  RLS Supabase fermée au client anon : les lectures passent par les routes
 *  serveur /api/notifications après vérification de session.
 */

import 'server-only';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export type NotificationType =
  | 'alert_match'       // Nouvel élément correspondant à une alerte
  | 'saved_update'      // Mise à jour d'un élément sauvegardé
  | 'account_event'     // Événement de compte (bienvenue, vérification…)
  | 'system';           // Annonce système / maintenance

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  /** Titre court de la notification. */
  title: string;
  /** Description détaillée (optionnelle). */
  body: string | null;
  /** Lien cible au clic (route interne ou URL externe). */
  link: string | null;
  /** Type d'élément concerné (si applicable). */
  item_type: string | null;
  /** ID de l'élément concerné (si applicable). */
  item_id: string | null;
  /** La notification a-t-elle été lue ? */
  read: boolean;
  created_at: string;
}

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
    cachedDb = new DatabaseSync(resolvePath(dataDir, 'travaillerenci.sqlite3'));
    cachedDb.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id    TEXT NOT NULL,
        type       TEXT NOT NULL CHECK (type IN ('alert_match','saved_update','account_event','system')),
        title      TEXT NOT NULL,
        body       TEXT,
        link       TEXT,
        item_type  TEXT,
        item_id    TEXT,
        read       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read, created_at DESC);
    `);
    return cachedDb;
  } catch {
    return null;
  }
}

function rowToNotification(row: any): Notification {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: row.type as NotificationType,
    title: String(row.title),
    body: row.body ?? null,
    link: row.link ?? null,
    item_type: row.item_type ?? null,
    item_id: row.item_id ?? null,
    read: Boolean(row.read),
    created_at: row.created_at ?? '',
  };
}

/** Nombre max de notifications retournées par défaut. */
const DEFAULT_LIMIT = 30;

export class NotificationsService {
  /**
   * Liste les notifications d'un utilisateur (plus récentes en premier).
   */
  static async list(userId: string, limit = DEFAULT_LIMIT): Promise<Notification[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return (data || []).map(rowToNotification);
    }

    const db = await getDb();
    if (!db) return [];
    const rows = db
      .prepare(
        'SELECT * FROM notifications WHERE user_id = $userId ORDER BY created_at DESC LIMIT $limit',
      )
      .all({ $userId: userId, $limit: limit });
    return rows.map(rowToNotification);
  }

  /**
   * Nombre de notifications non lues.
   */
  static async unreadCount(userId: string): Promise<number> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return 0;
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);
      return count ?? 0;
    }

    const db = await getDb();
    if (!db) return 0;
    const row = db
      .prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = $userId AND read = 0')
      .get({ $userId: userId }) as { cnt: number } | undefined;
    return row?.cnt ?? 0;
  }

  /**
   * Marque une notification comme lue.
   */
  static async markRead(userId: string, notificationId: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return false;
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);
      return !error;
    }

    const db = await getDb();
    if (!db) return false;
    const result = db
      .prepare('UPDATE notifications SET read = 1 WHERE id = $id AND user_id = $userId')
      .run({ $id: notificationId, $userId: userId });
    return result.changes > 0;
  }

  /**
   * Marque toutes les notifications d'un utilisateur comme lues.
   */
  static async markAllRead(userId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      return;
    }

    const db = await getDb();
    if (!db) return;
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = $userId AND read = 0').run({
      $userId: userId,
    });
  }

  /**
   * Crée une notification.
   */
  static async create(
    userId: string,
    input: {
      type: NotificationType;
      title: string;
      body?: string | null;
      link?: string | null;
      item_type?: string | null;
      item_id?: string | null;
    },
  ): Promise<Notification | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
          item_type: input.item_type ?? null,
          item_id: input.item_id ?? null,
        })
        .select()
        .maybeSingle();
      if (error || !data) {
        console.error('notificationsService.create error:', error?.message);
        return null;
      }
      return rowToNotification(data);
    }

    const db = await getDb();
    if (!db) return null;
    const id = globalThis.crypto?.randomUUID?.() || `notif-${Date.now().toString(36)}`;
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, link, item_type, item_id)
       VALUES ($id, $userId, $type, $title, $body, $link, $itemType, $itemId)`,
    ).run({
      $id: id,
      $userId: userId,
      $type: input.type,
      $title: input.title,
      $body: input.body ?? null,
      $link: input.link ?? null,
      $itemType: input.item_type ?? null,
      $itemId: input.item_id ?? null,
    });
    // Relire pour récupérer created_at
    const row = db.prepare('SELECT * FROM notifications WHERE id = $id').get({ $id: id });
    return row ? rowToNotification(row) : null;
  }

  /**
   * Supprime une notification.
   */
  static async remove(userId: string, notificationId: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return false;
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);
      return !error;
    }

    const db = await getDb();
    if (!db) return false;
    return (
      db
        .prepare('DELETE FROM notifications WHERE id = $id AND user_id = $userId')
        .run({ $id: notificationId, $userId: userId }).changes > 0
    );
  }
}
