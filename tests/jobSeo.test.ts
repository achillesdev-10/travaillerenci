/**
 * Unit tests for the SEO job landing pages logic (src/lib/jobSeo.ts).
 * Run with: npx tsx tests/jobSeo.test.ts
 */

import {
  MIN_COMBO_OFFERS,
  MIN_OFFERS,
  buildJobSeoSlug,
  eligibleSeoLandings,
  filterOffersForSeo,
  landingChipHref,
  landingForOffer,
  landingLinksForOffer,
  minOffersFor,
  parseJobSeoSlug,
  resolveCity,
  resolveMetier,
  seoLandingTitle,
  type SeoOfferLike,
} from '../src/lib/jobSeo';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    process.stdout.write('.');
  } else {
    failed++;
    failures.push(message);
    process.stdout.write('F');
  }
}

function assertEqual<T>(actual: T, expected: T, testName: string) {
  assert(pass(actual, expected), `${testName}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function pass<T>(actual: T, expected: T): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function createOffer(overrides: Partial<SeoOfferLike> = {}): SeoOfferLike {
  return {
    id: 'o1',
    category: 'job',
    title: 'Offre de test',
    description: 'Description',
    location: 'Abidjan',
    ...overrides,
  };
}

console.log('\n🧪 Running jobSeo tests...\n');

// ---- 1. parseJobSeoSlug ----
console.log('\n1. parseJobSeoSlug');
assertEqual(
  parseJobSeoSlug('emplois-abidjan'),
  { activity: 'emplois', citySlug: 'abidjan', metierSlug: null },
  'ville seule',
);
assertEqual(
  parseJobSeoSlug('stages-informatique'),
  { activity: 'stages', citySlug: null, metierSlug: 'informatique' },
  'métier seul (stages)',
);
assertEqual(
  parseJobSeoSlug('emplois-informatique-abidjan'),
  { activity: 'emplois', citySlug: 'abidjan', metierSlug: 'informatique' },
  'combinaison métier puis ville',
);
assertEqual(
  parseJobSeoSlug('emplois-abidjan-informatique'),
  { activity: 'emplois', citySlug: 'abidjan', metierSlug: 'informatique' },
  'combinaison ville puis métier (ordre inversé)',
);
assertEqual(
  parseJobSeoSlug('stages-transport-logistique-san-pedro'),
  { activity: 'stages', citySlug: 'san-pedro', metierSlug: 'transport-logistique' },
  'slug multi-mots (transport-logistique + san-pedro)',
);
assertEqual(parseJobSeoSlug('emplois'), null, 'activité seule → null');
assertEqual(parseJobSeoSlug('emplois-paris'), null, 'ville inconnue → null');
assertEqual(parseJobSeoSlug('emplois-abidjan-bouake'), null, 'deux villes → null');
assertEqual(parseJobSeoSlug('blog'), null, 'slug hors grammaire → null');

// ---- 2. buildJobSeoSlug (aller-retour) ----
console.log('\n2. buildJobSeoSlug');
assertEqual(
  buildJobSeoSlug({ activity: 'emplois', citySlug: 'bouake', metierSlug: 'sante' }),
  'emplois-bouake-sante',
  'construction canonique',
);
const roundTrip = parseJobSeoSlug('stages-sante-bouake');
assert(roundTrip !== null && buildJobSeoSlug(roundTrip) === 'stages-bouake-sante', 'round-trip canonique');

// ---- 3. filterOffersForSeo — activité ----
console.log('\n3. filterOffersForSeo — activité');
const mixed: SeoOfferLike[] = [
  createOffer({ id: 'j1', category: 'job', title: 'Développeur', location: 'Abidjan' }),
  createOffer({ id: 'i1', category: 'internship', title: 'Stagiaire développeur', location: 'Abidjan' }),
  createOffer({ id: 's1', category: 'scholarship', title: 'Bourse', location: 'Abidjan' }),
];
const emploisParsed = parseJobSeoSlug('emplois-informatique-abidjan')!;
const stagesParsed = parseJobSeoSlug('stages-informatique-abidjan')!;
assertEqual(
  filterOffersForSeo(mixed, emploisParsed).map((o) => o.id),
  ['j1'],
  'emplois exclut stages et bourses',
);
assertEqual(
  filterOffersForSeo(mixed, stagesParsed).map((o) => o.id),
  ['i1'],
  'stages ne garde que internship',
);

// ---- 4. filterOffersForSeo — ville + métier ----
console.log('\n4. filterOffersForSeo — ville / métier');
const jobs: SeoOfferLike[] = [
  createOffer({ id: 'a', title: 'Développeur React', location: 'Abidjan - Plateau' }),
  createOffer({ id: 'b', title: 'Comptable senior', location: 'Abidjan - Cocody' }),
  createOffer({ id: 'c', title: 'Développeur', location: 'Bouaké' }),
  createOffer({ id: 'd', title: 'Infirmier', location: 'Bouaké' }),
];
assertEqual(
  filterOffersForSeo(jobs, parseJobSeoSlug('emplois-informatique')!).map((o) => o.id),
  ['a', 'c'],
  'métier informatique uniquement',
);
assertEqual(
  filterOffersForSeo(jobs, parseJobSeoSlug('emplois-abidjan')!).map((o) => o.id),
  ['a', 'b'],
  'ville Abidjan uniquement',
);
assertEqual(
  filterOffersForSeo(jobs, parseJobSeoSlug('emplois-informatique-abidjan')!).map((o) => o.id),
  ['a'],
  'combinaison informatique + Abidjan',
);
assertEqual(
  filterOffersForSeo(jobs, parseJobSeoSlug('emplois-comptabilite-finance-abidjan')!).map((o) => o.id),
  ['b'],
  'comptabilité + Abidjan',
);

// ---- 5. minOffersFor ----
console.log('\n5. minOffersFor');
assertEqual(minOffersFor(parseJobSeoSlug('emplois-abidjan')!), MIN_OFFERS, 'page base → MIN_OFFERS');
assertEqual(
  minOffersFor(parseJobSeoSlug('emplois-informatique-abidjan')!),
  MIN_COMBO_OFFERS,
  'combinaison → MIN_COMBO_OFFERS',
);

// ---- 6. eligibleSeoLandings — seuils ----
console.log('\n6. eligibleSeoLandings — seuils anti-pages-vides');
const thin: SeoOfferLike[] = Array.from({ length: 3 }).map((_, i) =>
  createOffer({ id: `t${i}`, title: 'Développeur', location: 'Abidjan' }),
);
const thinSlugs = eligibleSeoLandings(thin).map((l) => l.slug);
assert(!thinSlugs.includes('emplois-abidjan'), 'moins de MIN_OFFERS → ville non éligible');
assert(!thinSlugs.includes('emplois-abidjan-informatique'), 'combinaison sous seuil non éligible');

const enough: SeoOfferLike[] = [
  ...Array.from({ length: 8 }).map((_, i) =>
    createOffer({ id: `e${i}`, title: 'Développeur', location: 'Abidjan' }),
  ),
  ...Array.from({ length: 2 }).map((_, i) =>
    createOffer({ id: `x${i}`, title: 'Infirmier', location: 'Bouaké' }),
  ),
];
const enoughSlugs = eligibleSeoLandings(enough).map((l) => l.slug);
assert(enoughSlugs.includes('emplois-abidjan'), 'ville ≥ seuil → éligible');
assert(enoughSlugs.includes('emplois-informatique'), 'métier ≥ seuil → éligible');
assert(enoughSlugs.includes('emplois-abidjan-informatique'), 'combinaison ≥ 8 → éligible');
assert(!enoughSlugs.includes('emplois-bouake'), 'Bouaké (2 offres) non éligible');

// ---- 7. seoLandingTitle ----
console.log('\n7. seoLandingTitle');
assertEqual(
  seoLandingTitle(parseJobSeoSlug('emplois-abidjan')!),
  "Offres d'emploi à Abidjan",
  'titre ville',
);
assertEqual(
  seoLandingTitle(parseJobSeoSlug('stages-informatique')!),
  "Offres de stage Informatique / Digital en Côte d'Ivoire",
  'titre métier (stages)',
);
assertEqual(
  seoLandingTitle(parseJobSeoSlug('emplois-informatique-abidjan')!),
  "Offres d'emploi Informatique / Digital à Abidjan",
  'titre combinaison',
);

// ---- 8. Robustesse ----
console.log('\n8. Robustesse');
try {
  const r = filterOffersForSeo([], parseJobSeoSlug('emplois-sante')!);
  assertEqual(r.length, 0, 'liste vide ne plante pas');
} catch (e) {
  assert(false, `Crash: ${e}`);
}

// ---- 9. Liens SEO depuis une offre / un article (§16 + §33) ----
console.log('\n9. resolve / landingForOffer / landingLinksForOffer');
assertEqual(resolveCity('Abidjan, Cocody')?.slug, 'abidjan', 'ville résolue depuis la localisation');
assertEqual(resolveCity(null), null, 'localisation absente → null');
assertEqual(resolveCity('Paris, France'), null, 'ville hors périmètre → null');
assertEqual(resolveMetier('it-digital')?.slug, 'informatique', 'métier résolu depuis sector');
assertEqual(resolveMetier(null), null, 'secteur absent → null');
assertEqual(resolveMetier('secteur-inconnu'), null, 'secteur inconnu → null');

const enoughForCity = Array.from({ length: MIN_OFFERS }, (_, i) =>
  createOffer({ id: `city${i}`, location: 'Abidjan' }),
);
assertEqual(
  landingForOffer(enoughForCity, { activity: 'emplois', citySlug: 'abidjan', metierSlug: null }),
  { slug: 'emplois-abidjan', href: '/emplois-abidjan', label: "Offres d'emploi à Abidjan" },
  'page ville éligible → lien',
);
assertEqual(
  landingForOffer(enoughForCity.slice(0, MIN_OFFERS - 1), {
    activity: 'emplois',
    citySlug: 'abidjan',
    metierSlug: null,
  }),
  null,
  'sous le seuil → pas de lien (jamais de page vide)',
);
assertEqual(
  landingForOffer([], { activity: 'emplois', citySlug: null, metierSlug: null }),
  null,
  'sans ville ni métier → null',
);

const comboVivier = Array.from({ length: MIN_COMBO_OFFERS }, (_, i) =>
  createOffer({ id: `cv${i}`, location: 'Abidjan', sector: 'it-digital' }),
);
const links = landingLinksForOffer(
  comboVivier,
  { ...createOffer({ id: 'job', location: 'Abidjan, Riviera', sector: 'it-digital' }), sector: 'it-digital' },
  'emplois',
);
assertEqual(links.city?.href, '/emplois-abidjan', 'lien ville');
assertEqual(links.metier?.href, '/emplois-informatique', 'lien métier');
assertEqual(links.combo?.href, '/emplois-abidjan-informatique', 'lien combinaison');

const fewCombo = comboVivier.slice(0, MIN_OFFERS);
const fewLinks = landingLinksForOffer(
  fewCombo,
  { ...createOffer({ id: 'job2', location: 'Abidjan', sector: 'it-digital' }), sector: 'it-digital' },
  'emplois',
);
assertEqual(fewLinks.city?.href, '/emplois-abidjan', 'ville toujours éligible à 5 offres');
assertEqual(fewLinks.metier?.href, '/emplois-informatique', 'métier toujours éligible à 5 offres');
assertEqual(fewLinks.combo, null, 'combinaison sous le seuil strict → null');

// ---- 10. landingChipHref — chips de maillage sans 404 (§12) ----
console.log('\n10. landingChipHref (chips villes/métiers)');
assertEqual(
  landingChipHref(enoughForCity, { activity: 'emplois', citySlug: 'abidjan', metierSlug: null }),
  '/emplois-abidjan',
  'ville éligible → page SEO',
);
assertEqual(
  landingChipHref(
    enoughForCity.slice(0, MIN_OFFERS - 1),
    { activity: 'emplois', citySlug: 'abidjan', metierSlug: null },
  ),
  '/jobs?city=Abidjan',
  'ville sous le seuil → recherche filtrée (jamais 404)',
);
assertEqual(
  landingChipHref(comboVivier, { activity: 'emplois', citySlug: null, metierSlug: 'informatique' }),
  '/emplois-informatique',
  'métier éligible → page SEO',
);
assertEqual(
  landingChipHref([], { activity: 'emplois', citySlug: null, metierSlug: 'informatique' }),
  '/jobs?q=d%C3%A9veloppeur',
  'métier sous le seuil → recherche par mot-clé',
);
assertEqual(
  landingChipHref([], { activity: 'stages', citySlug: 'bouake', metierSlug: null }),
  '/stages?city=Bouak%C3%A9',
  'activité stages → verticale /stages',
);

console.log('\n\n📊 Results:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log('\n❌ Failures:');
  failures.forEach((f) => console.log(`   - ${f}`));
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!\n');
  process.exit(0);
}
