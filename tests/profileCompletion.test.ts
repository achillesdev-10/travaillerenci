/**
 * Unit tests for the candidate profile completion calculator.
 * Run with: npx tsx tests/profileCompletion.test.ts
 */

import { computeProfileCompletion } from '../src/lib/profileCompletion';

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
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${testName}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

console.log('\n🧪 Running profileCompletion tests...\n');

// ---- 1. Vide ----
console.log('\n1. Profil vide');
const empty = computeProfileCompletion({});
assertEqual(empty.percent, 0, 'vide → 0%');
assertEqual(empty.done, 0, 'aucun critère');
assert(empty.total >= 10, 'au moins 10 critères suivis');
assertEqual(empty.missingLabels.length, empty.total, 'tous manquants');

// ---- 2. Complet ----
console.log('\n2. Profil complet');
const full = computeProfileCompletion({
  email: 'a@b.ci',
  city: 'Abidjan',
  jobTitle: 'Développeur',
  sectors: ['it-digital'],
  diploma: 'master',
  experienceLevel: 'Senior',
  skills: ['React'],
  contractTypes: ['CDI'],
  phone: '2250700000000',
  bio: 'Présentation',
  resumeUrl: 'https://exemple.ci/cv.pdf',
});
assertEqual(full.percent, 100, 'tous les champs → 100%');
assertEqual(full.done, full.total, 'tous satisfaits');
assertEqual(full.missingLabels.length, 0, 'aucun manquant');

// ---- 3. Partiel ----
console.log('\n3. Cas partiel (exemple du cahier des charges)');
const partial = computeProfileCompletion({
  email: 'a@b.ci',
  city: 'Abidjan',
  jobTitle: 'Comptable',
  sectors: ['banque-finance'],
});
const expected = Math.round((4 / full.total) * 100);
assertEqual(partial.percent, expected, '4 critères sur le total');
assert(partial.missingLabels.includes('CV (lien)'), 'CV listé comme manquant');
assert(!partial.missingLabels.includes('Ville'), 'Ville non manquante');

// ---- 4. Valeurs vides / espaces ----
console.log('\n4. Valeurs vides');
assertEqual(
  computeProfileCompletion({ email: '   ', city: null, skills: [] }).done,
  0,
  'espaces seuls et tableaux vides → non satisfaits',
);

// ---- 5. Format de sortie ----
console.log('\n5. Structure de sortie');
const res = computeProfileCompletion({ city: 'Abidjan' });
assert(Array.isArray(res.items), 'items est un tableau');
assert(res.items.every((i) => typeof i.key === 'string' && typeof i.label === 'string' && typeof i.done === 'boolean'), 'items bien formés');
assert(res.percent >= 0 && res.percent <= 100, 'pourcentage borné');

// ---- 6. Robustesse ----
console.log('\n6. Robustesse');
try {
  assertEqual(computeProfileCompletion(null).percent, 0, 'null → 0%');
} catch (e) {
  assert(false, `Crash sur null: ${e}`);
}

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
