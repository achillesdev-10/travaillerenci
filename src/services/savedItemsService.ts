/**
 *  TravaillerEnCi — src/services/savedItemsService.ts
 *  Éléments sauvegardés par un candidat (étoile) : offres d'emploi, stages,
 *  bourses et concours — identifiés par (item_type, item_id).
 *
 *  • Local : SQLite (table `saved_items`, fichier ./data/travaillerenci.sqlite3)
 *  • Prod  : Supabase (migration 0016_saved_items.sql) — service_role.
 *
 *  RLS Supabase fermée au client anon : toutes les lectures/écritures passent
 *  par les routes serveur /api/saved après vérification de session.
 */

import 'server-only';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export type SavedItemType = 'job' | 'internship' | 'scholarship' | 'exam';

export const SAVED_ITEM_TYPES: SavedItemType[] = [
  'job',
  'internship',
  'scholarship',
  'exam',
];

export interface SavedItem {
  id: string;
  user_id: string;
  item_type: SavedItemType;
  item_id: string;
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
      CREATE TABLE IF NOT EXISTS saved_items (
        id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id    TEXT NOT NULL,
        item_type  TEXT NOT NULL CHECK (item_type IN ('job','internship','scholarship','exam')),
        item_id    TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, item_type, item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_saved_items_user ON saved_items (user_id, created_at DESC);
    `);
    return cachedDb;
  } catch {
    return null;
  }
}

function rowToItem(row: any): SavedItem {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    item_type: row.item_type as SavedItemType,
    item_id: String(row.item_id),
    created_at: row.created_at ?? '',
  };
}

export class SavedItemsService {
  /** Tous les éléments sauvegardés d'un utilisateur (du plus récent au plus ancien). */
  static async list(userId: string): Promise<SavedItem[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return [];
      const { data } = await supabase
        .from('saved_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return (data || []).map(rowToItem);
    }

    const db = await getDb();
    if (!db) return [];
    const rows = db
      .prepare('SELECT * FROM saved_items WHERE user_id = $userId ORDER BY created_at DESC')
      .all({ $userId: userId });
    return rows.map(rowToItem);
  }

  /** Vrai si l'élément est déjà sauvegardé. */
  static async isSaved(
    userId: string,
    itemType: SavedItemType,
    itemId: string,
  ): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return false;
      const { data } = await supabase
        .from('saved_items')
        .select('id')
        .eq('user_id', userId)
        .eq('item_type', itemType)
        .eq('item_id', itemId)
        .maybeSingle();
      return Boolean(data);
    }

    const db = await getDb();
    if (!db) return false;
    const row = db
      .prepare('SELECT id FROM saved_items WHERE user_id = $userId AND item_type = $type AND item_id = $itemId')
      .get({ $userId: userId, $type: itemType, $itemId: itemId });
    return Boolean(row);
  }

  /** Ajoute un élément sauvegardé (idempotent). Retourne le SavedItem ou null. */
  static async add(
    userId: string,
    itemType: SavedItemType,
    itemId: string,
  ): Promise<SavedItem | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('saved_items')
        .upsert({ user_id: userId, item_type: itemType, item_id: itemId }, { onConflict: 'user_id,item_type,item_id' })
        .select()
        .maybeSingle();
      if (error || !data) {
        console.error('savedItemsService.add error:', error?.message);
        return null;
      }
      return rowToItem(data);
    }

    const db = await getDb();
    if (!db) return null;
    db.prepare(
      'INSERT OR IGNORE INTO saved_items (user_id, item_type, item_id) VALUES ($userId, $type, $itemId)',
    ).run({ $userId: userId, $type: itemType, $itemId: itemId });
    const row = db
      .prepare('SELECT * FROM saved_items WHERE user_id = $userId AND item_type = $type AND item_id = $itemId')
      .get({ $userId: userId, $type: itemType, $itemId: itemId });
    return row ? rowToItem(row) : null;
  }

  /** Supprime un élément sauvegardé. */
  static async remove(
    userId: string,
    itemType: SavedItemType,
    itemId: string,
  ): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return false;
      const { error } = await supabase
        .from('saved_items')
        .delete()
        .eq('user_id', userId)
        .eq('item_type', itemType)
        .eq('item_id', itemId);
      return !error;
    }

    const db = await getDb();
    if (!db) return false;
    return (
      db
        .prepare('DELETE FROM saved_items WHERE user_id = $userId AND item_type = $type AND item_id = $itemId')
        .run({ $userId: userId, $type: itemType, $itemId: itemId }).changes > 0
    );
  }
}
