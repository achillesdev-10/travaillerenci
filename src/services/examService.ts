/**
 *  TravaillerEnCi — Service du module Concours Administratifs (table `exams`)
 *  Chemin : src/services/examService.ts
 *
 *  Couche d'abstraction typée sur la table `exams` :
 *   • Local  : SQLite (fichier ./data/travaillerenci.sqlite3, table `exams`)
 *   • Prod   : Supabase (migration 0010) via le SDK — signatures 1:1.
 *
 *  Le schéma SQLite est créé/migré automatiquement ici (miroir de la migration
 *  Supabase 0010, hormis les types : dates TEXT, arrays JSON TEXT).
 */

import type {
  Exam,
  ExamCategory,
  ExamFilters,
  ExamInsert,
  ExamStatus,
  PaginatedExams,
} from '@/types/exam';
import { diplomaLevel } from '@/lib/examConstants';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { slugify } from '@/lib/utils';

// -----------------------------------------------------------------------------
// Types BDD locaux (node:sqlite)
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
    cachedDb = new DatabaseSync(resolvePath(dataDir, 'travaillerenci.sqlite3'));
    ensureSchema(cachedDb);
    return cachedDb;
  } catch {
    return null;
  }
}

/** Miroir SQLite de la migration Supabase 0010. */
function ensureSchema(db: DatabaseSyncInstance) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      title               TEXT NOT NULL,
      slug                TEXT,
      organizer           TEXT NOT NULL,
      category            TEXT NOT NULL DEFAULT 'administratif',
      exam_type           TEXT,
      status              TEXT NOT NULL DEFAULT 'pending',
      description_md      TEXT NOT NULL DEFAULT '',
      registration_start  TEXT,
      registration_end    TEXT,
      exam_date           TEXT,
      results_date        TEXT,
      age_min             INTEGER,
      age_max             INTEGER,
      age_reference_date  TEXT,
      nationality         TEXT,
      diplomas            TEXT NOT NULL DEFAULT '[]',
      min_diploma_level   INTEGER,
      positions_count     INTEGER,
      registration_fee    TEXT,
      location            TEXT,
      cities              TEXT NOT NULL DEFAULT '[]',
      documents           TEXT NOT NULL DEFAULT '[]',
      source_url          TEXT,
      source_website      TEXT,
      confidence          TEXT NOT NULL DEFAULT 'medium',
      views_count         INTEGER NOT NULL DEFAULT 0,
      is_verified         INTEGER NOT NULL DEFAULT 0,
      seo_title           TEXT,
      seo_description     TEXT,
      seo_keywords        TEXT,
      published_at        TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT exams_status_check CHECK (status IN ('pending','published','rejected','archived')),
      CONSTRAINT exams_category_check CHECK (category IN ('administratif','sante','enseignement','securite','militaire','autre')),
      CONSTRAINT exams_confidence_check CHECK (confidence IN ('low','medium','high'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_exams_status ON exams (status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_exams_category ON exams (category);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_exams_organizer ON exams (organizer);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_exams_registration_end ON exams (registration_end);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_exams_min_diploma_level ON exams (min_diploma_level);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_exams_created_at ON exams (created_at DESC);`);
}

// -----------------------------------------------------------------------------
// Normalisation des lignes
// -----------------------------------------------------------------------------
function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const EXAM_FULL_COLUMNS =
  'id,title,slug,organizer,category,exam_type,status,description_md,registration_start,registration_end,exam_date,results_date,age_min,age_max,age_reference_date,nationality,diplomas,min_diploma_level,positions_count,registration_fee,location,cities,documents,source_url,source_website,confidence,views_count,is_verified,seo_title,seo_description,seo_keywords,published_at,created_at,updated_at';

/** Toutes les colonnes sauf `documents` (listes publiques). */
const EXAM_CARD_COLUMNS =
  'id,title,slug,organizer,category,exam_type,status,description_md,registration_start,registration_end,exam_date,results_date,age_min,age_max,age_reference_date,nationality,diplomas,min_diploma_level,positions_count,registration_fee,location,cities,source_url,source_website,confidence,views_count,is_verified,seo_title,seo_description,seo_keywords,published_at,created_at,updated_at';

function rowToExam(row: any): Exam {
  return {
    ...row,
    category: (row.category as ExamCategory) || 'administratif',
    status: (row.status as ExamStatus) || 'pending',
    confidence: row.confidence || 'medium',
    diplomas: parseJsonArray<string>(row.diplomas),
    cities: parseJsonArray<string>(row.cities),
    documents: parseJsonArray<Exam['documents'][number]>(row.documents),
    views_count: Number(row.views_count || 0),
    is_verified: row.is_verified === 1 || row.is_verified === true,
    min_diploma_level: row.min_diploma_level == null ? null : Number(row.min_diploma_level),
    age_min: row.age_min == null ? null : Number(row.age_min),
    age_max: row.age_max == null ? null : Number(row.age_max),
    positions_count: row.positions_count == null ? null : Number(row.positions_count),
  };
}

function rowToExamFromSupabase(row: any): Exam {
  return {
    ...row,
    description_md: row.description_md ?? '',
    category: (row.category as ExamCategory) || 'administratif',
    status: (row.status as ExamStatus) || 'pending',
    confidence: row.confidence || 'medium',
    diplomas: Array.isArray(row.diplomas) ? row.diplomas : [],
    cities: Array.isArray(row.cities) ? row.cities : [],
    documents: Array.isArray(row.documents) ? row.documents : [],
    views_count: Number(row.views_count || 0),
    is_verified: row.is_verified === true,
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
/** Niveau minimal des diplômes acceptés (1..8), ou null si aucun diplôme connu. */
export function computeMinDiplomaLevel(diplomas: string[] | null | undefined): number | null {
  if (!diplomas || diplomas.length === 0) return null;
  const levels = diplomas
    .map((d) => diplomaLevel(d))
    .filter((l): l is number => l !== null);
  if (levels.length === 0) return null;
  return Math.min(...levels);
}

function isPublished(patch: Partial<ExamInsert>, existing?: Exam | null): boolean {
  if (patch.status !== undefined) return patch.status === 'published';
  return existing?.status === 'published';
}

/** Normalise un insert/patch : types, défauts, niveaux calculés. */
function normalizeExamData(
  data: Record<string, unknown>,
  existing?: Exam | null,
): Partial<ExamInsert> {
  const out: Record<string, unknown> = {};

  if (typeof data.title === 'string') out.title = data.title.trim();
  if (typeof data.organizer === 'string') out.organizer = data.organizer.trim();
  if (typeof data.description_md === 'string') out.description_md = data.description_md.trim();
  if (typeof data.category === 'string') out.category = data.category;
  if (typeof data.exam_type === 'string' && data.exam_type) out.exam_type = data.exam_type;
  if (typeof data.status === 'string') out.status = data.status;
  if (typeof data.confidence === 'string') out.confidence = data.confidence;

  for (const key of ['registration_start', 'registration_end', 'exam_date', 'results_date']) {
    if (typeof data[key] === 'string') {
      out[key] = (data[key] as string).trim() ? (data[key] as string).trim() : null;
    } else if (data[key] === null || data[key] === undefined) {
      out[key] = null;
    }
  }
  for (const key of ['age_min', 'age_max', 'positions_count']) {
    if (typeof data[key] === 'number' && Number.isFinite(data[key])) out[key] = data[key];
    else if (data[key] === '' || data[key] === null || data[key] === undefined) out[key] = null;
  }
  for (const key of ['age_reference_date', 'nationality', 'registration_fee', 'location']) {
    if (typeof data[key] === 'string') {
      out[key] = (data[key] as string).trim() ? (data[key] as string).trim() : null;
    } else if (data[key] === null || data[key] === undefined) {
      out[key] = null;
    }
  }
  for (const key of ['source_url', 'source_website', 'seo_title', 'seo_description', 'seo_keywords']) {
    if (typeof data[key] === 'string') {
      out[key] = (data[key] as string).trim() ? (data[key] as string).trim() : null;
    } else if (data[key] === null || data[key] === undefined) {
      out[key] = null;
    }
  }

  if (Array.isArray(data.diplomas)) {
    out.diplomas = (data.diplomas as string[]).map((d) => String(d).trim()).filter(Boolean);
  } else if (typeof data.diplomas === 'string') {
    out.diplomas = (data.diplomas as string)
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
  }
  if (Array.isArray(data.cities)) {
    out.cities = (data.cities as string[]).map((c) => String(c).trim()).filter(Boolean);
  } else if (typeof data.cities === 'string') {
    out.cities = (data.cities as string)
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }
  if (Array.isArray(data.documents)) {
    out.documents = (data.documents as unknown[]).filter(
      (d): d is { name: string; url: string } =>
        Boolean(d) && typeof (d as any).url === 'string' && typeof (d as any).name === 'string',
    );
  }
  if (typeof data.slug === 'string' && data.slug.trim()) out.slug = data.slug.trim();

  // Niveau minimal recalculé à partir des diplômes finaux.
  const finalDiplomas = (out.diplomas as string[] | undefined) ?? existing?.diplomas;
  out.min_diploma_level = computeMinDiplomaLevel(finalDiplomas);

  // published_at synchronisé avec le statut.
  const willBePublished = isPublished(out as Partial<ExamInsert>, existing);
  out.published_at = willBePublished
    ? existing?.published_at || new Date().toISOString()
    : null;
  if (willBePublished) out.is_verified = true;

  if (typeof data.is_verified === 'boolean') out.is_verified = data.is_verified;

  return out as Partial<ExamInsert>;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------
export class ExamService {
  // ------------------------------------------------------------ LIST
  static async list(filters: ExamFilters = {}): Promise<PaginatedExams> {
    if (isSupabaseConfigured()) return this.listSupabase(filters);
    const db = await getDb();
    if (!db) return { rows: [], total: 0 };

    const {
      keyword,
      organizer,
      category,
      status,
      exam_type,
      diploma,
      diploma_level,
      limit = 30,
      offset = 0,
      order_by = 'created_at',
      order_dir = 'desc',
    } = filters;

    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (keyword) {
      clauses.push('(title LIKE $kw OR organizer LIKE $kw OR description_md LIKE $kw)');
      params.$kw = `%${keyword}%`;
    }
    if (organizer) {
      clauses.push('organizer LIKE $org');
      params.$org = `%${organizer}%`;
    }
    if (category) {
      const list = Array.isArray(category) ? category : [category];
      const placeholders = list.map((_, i) => `$cat${i}`).join(',');
      list.forEach((t, i) => (params[`$cat${i}`] = t));
      clauses.push(`category IN (${placeholders})`);
    }
    if (status) {
      const list = Array.isArray(status) ? status : [status];
      const placeholders = list.map((_, i) => `$st${i}`).join(',');
      list.forEach((t, i) => (params[`$st${i}`] = t));
      clauses.push(`status IN (${placeholders})`);
    }
    if (exam_type) {
      const list = Array.isArray(exam_type) ? exam_type : [exam_type];
      const placeholders = list.map((_, i) => `$et${i}`).join(',');
      list.forEach((t, i) => (params[`$et${i}`] = t));
      clauses.push(`exam_type IN (${placeholders})`);
    }
    // NB : filtre via json_each (appartenance exacte au tableau JSON) — la
    // colonne diplomas est un JSON TEXT en SQLite. Évite LIKE + guillemets.
    const diplomaMatch = (name: string) =>
      `EXISTS (SELECT 1 FROM json_each(exams.diplomas) AS _je WHERE _je.value = $${name})`;
    if (diploma_level && diploma_level > 0) {
      clauses.push(
        `(min_diploma_level IS NOT NULL AND min_diploma_level <= $dl OR ${diplomaMatch('dip')})`,
      );
      params.$dl = diploma_level;
      params.$dip = (diploma || '').toUpperCase();
    } else if (diploma) {
      clauses.push(diplomaMatch('dip'));
      params.$dip = diploma.toUpperCase();
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderSafe = ['created_at', 'title', 'organizer', 'registration_end'].includes(order_by!)
      ? order_by!
      : 'created_at';
    const dirSafe = order_dir === 'asc' ? 'ASC' : 'DESC';


    const rows = db
      .prepare(
        `SELECT * FROM exams ${whereSql} ORDER BY ${orderSafe} ${dirSafe} LIMIT $limit OFFSET $offset`,
      )
      .all({ ...params, $limit: limit, $offset: offset })
      .map(rowToExam);
    const total = (
      db.prepare(`SELECT COUNT(*) AS total FROM exams ${whereSql}`).get(params) as any
    ).total;
    return { rows, total };
  }

  // ------------------------------------------------------------ GET
  static async getById(id: string): Promise<Exam | null> {
    if (isSupabaseConfigured()) return this.getByIdSupabase(id);
    const db = await getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM exams WHERE id = $id').get({ $id: id });
    return row ? rowToExam(row) : null;
  }

  static async getBySlug(slug: string): Promise<Exam | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data } = await supabase.from('exams').select('*').eq('slug', slug).maybeSingle();
      return data ? rowToExamFromSupabase(data) : null;
    }
    const db = await getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM exams WHERE slug = $slug').get({ $slug: slug });
    return row ? rowToExam(row) : null;
  }

  // ------------------------------------------------------------ CREATE
  static async create(data: Partial<ExamInsert>): Promise<Exam | null> {
    if (isSupabaseConfigured()) return this.createSupabase(data);
    const db = await getDb();
    if (!db) return null;

    const normalized = normalizeExamData(data as Record<string, unknown>) as Record<string, any>;
    const title = String(normalized.title || data.title || '').trim();
    const organizer = String(normalized.organizer || data.organizer || '').trim();
    if (!title || !organizer) return null;

    // ID généré côté JS (crypto.randomUUID) : `RETURNING id` renvoie null sur
    // node:sqlite avec la valeur DEFAULT UUID — identique des deux côtés.
    const now = new Date().toISOString();
    const id = globalThis.crypto?.randomUUID?.() || slugify(`${title}-${organizer}-${now}`);
    // Slug unique garanti : les concours récurrents (même intitulé chaque
    // année, ex. « Concours direct ENA ») doivent rester uniques — l'index
    // UNIQUE Supabase (idx_exams_slug_unique) rejetterait un doublon.
    const slug =
      (normalized.slug as string) || `${slugify(`${title} ${organizer}`)}-${id.slice(0, 6)}`;

    const res = db
      .prepare(
        `INSERT INTO exams (
          id, title, slug, organizer, category, exam_type, status, description_md,
          registration_start, registration_end, exam_date, results_date,
          age_min, age_max, age_reference_date, nationality, diplomas, min_diploma_level,
          positions_count, registration_fee, location, cities, documents,
          source_url, source_website, confidence, views_count, is_verified,
          seo_title, seo_description, seo_keywords, published_at, created_at, updated_at
        ) VALUES (
          $id, $title, $slug, $organizer, $category, $exam_type, $status, $description_md,
          $registration_start, $registration_end, $exam_date, $results_date,
          $age_min, $age_max, $age_reference_date, $nationality, $diplomas, $min_diploma_level,
          $positions_count, $registration_fee, $location, $cities, $documents,
          $source_url, $source_website, $confidence, 0, $is_verified,
          $seo_title, $seo_description, $seo_keywords, $published_at, $created_at, $created_at
        )`,
      )
      .run({
        $id: id,
        $title: title,
        $slug: slug,
        $organizer: organizer,
        $category: normalized.category || 'administratif',
        $exam_type: normalized.exam_type ?? null,
        $status: normalized.status || 'pending',
        $description_md: normalized.description_md || '',
        $registration_start: normalized.registration_start ?? null,
        $registration_end: normalized.registration_end ?? null,
        $exam_date: normalized.exam_date ?? null,
        $results_date: normalized.results_date ?? null,
        $age_min: normalized.age_min ?? null,
        $age_max: normalized.age_max ?? null,
        $age_reference_date: normalized.age_reference_date ?? null,
        $nationality: normalized.nationality ?? null,
        $diplomas: JSON.stringify(normalized.diplomas || []),
        $min_diploma_level: normalized.min_diploma_level ?? null,
        $positions_count: normalized.positions_count ?? null,
        $registration_fee: normalized.registration_fee ?? null,
        $location: normalized.location ?? null,
        $cities: JSON.stringify(normalized.cities || []),
        $documents: JSON.stringify(normalized.documents || []),
        $source_url: normalized.source_url ?? null,
        $source_website: normalized.source_website ?? null,
        $confidence: normalized.confidence || 'medium',
        $is_verified: normalized.is_verified === true ? 1 : normalized.status === 'published' ? 1 : 0,
        $seo_title: normalized.seo_title ?? null,
        $seo_description: normalized.seo_description ?? null,
        $seo_keywords: normalized.seo_keywords ?? null,
        $published_at: normalized.status === 'published' ? now : null,
        $created_at: now,
      });

    return res.changes > 0 ? this.getById(id) : null;
  }

  // ------------------------------------------------------------ UPDATE
  private static readonly UPDATE_COLUMNS = new Set([
    'title',
    'slug',
    'organizer',
    'category',
    'exam_type',
    'status',
    'description_md',
    'registration_start',
    'registration_end',
    'exam_date',
    'results_date',
    'age_min',
    'age_max',
    'age_reference_date',
    'nationality',
    'diplomas',
    'min_diploma_level',
    'positions_count',
    'registration_fee',
    'location',
    'cities',
    'documents',
    'source_url',
    'source_website',
    'confidence',
    'is_verified',
    'seo_title',
    'seo_description',
    'seo_keywords',
    'published_at',
  ]);

  static async update(id: string, patch: Partial<ExamInsert>): Promise<Exam | null> {
    if (isSupabaseConfigured()) return this.updateSupabase(id, patch);
    const db = await getDb();
    if (!db) return null;

    const existing = await this.getById(id);
    if (!existing) return null;

    const clean: Record<string, unknown> = {};
    const normalized = normalizeExamData(patch as Record<string, unknown>, existing);
    for (const [key, value] of Object.entries(normalized)) {
      if (!ExamService.UPDATE_COLUMNS.has(key)) continue;
      if (typeof value === 'boolean') clean[key] = value ? 1 : 0;
      else if (Array.isArray(value)) clean[key] = JSON.stringify(value);
      else clean[key] = value;
    }
    if (Object.keys(clean).length === 0) return existing;

    const fields = Object.keys(clean).map((k) => `${k} = $${k}`).join(', ');
    const params: Record<string, unknown> = { $id: id };
    Object.entries(clean).forEach(([k, v]) => (params[`$${k}`] = v));
    db.prepare(`UPDATE exams SET ${fields}, updated_at = datetime('now') WHERE id = $id`).run(params);
    return this.getById(id);
  }

  // ------------------------------------------------------------ REMOVE
  static async remove(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) return this.removeSupabase(id);
    const db = await getDb();
    if (!db) return false;
    return (db.prepare('DELETE FROM exams WHERE id = $id').run({ $id: id }).changes || 0) > 0;
  }

  // ------------------------------------------------------------ VIEWS
  static async incrementViews(id: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      try {
        await supabase.rpc('increment_exam_views', { exam_id: id });
      } catch {
        // Repli si la fonction RPC n'existe pas : lecture + incrément.
        const { data: current } = await supabase
          .from('exams')
          .select('views_count')
          .eq('id', id)
          .maybeSingle();
        if (current) {
          await supabase
            .from('exams')
            .update({ views_count: Number(current.views_count || 0) + 1 })
            .eq('id', id);
        }
      }
      return;
    }
    const db = await getDb();
    if (!db) return;
    db.prepare('UPDATE exams SET views_count = views_count + 1, updated_at = updated_at WHERE id = $id').run({ $id: id });
  }

  // ------------------------------------------------------------ SIMILARS
  static async getSimilar(exam: Exam, limit: number = 4): Promise<Exam[]> {
    if (isSupabaseConfigured()) return this.getSimilarSupabase(exam, limit);
    const db = await getDb();
    if (!db) return [];

    const params: Record<string, unknown> = { $id: exam.id, $limit: limit };
    let where = `status = 'published' AND id != $id AND (category = $cat`;
    params.$cat = exam.category;
    if (exam.organizer) {
      where += ` OR organizer = $org`;
      params.$org = exam.organizer;
    }
    if (exam.min_diploma_level) {
      where += ` OR (min_diploma_level IS NOT NULL AND min_diploma_level BETWEEN $lvl1 AND $lvl2)`;
      params.$lvl1 = Math.max(1, exam.min_diploma_level - 1);
      params.$lvl2 = Math.min(8, exam.min_diploma_level + 1);
    }
    where += `)`;
    const rows = db
      .prepare(`SELECT * FROM exams WHERE ${where} ORDER BY created_at DESC LIMIT $limit`)
      .all(params)
      .map(rowToExam);
    return rows;
  }

  // ------------------------------------------------------------ ORGANIZERS
  static async listOrganizers(): Promise<string[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return [];
      const { data } = await supabase.from('exams').select('organizer').eq('status', 'published');
      return Array.from(new Set((data || []).map((r) => r.organizer).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, 'fr'),
      );
    }
    const db = await getDb();
    if (!db) return [];
    const rows = db
      .prepare(`SELECT DISTINCT organizer FROM exams WHERE status = 'published' AND organizer != '' ORDER BY organizer COLLATE NOCASE`)
      .all() as Array<{ organizer: string }>;
    return rows.map((r) => r.organizer);
  }

  // ------------------------------------------------------------ MAINTENANCE
  /**
   * Suppression automatique des concours dont l'information a été collectée
   * il y a plus de 35 jours (5 semaines) — une annonce dont la fin
   * d'inscription est encore dans le futur est conservée.
   * Exécutée à chaque chargement du dashboard exams (comme pour les offres).
   */
  static async purgeOldExams(maxAgeDays: number = 35): Promise<number> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return 0;
      try {
        const nowIso = new Date().toISOString();
        const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
        const r1 = await supabase
          .from('exams')
          .delete()
          .lt('created_at', cutoff)
          .is('registration_end', null)
          .select('id');
        const r2 = await supabase
          .from('exams')
          .delete()
          .lt('created_at', cutoff)
          .lt('registration_end', nowIso)
          .select('id');
        return (r1.data?.length ?? 0) + (r2.data?.length ?? 0);
      } catch {
        return 0;
      }
    }
    const db = await getDb();
    if (!db) return 0;
    try {
      const nowIso = new Date().toISOString();
      const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
      // julianday() : la colonne created_at mêle « YYYY-MM-DD HH:MM:SS »
      // (défaut SQLite) et ISO avec « T » (écritures Node/Python) — une
      // comparaison lexicographique directe serait faussée.
      const result = db
        .prepare(
          `DELETE FROM exams
           WHERE julianday(created_at) < julianday($cutoff)
             AND (registration_end IS NULL OR julianday(registration_end) < julianday($now))`,
        )
        .run({ $cutoff: cutoff, $now: nowIso });
      return result.changes || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Publication automatique des concours en attente depuis plus de
   * `maxAgeMinutes` (défaut : 21 min — miroir des offres).
   *
   * Cause racine historique du « 0 concours recensé » : les concours
   * collectés par le scraper restaient en statut `pending` pour toujours,
   * faute de modération automatique (seules les offres en bénéficiaient).
   * Exécutée à chaque chargement du dashboard exams (comme pour les offres)
   * et par la maintenance CI (scraper.py --maintenance-only).
   */
  static async autoPublishPending(maxAgeMinutes: number = 21): Promise<number> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return 0;
      try {
        const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('exams')
          .update({
            status: 'published',
            is_verified: true,
            published_at: new Date().toISOString(),
          })
          .eq('status', 'pending')
          .lt('created_at', cutoff)
          .select('id');
        if (error) {
          console.error('ExamService.autoPublishPending error:', error.message);
          return 0;
        }
        return data?.length ?? 0;
      } catch {
        return 0;
      }
    }
    const db = await getDb();
    if (!db) return 0;
    try {
      const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
      // julianday() : la colonne created_at mêle « YYYY-MM-DD HH:MM:SS »
      // (défaut SQLite) et ISO avec « T » (écritures Node/Python) — une
      // comparaison lexicographique directe serait faussée.
      const result = db
        .prepare(
          `UPDATE exams
           SET status = 'published',
               is_verified = 1,
               published_at = COALESCE(published_at, datetime('now')),
               updated_at = datetime('now')
           WHERE status = 'pending'
             AND julianday(created_at) < julianday($cutoff)`,
        )
        .run({ $cutoff: cutoff });
      return result.changes || 0;
    } catch {
      return 0;
    }
  }

  // ------------------------------------------------------------ ADMIN STATS
  static async getAdminStats(): Promise<{
    total: number;
    published: number;
    pending: number;
    rejected: number;
    totalViews: number;
    openNow: number;
  }> {
    // Purge « 5 semaines » au chargement du dashboard exams (miroir de la
    // purge des offres dans getAdminDashboardData).
    await this.purgeOldExams();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return { total: 0, published: 0, pending: 0, rejected: 0, totalViews: 0, openNow: 0 };
      const { data } = await supabase.from('exams').select('status,views_count,registration_end');
      const rows = data || [];
      const openNow = rows.filter(
        (r) =>
          r.status === 'published' &&
          r.registration_end &&
          new Date(r.registration_end).getTime() > Date.now(),
      ).length;
      return {
        total: rows.length,
        published: rows.filter((r) => r.status === 'published').length,
        pending: rows.filter((r) => r.status === 'pending').length,
        rejected: rows.filter((r) => r.status === 'rejected').length,
        totalViews: rows.reduce((s, r) => s + Number(r.views_count || 0), 0),
        openNow,
      };
    }
    const db = await getDb();
    if (!db) return { total: 0, published: 0, pending: 0, rejected: 0, totalViews: 0, openNow: 0 };
    const row = db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) AS published,
                SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
                SUM(views_count) AS totalViews,
                SUM(CASE WHEN status='published' AND registration_end IS NOT NULL AND registration_end > datetime('now') THEN 1 ELSE 0 END) AS openNow
         FROM exams`,
      )
      .get() as any;
    return {
      total: row.total || 0,
      published: row.published || 0,
      pending: row.pending || 0,
      rejected: row.rejected || 0,
      totalViews: row.totalViews || 0,
      openNow: row.openNow || 0,
    };
  }

  // =========================================================================
  //  Implémentations Supabase (production)
  // =========================================================================
  private static async listSupabase(filters: ExamFilters): Promise<PaginatedExams> {
    const supabase = getSupabaseClient();
    if (!supabase) return { rows: [], total: 0 };

    const {
      keyword,
      organizer,
      category,
      status,
      exam_type,
      diploma,
      diploma_level,
      limit = 30,
      offset = 0,
      order_by = 'created_at',
      order_dir = 'desc',
      fields = 'full',
    } = filters;

    const columns: string = fields === 'card' ? EXAM_CARD_COLUMNS : EXAM_FULL_COLUMNS;
    let query = supabase.from('exams').select(columns as any, { count: 'exact' });

    if (keyword) {
      const safeKeyword = keyword.replace(/[,.( )*!]/g, ' ').trim();
      if (safeKeyword) {
        const pattern = `%${safeKeyword}%`;
        query = query.or(
          `title.ilike.${pattern},organizer.ilike.${pattern},description_md.ilike.${pattern}`,
        );
      }
    }
    if (organizer) query = query.ilike('organizer', `%${organizer}%`);
    if (category) {
      const list = Array.isArray(category) ? category : [category];
      if (list.length > 0) query = query.in('category', list);
    }
    if (status) {
      const list = Array.isArray(status) ? status : [status];
      if (list.length > 0) query = query.in('status', list);
    }
    if (exam_type) {
      const list = Array.isArray(exam_type) ? exam_type : [exam_type];
      if (list.length > 0) query = query.in('exam_type', list);
    }
    if (diploma_level && diploma_level > 0) {
      const orClauses = [`min_diploma_level.lte.${diploma_level}`];
      if (diploma) orClauses.push(`diplomas.cs.{"${diploma.toUpperCase()}"}`);
      query = query.or(orClauses.join(','));
    } else if (diploma) {
      query = query.contains('diplomas', [diploma.toUpperCase()]);
    }

    const orderSafe = ['created_at', 'title', 'organizer', 'registration_end'].includes(order_by!)
      ? order_by!
      : 'created_at';
    query = query.order(orderSafe, { ascending: order_dir !== 'desc' });

    const safeLimit = Math.min(Math.max(limit, 1), 200);
    query = query.range(offset, offset + safeLimit - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error('ExamService.listSupabase error:', error.message);
      return { rows: [], total: 0 };
    }
    return { rows: (data || []).map(rowToExamFromSupabase), total: count || 0 };
  }

  private static async getByIdSupabase(id: string): Promise<Exam | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase.from('exams').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return rowToExamFromSupabase(data);
  }

  private static async createSupabase(input: Partial<ExamInsert>): Promise<Exam | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const normalized = normalizeExamData(input as Record<string, unknown>) as Record<string, any>;
    const title = String(normalized.title || input.title || '').trim();
    const organizer = String(normalized.organizer || input.organizer || '').trim();
    if (!title || !organizer) return null;

    // Slug unique garanti (index UNIQUE Supabase) : suffixe d'ID pour les
    // concours récurrents d'année en année avec le même intitulé.
    const id = globalThis.crypto?.randomUUID?.();
    const payload: Record<string, unknown> = {
      ...normalized,
      title,
      organizer,
      slug:
        (normalized.slug as string) ||
        `${slugify(`${title} ${organizer}`)}-${id?.slice(0, 6) ?? ''}`,
      diplomas: normalized.diplomas || [],
      cities: normalized.cities || [],
      documents: normalized.documents || [],
      views_count: 0,
      published_at: normalized.status === 'published' ? new Date().toISOString() : null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('exams')
      .insert(payload)
      .select()
      .maybeSingle();
    if (insertError || !inserted) return null;
    return rowToExamFromSupabase(inserted);
  }

  private static async updateSupabase(id: string, patch: Partial<ExamInsert>): Promise<Exam | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const existing = await this.getByIdSupabase(id);
    if (!existing) return null;

    const normalized = normalizeExamData(patch as Record<string, unknown>, existing);
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(normalized)) {
      if (!ExamService.UPDATE_COLUMNS.has(key)) continue;
      if (typeof value === 'boolean') payload[key] = value;
      else payload[key] = value;
    }
    if (Object.keys(payload).length === 0) return existing;

    const { data, error } = await supabase
      .from('exams')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error || !data) return null;
    return rowToExamFromSupabase(data);
  }

  private static async removeSupabase(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { error } = await supabase.from('exams').delete().eq('id', id);
    return !error;
  }

  private static async getSimilarSupabase(exam: Exam, limit: number): Promise<Exam[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    let query = supabase
      .from('exams')
      .select('*')
      .eq('status', 'published')
      .neq('id', exam.id);

    // Priorité : même catégorie OU même organisateur OU niveau de diplôme proche.
    const orClauses: string[] = [`category.eq.${exam.category}`];
    if (exam.organizer) orClauses.push(`organizer.eq.${exam.organizer}`);
    if (exam.min_diploma_level) {
      orClauses.push(
        `and(min_diploma_level.gte.${Math.max(1, exam.min_diploma_level - 1)},min_diploma_level.lte.${Math.min(8, exam.min_diploma_level + 1)})`,
      );
    }
    query = query.or(orClauses.join(','));
    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(rowToExamFromSupabase);
  }
}
