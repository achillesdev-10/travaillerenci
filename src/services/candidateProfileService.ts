/**
 *  TravaillerEnCi — src/services/candidateProfileService.ts
 *  Mini-profil candidat (critères d'alertes) : ville, diplôme le plus élevé,
 *  secteur(s) d'intérêt, téléphone WhatsApp.
 *
 *  • Local : SQLite (table `candidate_profiles`, fichier ./data/travaillerenci.sqlite3)
 *  • Prod  : Supabase (migration 0015_candidate_profiles.sql) — service_role.
 *
 *  RLS Supabase fermée au client anon : les lectures/écritures passent par les
 *  routes serveur /api/candidate/profile après vérification de session.
 */

import 'server-only';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

/** Slugs de secteurs acceptés (source unique — SECTORS de src/lib/constants.ts).
 *  Utilisé par l'inscription ET par PUT /api/candidate/profile. */
export const VALID_SECTOR_SLUGS: ReadonlySet<string> = new Set([
  'it-digital',
  'banque-finance',
  'btp-immobilier',
  'industrie',
  'commerce-distribution',
  'sante',
  'education-formation',
  'agroalimentaire',
  'telecoms',
  'transport-logistique',
  'tourisme-hotellerie',
  'audiovisuel-medias',
  'audit-conseil',
  'juridique',
  'rh',
  'marketing-communication',
]);

export interface CandidateProfile {
  user_id: string;
  city: string | null;
  diploma: string | null;
  sectors: string[];
  /** Numéro WhatsApp au format international (ex : 2250700000000). */
  phone: string | null;
  created_at: string;
  updated_at: string;
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
      CREATE TABLE IF NOT EXISTS candidate_profiles (
        user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        city       TEXT,
        diploma    TEXT,
        sectors    TEXT NOT NULL DEFAULT '[]',
        phone      TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
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

function rowToProfile(row: any): CandidateProfile {
  return {
    user_id: String(row.user_id),
    city: row.city ?? null,
    diploma: row.diploma ?? null,
    sectors: parseJsonArray(row.sectors),
    phone: row.phone ?? null,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

export class CandidateProfileService {
  /** Retourne le profil candidat, ou null si absent. */
  static async get(userId: string): Promise<CandidateProfile | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data } = await supabase
        .from('candidate_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      return data ? rowToProfile(data) : null;
    }

    const db = await getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM candidate_profiles WHERE user_id = $userId').get({ $userId: userId });
    return row ? rowToProfile(row) : null;
  }

  /** Crée ou met à jour le profil (patch partiel). */
  static async upsert(
    userId: string,
    patch: {
      city?: string | null;
      diploma?: string | null;
      sectors?: string[] | null;
      phone?: string | null;
    },
  ): Promise<CandidateProfile | null> {
    const existing = await CandidateProfileService.get(userId);

    const city = patch.city !== undefined ? (patch.city?.trim() || null) : existing?.city ?? null;
    const diploma = patch.diploma !== undefined ? (patch.diploma?.trim() || null) : existing?.diploma ?? null;
    const sectors =
      patch.sectors !== undefined
        ? (patch.sectors ?? [])
            .map((s) => s.trim())
            .filter((s) => s && VALID_SECTOR_SLUGS.has(s))
        : existing?.sectors ?? [];
    const phone = patch.phone !== undefined ? (patch.phone?.trim() || null) : existing?.phone ?? null;
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const payload = { city, diploma, sectors, phone, updated_at: now };
      const { data, error } = await supabase
        .from('candidate_profiles')
        .upsert({ user_id: userId, ...payload, created_at: existing?.created_at ?? now }, { onConflict: 'user_id' })
        .select()
        .maybeSingle();
      if (error || !data) {
        console.error('candidateProfileService.upsert error:', error?.message);
        return null;
      }
      return rowToProfile(data);
    }

    const db = await getDb();
    if (!db) return null;
    if (existing) {
      db.prepare(
        'UPDATE candidate_profiles SET city = $city, diploma = $diploma, sectors = $sectors, phone = $phone, updated_at = $now WHERE user_id = $userId',
      ).run({ $city: city, $diploma: diploma, $sectors: JSON.stringify(sectors), $phone: phone, $now: now, $userId: userId });
    } else {
      db.prepare(
        'INSERT INTO candidate_profiles (user_id, city, diploma, sectors, phone, created_at, updated_at) VALUES ($userId, $city, $diploma, $sectors, $phone, $now, $now)',
      ).run({ $userId: userId, $city: city, $diploma: diploma, $sectors: JSON.stringify(sectors), $phone: phone, $now: now });
    }
    return CandidateProfileService.get(userId);
  }
}
