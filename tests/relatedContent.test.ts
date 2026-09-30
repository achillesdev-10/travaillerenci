/**
 * Unit tests for the contextual content links (master prompt §16):
 * ARTICLE → OFFRE and OFFRE → ARTICLE.
 * Run with: npx tsx tests/relatedContent.test.ts
 */

import { articleSector, pickRelatedArticles } from '../src/lib/relatedContent';

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

console.log('\n🧪 Running relatedContent tests...\n');

const ARTICLES = [
  { id: '1', title: 'Devenir développeur web en Côte d\'Ivoire', excerpt: 'Le métier de développeur', tags: 'informatique, developpement' },
  { id: '2', title: 'Bien gérer sa paie', excerpt: 'Comptabilité et salaire', tags: 'comptabilite' },
  { id: '3', title: 'Réussir un entretien embauche', excerpt: 'Conseils RH et recrutement', tags: 'emploi, cv' },
  { id: '4', title: 'Comment trouver un emploi sans expérience ?', excerpt: 'Premier emploi, débutants', tags: '' },
];

// ---- 1. articleSector ----
console.log('\n1. articleSector');
assertEqual(articleSector(ARTICLES[0]), 'it-digital', 'article dev → secteur informatique');
assertEqual(articleSector(ARTICLES[1]), 'rh', 'article paie → secteur RH (dictionnaire de mots-clés)');
assert(articleSector(ARTICLES[3]) !== undefined, 'article sans étiquettes ne plante pas');
assertEqual(
  articleSector({ title: '', excerpt: null, tags: null }),
  null,
  'article vide → null',
);

// ---- 2. pickRelatedArticles ----
console.log('\n2. pickRelatedArticles');
const related = pickRelatedArticles(ARTICLES, 'it-digital', 2);
assertEqual(related.map((a) => a.id), ['1'], 'un seul article pertinent pour informatique');
assertEqual(pickRelatedArticles(ARTICLES, null, 2), [], 'secteur null → aucune sélection');
assertEqual(pickRelatedArticles(ARTICLES, 'secteur-inconnu', 2), [], 'secteur inconnu → vide');
assertEqual(pickRelatedArticles(ARTICLES, 'it-digital', 0), [], 'limit 0 → vide');
assertEqual(
  pickRelatedArticles(ARTICLES, 'it-digital', 2),
  related,
  'sélection déterministe',
);
assertEqual(
  pickRelatedArticles([...ARTICLES].reverse(), 'it-digital', 2).map((a) => a.id),
  ['1'],
  'ordre d’entrée préservé (filtre stable)',
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
