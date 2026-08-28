/**
 *  TravaillerEnCi — Service PlatformSettings
 *  Réglages centralisés de la plateforme (taxonomies, scraper, notifications)
 *
 *  Stockage : table `platform_settings` (clé/valeur JSON)
 *  Local : SQLite (node:sqlite) — Prod : Supabase
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SettingValue = string | number | boolean | string[] | Record<string, unknown>;

export interface PlatformSetting {
  key: string;
  value: SettingValue;
  updated_at: string;
}

// Clés de settings avec leurs types et valeurs par défaut
export interface PlatformSettings {
  // Taxonomies
  sectors: string[];
  cities: string[];
  contract_types: string[];
  budget_ranges: string[];
  // Scraper
  scraper_sources: Record<string, boolean>;  // { educarriere: true, emploici: true, ... }
  scraper_alert_threshold: number;           // nombre min d'offres avant alerte
  // Notifications
  notification_channels: Record<string, 'email' | 'whatsapp' | 'both' | 'off'>;
  // e.g. { scraper_failure: 'both', new_report: 'email', ... }
}

const DEFAULT_SETTINGS: PlatformSettings = {
  sectors: [
    'IT / Digital', 'Banque & Finance', 'BTP & Immobilier', 'Industrie',
    'Commerce & Distribution', 'Santé', 'Éducation & Formation',
    'Agroalimentaire', 'Télécoms', 'Transport & Logistique',
    'Tourisme & Hôtellerie', 'Audiovisuel & Médias', 'Audit & Conseil',
    'Juridique', 'RH', 'Marketing & Communication',
  ],
  cities: [
    'Abidjan', 'Yamoussoukro', 'Bouaké', 'San-Pédro', 'Daloa',
    'Korhogo', 'Man', 'Gagnoa', 'Abengourou', 'Grand-Bassam',
  ],
  contract_types: ['CDI', 'CDD', 'Stage', 'Alternance', 'Freelance', 'Prestation'],
  budget_ranges: ['Petit budget', 'Budget moyen', 'Gros investissement'],
  scraper_sources: {
    educarriere: true,
    emploici: true,
    boursedetude: true,
  },
  scraper_alert_threshold: 5,
  notification_channels: {
    scraper_failure: 'both',
    new_report: 'email',
    new_company: 'email',
    new_comment: 'email',
  },
};

// ---------------------------------------------------------------------------
// SQLite (local dev)
// ---------------------------------------------------------------------------

type DatabaseSyncInstance = {
  prepare(sql: string): StatementInstance;
  exec(sql: string): void;
  close(): void;
};
type StatementInstance = {
  run(params?: unknown): { changes: number; lastInsertRowid: unknown };
  get(params?: unknown): unknown;
  all(params?: unknown): unknown[];
};

let cachedDb: DatabaseSyncInstance | null = null;

async function getDb(): Promise<DatabaseSyncInstance | null> {
  if (cachedDb) return cachedDb;
  try {
    const mod = await import('node:sqlite');
    const { DatabaseSync } = mod as unknown as { DatabaseSync: new (path: string) => DatabaseSyncInstance };
    const { resolve: resolvePath } = (await import('node:path')) as typeof import('node:path');
    const { existsSync: exists, mkdirSync: mkdir } = (await import('node:fs')) as typeof import('node:fs');
    const dataDir = resolvePath(process.cwd(), 'data');
    if (!exists(dataDir)) mkdir(dataDir, { recursive: true });
    const dbPath = resolvePath(dataDir, 'travaillerenci.sqlite3');
    cachedDb = new DatabaseSync(dbPath);
    ensureSchema(cachedDb);
    return cachedDb;
  } catch (err) {
    console.error('[platformSettingsService] SQLite indisponible :', err);
    return null;
  }
}

function ensureSchema(db: DatabaseSyncInstance) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToSetting(row: unknown): PlatformSetting {
  const r = row as { key: string; value: string; updated_at: string };
  return {
    key: r.key,
    value: JSON.parse(r.value),
    updated_at: r.updated_at,
  };
}

function normalizeSettings(raw: Record<string, unknown>): PlatformSettings {
  const defaults = { ...DEFAULT_SETTINGS };
  const result = { ...defaults };

  if (Array.isArray(raw.sectors)) result.sectors = raw.sectors as string[];
  if (Array.isArray(raw.cities)) result.cities = raw.cities as string[];
  if (Array.isArray(raw.contract_types)) result.contract_types = raw.contract_types as string[];
  if (Array.isArray(raw.budget_ranges)) result.budget_ranges = raw.budget_ranges as string[];
  if (raw.scraper_sources && typeof raw.scraper_sources === 'object') {
    result.scraper_sources = raw.scraper_sources as Record<string, boolean>;
  }
  if (typeof raw.scraper_alert_threshold === 'number') {
    result.scraper_alert_threshold = raw.scraper_alert_threshold;
  }
  if (raw.notification_channels && typeof raw.notification_channels === 'object') {
    result.notification_channels = raw.notification_channels as Record<string, 'email' | 'whatsapp' | 'both' | 'off'>;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PlatformSettingsService {
  /** Charge tous les settings (fuse les defaults avec les valeurs en BDD). */
  static async getAll(): Promise<PlatformSettings> {
    if (isSupabaseConfigured()) return this.getAllSupabase();

    const db = await getDb();
    if (!db) return { ...DEFAULT_SETTINGS };

    try {
      const rows = db.prepare('SELECT key, value, updated_at FROM platform_settings').all() as Array<{ key: string; value: string; updated_at: string }>;
      const raw: Record<string, unknown> = {};
      for (const row of rows) {
        try { raw[row.key] = JSON.parse(row.value); } catch { /* ignore */ }
      }
      return normalizeSettings(raw);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  /** Met à jour un ou plusieurs settings (merge avec les existants). */
  static async update(updates: Partial<PlatformSettings>): Promise<PlatformSettings> {
    if (isSupabaseConfigured()) return this.updateSupabase(updates);

    const db = await getDb();
    if (!db) return this.getAll();

    const current = await this.getAll();
    const merged = { ...current, ...updates };

    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(merged)) {
      db.prepare(
        'INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
      ).run([key, JSON.stringify(value), now]);
    }

    return merged;
  }

  // -- Supabase --

  private static async getAllSupabase(): Promise<PlatformSettings> {
    const supabase = getSupabaseClient();
    if (!supabase) return { ...DEFAULT_SETTINGS };

    try {
      const { data } = await supabase.from('platform_settings').select('key, value');
      const raw: Record<string, unknown> = {};
      for (const row of (data || []) as Array<{ key: string; value: string }>) {
        try { raw[row.key] = JSON.parse(row.value); } catch { /* ignore */ }
      }
      return normalizeSettings(raw);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private static async updateSupabase(updates: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.getAll();

    const current = await this.getAllSupabase();
    const merged = { ...current, ...updates };
    const now = new Date().toISOString();

    const rows = Object.entries(merged).map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
      updated_at: now,
    }));

    try {
      await supabase.from('platform_settings').upsert(rows, { onConflict: 'key' });
    } catch (err) {
      console.error('[platformSettingsService] Supabase upsert error:', err);
    }

    return merged;
  }
}
