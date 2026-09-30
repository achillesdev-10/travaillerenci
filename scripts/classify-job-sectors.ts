/**
 *  TravaillerEnCi — scripts/classify-job-sectors.ts
 *
 *  Backfill : remplit `job_offers.sector` pour les offres non classées, via le
 *  classifieur déterministe `classifySector` (aucune IA, aucun coût).
 *
 *  USAGE :
 *    npx tsx scripts/classify-job-sectors.ts            # classe (SQLite par défaut)
 *    npx tsx scripts/classify-job-sectors.ts --dry-run  # simulation, aucune écriture
 *    npx tsx scripts/classify-job-sectors.ts --force    # reclasse AUSSI les offres déjà classées
 *
 *  Cible :
 *    • Supabase si NEXT_PUBLIC_DB_PROVIDER=supabase (ou --supabase) ;
 *    • sinon SQLite locale (data/travaillerenci.sqlite3).
 *
 *  Idempotent : ne touche jamais une offre déjà classée sauf avec --force.
 *  N'écrase jamais un secteur choisi manuellement par un admin.
 */

import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { classifySector, VALID_SECTOR_SLUGS } from '@/lib/sectorClassifier';

/** Charge .env.local (tsx ne le fait pas automatiquement). */
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const WANT_SUPABASE =
  process.argv.includes('--supabase') || process.env.NEXT_PUBLIC_DB_PROVIDER === 'supabase';

interface OfferRow {
  id: string;
  title: string;
  description: string | null;
}

interface Stats {
  scanned: number;
  classified: number;
  skipped: number;
}

function report(stats: Stats) {
  console.log('\n📊 Résultat');
  console.log(`   Offres scannées  : ${stats.scanned}`);
  console.log(`   Classées         : ${stats.classified}`);
  console.log(`   Laissées telles  : ${stats.skipped}`);
  console.log(DRY_RUN ? '   (simulation — aucune écriture)\n' : '');
}

// ---------------------------------------------------------------------------
//  SQLite
// ---------------------------------------------------------------------------
async function runSqlite() {
  const { DatabaseSync } = await import('node:sqlite');
  const dbPath = path.join(process.cwd(), 'data', 'travaillerenci.sqlite3');
  if (!existsSync(dbPath)) {
    console.error(`❌ Base SQLite introuvable : ${dbPath}`);
    process.exit(1);
  }
  const db = new DatabaseSync(dbPath);

  // Colonne défensive (cohérent avec le service applicatif).
  const cols = db.prepare('PRAGMA table_info(job_offers)').all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'sector')) {
    db.exec('ALTER TABLE job_offers ADD COLUMN sector TEXT');
  }

  const where = FORCE ? '' : "WHERE sector IS NULL OR TRIM(sector) = ''";
  const rows = db
    .prepare(`SELECT id, title, description FROM job_offers ${where}`)
    .all() as unknown as OfferRow[];

  const stats: Stats = { scanned: rows.length, classified: 0, skipped: 0 };
  const update = db.prepare('UPDATE job_offers SET sector = $sector WHERE id = $id');

  for (const row of rows) {
    const sector = classifySector({ title: row.title, description: row.description });
    if (!sector || !VALID_SECTOR_SLUGS.has(sector)) {
      stats.skipped++;
      continue;
    }
    if (!DRY_RUN) update.run({ $sector: sector, $id: row.id });
    stats.classified++;
    if (DRY_RUN) console.log(`   [dry] ${row.id} → ${sector}  « ${row.title.slice(0, 60)} »`);
  }
  db.close();
  report(stats);
}

// ---------------------------------------------------------------------------
//  Supabase
// ---------------------------------------------------------------------------
async function runSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('❌ Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL + clé requis).');
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const PAGE = 500;
  let offset = 0;
  const stats: Stats = { scanned: 0, classified: 0, skipped: 0 };

  for (;;) {
    let query = supabase.from('job_offers').select('id,title,description').range(offset, offset + PAGE - 1);
    if (!FORCE) query = query.or('sector.is.null,sector.eq.');
    const { data, error } = await query;
    if (error) {
      console.error('❌ Lecture Supabase :', error.message);
      process.exit(1);
    }
    const rows = (data || []) as OfferRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      stats.scanned++;
      const sector = classifySector({ title: row.title, description: row.description });
      if (!sector || !VALID_SECTOR_SLUGS.has(sector)) {
        stats.skipped++;
        continue;
      }
      if (!DRY_RUN) {
        const { error: updErr } = await supabase
          .from('job_offers')
          .update({ sector })
          .eq('id', row.id);
        if (updErr) {
          console.error(`   ⚠️ ${row.id} : ${updErr.message}`);
          stats.skipped++;
          continue;
        }
      }
      stats.classified++;
      if (DRY_RUN) console.log(`   [dry] ${row.id} → ${sector}  « ${row.title.slice(0, 60)} »`);
    }

    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  report(stats);
}

async function main() {
  console.log(`\n🏷️  Classification des offres par métier ${DRY_RUN ? '(simulation)' : ''}`);
  if (WANT_SUPABASE) await runSupabase();
  else await runSqlite();
}

main().catch((err) => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});
