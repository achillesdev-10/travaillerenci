/**
 * Unit tests for the share UTM helper (master prompt §21).
 * Run with: npx tsx tests/shareUtm.test.ts
 */

import { buildShareUrl, normalizeCampaign, SHARE_UTM_SOURCE, SHARE_UTM_MEDIUM } from '../src/lib/shareUtm';

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

console.log('\n🧪 Running shareUtm tests...\n');

const ORIGIN = 'https://travaillerenci.vercel.app';

// ---- 1. Ajout des paramètres UTM ----
console.log('\n1. Ajout des paramètres UTM');
const tagged = buildShareUrl(`${ORIGIN}/jobs/123`, 'offre', ORIGIN);
assert(tagged.includes(`utm_source=${SHARE_UTM_SOURCE}`), 'utm_source présent');
assert(tagged.includes(`utm_medium=${SHARE_UTM_MEDIUM}`), 'utm_medium présent');
assert(tagged.includes('utm_campaign=offre'), 'utm_campaign = offre');
assert(tagged.startsWith(`${ORIGIN}/jobs/123?`), 'URL de base préservée');

// ---- 2. Idempotence ----
console.log('\n2. Idempotence');
assertEqual(buildShareUrl(tagged, 'autre-campagne', ORIGIN), tagged, 'URL déjà taguée inchangée');

// ---- 3. URLs relatives ----
console.log('\n3. URLs relatives');
const relative = buildShareUrl('/blog/mon-article', 'article-blog', ORIGIN);
assert(relative.startsWith(`${ORIGIN}/blog/mon-article?`), 'URL relative résolue contre la base');
assert(relative.includes('utm_campaign=article-blog'), 'campagne sur URL relative');

// ---- 4. URLs externes non taguées ----
console.log('\n4. URLs externes');
const external = 'https://example.com/page';
assertEqual(buildShareUrl(external, 'offre', ORIGIN), external, 'URL externe inchangée');

// ---- 5. Sans base ----
console.log('\n5. Sans base de comparaison');
const noBase = buildShareUrl(`${ORIGIN}/jobs/1`, 'offre');
assert(noBase.includes('utm_source='), 'URL absolue taguée sans base');

// ---- 6. Normalisation de campagne ----
console.log('\n6. Normalisation de campagne');
assertEqual(normalizeCampaign('Article Éducatif !!'), 'article-educatif', 'accents + ponctuation nettoyés');
assertEqual(normalizeCampaign('---'), '', 'casse vide → chaîne vide');
assert(normalizeCampaign('x'.repeat(80)).length <= 40, 'longueur bornée à 40');

// ---- 7. Champs vides / invalides ----
console.log('\n7. Robustesse');
assertEqual(buildShareUrl('', 'offre', ORIGIN), '', 'URL vide retournée telle quelle');
assert(
  buildShareUrl('not a url', 'offre', ORIGIN).includes('utm_source='),
  'entrée invalide retournée sans crash',
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
