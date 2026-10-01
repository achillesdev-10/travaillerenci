/**
 *  TravaillerEnCi — e2e/fixtures.ts
 *
 *  Fixtures locales pour les tests Playwright (§36 du master prompt).
 *
 *  ⚠️  JAMAIS de données de démonstration en production : ce module n'agit que
 *  sur la base SQLite locale `data/travaillerenci.sqlite3`, uniquement lorsque
 *  les tests E2E démarrent (globalSetup) ou lorsque le script est lancé à la
 *  main (`npm run e2e:seed` / `npm run e2e:seed:cleanup`).
 *
 *  Marqueur des fixtures : `source_url` préfixé `e2e-fixture://`.
 *  Les comptes de test utilisent des emails `e2e-*@test.ci`.
 */

import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

// Les scripts Playwright et `npm run e2e:seed` s'exécutent depuis la racine.
const ROOT = process.cwd();
const DB_PATH = resolve(ROOT, 'data', 'travaillerenci.sqlite3');

const FIXTURE_PREFIX = 'e2e-fixture://';
const E2E_EMAIL_DOMAIN = '@test.ci';

interface FixtureOffer {
  id: string;
  title: string;
  company: string;
  location: string;
  contract_type: string;
  category: string;
  sector: string;
  clicks_count: number;
  ageHours: number;
}

/**
 * 12 offres couvrant : un combo métier×ville suffisant pour la landing
 * SEO `/emplois-informatique-abidjan` (8 ≥ MIN_COMBO_OFFERS), les landings
 * `/emplois-informatique` et `/emplois-abidjan` (≥ MIN_OFFERS), des stages,
 * et plusieurs villes/secteurs pour les filtres et le tri « récent ».
 */
const OFFERS: FixtureOffer[] = [
  // 8 offres informatique à Abidjan (combo SEO requis : ≥ 8)
  { id: '11111111-1111-4111-8111-111111111101', title: 'Développeur React (H/F)', company: 'EsnAbidjan', location: 'Abidjan, Cocody', contract_type: 'CDI', category: 'job', sector: 'it-digital', clicks_count: 42, ageHours: 3 },
  { id: '11111111-1111-4111-8111-111111111102', title: 'Développeur Back-end Node.js', company: 'KokoTech', location: 'Abidjan, Plateau', contract_type: 'CDI', category: 'job', sector: 'it-digital', clicks_count: 31, ageHours: 6 },
  { id: '11111111-1111-4111-8111-111111111103', title: 'Data Analyst junior', company: 'DataCI', location: 'Abidjan, Riviera', contract_type: 'CDD', category: 'job', sector: 'it-digital', clicks_count: 27, ageHours: 9 },
  { id: '11111111-1111-4111-8111-111111111104', title: 'Technicien réseaux', company: 'NetLink', location: 'Abidjan, Yopougon', contract_type: 'CDI', category: 'job', sector: 'it-digital', clicks_count: 19, ageHours: 12 },
  { id: '11111111-1111-4111-8111-111111111105', title: 'Développeur Web Full-stack', company: 'DigitalAbidjan', location: 'Abidjan, Marcory', contract_type: 'CDD', category: 'job', sector: 'it-digital', clicks_count: 15, ageHours: 18 },
  { id: '11111111-1111-4111-8111-111111111106', title: 'Ingénieur DevOps', company: 'CloudIvoire', location: 'Abidjan, Plateau', contract_type: 'CDI', category: 'job', sector: 'it-digital', clicks_count: 12, ageHours: 24 },
  { id: '11111111-1111-4111-8111-111111111107', title: 'Support informatique', company: 'AssistCI', location: 'Abidjan, Cocody', contract_type: 'CDI', category: 'job', sector: 'it-digital', clicks_count: 8, ageHours: 30 },
  { id: '11111111-1111-4111-8111-111111111108', title: 'Développeur Mobile Flutter', company: 'AppMakers', location: 'Abidjan, Zone 4', contract_type: 'CDD', category: 'job', sector: 'it-digital', clicks_count: 5, ageHours: 36 },
  // 2 stages
  { id: '22222222-2222-4222-8222-222222222201', title: 'Stage marketing digital', company: 'AgenceVibe', location: 'Abidjan, Cocody', contract_type: 'Stage', category: 'internship', sector: 'marketing-communication', clicks_count: 22, ageHours: 5 },
  { id: '22222222-2222-4222-8222-222222222202', title: 'Stage comptabilité', company: 'CabinetKouakou', location: 'Bouaké, Centre', contract_type: 'Stage', category: 'internship', sector: 'banque-finance', clicks_count: 9, ageHours: 40 },
  // 2 offres hors Abidjan (filtres ville / diversité sectorielle)
  { id: '33333333-3333-4333-8333-333333333301', title: 'Chargé de clientèle bancaire', company: 'BanqueRegion', location: 'Yamoussoukro, Quartier France', contract_type: 'CDI', category: 'job', sector: 'banque-finance', clicks_count: 11, ageHours: 14 },
  { id: '33333333-3333-4333-8333-333333333302', title: 'Technicien de maintenance industrielle', company: 'UsinePort', location: 'San-Pédro, Zone portuaire', contract_type: 'CDD', category: 'job', sector: 'industrie', clicks_count: 7, ageHours: 46 },
];

const DESCRIPTION = [
  "Poste ouvert au sein d'une équipe dynamique en Côte d'Ivoire.",
  'Missions : participer au quotidien de l’équipe, atteindre les objectifs fixés et accompagner les projets en cours.',
  'Profil : motivation, sérieux et esprit d’équipe. Candidature en ligne via le lien fourni.',
].join('\n\n');

/** Ouvre la base locale (lecture/écriture). */
function openDb(): DatabaseSync {
  return new DatabaseSync(DB_PATH);
}

/** Insère (ou remplace) les 12 offres de test. Idempotent. */
export function seedFixtures(): number {
  const db = openDb();
  try {
    const now = Date.now();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO job_offers
        (id, title, company, location, contract_type, description, apply_link,
         apply_email, source_url, source_website, status, seo_title,
         seo_description, seo_keywords, slug, is_verified, is_archived,
         is_expired, clicks_count, created_at, updated_at, category, deadline, sector)
      VALUES
        (@id, @title, @company, @location, @contract_type, @description, @apply_link,
         @apply_email, @source_url, @source_website, @status, @seo_title,
         @seo_description, @seo_keywords, @slug, @is_verified, 0,
         0, @clicks_count, @created_at, @updated_at, @category, @deadline, @sector)
    `);

    let count = 0;
    for (const offer of OFFERS) {
      const createdAt = new Date(now - offer.ageHours * 3_600_000).toISOString();
      const updatedAt = createdAt;
      const deadline = new Date(now + 30 * 86_400_000).toISOString();
      insert.run({
        id: offer.id,
        title: offer.title,
        company: offer.company,
        location: offer.location,
        contract_type: offer.contract_type,
        description: DESCRIPTION,
        apply_link: 'https://example.ci/candidature',
        apply_email: `recrutement@${offer.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.ci`,
        source_url: `${FIXTURE_PREFIX}${offer.id}`,
        source_website: 'e2e-fixture',
        status: 'published',
        seo_title: `${offer.title} — ${offer.company}`,
        seo_description: `${offer.title} à ${offer.location} : postulez en ligne sur TravaillerenCi.`,
        seo_keywords: `${offer.title}, emploi ${offer.location}, recrutement Côte d'Ivoire`,
        slug: `e2e-${offer.id.slice(-6)}-${offer.title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 48)}`,
        is_verified: offer.clicks_count > 10 ? 1 : 0,
        clicks_count: offer.clicks_count,
        created_at: createdAt,
        updated_at: updatedAt,
        category: offer.category,
        deadline,
        sector: offer.sector,
      });
      count += 1;
    }
    return count;
  } finally {
    db.close();
  }
}

/**
 * Supprime les fixtures ET les comptes créés par les tests
 * (`e2e-*@test.ci` + leurs données). Laisse la base locale propre.
 */
export function cleanupFixtures(): { offers: number; users: number } {
  const db = openDb();
  try {
    const userIds = (
      db.prepare(`SELECT id FROM users WHERE email LIKE ?`).all(`e2e-%${E2E_EMAIL_DOMAIN}`) as Array<{
        id: string;
      }>
    ).map((row) => row.id);

    for (const userId of userIds) {
      for (const table of [
        'saved_items',
        'alerts',
        'notifications',
        'admin_notifications',
        'password_reset_tokens',
        'verify_email_tokens',
        'analytics_events',
        'site_visits',
      ]) {
        try {
          db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
        } catch {
          // Table sans colonne user_id : ignoré volontairement.
        }
      }
      db.prepare(`DELETE FROM candidate_profiles WHERE user_id = ?`).run(userId);
      db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
    }

    const offers = db
      .prepare(`DELETE FROM job_offers WHERE source_url LIKE ?`)
      .run(`${FIXTURE_PREFIX}%`);
    const changes = (offers as { changes?: number }).changes ?? 0;
    return { offers: Number(changes), users: userIds.length };
  } finally {
    db.close();
  }
}

// CLI : `npx tsx e2e/fixtures.ts [--cleanup]`
const invokedDirectly = Boolean(process.argv[1] && process.argv[1].endsWith('fixtures.ts'));
if (invokedDirectly) {
  if (process.argv.includes('--cleanup')) {
    const result = cleanupFixtures();
    console.log(
      `🧹 Nettoyage E2E : ${result.offers} offre(s) et ${result.users} compte(s) supprimé(s).`,
    );
  } else {
    const count = seedFixtures();
    console.log(`🌱 Fixtures E2E : ${count} offres insérées dans ${DB_PATH}`);
  }
}
