/**
 *  TravaillerEnCi — src/services/applicationService.ts
 *
 *  Carnet de candidatures externes (Sprint 1).
 *
 *  • Local : SQLite (table `applications`, fichier ./data/travaillerenci.sqlite3)
 *  • Prod  : Supabase (migration 0037), client service_role.
 *
 *  La candidature n'est JAMAIS transmise par la plateforme : on enregistre
 *  l'intention, on redirige vers l'employeur, puis le candidat tient son carnet.
 *
 *  Toutes les lectures/écritures sont filtrées par `user_id` : aucune méthode
 *  ne permet de lire ou modifier la candidature d'un autre utilisateur.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  isApplicationStatus,
  isCandidateUpdatableStatus,
  type ApplicationMethod,
  type ApplicationRecord,
  type ApplicationStatus,
  type CandidateUpdatableStatus,
} from '@/lib/applicationRules';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

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

const SELECT_WITH_JOB = `
  SELECT
    a.*,
    j.title       AS job_title,
    j.company     AS company_name,
    j.slug        AS job_slug,
    j.apply_link  AS job_apply_link,
    j.apply_email AS job_apply_email,
    j.status      AS job_status,
    j.is_expired  AS job_is_expired,
    j.is_archived AS job_is_archived
  FROM applications a
  LEFT JOIN job_offers j ON j.id = a.job_id
`;

const SUPABASE_SELECT = [
  'id',
  'job_id',
  'user_id',
  'status',
  'apply_method',
  'resume_url',
  'cover_letter',
  'applied_at',
  'updated_at',
  'created_at',
  'job_offers(title, company, slug, apply_link, apply_email, status, is_expired, is_archived)',
].join(', ');

export type ApplicationFailure =
  | 'duplicate'
  | 'not_found'
  | 'migration_required'
  | 'db_error';

export type ApplicationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ApplicationFailure; message?: string };

export interface RecordApplicationInput {
  userId: string;
  jobId: string;
  applyMethod: ApplicationMethod;
  resumeUrl?: string | null;
  coverLetter?: string | null;
}

export interface ListApplicationsOptions {
  limit?: number;
  offset?: number;
}

function normalizeLimit(value: unknown, fallback = 50): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

function normalizeOffset(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function dbPath(): string {
  const override = process.env.TRAVAILLERENCI_DB_PATH;
  if (override && override.trim()) return override.trim();
  return '';
}

async function getDb(): Promise<DatabaseSyncInstance | null> {
  if (cachedDb) return cachedDb;
  try {
    const mod = await import('node:sqlite');
    const { DatabaseSync } = mod as unknown as {
      DatabaseSync: new (path: string) => DatabaseSyncInstance;
    };
    const { resolve: resolvePath } = (await import('node:path')) as typeof import('node:path');
    const { existsSync: exists, mkdirSync: mkdir } = (await import('node:fs')) as typeof import('node:fs');

    const override = dbPath();
    const path = override || resolvePath(process.cwd(), 'data', 'travaillerenci.sqlite3');
    if (!override) {
      const dataDir = resolvePath(process.cwd(), 'data');
      if (!exists(dataDir)) mkdir(dataDir, { recursive: true });
    }
    const db = new DatabaseSync(path);
    db.exec('PRAGMA foreign_keys = ON;');
    ensureSchema(db);
    cachedDb = db;
    return cachedDb;
  } catch (err) {
    console.error('applicationService: SQLite unavailable', err);
    return null;
  }
}

/**
 * Création + migration défensive de la table locale. La table n'existe pas
 * dans le schéma SQLite historique : on la crée sans toucher aux autres tables.
 */
function ensureSchema(db: DatabaseSyncInstance) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id           TEXT PRIMARY KEY,
      job_id       TEXT NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      candidate_id TEXT,
      status       TEXT NOT NULL DEFAULT 'to_finalize',
      apply_method TEXT,
      resume_url   TEXT,
      cover_letter TEXT,
      applied_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const cols = db.prepare('PRAGMA table_info(applications)').all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => String(c.name)));
  const additions: Array<[string, string]> = [
    ['user_id', 'TEXT'],
    ['apply_method', 'TEXT'],
    ['resume_url', 'TEXT'],
    ['applied_at', 'TEXT'],
    ['updated_at', 'TEXT'],
  ];
  for (const [name, type] of additions) {
    if (!names.has(name)) {
      db.exec(`ALTER TABLE applications ADD COLUMN ${name} ${type}`);
    }
  }

  db.exec(`
    UPDATE applications
       SET applied_at = COALESCE(applied_at, created_at, datetime('now'))
     WHERE applied_at IS NULL;
    UPDATE applications
       SET updated_at = COALESCE(updated_at, applied_at, created_at, datetime('now'))
     WHERE updated_at IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS applications_job_user_unique
      ON applications (job_id, user_id)
      WHERE user_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS applications_user_applied_idx
      ON applications (user_id, applied_at DESC);
    CREATE INDEX IF NOT EXISTS applications_job_idx
      ON applications (job_id);
  `);
}

export function __resetApplicationServiceForTests() {
  try {
    cachedDb?.close();
  } catch {
    // ignore
  }
  cachedDb = null;
}

function asBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function asMethod(value: unknown): ApplicationMethod | null {
  return value === 'external' || value === 'email' ? value : null;
}

function mapSqliteRow(row: any): ApplicationRecord {
  return {
    id: String(row.id),
    job_id: String(row.job_id),
    user_id: String(row.user_id),
    status: (isApplicationStatus(row.status) ? row.status : 'to_finalize') as ApplicationStatus,
    apply_method: asMethod(row.apply_method),
    resume_url: row.resume_url ?? null,
    cover_letter: row.cover_letter ?? null,
    applied_at: String(row.applied_at ?? row.created_at ?? ''),
    updated_at: String(row.updated_at ?? row.applied_at ?? row.created_at ?? ''),
    created_at: String(row.created_at ?? ''),
    job_title: row.job_title ?? null,
    company: row.company_name ?? row.company ?? null,
    job_slug: row.job_slug ?? null,
    job_apply_link: row.job_apply_link ?? null,
    job_apply_email: row.job_apply_email ?? null,
    job_status: row.job_status ?? null,
    job_is_expired: asBool(row.job_is_expired),
    job_is_archived: asBool(row.job_is_archived),
  };
}

function mapSupabaseRow(row: any): ApplicationRecord {
  const job = Array.isArray(row.job_offers) ? row.job_offers[0] : row.job_offers;
  return {
    id: String(row.id),
    job_id: String(row.job_id),
    user_id: String(row.user_id),
    status: (isApplicationStatus(row.status) ? row.status : 'to_finalize') as ApplicationStatus,
    apply_method: asMethod(row.apply_method),
    resume_url: row.resume_url ?? null,
    cover_letter: row.cover_letter ?? null,
    applied_at: String(row.applied_at ?? row.created_at ?? ''),
    updated_at: String(row.updated_at ?? row.applied_at ?? row.created_at ?? ''),
    created_at: String(row.created_at ?? ''),
    job_title: job?.title ?? null,
    company: job?.company ?? null,
    job_slug: job?.slug ?? null,
    job_apply_link: job?.apply_link ?? null,
    job_apply_email: job?.apply_email ?? null,
    job_status: job?.status ?? null,
    job_is_expired: job?.is_expired ?? null,
    job_is_archived: job?.is_archived ?? null,
  };
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '');
  }
  return '';
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return error instanceof Error ? error.message : String(error ?? '');
}

function isDuplicateError(error: unknown): boolean {
  return (
    errorCode(error) === '23505' ||
    /UNIQUE constraint failed|duplicate key value/i.test(errorMessage(error))
  );
}

/** Migration 0037 absente / cache PostgREST non rechargé. */
function isMissingSchemaError(error: unknown): boolean {
  const code = errorCode(error);
  const msg = errorMessage(error);
  return (
    code === '42703' ||
    code === '42P01' ||
    code === 'PGRST204' ||
    /column .* does not exist|relation .* does not exist|table .* does not exist|could not find the '.*' column|schema cache/i.test(
      msg,
    )
  );
}

async function recordSqlite(
  input: RecordApplicationInput,
): Promise<ApplicationResult<ApplicationRecord>> {
  const db = await getDb();
  if (!db) {
    return { ok: false, reason: 'db_error', message: 'Base locale indisponible.' };
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  try {
    db.prepare(
      `INSERT INTO applications
        (id, job_id, user_id, status, apply_method, resume_url, cover_letter, applied_at, updated_at, created_at)
       VALUES
        ($id, $jobId, $userId, 'to_finalize', $applyMethod, $resumeUrl, $coverLetter, $now, $now, $now)`,
    ).run({
      $id: id,
      $jobId: input.jobId,
      $userId: input.userId,
      $applyMethod: input.applyMethod,
      $resumeUrl: input.resumeUrl ?? null,
      $coverLetter: input.coverLetter ?? null,
      $now: now,
    });

    const row = db
      .prepare(`${SELECT_WITH_JOB} WHERE a.id = $id AND a.user_id = $userId`)
      .get({ $id: id, $userId: input.userId });
    return { ok: true, data: mapSqliteRow(row) };
  } catch (err) {
    if (isDuplicateError(err)) {
      return { ok: false, reason: 'duplicate' };
    }
    console.error('applicationService.record SQLite error:', err);
    return { ok: false, reason: 'db_error', message: errorMessage(err) };
  }
}

async function listSqlite(
  userId: string,
  options: ListApplicationsOptions,
): Promise<ApplicationResult<ApplicationRecord[]>> {
  const db = await getDb();
  if (!db) {
    return { ok: false, reason: 'db_error', message: 'Base locale indisponible.' };
  }
  const limit = normalizeLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  try {
    const rows = db
      .prepare(
        `${SELECT_WITH_JOB}
         WHERE a.user_id = $userId
         ORDER BY COALESCE(a.applied_at, a.created_at) DESC
         LIMIT $limit OFFSET $offset`,
      )
      .all({ $userId: userId, $limit: limit, $offset: offset }) as any[];
    return { ok: true, data: rows.map(mapSqliteRow) };
  } catch (err) {
    console.error('applicationService.list SQLite error:', err);
    return { ok: false, reason: 'db_error', message: errorMessage(err) };
  }
}

async function updateSqlite(
  id: string,
  userId: string,
  status: CandidateUpdatableStatus,
): Promise<ApplicationResult<ApplicationRecord>> {
  const db = await getDb();
  if (!db) {
    return { ok: false, reason: 'db_error', message: 'Base locale indisponible.' };
  }
  const now = new Date().toISOString();
  try {
    const result = db
      .prepare(
        `UPDATE applications
            SET status = $status, updated_at = $now
          WHERE id = $id AND user_id = $userId`,
      )
      .run({ $id: id, $userId: userId, $status: status, $now: now });

    if (result.changes === 0) return { ok: false, reason: 'not_found' };

    const row = db
      .prepare(`${SELECT_WITH_JOB} WHERE a.id = $id AND a.user_id = $userId`)
      .get({ $id: id, $userId: userId });
    return { ok: true, data: mapSqliteRow(row) };
  } catch (err) {
    console.error('applicationService.update SQLite error:', err);
    return { ok: false, reason: 'db_error', message: errorMessage(err) };
  }
}

async function recordSupabase(
  input: RecordApplicationInput,
): Promise<ApplicationResult<ApplicationRecord>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: 'db_error', message: 'Supabase non configuré.' };
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('applications')
    .insert({
      job_id: input.jobId,
      user_id: input.userId,
      status: 'to_finalize',
      apply_method: input.applyMethod,
      resume_url: input.resumeUrl ?? null,
      cover_letter: input.coverLetter ?? null,
      applied_at: now,
      updated_at: now,
    })
    .select(SUPABASE_SELECT)
    .single();

  if (error) {
    if (isDuplicateError(error)) return { ok: false, reason: 'duplicate' };
    if (isMissingSchemaError(error)) return { ok: false, reason: 'migration_required' };
    console.error('applicationService.record Supabase error:', error);
    return { ok: false, reason: 'db_error', message: error.message };
  }
  return { ok: true, data: mapSupabaseRow(data) };
}

async function listSupabase(
  userId: string,
  options: ListApplicationsOptions,
): Promise<ApplicationResult<ApplicationRecord[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: 'db_error', message: 'Supabase non configuré.' };
  }
  const limit = normalizeLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  const { data, error } = await supabase
    .from('applications')
    .select(SUPABASE_SELECT)
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    if (isMissingSchemaError(error)) return { ok: false, reason: 'migration_required' };
    console.error('applicationService.list Supabase error:', error);
    return { ok: false, reason: 'db_error', message: error.message };
  }
  return { ok: true, data: (data ?? []).map(mapSupabaseRow) };
}

async function updateSupabase(
  id: string,
  userId: string,
  status: CandidateUpdatableStatus,
): Promise<ApplicationResult<ApplicationRecord>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: 'db_error', message: 'Supabase non configuré.' };
  }
  const { data, error } = await supabase
    .from('applications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select(SUPABASE_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) return { ok: false, reason: 'migration_required' };
    console.error('applicationService.update Supabase error:', error);
    return { ok: false, reason: 'db_error', message: error.message };
  }
  if (!data) return { ok: false, reason: 'not_found' };
  return { ok: true, data: mapSupabaseRow(data) };
}

export const ApplicationService = {
  /** Enregistre une candidature externe (statut initial « à finaliser »). */
  async record(input: RecordApplicationInput): Promise<ApplicationResult<ApplicationRecord>> {
    return isSupabaseConfigured() ? recordSupabase(input) : recordSqlite(input);
  },

  /** Carnet du candidat connecté, du plus récent au plus ancien. */
  async listForUser(
    userId: string,
    options: ListApplicationsOptions = {},
  ): Promise<ApplicationResult<ApplicationRecord[]>> {
    return isSupabaseConfigured()
      ? listSupabase(userId, options)
      : listSqlite(userId, options);
  },

  /** Met à jour un statut que le candidat peut poser lui-même. */
  async updateStatusForUser(
    id: string,
    userId: string,
    status: string,
  ): Promise<ApplicationResult<ApplicationRecord>> {
    if (!isCandidateUpdatableStatus(status)) {
      return { ok: false, reason: 'not_found' };
    }
    return isSupabaseConfigured()
      ? updateSupabase(id, userId, status)
      : updateSqlite(id, userId, status);
  },
};

export const __test = {
  mapSqliteRow,
  mapSupabaseRow,
  isMissingSchemaError,
  isDuplicateError,
  normalizeLimit,
  normalizeOffset,
};
