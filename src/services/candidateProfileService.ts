/**
 *  TravaillerEnCi — src/services/candidateProfileService.ts
 *  Profil candidat : ville, diplôme, secteurs d'intérêt, téléphone WhatsApp,
 *  métier recherché, niveau d'expérience, compétences, types de contrat
 *  recherchés, présentation, lien CV.
 *
 *  • Local : SQLite (table `candidate_profiles`, fichier ./data/travaillerenci.sqlite3)
 *  • Prod  : Supabase (migrations 0015 & 0026) — service_role.
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

/** Niveaux d'expérience acceptés (miroir de JOB_LEVELS). */
export const VALID_EXPERIENCE_LEVELS: ReadonlySet<string> = new Set([
  'Junior',
  'Intermédiaire',
  'Senior',
  'Expert',
  'Manager',
  'Cadre dirigeant',
]);

/** Types de contrat recherchés acceptés (miroir de JOB_TYPES). */
export const VALID_CONTRACT_TYPES: ReadonlySet<string> = new Set([
  'CDI',
  'CDD',
  'Stage',
  'Alternance',
  'Freelance',
  'Temps plein',
  'Temps partiel',
]);

const MAX_SKILLS = 30;
const MAX_SKILL_LENGTH = 40;
const MAX_BIO_LENGTH = 600;
const MAX_JOB_TITLE_LENGTH = 120;
const MAX_RESUME_URL_LENGTH = 500;

export interface CandidateProfile {
  user_id: string;
  city: string | null;
  diploma: string | null;
  sectors: string[];
  /** Numéro WhatsApp au format international (ex : 2250700000000). */
  phone: string | null;
  job_title: string | null;
  experience_level: string | null;
  skills: string[];
  contract_types: string[];
  bio: string | null;
  resume_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateProfilePatch {
  city?: string | null;
  diploma?: string | null;
  sectors?: string[] | null;
  phone?: string | null;
  job_title?: string | null;
  experience_level?: string | null;
  skills?: string[] | null;
  contract_types?: string[] | null;
  bio?: string | null;
  resume_url?: string | null;
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
        user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        city             TEXT,
        diploma          TEXT,
        sectors          TEXT NOT NULL DEFAULT '[]',
        phone            TEXT,
        job_title        TEXT,
        experience_level TEXT,
        skills           TEXT NOT NULL DEFAULT '[]',
        contract_types   TEXT NOT NULL DEFAULT '[]',
        bio              TEXT,
        resume_url       TEXT,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Migration défensive : la table peut avoir été créée avant l'ajout des
    // colonnes 0026 (métier, expérience, compétences, contrats, bio, CV).
    const cols = cachedDb.prepare('PRAGMA table_info(candidate_profiles)').all();
    const existing = new Set(cols.map((c: { name: string }) => String(c.name)));
    if (!existing.has('job_title')) cachedDb.exec('ALTER TABLE candidate_profiles ADD COLUMN job_title TEXT');
    if (!existing.has('experience_level')) cachedDb.exec('ALTER TABLE candidate_profiles ADD COLUMN experience_level TEXT');
    if (!existing.has('skills')) cachedDb.exec("ALTER TABLE candidate_profiles ADD COLUMN skills TEXT NOT NULL DEFAULT '[]'");
    if (!existing.has('contract_types')) cachedDb.exec("ALTER TABLE candidate_profiles ADD COLUMN contract_types TEXT NOT NULL DEFAULT '[]'");
    if (!existing.has('bio')) cachedDb.exec('ALTER TABLE candidate_profiles ADD COLUMN bio TEXT');
    if (!existing.has('resume_url')) cachedDb.exec('ALTER TABLE candidate_profiles ADD COLUMN resume_url TEXT');

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

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function rowToProfile(row: any): CandidateProfile {
  return {
    user_id: String(row.user_id),
    city: row.city ?? null,
    diploma: row.diploma ?? null,
    sectors: parseJsonArray(row.sectors),
    phone: row.phone ?? null,
    job_title: row.job_title ?? null,
    experience_level: row.experience_level ?? null,
    skills: parseJsonArray(row.skills),
    contract_types: parseJsonArray(row.contract_types),
    bio: row.bio ?? null,
    resume_url: row.resume_url ?? null,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

/** Normalise une liste de compétences (trim, dédoublonnage, limites). */
function normalizeSkills(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const skill = raw.trim().slice(0, MAX_SKILL_LENGTH);
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
    if (out.length >= MAX_SKILLS) break;
  }
  return out;
}

function normalizeContractTypes(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && VALID_CONTRACT_TYPES.has(v))
    .slice(0, VALID_CONTRACT_TYPES.size);
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
  static async upsert(userId: string, patch: CandidateProfilePatch): Promise<CandidateProfile | null> {
    const existing = await CandidateProfileService.get(userId);
    const now = new Date().toISOString();

    const city = patch.city !== undefined ? text(patch.city, 120) : existing?.city ?? null;
    const diploma = patch.diploma !== undefined ? text(patch.diploma, 80) : existing?.diploma ?? null;
    const sectors =
      patch.sectors !== undefined
        ? (patch.sectors ?? [])
            .map((s) => String(s).trim())
            .filter((s) => s && VALID_SECTOR_SLUGS.has(s))
        : existing?.sectors ?? [];
    const phone = patch.phone !== undefined ? text(patch.phone, 40) : existing?.phone ?? null;
    const jobTitle =
      patch.job_title !== undefined ? text(patch.job_title, MAX_JOB_TITLE_LENGTH) : existing?.job_title ?? null;
    const experienceLevel =
      patch.experience_level !== undefined
        ? (() => {
            const v = text(patch.experience_level, 40);
            return v && VALID_EXPERIENCE_LEVELS.has(v) ? v : null;
          })()
        : existing?.experience_level ?? null;
    const skills = patch.skills !== undefined ? normalizeSkills(patch.skills) : existing?.skills ?? [];
    const contractTypes =
      patch.contract_types !== undefined
        ? normalizeContractTypes(patch.contract_types)
        : existing?.contract_types ?? [];
    const bio = patch.bio !== undefined ? text(patch.bio, MAX_BIO_LENGTH) : existing?.bio ?? null;
    const resumeUrl =
      patch.resume_url !== undefined ? text(patch.resume_url, MAX_RESUME_URL_LENGTH) : existing?.resume_url ?? null;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const payload = {
        city,
        diploma,
        sectors,
        phone,
        job_title: jobTitle,
        experience_level: experienceLevel,
        skills,
        contract_types: contractTypes,
        bio,
        resume_url: resumeUrl,
        updated_at: now,
      };
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
        `UPDATE candidate_profiles SET
           city = $city, diploma = $diploma, sectors = $sectors, phone = $phone,
           job_title = $jobTitle, experience_level = $experienceLevel, skills = $skills,
           contract_types = $contractTypes, bio = $bio, resume_url = $resumeUrl,
           updated_at = $now
         WHERE user_id = $userId`,
      ).run({
        $city: city,
        $diploma: diploma,
        $sectors: JSON.stringify(sectors),
        $phone: phone,
        $jobTitle: jobTitle,
        $experienceLevel: experienceLevel,
        $skills: JSON.stringify(skills),
        $contractTypes: JSON.stringify(contractTypes),
        $bio: bio,
        $resumeUrl: resumeUrl,
        $now: now,
        $userId: userId,
      });
    } else {
      db.prepare(
        `INSERT INTO candidate_profiles
           (user_id, city, diploma, sectors, phone, job_title, experience_level, skills, contract_types, bio, resume_url, created_at, updated_at)
         VALUES
           ($userId, $city, $diploma, $sectors, $phone, $jobTitle, $experienceLevel, $skills, $contractTypes, $bio, $resumeUrl, $now, $now)`,
      ).run({
        $userId: userId,
        $city: city,
        $diploma: diploma,
        $sectors: JSON.stringify(sectors),
        $phone: phone,
        $jobTitle: jobTitle,
        $experienceLevel: experienceLevel,
        $skills: JSON.stringify(skills),
        $contractTypes: JSON.stringify(contractTypes),
        $bio: bio,
        $resumeUrl: resumeUrl,
        $now: now,
      });
    }
    return CandidateProfileService.get(userId);
  }
}
