/**
 * Unit tests for the analytics event catalogue.
 * Run with: npx tsx tests/analyticsEvents.test.ts
 */

import {
  ANALYTICS_EVENTS,
  ONCE_PER_USER_EVENTS,
  PROFILE_COMPLETE_THRESHOLD,
  isAnalyticsEvent,
} from '../src/lib/analyticsEvents';

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

console.log('\n🧪 Running analyticsEvents tests...\n');

// ---- 1. Événements demandés (§22) ----
console.log('\n1. Événements du cahier des charges');
const REQUIRED = [
  'job_view',
  'job_save',
  'signup',
  'profile_complete',
  'cv_upload',
  'alert_create',
  'application_click',
];
for (const name of REQUIRED) {
  assert(isAnalyticsEvent(name), `événement requis présent : ${name}`);
}
assertEqual(REQUIRED.every(isAnalyticsEvent), true, 'tous les événements requis existent');

// ---- 2. Validation ----
console.log('\n2. isAnalyticsEvent');
assertEqual(isAnalyticsEvent('signup'), true, 'signup valide');
assertEqual(isAnalyticsEvent('evil_event'), false, 'événement inconnu refusé');
assertEqual(isAnalyticsEvent(123), false, 'non-string refusé');
assertEqual(isAnalyticsEvent(''), false, 'chaîne vide refusée');
assertEqual(isAnalyticsEvent(null), false, 'null refusé');

// ---- 3. Déduplication ----
console.log('\n3. Déduplication une fois par utilisateur');
assert(ONCE_PER_USER_EVENTS.has('signup'), 'signup enregistré une seule fois');
assert(ONCE_PER_USER_EVENTS.has('profile_complete'), 'profile_complete enregistré une seule fois');
assert(!ONCE_PER_USER_EVENTS.has('job_view'), 'job_view répétable');
assert(!ONCE_PER_USER_EVENTS.has('job_save'), 'job_save répétable');
assert(!ONCE_PER_USER_EVENTS.has('application_click'), 'application_click répétable');

// ---- 4. Seuil ----
console.log('\n4. Seuil de complétion');
assert(
  PROFILE_COMPLETE_THRESHOLD > 0 && PROFILE_COMPLETE_THRESHOLD <= 100,
  'seuil borné 1..100',
);
assertEqual(PROFILE_COMPLETE_THRESHOLD, 70, 'seuil de complétion = 70%');

// ---- 5. Catalogue ----
console.log('\n5. Catalogue');
assert(ANALYTICS_EVENTS.length >= REQUIRED.length, 'catalogue ≥ événements requis');
assertEqual(new Set(ANALYTICS_EVENTS).size, ANALYTICS_EVENTS.length, 'pas de doublon de nom');
assert([...ONCE_PER_USER_EVENTS].every((e) => (ANALYTICS_EVENTS as readonly string[]).includes(e)), 'every ONCE event is a known event');

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
