/**
 * Unit tests for the profile visibility consent helper (master prompt §30).
 * Run with: npx tsx tests/profileVisibility.test.ts
 */

import {
  DEFAULT_PROFILE_VISIBILITY,
  PROFILE_VISIBILITY_LABELS,
  PROFILE_VISIBILITY_VALUES,
  isProfileVisibility,
  isRecruiterVisible,
  normalizeProfileVisibility,
} from '../src/lib/profileVisibility';

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
    `${testName} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

// ── Valeurs acceptées ────────────────────────────────────────────────────────
assertEqual(
  [...PROFILE_VISIBILITY_VALUES],
  ['private', 'recruiters'],
  'PROFILE_VISIBILITY_VALUES',
);
assertEqual(DEFAULT_PROFILE_VISIBILITY, 'private', 'DEFAULT_PROFILE_VISIBILITY');
assertEqual(isProfileVisibility('private'), true, 'isProfileVisibility private');
assertEqual(isProfileVisibility('recruiters'), true, 'isProfileVisibility recruiters');
assertEqual(isProfileVisibility('public'), false, 'isProfileVisibility inconnu');
assertEqual(isProfileVisibility(null), false, 'isProfileVisibility null');
assertEqual(isProfileVisibility(undefined), false, 'isProfileVisibility undefined');
assertEqual(isProfileVisibility(42), false, 'isProfileVisibility number');

// ── Règle de sécurité : toute valeur inconnue retombe sur « privé » ─────────
assertEqual(normalizeProfileVisibility('recruiters'), 'recruiters', 'normalize recruiters');
assertEqual(normalizeProfileVisibility('private'), 'private', 'normalize private');
assertEqual(normalizeProfileVisibility('public'), 'private', 'normalize valeur inconnue → private');
assertEqual(normalizeProfileVisibility(''), 'private', 'normalize chaîne vide → private');
assertEqual(normalizeProfileVisibility(null), 'private', 'normalize null → private');
assertEqual(normalizeProfileVisibility(undefined), 'private', 'normalize undefined → private');
assertEqual(normalizeProfileVisibility({}), 'private', 'normalize objet → private');
assertEqual(normalizeProfileVisibility(1), 'private', 'normalize nombre → private');

// ── Consentement explicite requis pour être visible ──────────────────────────
assertEqual(isRecruiterVisible('recruiters'), true, 'isRecruiterVisible oui');
assertEqual(isRecruiterVisible('private'), false, 'isRecruiterVisible non');
assertEqual(isRecruiterVisible(null), false, 'isRecruiterVisible null (défaut privé)');
assertEqual(isRecruiterVisible(undefined), false, 'isRecruiterVisible undefined (défaut privé)');
assertEqual(isRecruiterVisible('anything-else'), false, 'isRecruiterVisible valeur inconnue');

// ── Libellés UI ──────────────────────────────────────────────────────────────
for (const value of PROFILE_VISIBILITY_VALUES) {
  assert(
    typeof PROFILE_VISIBILITY_LABELS[value] === 'string' && PROFILE_VISIBILITY_LABELS[value].length > 0,
    `PROFILE_VISIBILITY_LABELS manquant pour ${value}`,
  );
}
assertEqual(PROFILE_VISIBILITY_LABELS.private, 'Profil privé', 'label private');

// ── Bilan ────────────────────────────────────────────────────────────────────
process.stdout.write('\n');
if (failed > 0) {
  console.error(`${failed} test(s) failed, ${passed} passed.`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`All ${passed} tests passed.`);
