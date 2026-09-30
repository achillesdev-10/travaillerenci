/**
 * Unit tests for the deterministic sector classifier.
 * Run with: npx tsx tests/sectorClassifier.test.ts
 */

import {
  VALID_SECTOR_SLUGS,
  classifyOffer,
  classifySector,
} from '../src/lib/sectorClassifier';

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

console.log('\n🧪 Running sectorClassifier tests...\n');

// ---- 1. Vocabulaire ----
console.log('\n1. VALID_SECTOR_SLUGS');
assert(VALID_SECTOR_SLUGS.size >= 16, 'au moins 16 secteurs');
assert(VALID_SECTOR_SLUGS.has('it-digital'), 'contient it-digital');
assert(VALID_SECTOR_SLUGS.has('sante'), 'contient sante');

// ---- 2. Classification titre ----
console.log('\n2. Classification par titre');
assertEqual(classifySector({ title: 'Développeur React' }), 'it-digital', 'Développeur → IT');
assertEqual(classifySector({ title: 'Comptable senior' }), 'banque-finance', 'Comptable → Finance');
assertEqual(classifySector({ title: 'Infirmier' }), 'sante', 'Infirmier → Santé');
assertEqual(
  classifySector({ title: 'Commercial terrain' }),
  'commerce-distribution',
  'Commercial → Commerce',
);
assertEqual(classifySector({ title: 'Chauffeur livreur' }), 'transport-logistique', 'Chauffeur → Transport');
assertEqual(classifySector({ title: 'Chef de chantier' }), 'btp-immobilier', 'Chantier → BTP');
assertEqual(classifySector({ title: 'Enseignant mathématiques' }), 'education-formation', 'Enseignant → Éducation');
assertEqual(classifySector({ title: 'Juriste' }), 'juridique', 'Juriste → Juridique');

// ---- 3. Accents / casse ----
console.log('\n3. Accents & casse');
assertEqual(classifySector({ title: 'DEVELOPPEUR WEB' }), 'it-digital', 'casse ignorée');
assertEqual(classifySector({ title: 'Développeur' }), 'it-digital', 'accents ignorés');

// ---- 4. Description seule ----
console.log('\n4. Description utilisée en repli');
assertEqual(
  classifySector({ title: 'Poste à pourvoir', description: 'Recherche un développeur full stack.' }),
  'it-digital',
  'description suffit si le titre est générique',
);

// ---- 5. Le titre pèse plus que la description ----
console.log('\n5. Pondération titre > description');
assertEqual(
  classifySector({ title: 'Développeur', description: 'Poste au sein du service audit.' }),
  'it-digital',
  'à volume de mots-clés comparable, le titre (poids double) l’emporte',
);

// ---- 6. Indéterminé ----
console.log('\n6. Indéterminé');
assertEqual(classifySector({ title: 'Test' }), null, 'titre neutre → null');
assertEqual(classifySector({ title: '', description: '' }), null, 'vide → null');
assertEqual(classifyOffer({ title: '' }).score, 0, 'score 0 sans correspondance');

// ---- 7. Score de confiance ----
console.log('\n7. Score de confiance');
const multi = classifyOffer({ title: 'Développeur React Node.js DevOps' });
assert(multi.score >= 4, 'plusieurs mots-clés IT → score élevé');
const single = classifyOffer({ title: 'Infirmier' });
assert(single.score >= 2, 'un mot-clé dans le titre → score ≥ 2 (poids double)');

// ---- 8. Robustesse ----
console.log('\n8. Robustesse');
try {
  const r = classifySector({ title: 'ok', description: null });
  assert(r === null || typeof r === 'string', 'ne plante pas avec description null');
} catch (e) {
  assert(false, `Crash: ${e}`);
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
