/**
 * Unit tests for the « offres à ne pas manquer » selection (master prompt §35)
 * and the « offres du jour » filter (§34).
 * Run with: npx tsx tests/mustSee.test.ts
 */

import {
  DAY_MS,
  filterRecentOffers,
  isMustSeeEligible,
  mustSeeReasons,
  mustSeeScore,
  pickMustSeeOffers,
} from '../src/lib/mustSee';

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

const NOW = new Date('2026-09-30T12:00:00.000Z');
const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * DAY_MS).toISOString();

const OFFERS = {
  todayPopular: {
    id: 'a',
    status: 'published',
    created_at: iso(-0.2),
    deadline: null,
    clicks_count: 120,
  },
  todayNew: { id: 'b', status: 'published', created_at: iso(-0.1), deadline: null, clicks_count: 0 },
  deadlineSoon: {
    id: 'c',
    status: 'published',
    created_at: iso(-5),
    deadline: iso(2),
    clicks_count: 5,
  },
  oldQuiet: {
    id: 'd',
    status: 'published',
    created_at: iso(-60),
    deadline: null,
    clicks_count: 0,
  },
  expired: {
    id: 'e',
    status: 'published',
    created_at: iso(-1),
    deadline: iso(-1),
    clicks_count: 50,
  },
  archived: {
    id: 'f',
    status: 'published',
    created_at: iso(-1),
    deadline: null,
    clicks_count: 50,
    is_archived: true,
  },
  draft: { id: 'g', status: 'draft', created_at: iso(-1), deadline: null, clicks_count: 99 },
  markedExpired: {
    id: 'h',
    status: 'published',
    created_at: iso(-2),
    deadline: null,
    clicks_count: 99,
    is_expired: true,
  },
  yesterdayOld: {
    id: 'i',
    status: 'published',
    created_at: iso(-1.25),
    deadline: null,
    clicks_count: 3,
  },
};

console.log('\n🧪 Running mustSee tests...\n');

// ---- 1. Éligibilité ----
console.log('\n1. Éligibilité');
assert(isMustSeeEligible(OFFERS.todayPopular, NOW), 'offre du jour éligible');
assert(isMustSeeEligible(OFFERS.oldQuiet, NOW), 'offre ancienne mais active éligible');
assert(!isMustSeeEligible(OFFERS.expired, NOW), 'deadline passée exclue');
assert(!isMustSeeEligible(OFFERS.archived, NOW), 'archivée exclue');
assert(!isMustSeeEligible(OFFERS.draft, NOW), 'brouillon exclu');
assert(!isMustSeeEligible(OFFERS.markedExpired, NOW), 'marquée expirée exclue');
assert(!isMustSeeEligible({ id: 'x', created_at: null }, NOW), 'sans date de publication exclue');

// ---- 2. Score ----
console.log('\n2. Score');
assert(
  mustSeeScore(OFFERS.todayPopular, NOW) > mustSeeScore(OFFERS.oldQuiet, NOW),
  'récente + populaire > ancienne + silencieuse',
);
assert(
  mustSeeScore(OFFERS.deadlineSoon, NOW) > mustSeeScore(OFFERS.oldQuiet, NOW),
  'deadline proche > ancienne',
);
assertEqual(
  mustSeeScore(OFFERS.todayNew, NOW),
  mustSeeScore(OFFERS.todayNew, NOW),
  'score déterministe',
);

// ---- 3. Raisons (badges) ----
console.log('\n3. Raisons');
assert(mustSeeReasons(OFFERS.todayPopular, NOW).includes('populaire'), 'badge populaire');
assert(mustSeeReasons(OFFERS.todayNew, NOW).includes('recente'), 'badge nouvelle');
assert(mustSeeReasons(OFFERS.deadlineSoon, NOW).includes('deadline'), 'badge clôture bientôt');
assertEqual(mustSeeReasons(OFFERS.oldQuiet, NOW), [], 'offre ancienne sans badge');

// ---- 4. Sélection ----
console.log('\n4. Sélection');
const picked = pickMustSeeOffers(Object.values(OFFERS), { now: NOW, limit: 8 });
assertEqual(
  picked.map((o) => o.id),
  ['a', 'c', 'b', 'i', 'd'],
  'classement = éligibles uniquement, du plus prioritaire au moins',
);
assertEqual(pickMustSeeOffers(Object.values(OFFERS), { now: NOW, limit: 2 }).length, 2, 'limit respectée');
assertEqual(pickMustSeeOffers([], { now: NOW }), [], 'liste vide → vide');
assertEqual(
  pickMustSeeOffers(Object.values(OFFERS), { now: NOW, limit: 8 }),
  picked,
  'sélection stable entre deux appels',
);

// ---- 5. Offres du jour ----
console.log('\n5. Offres du jour');
const today = filterRecentOffers(Object.values(OFFERS), 24, NOW);
assertEqual(today.map((o) => o.id), ['b', 'a'], '24 h : offres publiées aujourd’hui');
const twoDays = filterRecentOffers(Object.values(OFFERS), 48, NOW);
assertEqual(
  twoDays.map((o) => o.id),
  ['b', 'a', 'i'],
  '48 h : fenêtre élargie, hors archivées / brouillons / deadline passée',
);
assertEqual(filterRecentOffers(Object.values(OFFERS), 24, NOW), today, 'filtre déterministe');

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
