/**
 * Unit tests for the deterministic recommendation scoring engine.
 * Run with: npx tsx tests/recommendationScoring.test.ts
 */

import {
  DIPLOMA_KEYWORDS,
  RECOMMENDATION_WEIGHTS,
  SECTOR_KEYWORDS,
  hasProfileSignals,
  matchesCity,
  matchesKeyword,
  normalizeText,
  rankJobs,
  scoreJob,
  type ScorableJob,
} from '../src/lib/recommendationScoring';

// ---------------------------------------------------------------------------
//  Test helpers (même convention que tests/jobThumbnails.test.ts)
// ---------------------------------------------------------------------------
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
  const pass = actual === expected;
  assert(pass, `${testName}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function createJob(overrides: Partial<ScorableJob> = {}): ScorableJob {
  return {
    id: 'job-1',
    title: 'Test Job',
    description: 'Description de test',
    location: 'Abidjan',
    contract_type: 'CDI',
    is_verified: false,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const NOW = new Date('2024-01-10T00:00:00Z');

// ---------------------------------------------------------------------------
//  Suite
// ---------------------------------------------------------------------------
console.log('\n🧪 Running recommendationScoring tests...\n');

// ---- 1. normalizeText ----
console.log('\n1. normalizeText');
assertEqual(normalizeText('Développeur Full-Stack'), 'developpeur full stack', 'Accents + ponctuation');
assertEqual(normalizeText('  Abidjan   –   Plateau '), 'abidjan plateau', 'Espaces condensés');
assertEqual(normalizeText(null), '', 'null → chaîne vide');

// ---- 2. matchesKeyword (frontière de mot) ----
console.log('\n2. matchesKeyword');
assert(matchesKeyword('developpeur full stack', 'developpeur'), '"developpeur" matche "developpeur full stack"');
assert(matchesKeyword('developpeurs web', 'developpeur'), '"developpeur" matche le pluriel');
assert(!matchesKeyword('developpeur full stack', 'veloppeur'), 'pas de correspondance en milieu de mot');
assert(!matchesKeyword('', 'data'), 'chaîne vide → false');

// ---- 3. matchesCity ----
console.log('\n3. matchesCity');
assert(matchesCity('Abidjan - Plateau', 'Abidjan'), 'Abidjan dans "Abidjan - Plateau"');
assert(matchesCity('abidjan', 'ABIDJAN'), 'insensible à la casse');
assert(!matchesCity('Bouaké', 'Abidjan'), 'villes différentes');
assert(!matchesCity(null, 'Abidjan'), 'localisation null');

// ---- 4. hasProfileSignals ----
console.log('\n4. hasProfileSignals');
assert(!hasProfileSignals(null), 'null → false');
assert(!hasProfileSignals({}), 'objet vide → false');
assert(hasProfileSignals({ city: 'Abidjan' }), 'ville renseignée → true');
assert(hasProfileSignals({ sectors: ['it-digital'] }), 'secteur renseigné → true');

// ---- 5. scoreJob — secteur ----
console.log('\n5. scoreJob — correspondance secteur');
const devJob = createJob({
  title: 'Développeur React',
  description: 'Nous recherchons un développeur.',
  created_at: '2023-01-01T00:00:00Z',
});
const sectorScore = scoreJob({ sectors: ['it-digital'] }, devJob, NOW);
assertEqual(sectorScore.score, RECOMMENDATION_WEIGHTS.sector, 'IT seul → +40');
assertEqual(sectorScore.matchedSector, 'it-digital', 'secteur identifié');
assert(sectorScore.reasons.some((r) => r.includes('Informatique')), 'raison secteur présente');

// mauvais secteur → pas de bonus
const noMatch = scoreJob({ sectors: ['sante'] }, devJob, NOW);
assertEqual(noMatch.score, 0, 'secteur non correspondant → 0');
assertEqual(noMatch.reasons.length, 0, 'aucune raison');

// ---- 6. scoreJob — ville ----
console.log('\n6. scoreJob — ville');
const cityScore = scoreJob({ city: 'Abidjan' }, createJob({ created_at: '2023-01-01T00:00:00Z' }), NOW);
assertEqual(cityScore.score, RECOMMENDATION_WEIGHTS.city, 'ville seule → +25');
assert(cityScore.reasons.includes('Dans votre ville'), 'raison ville');

// ---- 7. scoreJob — diplôme ----
console.log('\n7. scoreJob — diplôme');
const masterJob = createJob({
  title: 'Stage',
  description: 'Stage de fin d’études Bac+5 / Master',
  created_at: '2023-01-01T00:00:00Z',
});
const diplomaScore = scoreJob({ diploma: 'master' }, masterJob, NOW);
assertEqual(diplomaScore.score, RECOMMENDATION_WEIGHTS.diploma, 'master seul → +10');
assert(DIPLOMA_KEYWORDS.master.includes('master'), 'dictionnaire diplôme master non vide');

// ---- 8. scoreJob — fraîcheur + vérifié ----
console.log('\n8. scoreJob — fraîcheur & vérification');
const freshJob = createJob({ created_at: '2024-01-08T00:00:00Z' }); // 2 jours
assertEqual(scoreJob({}, freshJob, NOW).score, RECOMMENDATION_WEIGHTS.fresh7d, 'offre ≤ 7j → +8');

const monthJob = createJob({ created_at: '2023-12-25T00:00:00Z' }); // 16 jours
assertEqual(scoreJob({}, monthJob, NOW).score, RECOMMENDATION_WEIGHTS.fresh30d, 'offre ≤ 30j → +4');

const verifiedJob = createJob({ created_at: '2023-01-01T00:00:00Z', is_verified: true });
assertEqual(scoreJob({}, verifiedJob, NOW).score, RECOMMENDATION_WEIGHTS.verified, 'vérifiée → +3');

// ---- 9. scoreJob — cumul des signaux ----
console.log('\n9. scoreJob — cumul');
const fullJob = createJob({
  title: 'Développeur Full Stack',
  description: 'Bac+5 apprécié',
  location: 'Abidjan - Cocody',
  is_verified: true,
  created_at: '2024-01-09T00:00:00Z',
});
const fullScore = scoreJob(
  { city: 'Abidjan', diploma: 'master', sectors: ['it-digital'] },
  fullJob,
  NOW,
);
const expectedFull =
  RECOMMENDATION_WEIGHTS.sector +
  RECOMMENDATION_WEIGHTS.city +
  RECOMMENDATION_WEIGHTS.diploma +
  RECOMMENDATION_WEIGHTS.fresh7d +
  RECOMMENDATION_WEIGHTS.verified;
assertEqual(fullScore.score, expectedFull, 'cumul secteur+ville+diplôme+fraîcheur+vérifié');
assert(fullScore.reasons.length >= 4, 'plusieurs raisons remontées');

// ---- 10. rankJobs ----
console.log('\n10. rankJobs — tri et limite');
const medicalJob = createJob({
  id: 'job-sante',
  title: 'Infirmier',
  description: 'Soins',
  location: 'Bouaké',
  created_at: '2024-01-09T00:00:00Z',
});
const recentDevJob = createJob({
  id: 'job-dev',
  title: 'Développeur',
  description: 'Code',
  location: 'Abidjan',
  created_at: '2024-01-09T00:00:00Z',
});
const ranked = rankJobs({ sectors: ['it-digital'] }, [medicalJob, recentDevJob], undefined, NOW);
assertEqual(ranked[0].job.id, 'job-dev', 'offre du bon secteur en tête');
assert(ranked[0].score > ranked[1].score, 'score du 1er > score du 2e');

const limited = rankJobs({ sectors: ['it-digital'] }, [medicalJob, recentDevJob], 1, NOW);
assertEqual(limited.length, 1, 'limite respectée');

// départage à score égal → plus récent d'abord
const olderSameScore = createJob({ id: 'old', title: 'Développeur', created_at: '2023-01-01T00:00:00Z' });
const newerSameScore = createJob({ id: 'new', title: 'Développeur', created_at: '2024-01-05T00:00:00Z' });
const tieRanked = rankJobs({}, [olderSameScore, newerSameScore], undefined, NOW);
assertEqual(tieRanked[0].job.id, 'new', 'à score égal, le plus récent passe devant');

// ---- 11. Robustesse ----
console.log('\n11. Robustesse — données manquantes');
try {
  const r = scoreJob({}, createJob({ title: '', description: '', location: '', created_at: null }), NOW);
  assertEqual(r.score, 0, 'offre vide → score 0');
} catch (e) {
  assert(false, `Crash sur offre vide: ${e}`);
}

// ---- 12. Dictionnaires ----
console.log('\n12. Dictionnaires secteurs');
assert(Object.keys(SECTOR_KEYWORDS).length >= 16, 'au moins 16 secteurs couverts');
assert(
  Object.values(SECTOR_KEYWORDS).every((s) => s.label && s.keywords.length > 0),
  'chaque secteur a un label et des mots-clAcs',
);

// ---- 13. Compétences & expérience (section 10) ----
console.log('\n13. scoreJob - compétences & expérience');
const skillJob = createJob({
  title: 'Développeur React',
  description: 'Maîtrise de React et TypeScript exigée.',
  created_at: '2023-01-01T00:00:00Z',
});
const skillScore = scoreJob({ skills: ['React', 'Node.js'] }, skillJob, NOW);
assertEqual(skillScore.score, RECOMMENDATION_WEIGHTS.skills, 'une compétence suffit → +20');
assert(
  skillScore.reasons.some((r) => r.includes('React')),
  'raison compétence listée',
);
assertEqual(
  scoreJob({ skills: ['Comptabilité'] }, skillJob, NOW).score,
  0,
  "compétence absente de l'offre → 0",
);
assertEqual(
  scoreJob({ skills: [] }, skillJob, NOW).score,
  0,
  'liste de compétences vide → 0',
);

const seniorJob = createJob({
  title: 'Chef de projet informatique',
  description: "Profil senior confirmé, 5 ans d'expérience minimum.",
  created_at: '2023-01-01T00:00:00Z',
});
const expScore = scoreJob({ experienceLevel: 'Senior' }, seniorJob, NOW);
assertEqual(expScore.score, RECOMMENDATION_WEIGHTS.experience, 'niveau senior mentionné → +10');
assertEqual(
  scoreJob({ experienceLevel: 'Junior' }, seniorJob, NOW).score,
  0,
  'niveau non demandé → 0',
);
assertEqual(
  scoreJob({ experienceLevel: null }, seniorJob, NOW).score,
  0,
  'aucun niveau de profil → 0',
);
assert(
  scoreJob({ experienceLevel: 'Senior' }, skillJob, NOW).score === 0,
  'offre sans mention de niveau → 0',
);

assert(hasProfileSignals({ skills: ['React'] }), 'compétences seules = signal de profil');
assert(hasProfileSignals({ experienceLevel: 'Senior' }), 'expérience seule = signal de profil');

// ---------------------------------------------------------------------------
//  Résultats
// ---------------------------------------------------------------------------
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
