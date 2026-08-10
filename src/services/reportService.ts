/**
 *  TravaillerEnCi — src/services/reportService.ts
 *  Signalements d'abus soumis depuis les fiches (« Signaler ce contenu »).
 *
 *  • Local : SQLite (table `reports`, fichier ./data/travaillerenci.sqlite3)
 *  • Prod  : Supabase (migration 0018_reports.sql) — service_role.
 *
 *  RLS Supabase fermée au client anon : écriture via POST /api/reports,
 *  lecture/modération via /api/admin/reports (session admin).
 */

import 'server-only';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import type { SavedItemType } from '@/services/savedItemsService';

export type ReportReason =
  | 'frais_demandes'
  | 'contenu_frauduleux'
  | 'info_inexacte'
  | 'contenu_inapproprie'
  | 'autre';

export const REPORT_REASONS: ReportReason[] = [
  'frais_demandes',
  'contenu_frauduleux',
  'info_inexacte',
  'contenu_inapproprie',
  'autre',
];

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export const REPORT_STATUSES: ReportStatus[] = ['pending', 'resolved', 'dismissed'];

export interface Report {
  id: string;
  reporter_user_id: string | null;
  reporter_email: string | null;
  item_type: SavedItemType;
  item_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface ReportInsert {
  reporter_user_id?: string | null;
  reporter_email?: string | null;
  item_type: SavedItemType;
  item_id: string;
  reason: ReportReason;
  details?: string | null;
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
      CREATE TABLE IF NOT EXISTS reports (
        id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        reporter_user_id TEXT,
        reporter_email   TEXT,
        item_type        TEXT NOT NULL CHECK (item_type IN ('job','internship','scholarship','exam')),
        item_id          TEXT NOT NULL,
        reason           TEXT NOT NULL CHECK (reason IN ('frais_demandes','contenu_frauduleux','info_inexacte','contenu_inapproprie','autre')),
        details          TEXT,
        status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at      TEXT,
        resolved_by      TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_reports_item ON reports (item_type, item_id);
    `);
    return cachedDb;
  } catch {
    return null;
  }
}

function normalizeSqliteDate(value: string | null | undefined): string | null {
  if (!value) return null;
  // datetime('now') SQLite → "YYYY-MM-DD HH:MM:SS" (UTC, sans T/Z). On
  // normalise en ISO-8601 pour un new Date() fiable côté client, quel que
  // soit le navigateur. Les valeurs déjà ISO (Supabase, resolved_at écrits
  // par updateStatus) passent inchangées.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value.replace(' ', 'T') + 'Z';
  }
  return value;
}

function rowToReport(row: any): Report {
  return {
    id: String(row.id),
    reporter_user_id: row.reporter_user_id ? String(row.reporter_user_id) : null,
    reporter_email: row.reporter_email ? String(row.reporter_email) : null,
    item_type: row.item_type as SavedItemType,
    item_id: String(row.item_id),
    reason: row.reason as ReportReason,
    details: row.details ? String(row.details) : null,
    status: (row.status || 'pending') as ReportStatus,
    created_at: normalizeSqliteDate(row.created_at) ?? '',
    resolved_at: normalizeSqliteDate(row.resolved_at),
    resolved_by: row.resolved_by ? String(row.resolved_by) : null,
  };
}

export class ReportService {
  /** Crée un signalement. Retourne le Report ou null en cas d'échec. */
  static async create(input: ReportInsert): Promise<Report | null> {
    const payload = {
      reporter_user_id: input.reporter_user_id || null,
      reporter_email: input.reporter_email?.trim() || null,
      item_type: input.item_type,
      item_id: input.item_id,
      reason: input.reason,
      details: input.details?.trim() || null,
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('reports')
        .insert(payload)
        .select()
        .maybeSingle();
      if (error || !data) {
        console.error('ReportService.create error:', error?.message);
        return null;
      }
      return rowToReport(data);
    }

    const db = await getDb();
    if (!db) return null;
    // NB : la clé primaire est un UUID (TEXT) — lastInsertRowid serait le
    // rowid numérique, inutilisable pour relire la ligne. On génère donc
    // l'id côté JS et on le passe explicitement à l'INSERT.
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO reports (id, reporter_user_id, reporter_email, item_type, item_id, reason, details)
       VALUES ($id, $userId, $email, $type, $itemId, $reason, $details)`,
    ).run({
      $id: id,
      $userId: payload.reporter_user_id,
      $email: payload.reporter_email,
      $type: payload.item_type,
      $itemId: payload.item_id,
      $reason: payload.reason,
      $details: payload.details,
    });
    const row = db.prepare('SELECT * FROM reports WHERE id = $id').get({ $id: id });
    return row ? rowToReport(row) : null;
  }

  /** Liste les signalements (tri du plus récent au plus ancien). */
  static async list(status?: ReportStatus | 'all', limit = 200): Promise<Report[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return [];
      let query = supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      const { data } = await query;
      return (data || []).map(rowToReport);
    }

    const db = await getDb();
    if (!db) return [];
    const rows =
      status && status !== 'all'
        ? db
            .prepare(
              'SELECT * FROM reports WHERE status = $status ORDER BY created_at DESC LIMIT $limit',
            )
            .all({ $status: status, $limit: limit })
        : db
            .prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT $limit')
            .all({ $limit: limit });
    return rows.map(rowToReport);
  }

  /** Nombre de signalements par statut (badges de la file de modération). */
  static async countByStatus(): Promise<Record<ReportStatus, number>> {
    const counts: Record<ReportStatus, number> = {
      pending: 0,
      resolved: 0,
      dismissed: 0,
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return counts;
      // Comptage serveur (head=true) : ne rapatrie aucune ligne.
      const [pending, resolved, dismissed] = await Promise.all([
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'dismissed'),
      ]);
      counts.pending = pending.count ?? 0;
      counts.resolved = resolved.count ?? 0;
      counts.dismissed = dismissed.count ?? 0;
      return counts;
    }

    const db = await getDb();
    if (!db) return counts;
    const rows = db.prepare('SELECT status, COUNT(*) AS n FROM reports GROUP BY status').all();
    for (const row of rows) {
      const s = row.status as ReportStatus;
      if (s in counts) counts[s] = Number(row.n) || 0;
    }
    return counts;
  }

  /** Met à jour le statut d'un signalement (résolu / classé / rouvert). */
  static async updateStatus(
    id: string,
    status: ReportStatus,
    resolvedBy: string,
  ): Promise<Report | null> {
    const now = new Date().toISOString();
    const resolvedAt = status === 'pending' ? null : now;
    const resolvedByValue = status === 'pending' ? null : resolvedBy;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('reports')
        .update({ status, resolved_at: resolvedAt, resolved_by: resolvedByValue })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error || !data) {
        console.error('ReportService.updateStatus error:', error?.message);
        return null;
      }
      return rowToReport(data);
    }

    const db = await getDb();
    if (!db) return null;
    db.prepare(
      'UPDATE reports SET status = $status, resolved_at = $at, resolved_by = $by WHERE id = $id',
    ).run({ $status: status, $at: resolvedAt, $by: resolvedByValue, $id: id });
    const row = db.prepare('SELECT * FROM reports WHERE id = $id').get({ $id: id });
    return row ? rowToReport(row) : null;
  }
}
