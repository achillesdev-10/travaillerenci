/**
 *  TravaillerEnCi — scripts/sync-all-to-supabase.ts
 *
 *  RESYNC UNIFIÉE : copie les tables locales (SQLite data/travaillerenci.sqlite3)
 *  vers Supabase (production) :
 *    • exams      → public.exams        (dédup source_url puis titre+organisateur)
 *    • blog_posts → public.blog_posts   (dédup par slug)
 *    • job_offers → public.job_offers   (dédup source_url puis titre+entreprise)
 *
 *  Règles communes :
 *    - Idempotent : jamais de doublons, relançable sans risque.
 *    - UPDATE : préserve `created_at` et les compteurs distants (views_count,
 *      clicks_count) qui évoluent côté production.
 *    - Prérequis : migrations appliquées (scripts/apply-content-migrations.ts)
 *      et clés Supabase dans .env.local (service_role pour écrire via la RLS).
 *
 *  USAGE :
 *    npx tsx scripts/sync-all-to-supabase.ts --dry
 *    npx tsx scripts/sync-all-to-supabase.ts --tables=blog,jobs
 *    npx tsx scripts/sync-all-to-supabase.ts
 */

import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

/** Charge les variables d'env du fichier .env.local (tsx ne le fait pas). */
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const DRY = process.argv.includes('--dry');
const tablesArg = process.argv
  .find((a) => a.startsWith('--tables='))
  ?.split('=')[1] ?? 'exam,blog,jobs';
const requested = new Set(
  tablesArg.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL manquante (.env.local).');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.warn(
    '⚠️  SUPABASE_SERVICE_ROLE_KEY manquante : les écritures seront bloquées par la RLS (clé anon utilisée).',
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || ANON_KEY || '', {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DB_PATH = path.join(process.cwd(), 'data', 'travaillerenci.sqlite3');
const db = new DatabaseSync(DB_PATH);

type SqliteRow = Record<string, unknown>;
type Payload = Record<string, unknown>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** SQLite stocke les dates en ISO parfois sans fuseau → force UTC (TIMESTAMPTZ). */
function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/[zZ]$/.test(text) || /[+-]\d{2}:\d{2}$/.test(text)) return text;
  return `${text}Z`;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toBool = (v: unknown): boolean => v === 1 || v === true;

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const str = (v: unknown, fallback: string | null = null): string | null => {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s || fallback;
};

async function probeTable(name: string): Promise<boolean> {
  const { error } = await supabase.from(name as any).select('id').limit(1);
  if (error && /Could not find the table|PGRST205/i.test(String(error.message))) {
    return false;
  }
  if (error) throw new Error(`Connexion Supabase impossible (${name}) : ${error.message}`);
  return true;
}

/** Déduplication : source_url, sinon titre+organisateur (idempotence). */
async function findExam(p: Payload): Promise<string | null> {
  if (p.source_url) {
    const { data } = await supabase.from('exams').select('id').eq('source_url', p.source_url).maybeSingle();
    if (data) return data.id as string;
  }
  if (p.title && p.organizer) {
    const { data } = await supabase
      .from('exams').select('id').eq('title', p.title).eq('organizer', p.organizer).limit(1);
    if (data && data.length > 0) return data[0].id as string;
  }
  return null;
}

async function findBlog(p: Payload): Promise<string | null> {
  if (!p.slug) return null;
  const { data } = await supabase.from('blog_posts').select('id').eq('slug', p.slug).maybeSingle();
  return data ? (data.id as string) : null;
}

async function findJob(p: Payload): Promise<string | null> {
  if (p.source_url) {
    const { data } = await supabase.from('job_offers').select('id').eq('source_url', p.source_url).maybeSingle();
    if (data) return data.id as string;
  }
  if (p.title && p.company) {
    const { data } = await supabase
      .from('job_offers').select('id').eq('title', p.title).eq('company', p.company).limit(1);
    if (data && data.length > 0) return data[0].id as string;
  }
  return null;
}

// -----------------------------------------------------------------------------
//  exams
// -----------------------------------------------------------------------------
function examPayload(row: SqliteRow): Payload {
  return {
    title: str(row.title, '')!,
    slug: str(row.slug),
    organizer: str(row.organizer, '')!,
    category: str(row.category, 'administratif'),
    exam_type: str(row.exam_type),
    status: str(row.status, 'pending'),
    description_md: str(row.description_md, '')!,
    registration_start: toIso(row.registration_start),
    registration_end: toIso(row.registration_end),
    exam_date: toIso(row.exam_date),
    results_date: toIso(row.results_date),
    age_min: num(row.age_min),
    age_max: num(row.age_max),
    age_reference_date: str(row.age_reference_date),
    nationality: str(row.nationality),
    diplomas: parseJsonArray(row.diplomas).map((d) => String(d)),
    min_diploma_level: num(row.min_diploma_level),
    positions_count: num(row.positions_count),
    registration_fee: str(row.registration_fee),
    location: str(row.location),
    cities: parseJsonArray(row.cities).map((c) => String(c)),
    documents: parseJsonArray(row.documents),
    source_url: str(row.source_url),
    source_website: str(row.source_website),
    confidence: str(row.confidence, 'medium'),
    views_count: num(row.views_count) ?? 0,
    is_verified: toBool(row.is_verified),
    seo_title: str(row.seo_title),
    seo_description: str(row.seo_description),
    seo_keywords: str(row.seo_keywords),
    published_at: toIso(row.published_at),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

// -----------------------------------------------------------------------------
//  blog_posts
// -----------------------------------------------------------------------------
function blogPayload(row: SqliteRow): Payload {
  return {
    title: str(row.title, '')!,
    slug: str(row.slug, '')!,
    excerpt: str(row.excerpt),
    content: str(row.content, '')!,
    cover_image: str(row.cover_image),
    author: str(row.author, 'TravaillerenCi'),
    tags: str(row.tags),
    status: str(row.status, 'draft'),
    published_at: toIso(row.published_at),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

// -----------------------------------------------------------------------------
//  job_offers
// -----------------------------------------------------------------------------
function jobPayload(row: SqliteRow): Payload {
  return {
    title: str(row.title, '')!,
    company: str(row.company, '')!,
    location: str(row.location, ''),
    contract_type: str(row.contract_type, 'CDI'),
    description: str(row.description, '')!,
    apply_link: str(row.apply_link),
    apply_email: str(row.apply_email),
    source_url: str(row.source_url),
    source_website: str(row.source_website),
    status: str(row.status, 'pending'),
    seo_title: str(row.seo_title),
    seo_description: str(row.seo_description),
    seo_keywords: str(row.seo_keywords),
    slug: str(row.slug),
    is_verified: toBool(row.is_verified),
    is_archived: toBool(row.is_archived),
    is_expired: toBool(row.is_expired),
    clicks_count: num(row.clicks_count) ?? 0,
    category: str(row.category, 'job'),
    deadline: toIso(row.deadline),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

// -----------------------------------------------------------------------------
//  Logique générique : upsert une table SQLite → Supabase
// -----------------------------------------------------------------------------
type SyncSpec = {
  name: string;
  table: 'exams' | 'blog_posts' | 'job_offers';
  payload(row: SqliteRow): Payload;
  find(p: Payload): Promise<string | null>;
  /** Champ obligatoire en plus du titre (identifiant métier). */
  identity: 'organizer' | 'company' | null;
  /** Champs préservés côté distant lors d'un UPDATE (compteurs/historique). */
  preserveOnUpdate: string[];
};

async function syncTable(spec: SyncSpec) {
  if (!requested.has(spec.name)) {
    console.log(`⏭️  ${spec.table} : ignorée (--tables=${tablesArg})`);
    return;
  }

  console.log(`\n📦 ${spec.table} :`);

  const exists = await probeTable(spec.table);
  if (!exists) {
    console.error(
      `   ❌ Table public.${spec.table} absente — appliquez d'abord ` +
        'scripts/apply-content-migrations.ts',
    );
    return;
  }

  const rows = db
    .prepare(`SELECT * FROM ${spec.table} ORDER BY created_at ASC`)
    .all() as unknown as SqliteRow[];
  console.log(`   ${rows.length} ligne(s) lue(s) depuis SQLite.`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    const payload = spec.payload(row);
    const missingIdentity =
      (spec.identity === 'organizer' && !payload.organizer) ||
      (spec.identity === 'company' && !payload.company);
    if (!payload.title || missingIdentity) {
      failed++;
      console.warn(`   ⚠ Ignoré (identifiants manquants) : ${payload.title || '(sans titre)'}`);
      continue;
    }

    try {
      const existingId = await spec.find(payload);

      if (existingId) {
        if (DRY) {
          console.log(`   ↻ [dry] MAJ      : ${payload.title}`);
          updated++;
          continue;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { created_at, ...rest } = payload;
        for (const key of spec.preserveOnUpdate) delete rest[key];
        const { error } = await supabase
          .from(spec.table)
          .update(rest)
          .eq('id', existingId);
        if (error) throw error;
        updated++;
        console.log(`   ↻ MAJ       : ${payload.title}`);
      } else {
        if (DRY) {
          console.log(`   ➕ [dry] AJOUT    : ${payload.title}`);
          inserted++;
          continue;
        }
        const insertPayload: Payload = { ...payload };
        if (row.id && UUID_RE.test(String(row.id))) {
          insertPayload.id = String(row.id);
        } else {
          delete insertPayload.id;
        }
        const { error } = await supabase.from(spec.table).insert(insertPayload);
        if (error) throw error;
        inserted++;
        console.log(`   ➕ AJOUT    : ${payload.title}`);
      }
    } catch (err) {
      failed++;
      console.error(
        `   ❌ ÉCHEC   : ${payload.title} — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    DRY
      ? `   (simulation) ${inserted} ajout(s), ${updated} MAJ, ${failed} échec(s) — aucune écriture.`
      : `   ✅ ${inserted} ajouté(s), ${updated} mis(e) à jour, ${failed} échec(s).`,
  );
}

// -----------------------------------------------------------------------------
//  Exécution
// -----------------------------------------------------------------------------
async function main() {
  const specs: SyncSpec[] = [
    { name: 'exam', table: 'exams', payload: examPayload, find: findExam, identity: 'organizer', preserveOnUpdate: ['views_count'] },
    { name: 'blog', table: 'blog_posts', payload: blogPayload, find: findBlog, identity: null, preserveOnUpdate: [] },
    { name: 'jobs', table: 'job_offers', payload: jobPayload, find: findJob, identity: 'company', preserveOnUpdate: ['clicks_count'] },
  ];

  const known = new Set(specs.map((s) => s.name));
  const unknown = [...requested].filter((t) => !known.has(t));
  if (requested.size === 0) {
    console.error('❌ --tables= vide — aucun nom de table reconnu (exam, blog, jobs).');
    db.close();
    process.exitCode = 1;
    return;
  }
  if (unknown.length > 0) {
    console.warn(`⚠️  Noms de table inconnus ignorés : ${unknown.join(', ')} (attendu : exam, blog, jobs)`);
  }

  for (const spec of specs) {
    await syncTable(spec);
  }

  db.close();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(DRY ? '✅ Simulation terminée (aucune écriture).' : '✅ Resync unifiée terminée.');
}

main().catch((err) => {
  console.error('❌ Erreur fatale :', err instanceof Error ? err.message : String(err));
  try {
    db.close();
  } catch {
    // déjà fermé
  }
  process.exitCode = 1;
});
