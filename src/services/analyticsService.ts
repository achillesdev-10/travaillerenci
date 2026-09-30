/**
 *  TravaillerEnCi — src/services/analyticsService.ts
 *
 *  Écriture des événements produits (page vues d'offres, sauvegardes,
 *  inscriptions, alertes, candidatures…) — table `analytics_events`.
 *
 *  • Local : SQLite (table auto-créée, fichier ./data/travaillerenci.sqlite3)
 *  • Prod  : Supabase (migration 0027) — service_role.
 *
 *  La table n'expose aucune donnée personnelle : identifiant d'objet,
 *  chemin et horodatage uniquement.
 */

import 'server-only';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { ONCE_PER_USER_EVENTS, type AnalyticsEventName } from '@/lib/analyticsEvents';

export interface AnalyticsEventInput {
  event: AnalyticsEventName;
  /** Identifiant d'objet (id d'offre, id d'alerte…) — jamais de donnée personnelle. */
  label?: string | null;
  path?: string | null;
  userId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
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
      CREATE TABLE IF NOT EXISTS analytics_events (
        id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        event      TEXT NOT NULL,
        label      TEXT,
        path       TEXT,
        user_id    TEXT,
        ip_hash    TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_events_event   ON analytics_events (event, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events (created_at DESC);
    `);
    return cachedDb;
  } catch {
    return null;
  }
}

/** Écrit un événement. Retourne false en cas d'échec (jamais d'exception remontée). */
export async function recordEvent(input: AnalyticsEventInput): Promise<boolean> {
  const { event, label = null, path = null, userId = null, ipHash = null, userAgent = null } = input;
  const once = ONCE_PER_USER_EVENTS.has(event);
  const now = new Date().toISOString();

  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return false;

      if (once && userId) {
        const { data: existing } = await supabase
          .from('analytics_events')
          .select('id')
          .eq('event', event)
          .eq('user_id', userId)
          .limit(1);
        if (Array.isArray(existing) && existing.length > 0) return true; // déjà enregistré
      }

      const { error } = await supabase.from('analytics_events').insert({
        event,
        label,
        path,
        user_id: userId,
        ip_hash: ipHash,
        user_agent: userAgent ? userAgent.slice(0, 255) : null,
        created_at: now,
      });
      if (error) {
        console.error('recordEvent supabase error:', error.message);
        return false;
      }
      return true;
    }

    const db = await getDb();
    if (!db) return false;

    if (once && userId) {
      const existing = db
        .prepare('SELECT id FROM analytics_events WHERE event = $event AND user_id = $userId LIMIT 1')
        .get({ $event: event, $userId: userId });
      if (existing) return true; // déjà enregistré
    }

    db.prepare(
      `INSERT INTO analytics_events (event, label, path, user_id, ip_hash, user_agent, created_at)
       VALUES ($event, $label, $path, $userId, $ipHash, $userAgent, $now)`,
    ).run({
      $event: event,
      $label: label,
      $path: path,
      $userId: userId,
      $ipHash: ipHash,
      $userAgent: userAgent ? userAgent.slice(0, 255) : null,
      $now: now,
    });
    return true;
  } catch (err) {
    console.error('recordEvent error:', err);
    return false;
  }
}
