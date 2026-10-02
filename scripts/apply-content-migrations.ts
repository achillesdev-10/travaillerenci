/**
 *  TravaillerEnCi — scripts/apply-content-migrations.ts
 *
 *  Applique les migrations « contenu » manquantes sur Supabase via la
 *  MANAGEMENT API (exécution SQL directe — indépendant du cache PostgREST) :
 *    • 0009 : table `blog_posts` (supabase/migrations/0009_create_blog_posts.sql)
 *    • 0010 : table `exams`     (supabase/APPLY-EXAMS-MIGRATION.sql)
 *    • 0014–0018 : vérification email, profil candidat, sauvegardes, alertes,
 *      signalements (rétention candidat).
 *    • 0025–0029 : colonne métier des offres, profil enrichi, analytics,
 *      consentement de visibilité (§30), newsletter (§20).
 *
 *  Une migration est réputée « en place » si la table existe ET si toutes les
 *  colonnes déclarées sont présentes (information_schema.columns) : cela
 *  permet d'appliquer les migrations de colonnes sur une table déjà créée.
 *
 *  Prérequis :
 *    - Personal Access Token Supabase dans .env.local : SUPABASE_ACCESS_TOKEN
 *    - NEXT_PUBLIC_SUPABASE_URL (déjà présente)
 *
 *  USAGE :
 *    npx tsx scripts/apply-content-migrations.ts           # vérifie puis applique
 *    npx tsx scripts/apply-content-migrations.ts --check   # vérification seule
 *
 *  Idempotent : ne ré-applique que les migrations réellement manquantes.
 */

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

const CHECK_ONLY = process.argv.includes('--check');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL manquante (.env.local).');
  process.exit(1);
}
if (!ACCESS_TOKEN) {
  console.error(
    '❌ SUPABASE_ACCESS_TOKEN manquante.\n' +
      '   Créez un Personal Access Token sur https://supabase.com/dashboard/account/tokens\n' +
      '   puis ajoutez-le dans .env.local : SUPABASE_ACCESS_TOKEN=sbp_…',
  );
  process.exit(1);
}

const projectRef = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0];
const API = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

/** Migrations à vérifier/appliquer : table cible → fichier SQL (autonome).
 *  `columns` (optionnel) : colonnes devant exister pour que la migration soit
 *  considérée comme appliquée (migrations de colonnes sur table déjà créée). */
const MIGRATIONS: Array<{
  table: string;
  label: string;
  file: string;
  columns?: string[];
}> = [
  { table: 'blog_posts', label: '0009 (blog)', file: 'supabase/migrations/0009_create_blog_posts.sql' },
  { table: 'exams', label: '0010 (concours)', file: 'supabase/APPLY-EXAMS-MIGRATION.sql' },
  // Rétention candidat : vérification d'email, mini-profil, sauvegardes, alertes.
  { table: 'verify_email_tokens', label: '0014 (vérification email)', file: 'supabase/migrations/0014_email_verification.sql' },
  { table: 'candidate_profiles', label: '0015 (profil candidat)', file: 'supabase/migrations/0015_candidate_profiles.sql' },
  { table: 'saved_items', label: '0016 (sauvegardes)', file: 'supabase/migrations/0016_saved_items.sql' },
  { table: 'alerts', label: '0017 (alertes candidat)', file: 'supabase/migrations/0017_alerts.sql' },
  { table: 'reports', label: '0018 (signalements)', file: 'supabase/migrations/0018_reports.sql' },
  // Master prompt : catégorisation des offres, profil enrichi, analytics,
  // consentement de visibilité (§30), newsletter (§20).
  {
    table: 'job_offers',
    label: '0025 (secteur des offres)',
    file: 'supabase/migrations/0025_add_job_sector.sql',
    columns: ['sector'],
  },
  {
    table: 'candidate_profiles',
    label: '0026 (profil candidat enrichi)',
    file: 'supabase/migrations/0026_enrich_candidate_profiles.sql',
    columns: ['job_title', 'experience_level', 'skills', 'contract_types', 'bio', 'resume_url'],
  },
  {
    table: 'analytics_events',
    label: '0027 (analytics)',
    file: 'supabase/migrations/0027_create_analytics_events.sql',
  },
  {
    table: 'candidate_profiles',
    label: '0028 (consentement de visibilité)',
    file: 'supabase/migrations/0028_add_profile_visibility.sql',
    columns: ['profile_visibility'],
  },
  // Newsletter : architecture d'envoi préparatoire (§20), table dédiée.
  { table: 'newsletter_subscribers', label: '0029 (newsletter)', file: 'supabase/migrations/0029_newsletter_subscribers.sql' },
  // Alertes candidat : critères contrat + mots-clés (§8).
  {
    table: 'alerts',
    label: '0030 (alertes : contrat + mots-clés)',
    file: 'supabase/migrations/0030_alerts_contract_keywords.sql',
    columns: ['contract_type', 'keywords'],
  },
];

async function runSql(query: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      error:
        (body && (body.message || body.error || body.details)) || `HTTP ${res.status}`,
    };
  }
  return { ok: true, data: body?.result ?? body };
}

type TableCheck = { ok: boolean; present: boolean };
type ColumnsCheck = { ok: boolean; missing: string[] };

async function tableExists(table: string): Promise<TableCheck> {
  const check = await runSql(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '${table}'`,
  );
  if (!check.ok) return { ok: false, present: false };
  return { ok: true, present: Array.isArray(check.data) && check.data.length > 0 };
}

/** Colonnes déclarées absentes de la table ([] si tout est en place). */
async function missingColumns(table: string, columns: string[]): Promise<ColumnsCheck> {
  if (!columns.length) return { ok: true, missing: [] };
  const check = await runSql(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}'`,
  );
  if (!check.ok) return { ok: false, missing: columns.slice() };
  const present = new Set(
    (Array.isArray(check.data) ? check.data : []).map((row: { column_name?: unknown }) =>
      String(row.column_name ?? ''),
    ),
  );
  return { ok: true, missing: columns.filter((column) => !present.has(column)) };
}

async function main() {
  console.log(`🔎 Projet Supabase : ${projectRef}\n`);

  let allOk = true;
  for (const m of MIGRATIONS) {
    const tableCheck = await tableExists(m.table);
    if (!tableCheck.ok) {
      console.log(
        `❌ ${m.label} — vérification impossible (erreur API : jeton invalide ou projet inaccessible).`,
      );
      allOk = false;
      continue;
    }

    const columnsCheck = tableCheck.present
      ? await missingColumns(m.table, m.columns ?? [])
      : { ok: true, missing: [] };
    if (!columnsCheck.ok) {
      console.log(`❌ ${m.label} — vérification des colonnes impossible (erreur API).`);
      allOk = false;
      continue;
    }

    const applied = tableCheck.present && columnsCheck.missing.length === 0;

    if (applied) {
      console.log(
        `✅ ${m.label} — public.${m.table} en place${m.columns?.length ? ` (${m.columns.length} colonnes vérifiées)` : ''}`,
      );
    } else if (!tableCheck.present) {
      console.log(`ℹ️  ${m.label} — table public.${m.table} ABSENTE`);
    } else {
      console.log(
        `⚠️  ${m.label} — table présente, colonne(s) manquante(s) : ${columnsCheck.missing.join(', ')}`,
      );
    }

    if (CHECK_ONLY || applied) continue;

    const sqlPath = path.join(process.cwd(), m.file);
    if (!existsSync(sqlPath)) {
      console.error(`   ❌ Fichier introuvable : ${m.file}`);
      allOk = false;
      continue;
    }
    console.log(`   Application de ${m.file}…`);
    const apply = await runSql(readFileSync(sqlPath, 'utf8'));
    if (!apply.ok) {
      console.error(`   ❌ Échec : ${apply.error}`);
      allOk = false;
      continue;
    }

    const recheckTable = await tableExists(m.table);
    const recheckColumns = recheckTable.ok && recheckTable.present
      ? await missingColumns(m.table, m.columns ?? [])
      : { ok: false, missing: (m.columns ?? []).slice() };
    const confirmed = recheckTable.ok && recheckColumns.ok && recheckTable.present && recheckColumns.missing.length === 0;
    console.log(
      confirmed
        ? `   ✅ ${m.label} appliquée et confirmée.`
        : `   ⚠️  ${m.label} : contre-vérification échouée${
            recheckColumns.missing.length ? ` (manque : ${recheckColumns.missing.join(', ')})` : ''
          }.`,
    );
    if (!confirmed) allOk = false;
  }

  console.log(
    `\n${allOk ? '✅ Toutes les migrations de contenu sont en place.' : '❌ Au moins une migration a échoué.'}`,
  );
  if (!allOk) process.exitCode = 1;
}

main().catch((err) => {
  console.error('❌ Erreur fatale :', err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
