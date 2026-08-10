/**
 *  TravaillerEnCi — src/services/alertService.ts
 *  Alertes candidat (création / gestion côté app). L'ENVOI des notifications
 *  est assuré par le digest scraper/alert_digest.py (workflow GitHub Actions)
 *  qui lit les mêmes tables.
 *
 *  • Local : SQLite (tables `alerts` + `alert_digest_log`)
 *  • Prod  : Supabase (migration 0017_alerts.sql) — service_role.
 *
 *  RLS Supabase fermée au client anon : passages par /api/alerts (session).
 */

import 'server-only';
import { randomBytes } from 'node:crypto';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import type {
  AlertChannel,
  AlertContentType,
  AlertCreateInput,
  AlertFrequency,
  AlertItem,
  AlertPatch,
} from '@/types/alerts';

const VALID_CONTENT_TYPES: AlertContentType[] = ['job', 'internship', 'scholarship', 'exam'];
const VALID_CHANNELS: AlertChannel[] = ['email', 'whatsapp', 'both'];
const VALID_FREQUENCIES: AlertFrequency[] = ['immediate', 'daily'];

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
      CREATE TABLE IF NOT EXISTS alerts (
        id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id           TEXT NOT NULL,
        label             TEXT NOT NULL,
        content_types     TEXT NOT NULL DEFAULT '[]',
        city              TEXT,
        diploma           TEXT,
        sector            TEXT,
        channels          TEXT NOT NULL DEFAULT 'email' CHECK (channels IN ('email','whatsapp','both')),
        frequency         TEXT NOT NULL DEFAULT 'immediate' CHECK (frequency IN ('immediate','daily')),
        active            INTEGER NOT NULL DEFAULT 1,
        unsubscribe_token TEXT NOT NULL UNIQUE,
        last_sent_at      TEXT,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS alert_digest_log (
        id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        alert_id  TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL CHECK (item_type IN ('job','internship','scholarship','exam')),
        item_id   TEXT NOT NULL,
        sent_at   TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (alert_id, item_type, item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts (user_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts (active);
      CREATE INDEX IF NOT EXISTS idx_alert_digest_alert ON alert_digest_log (alert_id);
    `);
    return cachedDb;
  } catch {
    return null;
  }
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToAlert(row: any): AlertItem {
  const raw = parseJsonArray(row.content_types);
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    label: String(row.label || ''),
    content_types: raw.filter((t): t is AlertContentType =>
      (VALID_CONTENT_TYPES as string[]).includes(t),
    ),
    city: row.city ?? null,
    diploma: row.diploma ?? null,
    sector: row.sector ?? null,
    channels: (VALID_CHANNELS as string[]).includes(row.channels) ? row.channels : 'email',
    frequency: (VALID_FREQUENCIES as string[]).includes(row.frequency) ? row.frequency : 'immediate',
    active: Boolean(row.active),
    unsubscribe_token: String(row.unsubscribe_token || ''),
    last_sent_at: row.last_sent_at ?? null,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

function normalizeContentTypes(value: AlertContentType[]): AlertContentType[] {
  return value
    .filter((t) => (VALID_CONTENT_TYPES as string[]).includes(t))
    .slice(0, VALID_CONTENT_TYPES.length);
}

function normalizePatch(patch: AlertPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof patch.label === 'string') out.label = patch.label.trim().slice(0, 120) || 'Mes alertes';
  if (Array.isArray(patch.content_types)) out.content_types = normalizeContentTypes(patch.content_types);
  if (patch.city !== undefined) out.city = patch.city?.trim() || null;
  if (patch.diploma !== undefined) out.diploma = patch.diploma?.trim() || null;
  if (patch.sector !== undefined) out.sector = patch.sector?.trim() || null;
  if (patch.channels && (VALID_CHANNELS as string[]).includes(patch.channels)) out.channels = patch.channels;
  if (patch.frequency && (VALID_FREQUENCIES as string[]).includes(patch.frequency)) out.frequency = patch.frequency;
  if (typeof patch.active === 'boolean') out.active = patch.active;
  return out;
}

export class AlertService {
  /** Alertes d'un utilisateur (actives d'abord, puis récentes). */
  static async list(userId: string): Promise<AlertItem[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return [];
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .order('active', { ascending: false })
        .order('created_at', { ascending: false });
      return (data || []).map(rowToAlert);
    }

    const db = await getDb();
    if (!db) return [];
    const rows = db
      .prepare('SELECT * FROM alerts WHERE user_id = $userId ORDER BY active DESC, created_at DESC')
      .all({ $userId: userId });
    return rows.map(rowToAlert);
  }

  /** Crée une alerte (avec jeton de désinscription unique). */
  static async create(userId: string, input: AlertCreateInput): Promise<AlertItem | null> {
    const clean = normalizePatch({
      label: input.label,
      content_types: input.content_types ?? [],
      city: input.city ?? null,
      diploma: input.diploma ?? null,
      sector: input.sector ?? null,
      channels: input.channels,
      frequency: input.frequency,
    });
    const unsubscribeToken = randomBytes(24).toString('hex');
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('alerts')
        .insert({
          user_id: userId,
          label: clean.label,
          content_types: clean.content_types ?? [],
          city: clean.city ?? null,
          diploma: clean.diploma ?? null,
          sector: clean.sector ?? null,
          channels: clean.channels ?? 'email',
          frequency: clean.frequency ?? 'immediate',
          active: true,
          unsubscribe_token: unsubscribeToken,
        })
        .select()
        .maybeSingle();
      if (error || !data) {
        console.error('alertService.create error:', error?.message);
        return null;
      }
      return rowToAlert(data);
    }

    const db = await getDb();
    if (!db) return null;
    db.prepare(
      `INSERT INTO alerts (user_id, label, content_types, city, diploma, sector, channels, frequency, active, unsubscribe_token, created_at, updated_at)
       VALUES ($userId, $label, $types, $city, $diploma, $sector, $channels, $frequency, 1, $token, $now, $now)`,
    ).run({
      $userId: userId,
      $label: clean.label,
      $types: JSON.stringify(clean.content_types ?? []),
      $city: clean.city ?? null,
      $diploma: clean.diploma ?? null,
      $sector: clean.sector ?? null,
      $channels: clean.channels ?? 'email',
      $frequency: clean.frequency ?? 'immediate',
      $token: unsubscribeToken,
      $now: now,
    });
    const row = db
      .prepare('SELECT * FROM alerts WHERE unsubscribe_token = $token')
      .get({ $token: unsubscribeToken });
    return row ? rowToAlert(row) : null;
  }

  /** Met à jour une alerte (propriétaire uniquement). */
  static async update(
    userId: string,
    alertId: string,
    patch: AlertPatch,
  ): Promise<AlertItem | null> {
    const clean = normalizePatch(patch);
    if (Object.keys(clean).length === 0) {
      const existing = await AlertService.getById(userId, alertId);
      return existing;
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('alerts')
        .update({ ...clean, updated_at: new Date().toISOString() })
        .eq('id', alertId)
        .eq('user_id', userId)
        .select()
        .maybeSingle();
      if (error || !data) return null;
      return rowToAlert(data);
    }

    const db = await getDb();
    if (!db) return null;
    const fields = Object.keys(clean).map((k) => `${k} = $${k}`).join(', ');
    db.prepare(
      `UPDATE alerts SET ${fields}, updated_at = $now WHERE id = $id AND user_id = $userId`,
    ).run({ ...clean, $now: new Date().toISOString(), $id: alertId, $userId: userId });
    return AlertService.getById(userId, alertId);
  }

  /** Supprime une alerte (propriétaire uniquement). */
  static async remove(userId: string, alertId: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return false;
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId)
        .eq('user_id', userId);
      return !error;
    }

    const db = await getDb();
    if (!db) return false;
    return (
      db
        .prepare('DELETE FROM alerts WHERE id = $id AND user_id = $userId')
        .run({ $id: alertId, $userId: userId }).changes > 0
    );
  }

  /** Une alerte par id (propriétaire uniquement). */
  static async getById(userId: string, alertId: string): Promise<AlertItem | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', alertId)
        .eq('user_id', userId)
        .maybeSingle();
      return data ? rowToAlert(data) : null;
    }

    const db = await getDb();
    if (!db) return null;
    const row = db
      .prepare('SELECT * FROM alerts WHERE id = $id AND user_id = $userId')
      .get({ $id: alertId, $userId: userId });
    return row ? rowToAlert(row) : null;
  }

  /** Désactive une alerte à partir de son jeton de désinscription. */
  static async deactivateByUnsubscribeToken(token: string): Promise<AlertItem | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('alerts')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('unsubscribe_token', token)
        .select()
        .maybeSingle();
      if (error || !data) return null;
      return rowToAlert(data);
    }

    const db = await getDb();
    if (!db) return null;
    db.prepare('UPDATE alerts SET active = 0, updated_at = $now WHERE unsubscribe_token = $token').run({
      $now: new Date().toISOString(),
      $token: token,
    });
    const row = db.prepare('SELECT * FROM alerts WHERE unsubscribe_token = $token').get({ $token: token });
    return row ? rowToAlert(row) : null;
  }
}
