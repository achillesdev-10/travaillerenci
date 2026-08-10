/**
 *  TravaillerEnCi — scripts/apply-content-migrations.ts
 *
 *  Applique les migrations « contenu » manquantes sur Supabase via la
 *  MANAGEMENT API (exécution SQL directe — indépendant du cache PostgREST) :
 *    • 0009 : table `blog_posts` (supabase/migrations/0009_create_blog_posts.sql)
 *    • 0010 : table `exams`     (supabase/APPLY-EXAMS-MIGRATION.sql)
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

/** Migrations à vérifier/appliquer : table cible → fichier SQL (autonome). */
const MIGRATIONS: Array<{ table: string; label: string; file: string }> = [
  { table: 'blog_posts', label: '0009 (blog)', file: 'supabase/migrations/0009_create_blog_posts.sql' },
  { table: 'exams', label: '0010 (concours)', file: 'supabase/APPLY-EXAMS-MIGRATION.sql' },
  // Rétention candidat : vérification d'email, mini-profil, sauvegardes, alertes.
  { table: 'verify_email_tokens', label: '0014 (vérification email)', file: 'supabase/migrations/0014_email_verification.sql' },
  { table: 'candidate_profiles', label: '0015 (profil candidat)', file: 'supabase/migrations/0015_candidate_profiles.sql' },
  { table: 'saved_items', label: '0016 (sauvegardes)', file: 'supabase/migrations/0016_saved_items.sql' },
  { table: 'alerts', label: '0017 (alertes candidat)', file: 'supabase/migrations/0017_alerts.sql' },
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

async function tableExists(table: string): Promise<boolean> {
  const check = await runSql(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '${table}'`,
  );
  if (!check.ok) return false;
  return Array.isArray(check.data) && check.data.length > 0;
}

async function main() {
  console.log(`🔎 Projet Supabase : ${projectRef}\n`);

  let allOk = true;
  for (const m of MIGRATIONS) {
    const exists = await tableExists(m.table);
    console.log(
      exists
        ? `✅ ${m.label} — table public.${m.table} présente`
        : `ℹ️  ${m.label} — table public.${m.table} ABSENTE`,
    );

    if (CHECK_ONLY || exists) continue;

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

    const recheck = await tableExists(m.table);
    console.log(
      recheck
        ? `   ✅ ${m.label} appliquée et confirmée.`
        : `   ⚠️  ${m.label} : contre-vérification échouée.`,
    );
    if (!recheck) allOk = false;
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
